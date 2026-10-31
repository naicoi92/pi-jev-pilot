import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PiFixture, root } from "./fixtures/pi-cli.ts";

/**
 * Jev is the first decision gate for a subagent's model and effort, however the launch
 * is requested. Every method below must produce one Jev classification per child and the
 * child must run at the effort Jev chose (`low`), never at the agent-file default (`high`).
 *
 * Deliberate exceptions, decided by the operator: `context:"fork"` keeps the agent's own
 * model and effort, and `resume` continues under the pair committed at the first launch.
 */
type Input = Record<string, unknown>;
const methods: {
  name: string;
  children: number;
  background: boolean[];
  input(bg: boolean): Input;
}[] = [
  {
    name: "single",
    children: 1,
    background: [false, true],
    input: (async) => ({
      agent: "repro",
      task: "Only task",
      async,
      options: { acceptance: false },
    }),
  },
  {
    name: "workflow-script-sequence",
    children: 2,
    background: [false, true],
    input: (async) => ({
      options: {
        acceptance: false,
        script:
          'const a = await runs.run("one", { agent: "repro", task: "First step" });\n' +
          'const b = await runs.run("two", { agent: "repro", task: "Second step " + a.output });\n' +
          "return [a.output, b.output];",
      },
      async,
    }),
  },
  {
    name: "workflow-script-all",
    children: 2,
    background: [false, true],
    input: (async) => ({
      options: {
        acceptance: false,
        script:
          'const r = await runs.all([{ key: "x", agent: "repro", task: "Task X" }, { key: "y", agent: "repro", task: "Task Y" }]);\n' +
          "return r.map((c) => c.output);",
      },
      async,
    }),
  },
  {
    name: "workflow-parallel",
    children: 2,
    background: [false, true],
    input: (async) => ({
      workflow: "parallel",
      args: {
        tasks: [
          { agent: "repro", task: "First distinct task" },
          { agent: "repro", task: "Second distinct task" },
        ],
      },
      async,
      options: { acceptance: false },
    }),
  },
  {
    name: "workflow-review",
    children: 1,
    background: [false],
    input: (async) => ({
      workflow: "review",
      args: { task: "Review task" },
      async,
      options: { acceptance: false },
    }),
  },
];

