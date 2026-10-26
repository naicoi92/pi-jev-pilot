import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PiFixture, root, type RecordData } from "./fixtures/pi-cli.ts";

// F1/F2: actual extension registration -> public tool -> native executor -> loopback provider.
async function launch(
  options: {
    junior?: boolean;
    effort?: string;
    status?: number;
    malformed?: boolean;
    resolved?: boolean;
    model?: string;
  } = {},
) {
  const cli =
    process.env.JEV_OWNER_CLI ??
    join(root, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
  const executor = process.env.JEV_OWNER_EXECUTOR ?? join(root, "node_modules/pi-subagents");
  const f = new PiFixture([
    ...(cli.endsWith(".js") ? [process.execPath, "run", cli] : [cli]),
    "--no-extensions",
    "-e",
    join(root, "tests/fixtures/worker-context.ts"),
    "-e",
    join(executor, "index.ts"),
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
  f.skipPackageInstall = true;
  f.settings = {
    jevPilot: {
      tiers: {
        fast: "fixture/fixture-model",
        balanced: "fixture/fixture-other-model",
        deep: "fixture-deep/judgment",
      },
    },
    subagents: { intercomBridge: { mode: "off" } },
  };
  f.status = options.status ?? 200;
  f.response = options.malformed
    ? { answers: { risky: { noul: 0 } } }
    : {
        answers: {
          effort: { choice: options.effort ?? "low", confidence: 0 },
          risky: { noul: 0 },
          tier: { choice: options.junior ? "deep" : "balanced", confidence: 0.45 },
        },
      };
  try {
    await f.start({
      JEV_EFFORT_ENABLED: "false",
      JEV_SKILLS_ENABLED: "false",
      JEV_WORKER_ROUTING_ENABLED: "true",
      JEV_TIMEOUT_MS: "5000",
      PI_SUBAGENTS_TEMP_ROOT: `/tmp/jctx-${crypto.randomUUID()}`,
    });
    // Public model registry metadata, refreshed before dispatch. No authority baseline injection.
    const modelsPath = join(f.directory, "agent/models.json");
    const models = JSON.parse(await readFile(modelsPath, "utf8"));
    models.providers.fixture.models[1].thinkingLevelMap = { low: "low", high: "high" };
    await writeFile(modelsPath, JSON.stringify(models));
    await f.command("prompt", { message: "/fixture-model-refresh" });
    await f.command("get_state");
    await writeFile(
      join(f.directory, "crew.json"),
      JSON.stringify({
        mode: "junior-lead",
        slots: [{ name: "local", model: "fixture/fixture-other-model" }],
        junior: "local",
      }),
    );
    await f.command("prompt", { message: "/fixture-crew" });
    await f.command("get_state");
    await mkdir(join(f.directory, "agent/agents"), { recursive: true });
    await writeFile(
      join(f.directory, "agent/agents/context-worker.md"),
      "---\nname: context-worker\ndescription: Local comparison worker\nmodel: fixture-deep/judgment\nthinking: high\ndefaultContext: fresh\ntools: read\n---\nReturn local result without tools.\n",
    );
    const input = {
      agent: options.junior ? "jev-pilot:junior" : "context-worker",
      task: "Return local result without tools.",
      async: false,
      ...(options.model ? { model: options.model } : {}),
      ...(options.resolved ? { model: "fixture/fixture-other-model:high" } : {}),
      options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
    };
    f.toolCalls.push({ name: "subagent", input });
    await f.prompt("Run local context fixture worker.");
    const terminal = f.records.find(
      (row) => row.type === "tool_execution_end" && row.toolName === "subagent",
    )!;
    const observed = {
      terminal,
      result: terminal?.result as RecordData | undefined,
      requests: f.generations,
      classifications: f.classifications,
      records: f.records,
    };
    if (process.env.JEV_OWNER_EVIDENCE) {
      await mkdir(process.env.JEV_OWNER_EVIDENCE, { recursive: true });
      await writeFile(
        join(process.env.JEV_OWNER_EVIDENCE, `context-${crypto.randomUUID()}.json`),
        JSON.stringify({ options, input, ...observed }, null, 2),
      );
    }
    return observed;
  } finally {
    await f.close();
  }
}

for (const model of [undefined, "inherit", "   "]) {
  test(`F2 native omitted or inherited caller ${JSON.stringify(model)} compares parent fast separately from default deep`, async () => {
    const observed = await launch({ model });
    expect(observed.terminal?.isError, JSON.stringify(observed.terminal)).toBe(false);
    expect(observed.result?.details).toMatchObject({
      mode: "single",
      results: [
        {
          model: "fixture/fixture-other-model:low",
          thinking: "low",
          exitCode: 0,
          usage: { turns: 1 },
        },
      ],
    });
    expect(observed.requests).toHaveLength(3);
    expect(observed.requests[1]).toMatchObject({
      model: "fixture-other-model",
      reasoning_effort: "low",
    });
    expect(observed.classifications).toHaveLength(1);
  }, 20000);
}

test("F2 native service failure retains deep executor original, not parent comparison", async () => {
  const observed = await launch({ status: 503 });
  expect(observed.terminal?.isError, JSON.stringify(observed.terminal)).toBe(false);
  expect(observed.result?.details).toMatchObject({
    results: [{ model: "fixture-deep/judgment:high", thinking: "high", exitCode: 0 }],
  });
  expect(observed.requests[1]).toMatchObject({ model: "judgment", reasoning_effort: "high" });
}, 20000);

for (const [effort, thinking] of [
  ["low", "low"],
  ["high", "high"],
  ["xhigh", "high"],
]) {
  test(`F1 actual registerCrewJunior missing effort assesses ${effort}, fixed model clamps ${thinking}`, async () => {
    const observed = await launch({ junior: true, effort });
    expect(observed.terminal?.isError, JSON.stringify(observed.terminal)).toBe(false);
    expect(observed.result?.details).toMatchObject({
      results: [
        {
          model: `fixture/fixture-other-model:${thinking}`,
          thinking,
          exitCode: 0,
          usage: { turns: 1 },
        },
      ],
    });
    expect(observed.requests).toHaveLength(3);
    expect(observed.requests[1]).toMatchObject({
      model: "fixture-other-model",
      reasoning_effort: thinking,
    });
    expect(observed.classifications).toHaveLength(1);
    const details = observed.result!.details as RecordData;
    const child = (details.results as RecordData[])[0]!;
    expect((child.launchResolvedExtensions as RecordData).required).toEqual([
      "jev-pilot-junior-turn-bound",
      "jev-pilot-child",
    ]);
    const assessment = observed.classifications[0]!;
    expect(JSON.stringify(assessment)).not.toContain("slot::local");
    expect(Object.keys(assessment.questions as RecordData).sort()).toEqual(["effort", "risky"]);
    expect(JSON.stringify(assessment.state)).not.toContain("comparison");
  }, 20000);
}

for (const control of [{ status: 503 }, { malformed: true }, { effort: "invalid" }]) {
  test(`F1 missing junior pair fails closed ${JSON.stringify(control)}`, async () => {
    const observed = await launch({ junior: true, ...control });
    expect(observed.terminal?.isError, JSON.stringify(observed.terminal)).toBe(true);
    expect(observed.requests).toHaveLength(2);
    expect(observed.classifications).toHaveLength(1);
    expect(JSON.stringify(observed.terminal)).toContain("baseline-unresolved");
  }, 20000);
}

test("F1 resolved actual junior stays zero assessment", async () => {
  const observed = await launch({ junior: true, resolved: true });
  expect(observed.terminal?.isError, JSON.stringify(observed.terminal)).toBe(false);
  expect(observed.classifications).toHaveLength(0);
  expect(observed.result?.details).toMatchObject({
    results: [{ model: "fixture/fixture-other-model:high", thinking: "high", exitCode: 0 }],
  });
}, 20000);
