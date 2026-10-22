import { afterEach, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerWorkerAdapter } from "../src/worker-adapter.ts";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerRequiredChildExtensions } from "pi-subagents/required-child-extensions";
import { fileURLToPath } from "node:url";

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
  for (const tier of ["FAST", "BALANCED", "DEEP"])
    process.env[`JEV_TIER_${tier}`] = `local/${tier.toLowerCase()}`;
  const hooks = new Map<string, Function[]>();
  const listeners = new Map<string, Function[]>();
  const controls: unknown[] = [];
  const entries: unknown[] = [];
  const signal = new AbortController();
  const session = crypto.randomUUID();
  const pi = {
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
    ui: { notify() {} },
  } as unknown as ExtensionContext;
  registerWorkerAdapter(pi as unknown as ExtensionAPI);
  const fire = async (name: string, event: unknown = {}) => {
    let result;
    for (const handler of hooks.get(name) ?? []) result = await handler(event, ctx);
    return result;
  };
  const call = (input: Record<string, unknown>, id = "call") =>
    fire("tool_call", { toolName: "subagent", toolCallId: id, input });
  shutdowns.push(() => fire("session_shutdown"));
  let requests = 0;
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
    fetch: async () => {
      requests++;
      await Bun.sleep(delay);
      return Response.json(response);
    },
  });
  process.env.JEV_SYSTEM_ONE_URL = server.url.toString();
  return {
    call,
    fire,
    pi,
    ctx,
    signal,
    controls,
    entries,
    requests: () => requests,
    delay: (value: number) => {
      delay = value;
    },
    response: (value: typeof response) => {
      response = value;
    },
  };
}

test("WORKER-03 thresholds and risk use shared policy without configured effort veto", async () => {
  const f = await fixture();
  const input = {
    agent: "worker",
    model: "local/deep",
    task: "Implement a complete well specified change with tests",
    options: { context: "fresh" },
  };
  await f.call(input);
  expect(input.model).toBe("local/balanced:medium");
  f.response({
    answers: {
      tier: { choice: "fast", confidence: 0.1 },
      effort: { choice: "low", confidence: 0.1 },
      risky: { noul: 0.8 },
    },
  });
  await f.call(input);
  expect(input.model).toBe("local/deep:high");
  f.response({
    answers: {
      tier: { choice: "fast", confidence: 0.2 },
      effort: { choice: "low", confidence: 0.2 },
      risky: { noul: 0 },
    },
  });
  await f.call(input);
  expect(input.model).toBe("local/deep:high");
});

test("WORKER-20 explicit and implicit fork bypass worker classification", async () => {
  const f = await fixture("fork");
  const implicit = { agent: "worker", task: "Do work", model: "local/fast" };
  await f.call(implicit);
  expect(implicit.model).toBe("local/fast");
  await f.call({ ...implicit, options: { context: "fork" } });
  expect(f.requests()).toBe(0);
});

test("WORKER-20 specialized reviewer and junior retain deterministic slots", async () => {
  const f = await fixture();
  const junior = { agent: "jev-pilot:junior", task: "Do work", model: "local/deep" };
  const reviewer = { agent: "jev-pilot:codex-review", task: "Review work", model: "local/deep" };
  await f.call(junior);
  await f.call(reviewer);
  expect(junior.model).toBe("local/balanced");
  expect(reviewer.model).toBe("local/fast");
  expect(f.requests()).toBe(0);
});

test("WORKER-26 cleanup stops only routed async identity and is idempotent", async () => {
  const f = await fixture();
  await f.call({ agent: "worker", model: "local/fast", task: "Implement work" }, "owned");
  await f.fire("tool_result", {
    toolName: "subagent",
    toolCallId: "owned",
    details: { asyncId: "exact-owned-run" },
  });
  await f.fire("tool_result", {
    toolName: "subagent",
    toolCallId: "unrelated",
    details: { asyncId: "unrelated-run" },
  });
  await f.fire("session_before_tree");
  await f.fire("session_shutdown");
  f.signal.abort();
  expect(f.controls).toMatchObject([{ method: "stop", params: { id: "exact-owned-run" } }]);
  expect(f.controls).toHaveLength(1);
});