for (const method of methods)
  for (const background of method.background)
    test(`GATE-${method.name}: every child is decided by Jev (async=${background})`, async () => {
      const cli = join(root, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
      const executor = join(root, "node_modules/pi-subagents/index.ts");
      const fixture = new PiFixture([
        process.execPath,
        "run",
        cli,
        "--no-extensions",
        "-e",
        executor,
        "-e",
        join(root, "src/extension.ts"),
        "--mode",
        "rpc",
        "--no-mcp",
        "--no-skills",
        "--no-context-files",
        "--no-prompt-templates",
        "--no-themes",
        "--offline",
        "--no-approve",
        "--model",
        "fixture/fixture-model",
        "--thinking",
        "high",
      ]);
      fixture.skipPackageInstall = true;
      fixture.settings = { subagents: { intercomBridge: { mode: "off" } } };
      fixture.jevConfig = {
        workerRoutingEnabled: true,
        effortEnabled: false,
        skillsEnabled: false,
        strategyEnabled: false,
        qualityEnabled: false,
        designEnabled: false,
        tiers: { deep: "fixture-deep/judgment" },
      };
      fixture.response = {
        answers: {
          tier: { choice: "deep", confidence: 1 },
          effort: { choice: "low", confidence: 1 },
          risky: { noul: 0 },
        },
      };
      fixture.prepare = async (_directory, agent) => {
        await mkdir(join(agent, "agents"), { recursive: true });
        const body = "Return a short answer.\n";
        const head =
          "description: Local deterministic worker\nmodel: fixture/fixture-model\nthinking: high\ndefaultContext: fresh\ntools: read\n";
        await writeFile(join(agent, "agents/repro.md"), `---\nname: repro\n${head}---\n${body}`);
        await writeFile(
          join(agent, "agents/reviewer.md"),
          `---\nname: reviewer\n${head}---\n${body}`,
        );
      };
      try {
        await fixture.start();
        fixture.toolCalls.push({ name: "subagent", input: method.input(background) });
        await fixture.prompt(`Run ${method.name}.`);
        const results = fixture.records.filter(
          (r) => r.type === "tool_execution_end" && r.toolName === "subagent",
        );
        expect(results, JSON.stringify(results)).toHaveLength(1);
        expect(results[0]!.isError, JSON.stringify(results[0]).slice(0, 1500)).toBe(false);
        if (background)
          await fixture
            .wait(
              () =>
                fixture.generations.filter((r) => r.model === "judgment").length >= method.children,
              25000,
            )
            .catch(() => undefined);
        const children = fixture.generations.filter((r) => r.model === "judgment");
        const seen = JSON.stringify(fixture.generations.map((r) => [r.model, r.reasoning_effort]));
        expect(fixture.classifications.length, `classifications; generations=${seen}`).toBe(
          method.children,
        );
        expect(children, seen).toHaveLength(method.children);
        expect(children.map((r) => r.reasoning_effort)).toEqual(Array(method.children).fill("low"));
      } finally {
        await fixture.close();
      }
    }, 45000);

test("GATE-resume: a resumed child keeps the pair Jev committed at launch (no second decision)", async () => {
  const cli = join(root, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
  const executor = join(root, "node_modules/pi-subagents/index.ts");
  const fixture = new PiFixture([
    process.execPath,
    "run",
    cli,
    "--no-extensions",
    "-e",
    executor,
    "-e",
    join(root, "src/extension.ts"),
    "--mode",
    "rpc",
    "--no-mcp",
    "--no-skills",
    "--no-context-files",
    "--no-prompt-templates",
    "--no-themes",
    "--offline",
    "--no-approve",
    "--model",
    "fixture/fixture-model",
    "--thinking",
    "high",
  ]);
  fixture.skipPackageInstall = true;
  fixture.settings = { subagents: { intercomBridge: { mode: "off" } } };
  fixture.jevConfig = {
    workerRoutingEnabled: true,
    effortEnabled: false,
    skillsEnabled: false,
    strategyEnabled: false,
    qualityEnabled: false,
    designEnabled: false,
    tiers: { deep: "fixture-deep/judgment" },
  };
  fixture.response = {
    answers: {
      tier: { choice: "deep", confidence: 1 },
      effort: { choice: "low", confidence: 1 },
      risky: { noul: 0 },
    },
  };
  fixture.prepare = async (_directory, agent) => {
    await mkdir(join(agent, "agents"), { recursive: true });
    await writeFile(
      join(agent, "agents/repro.md"),
      "---\nname: repro\ndescription: Local deterministic worker\nmodel: fixture/fixture-model\nthinking: high\ndefaultContext: fresh\ntools: read\n---\nReturn a short answer.\n",
    );
  };
  try {
    await fixture.start();
    fixture.toolCalls.push({
      name: "subagent",
      input: { agent: "repro", task: "First", async: true, options: { acceptance: false } },
    });
    await fixture.prompt("Launch.");
    await fixture.wait(
      () => fixture.generations.filter((r) => r.model === "judgment").length >= 1,
      25000,
    );
    const launch = fixture.records.find(
      (r) => r.type === "tool_execution_end" && r.toolName === "subagent",
    ) as { result?: { details?: { asyncId?: string } } } | undefined;
    const id = launch?.result?.details?.asyncId;
    expect(id, JSON.stringify(launch).slice(0, 800)).toBeString();
    await Bun.sleep(1500);
    fixture.toolCalls.push({
      name: "subagent",
      input: { action: "resume", id, message: "Again.", async: true },
    });
    await fixture.prompt("Resume.");
    await fixture.wait(
      () => fixture.generations.filter((r) => r.model === "judgment").length >= 2,
      25000,
    );
    const seen = JSON.stringify(fixture.generations.map((r) => [r.model, r.reasoning_effort]));
    expect(fixture.classifications.length, seen).toBe(1);
    expect(
      fixture.generations.filter((r) => r.model === "judgment").map((r) => r.reasoning_effort),
      seen,
    ).toEqual(["low", "low"]);
  } finally {
    await fixture.close();
  }
}, 60000);

test("EFFORT-READ: the stored worker plan row carries the classifier's numbers and no task text", async () => {
  const cli = join(root, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
  const executor = join(root, "node_modules/pi-subagents/index.ts");
  const fixture = new PiFixture([
    process.execPath,
    "run",
    cli,
    "--no-extensions",
    "-e",
    executor,
    "-e",
    join(root, "src/extension.ts"),
    "--mode",
    "rpc",
    "--no-mcp",
    "--no-skills",
    "--no-context-files",
    "--no-prompt-templates",
    "--no-themes",
    "--offline",
    "--no-approve",
    "--model",
    "fixture/fixture-model",
    "--thinking",
    "high",
  ]);
  fixture.skipPackageInstall = true;
  fixture.settings = { subagents: { intercomBridge: { mode: "off" } } };
  fixture.jevConfig = {
    workerRoutingEnabled: true,
    effortEnabled: false,
    skillsEnabled: false,
    strategyEnabled: false,
    qualityEnabled: false,
    designEnabled: false,
    tiers: { deep: "fixture-deep/judgment" },
  };
  fixture.response = {
    answers: {
      tier: { choice: "deep", confidence: 1 },
      effort: {
        choice: "medium",
        confidence: 0.7,
        probabilities: { "0": 0.05, "1": 0.55, "2": 0.3, "3": 0.08, "4": 0.02 },
      },
      risky: { noul: 0.12 },
    },
  };
  fixture.prepare = async (_directory, agent) => {
    await mkdir(join(agent, "agents"), { recursive: true });
    await writeFile(
      join(agent, "agents/repro.md"),
      "---\nname: repro\ndescription: Local deterministic worker\nmodel: fixture/fixture-model\nthinking: high\ndefaultContext: fresh\ntools: read\n---\nReturn a short answer.\n",
    );
  };
  try {
    await fixture.start();
    fixture.toolCalls.push({
      name: "subagent",
      input: {
        agent: "repro",
        task: "PRIVATE_BRIEF_TEXT do the thing",
        async: false,
        options: { acceptance: false },
      },
    });
    await fixture.prompt("Run.");
    const entries = (
      (await fixture.command("get_entries")).data as {
        entries: { customType?: string; data?: Record<string, unknown> }[];
      }
    ).entries;
    const rows = entries
      .filter((e) => e.customType === "jev-pilot:decision:v1" && e.data?.kind === "worker")
      .map((e) => e.data!);
    const withRead = rows.filter((row) => row.effortRead !== undefined);
    expect(withRead.length, JSON.stringify(rows)).toBeGreaterThan(0);
    expect(withRead.at(-1)!.effortRead).toEqual({
      level: 1,
      confidence: 0.7,
      risky: 0.12,
      probabilities: [0.05, 0.55, 0.3, 0.08, 0.02],
    });
    expect(JSON.stringify(rows)).not.toContain("PRIVATE_BRIEF_TEXT");
  } finally {
    await fixture.close();
  }
}, 60000);
