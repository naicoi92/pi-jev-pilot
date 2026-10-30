import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { PiFixture, root } from "./fixtures/pi-cli.ts";

let fixture: PiFixture | undefined;
let restartPending: Promise<void> | undefined;
afterEach(async () => {
  if (restartPending) {
    await restartPending;
    restartPending = undefined;
  }
  if (fixture && process.env.JEV_WORKER_CONFIG_EVIDENCE_DIR) {
    const directory = process.env.JEV_WORKER_CONFIG_EVIDENCE_DIR;
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, `worker-receipt-${crypto.randomUUID()}.json`),
      JSON.stringify(
        {
          executable: "/bin/sh /Users/naicoi/.bun/bin/pi-bolt",
          isolatedHome: true,
          classifierCount: fixture.classifications.length,
          provider: fixture.generations.map(({ model, reasoning_effort }) => ({
            model,
            reasoning_effort,
          })),
          credentialMatched: fixture.sawClassifierBearer,
          workerResults: fixture.records
            .filter((row) => row.type === "tool_execution_end" && row.toolName === "subagent")
            .map((row) => ({
              isError: row.isError,
              receiptPresent: JSON.stringify(row.result).includes("launchContractDigest"),
            })),
        },
        null,
        2,
      ),
    );
  }
  await fixture?.close();
  fixture = undefined;
});