test("WORKER-13 invalid physical mapping fails actionably without launching", async () => {
  const f = await fixture();
  process.env.JEV_TIER_DEEP = "missing/unknown";
  await expect(f.call({ agent: "worker", task: "Do work" })).rejects.toThrow(
    "exact physical Pi model",
  );
  expect(f.requests()).toBe(0);
});

test("WORKER-26 completion releases exact ownership before repeated cleanup", async () => {
  const f = await fixture();
  await f.call({ agent: "worker", model: "local/fast", task: "Implement work" }, "completed");
  await f.fire("tool_result", {
    toolName: "subagent",
    toolCallId: "completed",
    details: { asyncId: "completed-run" },
  });
  f.pi.events.emit("subagent:async-complete", { runId: "unrelated-run" });
  f.pi.events.emit("subagent:async-complete", { runId: "completed-run" });
  await f.fire("session_before_tree");
  await f.fire("session_shutdown");
  f.signal.abort();
  expect(f.controls).toEqual([]);
});

for (const transition of [
  "model_select",
  "thinking_level_select",
  "session_before_switch",
  "session_before_fork",
  "session_before_tree",
  "session_before_compact",
])
  test(`WORKER-26 ${transition} invalidates pending worker decision`, async () => {
    const f = await fixture();
    f.delay(150);
    const input = { agent: "worker", model: "local/fast", task: "Implement work" };
    const pending = f.call(input, "pending");
    while (!f.requests()) await Bun.sleep(5);
    await f.fire(transition);
    expect(await pending).toMatchObject({ block: true });
    expect(input.model).toBe("local/fast");
    await f.fire("tool_result", {
      toolName: "subagent",
      toolCallId: "pending",
      details: { asyncId: "must-not-own" },
    });
    await f.fire("session_shutdown");
    expect(f.controls).toEqual([]);
    expect(f.entries).toEqual([]);
  });

test("WORKER-13 host-first collision preserves owner across duplicate and adapter shutdown", async () => {
  const f = await fixture();
  const config = {
    sessionId: f.ctx.sessionManager.getSessionId(),
    extensions: [
      { id: "host-owner", path: fileURLToPath(new URL("../src/worker-child.ts", import.meta.url)) },
    ],
  };
  const host = registerRequiredChildExtensions(config);
  try {
    const input = { agent: "worker", task: "Implement work", model: "local/fast" };
    expect(await f.call(input)).toMatchObject({ block: true });
    expect(await f.call(input)).toMatchObject({ block: true });
    expect(input.model).toBe("local/fast");
    expect(f.requests()).toBe(0);
    await f.fire("session_shutdown");
    await f.fire("session_shutdown");
    expect(() => registerRequiredChildExtensions(config)).toThrow("already registered");
  } finally {
    host.dispose();
    host.dispose();
  }
  const replacement = registerRequiredChildExtensions(config);
  replacement.dispose();
});

test("WORKER-13 Jev-first owner survives late host collision and re-registers after session reload", async () => {
  const f = await fixture();
  const config = {
    sessionId: f.ctx.sessionManager.getSessionId(),
    extensions: [
      { id: "host-owner", path: fileURLToPath(new URL("../src/worker-child.ts", import.meta.url)) },
    ],
  };
  await f.call({ agent: "worker", task: "Implement work", model: "local/fast" });
  expect(() => registerRequiredChildExtensions(config)).toThrow("already registered");
  await f.call({ agent: "worker", task: "Implement work", model: "local/fast" });
  expect(f.requests()).toBe(2);
  await f.fire("session_shutdown");
  await f.fire("session_shutdown");
  const host = registerRequiredChildExtensions(config);
  host.dispose();
  host.dispose();
  await f.fire("session_start");
  await f.call({ agent: "worker", task: "Implement work", model: "local/fast" });
  expect(f.requests()).toBe(3);
  expect(() => registerRequiredChildExtensions(config)).toThrow("already registered");
});
