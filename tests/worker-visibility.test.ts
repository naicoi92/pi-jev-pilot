import { afterEach, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { statusLines, type WorkerDecisionRow } from "../src/decision-visibility.ts";
import { registerWorkerAdapter } from "../src/worker-adapter.ts";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const saved = { ...process.env };
let server: ReturnType<typeof Bun.serve> | undefined;
const shutdowns: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const shutdown of shutdowns.splice(0)) await shutdown();
  server?.stop(true);
  server = undefined;
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
});
async function fixture(defaultContext = "fresh") {
  const directory = await mkdtemp(join(tmpdir(), "pi-jev-worker-unit-"));
  const agent = join(directory, "agent");
  await mkdir(join(agent, "agents"), { recursive: true });
  for (const name of ["worker", "jev-pilot:junior", "jev-pilot:codex-review"])
    await writeFile(
      join(agent, "agents", `${name}.md`),
      `---\nname: ${name}\ndescription: Unit worker\nmodel: local/fast\ndefaultContext: ${defaultContext}\n---\nReturn done.\n`,
    );
  await writeFile(join(directory, "parent.jsonl"), "");
  process.env.PI_CODING_AGENT_DIR = agent;
  process.env.JEV_WORKER_ROUTING_ENABLED = "true";
  process.env.JEV_SYSTEM_ONE_API_KEY = "fixture";

  const hooks = new Map<string, Function[]>();
  const listeners = new Map<string, Function[]>();
  const controls: unknown[] = [];
  const entries: unknown[] = [];
  const widgets = new Map<string, string[] | undefined>();
  const statuses = new Map<string, string | undefined>();
  const snapshots: string[] = [];
  const signal = new AbortController();
  const session = crypto.randomUUID();
  let settings: unknown = {
    jevPilot: { tiers: { fast: "local/fast", balanced: "local/balanced", deep: "local/deep" } },
  };
  const pi = {
    getSettings: () => settings,
    on(name: string, handler: Function) {
      hooks.set(name, [...(hooks.get(name) ?? []), handler]);
    },
    events: {
      on(name: string, handler: Function) {
        listeners.set(name, [...(listeners.get(name) ?? []), handler]);
      },
      emit(name: string, value: unknown) {
        if (name === "subagents:rpc:v1:request") controls.push(value);
        for (const handler of listeners.get(name) ?? []) handler(value);
      },
    },
    appendEntry(_name: string, value: unknown) {
      entries.push(value);
    },
  };
  const models = ["fast", "balanced", "deep"].map((id) => ({
    provider: "local",
    id,
    api: "openai-completions",
    reasoning: true,
    contextWindow: 32000,
    maxTokens: 100,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }));
  const ctx = {
    cwd: directory,
    signal: signal.signal,
    scopedModels: [],
    model: models[0],
    isProjectTrusted: () => true,
    modelRegistry: {
      find: (provider: string, id: string) =>
        models.find((model) => model.provider === provider && model.id === id),
      hasConfiguredAuth: () => true,
      getAvailable: () => models,
    },
    sessionManager: {
      getSessionId: () => session,
      getSessionFile: () => join(directory, "parent.jsonl"),
      getLeafId: () => "leaf",
      getBranch: () => [],
    },
    ui: {
      setWidget(key: string, lines: string[] | undefined) {
        widgets.set(key, lines);
        snapshots.push(JSON.stringify(lines) ?? "cleared");
      },
      setStatus(key: string, text: string | undefined) {
        statuses.set(key, text);
      },
    },
  } as unknown as ExtensionContext;
  const running: number[] = [];
  registerWorkerAdapter(pi as unknown as ExtensionAPI, (count) => running.push(count));
  const fire = async (name: string, event: unknown = {}) => {
    let result;
    for (const handler of hooks.get(name) ?? []) result = await handler(event, ctx);
    return result;
  };
  const call = (input: Record<string, unknown>, id = "call") =>
    fire("tool_call", { toolName: "subagent", toolCallId: id, input });
  shutdowns.push(() => fire("session_shutdown"));
  await fire("session_start");
  let requests = 0;
  const payloads: Record<string, unknown>[] = [];
  let delay = 0;
  let response = {
    answers: {
      tier: { choice: "balanced", confidence: 0.95 },
      effort: { choice: "medium", confidence: 0.45 },
      risky: { noul: 0 },
    },
  };
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      payloads.push((await request.json()) as Record<string, unknown>);
      requests++;
      await Bun.sleep(delay);
      return Response.json(response);
    },
  });
  process.env.JEV_SYSTEM_ONE_URL = server.url.toString();
  return {
    call,
    settings: (value: unknown) => {
      settings = value;
    },
    fire,
    pi,
    ctx,
    signal,
    controls,
    entries,
    requests: () => requests,
    payloads,
    widgets,
    statuses,
    snapshots,
    running,
    visible: () => (widgets.get("jev-pilot-workers") ?? []).join("\n"),
    delay: (value: number) => {
      delay = value;
    },
    response: (value: typeof response) => {
      response = value;
    },
  };
}