async function nativeWorker(config: Record<string, unknown> = {}, withScoreTool = false) {
  const f = new PiFixture([
    "/bin/sh",
    "/Users/naicoi/.bun/bin/pi-bolt",
    "--no-extensions",
    "-e",
    join(root, "node_modules/pi-subagents/index.ts"),
    "-e",
    join(root, "tests/fixtures/worker-config-boundary.ts"),
    ...(withScoreTool ? ["-e", join(root, "tests/fixtures/worker-score-tool.ts")] : []),
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
  fixture = f;
  f.skipPackageInstall = true;
  f.jevConfig = {
    effortEnabled: false,
    skillsEnabled: false,
    strategyEnabled: false,
    qualityEnabled: false,
    designEnabled: false,
    tiers: { balanced: "fixture-deep/judgment" },
    ...config,
  };
  f.settings = {
    jevPilot: { tiers: { balanced: "fixture-fast/lookup" } },
    subagents: { intercomBridge: { mode: "off" } },
  };
  f.response = {
    answers: {
      effort: { choice: "low", confidence: 1 },
      risky: { noul: 0 },
      tier: { choice: "balanced", confidence: 1 },
    },
  };
  f.prepare = async (directory, agent) => {
    await cp(
      "/Users/naicoi/.pi-bolt/npm/1.0.4/pi-bolt-darwin-arm64",
      join(directory, ".pi-bolt/npm/1.0.4/pi-bolt-darwin-arm64"),
      { recursive: true },
    );
    const modelsPath = join(agent, "models.json");
    const models = JSON.parse(await Bun.file(modelsPath).text());
    models.providers.fixture.models[1].thinkingLevelMap = { low: "low", high: "high" };
    await writeFile(modelsPath, JSON.stringify(models));
    await mkdir(join(agent, "agents"), { recursive: true });
    await writeFile(
      join(agent, "agents/config-worker.md"),
      "---\nname: config-worker\ndescription: Local worker\nmodel: fixture/fixture-model\nthinking: high\ndefaultContext: fresh\ntools: read\n---\nReturn local result.\n",
    );
  };
  await f.start({ JEV_EFFORT_ENABLED: "false", JEV_SKILLS_ENABLED: "false" });
  return f;
}

test("AC1 native worker can invoke the JEV-selected host tool", async () => {
  const f = await nativeWorker({}, true);
  f.classifierResponse = (body) => {
    const questions = body.questions as Record<string, { instructions?: string }>;
    const answers: Record<string, unknown> = {
      effort: { choice: "low", confidence: 1 },
      risky: { noul: 0 },
      tier: { choice: "balanced", confidence: 1 },
    };
    for (const [key, question] of Object.entries(questions))
      if (key.startsWith("tool_"))
        answers[key] = { noul: question.instructions?.includes("fixture_score_tool") ? 0.99 : 0 };
    return { answers };
  };
  f.toolCalls.push(
    {
      name: "subagent",
      input: {
        agent: "config-worker",
        task: "Use fixture_score_tool to find evidence.",
        async: false,
        options: {
          tools: ["grep"],
          context: "fresh",
          acceptance: false,
          artifacts: false,
          timeoutMs: 20000,
        },
      },
    },
    { name: "fixture_score_tool", input: {} },
  );
  await f.prompt("Run the worker and use its selected tool.");
  expect(f.classifications).toHaveLength(1);
  expect(JSON.stringify(f.classifications[0])).toContain("fixture_score_tool");
  const childRequest = f.generations.find((request) => request.model === "judgment");
  const names = ((childRequest?.tools ?? []) as Array<{ function?: { name?: string } }>).map(
    (tool) => tool.function?.name,
  );
  expect(names).toContain("read");
  expect(names).toContain("grep");
  expect(names).toContain("fixture_score_tool");
  expect(await Bun.file(join(f.directory, "fixture-score-tool-invoked")).text()).toContain(
    "called",
  );
  const terminal = f.records.find(
    (row) => row.type === "tool_execution_end" && row.toolName === "subagent",
  );
  expect(terminal?.isError).not.toBe(true);
}, 45000);

test("AC3 native worker excludes a caller tool matching an exclusion pattern", async () => {
  const f = await nativeWorker();
  await writeFile(
    join(f.directory, "agent/agents/config-worker.md"),
    "---\nname: config-worker\ndescription: Local worker\nmodel: fixture/fixture-model\nthinking: high\ndefaultContext: fresh\ntools: read\nexcludeTools: gr*\n---\nReturn local result.\n",
  );
  f.toolCalls.push({
    name: "subagent",
    input: {
      agent: "config-worker",
      task: "Return local result.",
      async: false,
      options: {
        tools: ["grep"],
        context: "fresh",
        acceptance: false,
        artifacts: false,
        timeoutMs: 20000,
      },
    },
  });
  await f.prompt("Run the worker.");
  const childRequest = f.generations.find((request) => request.model === "judgment");
  const names = ((childRequest?.tools ?? []) as Array<{ function?: { name?: string } }>).map(
    (tool) => tool.function?.name,
  );
  expect(names).toContain("read");
  expect(names).not.toContain("grep");
  const terminal = f.records.find(
    (row) => row.type === "tool_execution_end" && row.toolName === "subagent",
  );
  expect(terminal?.isError).not.toBe(true);
}, 45000);

test("WCFG-1 native worker uses JSON tiers rather than merged settings", async () => {
  const f = await nativeWorker();
  f.toolCalls.push({
    name: "subagent",
    input: {
      agent: "config-worker",
      task: "Return local result.",
      async: false,
      options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
    },
  });
  await f.prompt("Run local worker.");
  expect(f.classifications).toHaveLength(1);
  expect(
    f.generations.some(
      (request) => request.model === "judgment" && request.reasoning_effort === "low",
    ),
  ).toBe(true);
}, 30000);

test("WCFG-3 changed registered junior refuses launch before assessment", async () => {
  const f = await nativeWorker();
  const path = join(f.directory, "agent/jev-pilot.json");
  const base = JSON.parse(await Bun.file(path).text());
  await writeFile(
    path,
    JSON.stringify({
      ...base,
      crew: { mode: "junior-lead", slots: [{ name: "helper", model: "fixture/fixture-model" }] },
    }),
  );
  f.toolCalls.push({
    name: "subagent",
    input: {
      agent: "jev-pilot:junior",
      task: "Return local result.",
      async: false,
      options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
    },
  });
  await f.prompt("Run junior worker.");
  const terminal = f.records.find(
    (row) => row.type === "tool_execution_end" && row.toolName === "subagent",
  );
  expect(JSON.stringify(terminal)).toContain("reload");
  expect(f.classifications).toHaveLength(0);
}, 30000);

test("WCFG-verified native junior retains verified fixed pair without assessment", async () => {
  const f = await nativeWorker({
    crew: { mode: "junior-lead", slots: [{ name: "helper", model: "fixture/fixture-model" }] },
  });
  f.toolCalls.push({
    name: "subagent",
    input: {
      agent: "jev-pilot:junior",
      task: "Return local result.",
      model: "fixture/fixture-model:low",
      async: false,
      options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
    },
  });
  await f.prompt("Run junior worker.");
  expect(f.classifications).toHaveLength(0);
  expect(f.generations.some((row) => row.reasoning_effort === "low")).toBe(true);
  expect(
    JSON.stringify(
      f.records.find((row) => row.type === "tool_execution_end" && row.toolName === "subagent"),
    ),
  ).toContain("launchContractDigest");
}, 30000);

test("WCFG-snapshot native edit during assessment retains captured tier", async () => {
  const f = await nativeWorker();
  f.classifierDelay = 500;
  f.toolCalls.push({
    name: "subagent",
    input: {
      agent: "config-worker",
      task: "Return local result.",
      async: false,
      options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
    },
  });
  const pending = f.prompt("Run local worker.");
  const deadline = Date.now() + 15000;
  while (!f.classifications.length && Date.now() < deadline) await Bun.sleep(20);
  expect(f.classifications).toHaveLength(1);
  const path = join(f.directory, "agent/jev-pilot.json");
  const config = JSON.parse(await Bun.file(path).text());
  await writeFile(path, JSON.stringify({ ...config, tiers: { balanced: "fixture-fast/lookup" } }));
  await pending;
  expect(
    f.generations.some((row) => row.model === "judgment" && row.reasoning_effort === "low"),
  ).toBe(true);
}, 30000);

test("WCFG-2 native missing junior effort assesses only effort at fixed model", async () => {
  const f = await nativeWorker({
    crew: {
      mode: "junior-lead",
      slots: [{ name: "helper", model: "fixture/fixture-other-model" }],
    },
  });
  f.toolCalls.push({
    name: "subagent",
    input: {
      agent: "jev-pilot:junior",
      task: "Return local result.",
      async: false,
      options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
    },
  });
  await f.prompt("Run junior worker.");
  expect(f.classifications).toHaveLength(1);
  expect(Object.keys(f.classifications[0]!.questions as object).sort()).toEqual([
    "effort",
    "risky",
  ]);
  expect(
    f.generations.some(
      (row) => row.model === "fixture-other-model" && row.reasoning_effort === "low",
    ),
  ).toBe(true);
  expect(
    JSON.stringify(
      f.records.find((row) => row.type === "tool_execution_end" && row.toolName === "subagent"),
    ),
  ).toContain("launchContractDigest");
}, 30000);

for (const repaired of [true, false]) {
  test(`WCFG-boundary native ${repaired ? "malformed edit repaired" : "valid edit becomes malformed"} before authority`, async () => {
    const f = await nativeWorker();
    const path = join(f.directory, "agent/jev-pilot.json");
    const original = await Bun.file(path).text();
    await writeFile(join(f.directory, "hold-worker"), "hold");
    f.toolCalls.push({
      name: "subagent",
      input: {
        agent: "config-worker",
        task: "Return local result.",
        async: false,
        options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
      },
    });
    const pending = f.prompt("Run local worker.");
    const deadline = Date.now() + 10000;
    while (!(await Bun.file(join(f.directory, "worker-held")).exists()) && Date.now() < deadline)
      await Bun.sleep(20);
    expect(await Bun.file(join(f.directory, "worker-held")).exists()).toBe(true);
    await writeFile(path, "{");
    if (repaired) {
      await Bun.sleep(100);
      await writeFile(path, original);
    }
    await rm(join(f.directory, "hold-worker"));
    await pending;
    expect(f.classifications).toHaveLength(repaired ? 1 : 0);
    expect(f.generations.some((row) => row.model === "judgment")).toBe(repaired);
  }, 30000);
}

test("WCFG-3 registered old junior edit refuses until explicit reload", async () => {
  const f = await nativeWorker({
    crew: { mode: "junior-lead", slots: [{ name: "helper", model: "fixture/fixture-model" }] },
  });
  const path = join(f.directory, "agent/jev-pilot.json");
  const config = JSON.parse(await Bun.file(path).text());
  await writeFile(
    path,
    JSON.stringify({
      ...config,
      crew: {
        mode: "junior-lead",
        slots: [{ name: "helper", model: "fixture/fixture-other-model" }],
      },
    }),
  );
  const launch = () =>
    f.toolCalls.push({
      name: "subagent",
      input: {
        agent: "jev-pilot:junior",
        task: "Return local result.",
        async: false,
        options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
      },
    });
  launch();
  await f.prompt("Run junior worker.");
  expect(f.classifications).toHaveLength(0);
  expect(f.generations.some((row) => row.model === "fixture-other-model")).toBe(false);
  expect(
    f.records.some(
      (row) =>
        row.type === "extension_ui_request" && JSON.stringify(row).includes("reload required"),
    ),
  ).toBe(true);
  await f.command("prompt", { message: "/worker-config-reload" });
  await Bun.sleep(500);
  await f.command("get_state");
  launch();
  await f.prompt("Run reloaded junior worker.");
  expect(f.classifications).toHaveLength(1);
  expect(
    f.generations.some(
      (row) => row.model === "fixture-other-model" && row.reasoning_effort === "low",
    ),
  ).toBe(true);
}, 45000);

test("WCFG-cancel native cancellation during assessment produces no worker provider call", async () => {
  const f = await nativeWorker();
  f.classifierDelay = 2000;
  f.toolCalls.push({
    name: "subagent",
    input: {
      agent: "config-worker",
      task: "Return local result.",
      async: false,
      options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
    },
  });
  const pending = f.prompt("Run local worker.");
  const deadline = Date.now() + 10000;
  while (!f.classifications.length && Date.now() < deadline) await Bun.sleep(20);
  expect(f.classifications).toHaveLength(1);
  await f.command("abort");
  await pending;
  expect(f.generations.some((row) => row.model === "judgment")).toBe(false);
}, 30000);

test("WCFG-3 active junior launch retains captured definition during edit", async () => {
  const f = await nativeWorker({
    crew: {
      mode: "junior-lead",
      slots: [{ name: "helper", model: "fixture/fixture-other-model" }],
    },
  });
  f.classifierDelay = 500;
  f.toolCalls.push({
    name: "subagent",
    input: {
      agent: "jev-pilot:junior",
      task: "Return local result.",
      async: false,
      options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
    },
  });
  const pending = f.prompt("Run junior worker.");
  const deadline = Date.now() + 10000;
  while (!f.classifications.length && Date.now() < deadline) await Bun.sleep(20);
  expect(f.classifications).toHaveLength(1);
  const path = join(f.directory, "agent/jev-pilot.json");
  const config = JSON.parse(await Bun.file(path).text());
  await writeFile(
    path,
    JSON.stringify({
      ...config,
      crew: { mode: "junior-lead", slots: [{ name: "helper", model: "fixture/fixture-model" }] },
    }),
  );
  await pending;
  expect(
    f.generations.some(
      (row) => row.model === "fixture-other-model" && row.reasoning_effort === "low",
    ),
  ).toBe(true);
}, 30000);

// AC-1: executor workflow owns sibling IDs; no Jev correlation or snapshot queue.
test("WCFG-concurrent native parallel workers keep captured policy after edit", async () => {
  const f = await nativeWorker();
  f.classifierDelay = 700;
  await writeFile(
    join(f.directory, "parallel-workers.js"),
    `return await runs.all([
    { key: "first", agent: "config-worker", task: "Return first local result.", async: false, context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
    { key: "second", agent: "config-worker", task: "Return second local result.", async: false, context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 }
  ]);`,
  );
  f.toolCalls.push({
    name: "subagent",
    input: {
      workflow: "./parallel-workers.js",
      async: false,
      options: { acceptance: false, artifacts: false, timeoutMs: 10000 },
    },
  });
  const offset = f.records.length;
  await f.command("prompt", { message: "Run parallel local workers." });
  const pending = f.wait(
    () => f.records.slice(offset).some((row) => row.type === "agent_settled"),
    30000,
  );
  const deadline = Date.now() + 15000;
  while (f.classifications.length < 2 && Date.now() < deadline) await Bun.sleep(20);
  expect(f.classifications).toHaveLength(2);
  const path = join(f.directory, "agent/jev-pilot.json");
  const config = JSON.parse(await Bun.file(path).text());
  await writeFile(path, JSON.stringify({ ...config, tiers: { balanced: "fixture-fast/lookup" } }));
  await pending;
  expect(
    f.generations.filter((row) => row.model === "judgment" && row.reasoning_effort === "low"),
  ).toHaveLength(2);
  const terminal = f.records.find(
    (row) => row.type === "tool_execution_end" && row.toolName === "subagent",
  );
  expect(terminal?.isError).toBe(false);
  expect(JSON.stringify(terminal).match(/launchContractDigest/g)?.length).toBeGreaterThanOrEqual(2);
}, 45000);

async function ownerSnapshot(f: PiFixture) {
  await rm(join(f.directory, "worker-owner.json"), { force: true });
  await f.command("prompt", { message: "/worker-owner-snapshot" });
  await f.wait(() => Bun.file(join(f.directory, "worker-owner.json")).size > 0);
  return JSON.parse(await Bun.file(join(f.directory, "worker-owner.json")).text());
}

async function terminalWorker(f: PiFixture) {
  const offset = f.records.length;
  const calls = f.classifications.length;
  const generations = f.generations.length;
  f.toolCalls.push({
    name: "subagent",
    input: {
      agent: "config-worker",
      task: "Return local result.",
      async: false,
      options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
    },
  });
  await f.prompt("Run local worker.");
  const terminal = f.records
    .slice(offset)
    .find((row) => row.type === "tool_execution_end" && row.toolName === "subagent");
  expect(terminal).toBeDefined();
  return {
    calls: f.classifications.length - calls,
    models: f.generations.slice(generations).map((row) => row.model),
    terminal,
  };
}

for (const initial of [true, false]) {
  test(`WCFG-restart routing ${initial} to ${!initial} keeps registered admission until process restart`, async () => {
    const f = await nativeWorker({ workerRoutingEnabled: initial });
    const path = join(f.directory, "agent/jev-pilot.json");
    const config = JSON.parse(await Bun.file(path).text());
    expect((await ownerSnapshot(f)).kind).toBe(initial ? "active" : "never-owned");
    expect((await terminalWorker(f)).calls).toBe(initial ? 1 : 0);
    await writeFile(path, JSON.stringify({ ...config, workerRoutingEnabled: !initial }));
    expect((await terminalWorker(f)).calls).toBe(initial ? 1 : 0);
    await f.restartAfterTerminal();
    expect((await ownerSnapshot(f)).kind).toBe(initial ? "never-owned" : "active");
    expect((await terminalWorker(f)).calls).toBe(initial ? 0 : 1);
  }, 90000);
}

for (const [lowFirst, overlayEdit] of [
  [true, false],
  [false, true],
] as const) {
  test(`WCFG-restart ${lowFirst ? "raise base" : "lower overlay"} retains registered worker deadline`, async () => {
    const oldTimeout = lowFirst ? 450 : 2400;
    const newTimeout = lowFirst ? 2400 : 450;
    const f = await nativeWorker({});
    const path = join(f.directory, "agent/jev-pilot.json");
    const config = JSON.parse(await Bun.file(path).text());
    await writeFile(
      path,
      JSON.stringify({ ...config, classifier: { ...config.classifier, timeoutMs: oldTimeout } }),
    );
    // Start process A with desired initial budget; no worker has been dispatched yet.
    await f.restartAfterTerminal();
    expect((await ownerSnapshot(f)).assessmentTimeoutMs).toBe(oldTimeout);
    f.classifierDelay = 1000;
    let active: Promise<void> | undefined;
    let activeOffset = 0;
    if (overlayEdit) {
      activeOffset = f.records.length;
      f.toolCalls.push({
        name: "subagent",
        input: {
          agent: "config-worker",
          task: "Return local result.",
          async: false,
          options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
        },
      });
      active = f.prompt("Run held worker.");
      restartPending = active;
      await f.wait(() => f.classifications.length === 1);
    }
    if (overlayEdit) {
      await mkdir(join(f.directory, "agent/jev-pilot"), { recursive: true });
      await writeFile(
        join(f.directory, "agent/jev-pilot/tuning.json"),
        JSON.stringify({ version: 1, values: { timeoutMs: newTimeout }, since: 0 }),
      );
    } else {
      await writeFile(
        path,
        JSON.stringify({ ...config, classifier: { ...config.classifier, timeoutMs: newTimeout } }),
      );
    }
    if (active) {
      await active;
      restartPending = undefined;
      expect(
        f.records
          .slice(activeOffset)
          .some((row) => row.type === "tool_execution_end" && row.toolName === "subagent"),
      ).toBe(true);
      expect(f.generations.some((row) => row.model === "judgment")).toBe(true);
    }
    const before = await terminalWorker(f);
    expect(before.calls).toBe(1);
    expect(before.models.includes("judgment")).toBe(!lowFirst);
    expect((await ownerSnapshot(f)).assessmentTimeoutMs).toBe(oldTimeout);
    await f.restartAfterTerminal();
    expect((await ownerSnapshot(f)).assessmentTimeoutMs).toBe(newTimeout);
    const after = await terminalWorker(f);
    expect(after.calls).toBe(1);
    expect(after.models.includes("judgment")).toBe(lowFirst);
  }, 90000);
}
