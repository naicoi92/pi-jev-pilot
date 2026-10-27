import { expect, test } from "bun:test";
import { cp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { PiFixture, root, type RecordData } from "./fixtures/pi-cli.ts";

// F3: public tool_call -> actual executor consumption; main consumers disabled, loopback only.
async function launch(classifier: Record<string, unknown> = {}, status = 200) {
  const cli = process.env.JEV_OWNER_CLI ?? "/Users/naicoi/.bun/bin/pi-bolt";
  const executor = process.env.JEV_OWNER_EXECUTOR ?? join(root, "node_modules/pi-subagents");
  const f = new PiFixture([
    ...(cli.endsWith(".js") ? [process.execPath, "run", cli] : ["/bin/sh", cli]),
    "--no-extensions",
    "-e",
    join(executor, "index.ts"),
    "-e",
    join(root, "tests/fixtures/worker-config-boundary.ts"),
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
  f.jevConfig = {
    effortEnabled: false,
    skillsEnabled: false,
    qualityEnabled: false,
    strategyEnabled: false,
    designEnabled: false,
    tiers: { balanced: "fixture/fixture-model" },
  };
  f.prepare = async (directory) => {
    await cp(
      "/Users/naicoi/.pi-bolt/npm/1.0.4/pi-bolt-darwin-arm64",
      join(directory, ".pi-bolt/npm/1.0.4/pi-bolt-darwin-arm64"),
      { recursive: true },
    );
  };
  f.settings = {
    jevPilot: { tiers: { balanced: "fixture/fixture-model" } },
    subagents: { intercomBridge: { mode: "off" } },
  };
  f.status = status;
  f.response = {
    answers: {
      effort: { choice: "low", confidence: 0 },
      risky: { noul: 0 },
      tier: { choice: "balanced", confidence: 1 },
    },
  };
  try {
    await f.start({
      JEV_EFFORT_ENABLED: "false",
      JEV_SKILLS_ENABLED: "false",
      JEV_WORKER_ROUTING_ENABLED: "true",
      TYPESAFE_API_KEY: "",
      JEV_SYSTEM_ONE_API_KEY: "legacy-must-not-rescue",
    });
    const path = join(f.directory, "agent/jev-pilot.json");
    const config = JSON.parse(await readFile(path, "utf8"));
    await writeFile(join(f.directory, "hold-worker"), "hold");
    await mkdir(join(f.directory, "agent/agents"), { recursive: true });
    await writeFile(
      join(f.directory, "agent/agents/migration-worker.md"),
      "---\nname: migration-worker\ndescription: Local migration worker\nmodel: fixture/fixture-model\nthinking: high\ndefaultContext: fresh\ntools: read\n---\nReturn local result without tools.\n",
    );
    f.toolCalls.push({
      name: "subagent",
      input: {
        agent: "migration-worker",
        task: "Return local result without tools.",
        async: false,
        options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
      },
    });
    const pending = f.prompt("Run local migration fixture worker.");
    const deadline = Date.now() + 10000;
    while (!(await Bun.file(join(f.directory, "worker-held")).exists()) && Date.now() < deadline)
      await Bun.sleep(20);
    expect(await Bun.file(join(f.directory, "worker-held")).exists()).toBe(true);
    await writeFile(
      path,
      JSON.stringify({ ...config, classifier: { ...config.classifier, ...classifier } }),
    );
    await rm(join(f.directory, "hold-worker"));
    await pending;
    const terminal = f.records.find(
      (row) => row.type === "tool_execution_end" && row.toolName === "subagent",
    )!;
    const result = terminal?.result as RecordData | undefined;
    return {
      terminal,
      result,
      records: f.records,
      requests: f.generations,
      classifications: f.classifications,
    };
  } finally {
    await f.close();
  }
}

for (const [name, classifier, expected] of [
  ["missing key", { apiKeyEnv: "ABSENT_NAMED_WORKER_KEY" }, "ABSENT_NAMED_WORKER_KEY"],
  ["invalid URL", { url: "invalid" }, "classifier.url"],
  ["blank model", { model: " " }, "classifier.model"],
] as const) {
  test(`F3 native ${name} refuses actionably before child`, async () => {
    const observed = await launch(classifier);
    expect(observed.terminal?.isError, JSON.stringify(observed)).toBe(true);
    expect(JSON.stringify(observed.records)).toContain(expected);
    expect(observed.requests).toHaveLength(2);
    expect(observed.classifications).toHaveLength(0);
  }, 20000);
}

test("F3 native service failure retains verified pair rather than configuration refusal", async () => {
  const observed = await launch({}, 503);
  expect(observed.terminal?.isError, JSON.stringify(observed.terminal)).toBe(false);
  expect(observed.requests).toHaveLength(3);
  expect(observed.requests[1]!.reasoning_effort).toBe("high");
  expect(observed.classifications).toHaveLength(1);
  expect(observed.result?.details).toMatchObject({
    mode: "single",
    results: [{ exitCode: 0, thinking: "high", usage: { turns: 1 } }],
  });
}, 20000);