const brief = "PRIVATE_TASK: Implement specified change with tests";

// AC-4 selection/classifier coverage moved to public receipts in worker-adapter.test.ts.
// Adapter owns pending/result presentation only, never predicts executor authority decisions.
test("UNIT-WV-pending WV-02 leaves caller envelope intact until executor receipt", async () => {
  const f = await fixture();
  const input = { agent: "worker", model: "local/deep:high", task: brief };
  await f.call(input);
  expect(input.model).toBe("local/deep:high");
  expect(f.visible()).toContain("executor authority · decision pending · launch unconfirmed");
  expect(f.requests()).toBe(0);
});

test("UNIT-WV-skips WV-04 workflow disabled and management stay executor-owned", async () => {
  const f = await fixture();
  await f.call({ workflow: "private-workflow.js" }, "workflow");
  expect(f.visible()).toContain("executor-owned · workflow inner launches");
  process.env.JEV_WORKER_ROUTING_ENABLED = "false";
  const input = { agent: "worker", model: "local/deep:high", task: brief };
  await f.call(input, "disabled");
  expect(f.visible()).toContain("unchanged · routing disabled");
  const snapshot = f.visible();
  await f.call({ action: "resume", id: "private-run" }, "management");
  expect(f.visible()).toBe(snapshot);
  expect(input.model).toBe("local/deep:high");
  expect(f.requests()).toBe(0);
});

test("UNIT-WV-concurrent WV-05 pending sibling survives unrelated result", async () => {
  const f = await fixture();
  await f.call({ agent: "worker", model: "local/fast", task: brief }, "slow");
  await f.call({ agent: "worker", model: "local/deep", task: brief }, "fast");
  await f.fire("tool_result", { toolName: "subagent", toolCallId: "fast", details: {} });
  expect(f.visible().split("\n")).toHaveLength(2);
  expect(f.visible()).toContain("decision pending");
  expect(f.visible()).toContain("executor result · launch unconfirmed");
});

for (const transition of [
  "session_shutdown",
  "session_before_switch",
  "session_before_fork",
  "session_before_tree",
  "session_before_compact",
  "session_start",
  "abort",
])
  test(`UNIT-WV-lifecycle WV-05 ${transition} prevents stale UI resurrection`, async () => {
    const f = await fixture();
    await f.call({ agent: "worker", model: "local/fast", task: brief });
    if (transition === "abort") {
      f.signal.abort();
      await f.fire("agent_settled", { aborted: true });
    } else await f.fire(transition);
    await f.fire("tool_result", {
      toolName: "subagent",
      toolCallId: "call",
      details: { asyncId: "late-run" },
    });
    f.pi.events.emit("subagent:async-complete", { runId: "late-run", state: "complete" });
    expect(f.widgets.get("jev-pilot-workers")).toBeUndefined();
    expect(f.statuses.get("jev-pilot-workers")).toBeUndefined();
  });

test("UNIT-WV-receipts WV-06 generic tool success never verifies child launch", async () => {
  const f = await fixture();
  await f.call({ agent: "worker", model: "local/fast", task: brief });
  await f.fire("tool_result", {
    toolName: "subagent",
    toolCallId: "call",
    details: { results: [{ model: "local/deep", thinking: "high" }] },
  });
  expect(f.visible()).toContain("executor result · launch unconfirmed");
  expect(f.visible()).not.toContain("executor receipt");
  await f.fire("tool_result", {
    toolName: "subagent",
    toolCallId: "call",
    details: { asyncId: "exact-run" },
  });
  expect(f.visible()).toContain("executor accepted async · launch unconfirmed");
  f.pi.events.emit("subagent:async-complete", { runId: "unrelated", state: "complete" });
  expect(f.visible()).not.toContain("executor complete");
  f.pi.events.emit("subagent:async-complete", { runId: "exact-run", state: "complete" });
  expect(f.visible()).toContain("executor complete · model/effort unconfirmed");
  expect(f.visible()).not.toContain("running");
  expect(f.controls).toEqual([]);
});

test("UNIT-WV-privacy WV-07 UI excludes task description errors and arbitrary call IDs", async () => {
  const f = await fixture();
  await f.call(
    { agent: "worker", task: brief, description: "PRIVATE_DESCRIPTION", model: "local/fast" },
    "PRIVATE_CALL_ID\u001b[31m",
  );
  expect(f.visible()).not.toContain("PRIVATE_");
  expect(f.visible()).not.toContain("\u001b");
  expect([...f.widgets.keys()]).toEqual(["jev-pilot-workers"]);
  expect([...f.statuses.keys()]).toEqual(["jev-pilot-workers"]);
  await f.fire("tool_result", {
    toolName: "subagent",
    toolCallId: "PRIVATE_CALL_ID\u001b[31m",
    details: { error: "PRIVATE_PROVIDER_ERROR" },
  });
  expect(f.visible()).not.toContain("PRIVATE_");
});

for (const path of ["runtime-miss", "fork"])
  for (const [proof, agent, expected] of [
    [true, "worker", "worker"],
    [true, "PRIVATE_AGENT\n\u001b[31m", "unknown"],
    [false, "worker", "unknown"],
  ] as const)
    test(`RC-2 RECEIPT-IDENTITY ${path} verified=${proof} safe=${expected} recovers only public identity`, async () => {
      const f = await fixture();
      const input =
        path === "fork"
          ? { agent: "worker", task: brief, context: "fork" }
          : { agent: "runtime-only", task: brief };
      await f.call(input);
      const plan = f.entries.find(
        (row) => (row as WorkerDecisionRow).kind === "worker",
      ) as WorkerDecisionRow;
      expect(plan.agent).toBe("unknown");
      expect(f.visible()).toContain(`Jev worker unknown ${plan.invocation}`);
      await f.fire("tool_result", {
        toolName: "subagent",
        toolCallId: "call",
        details: {
          mode: "single",
          runId: "PRIVATE_RUN_ID",
          results: [
            {
              agent,
              model: "local/deep",
              thinking: "high",
              exitCode: 0,
              usage: { turns: 1 },
              ...(proof
                ? {
                    launchContractDigest: "a".repeat(64),
                    launchResolvedExtensions: { source: "launch-resolved", version: 1 },
                  }
                : {}),
            },
          ],
        },
      });
      const executor = f.entries.at(-1) as WorkerDecisionRow;
      expect(executor).toMatchObject({
        kind: "worker",
        stage: "executor",
        invocation: plan.invocation,
        agent: expected,
        outcome: proof ? "receipt" : "unconfirmed",
      });
      expect(plan.agent).toBe("unknown");
      expect(f.visible()).toContain(`Jev worker ${expected} ${plan.invocation}`);
      const branch = f.entries
        .filter((row) => (row as WorkerDecisionRow).kind === "worker")
        .map((data) => ({ type: "custom", customType: "jev-pilot:decision:v1", data }));
      expect(
        statusLines(
          { getThinkingLevel: () => "low" } as ExtensionAPI,
          { sessionManager: { getBranch: () => branch } } as unknown as ExtensionContext,
        ).join("\n"),
      ).toContain(`Jev worker executor · ${expected} ${plan.invocation}`);
      expect(JSON.stringify(branch)).not.toContain("PRIVATE_");
    });

test("P12 WORKERS-4 adapter tracks pending native launches until result or async completion", async () => {
  const f = await fixture();
  expect(f.running).toEqual([]);
  await f.call({ agent: "worker", task: brief }, "sync");
  expect(f.running.at(-1)).toBe(1);
  await f.fire("tool_result", {
    toolName: "subagent",
    toolCallId: "sync",
    details: { mode: "single", results: [] },
  });
  expect(f.running.at(-1)).toBe(0);
  await f.call({ agent: "worker", task: brief }, "async");
  await f.fire("tool_result", {
    toolName: "subagent",
    toolCallId: "async",
    details: { asyncId: "run-9" },
  });
  expect(f.running.at(-1)).toBe(1);
  await f.fire("agent_settled", { aborted: false });
  expect(f.running.at(-1)).toBe(1);
  f.pi.events.emit("subagent:async-complete", { runId: "run-9", state: "complete" });
  expect(f.running.at(-1)).toBe(0);
});
