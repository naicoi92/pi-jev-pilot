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

  const hooks = new Map<string, Function[]>();
  const listeners = new Map<string, Function[]>();
  const controls: unknown[] = [];
  const entries: unknown[] = [];
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
  f.settings({
    jevPilot: {
      tiers: { fast: "local/fast", balanced: "local/balanced", deep: "missing/unknown" },
    },
  });
  await f.fire("session_start");
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
    // Cancellation may leave a visible cancelled decision row, but never a route record.
    expect(f.entries).not.toContainEqual(expect.objectContaining({ toolCallId: "pending" }));
    expect(f.entries).not.toContainEqual(expect.objectContaining({ outcome: "classified" }));
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

test("CREW-18 offered custom keys stay distinct from real tiers", async () => {
  const f = await fixture();
  const path = join(f.ctx.cwd, "crew.json");
  process.env.JEV_CREW_CONFIG = path;
  await writeFile(
    path,
    JSON.stringify({
      mode: "budget",
      slots: ["fast", "balanced", "deep"].map((name) => ({ name, model: "local/fast" })),
    }),
  );
  for (const choice of ["slot::fast", "slot::balanced", "slot::deep", "balanced", "deep"]) {
    f.response({
      answers: {
        tier: { choice, confidence: 0.9 },
        effort: { choice: "medium", confidence: 0.95 },
        risky: { noul: 0 },
      },
    });
    const input = { agent: "worker", task: "Read all logs", model: "local/deep" };
    await f.call(input);
    expect(input.model).toBe(
      choice.startsWith("slot::") ? "local/fast:medium" : `local/${choice}:medium`,
    );
  }
  const tier = (f.payloads[0]!.questions as Record<string, { criteria: unknown }>).tier!;
  expect(Object.keys(tier.criteria as object)).toEqual([
    "fast",
    "balanced",
    "deep",
    "slot::fast",
    "slot::balanced",
    "slot::deep",
  ]);
});
test("CREW-03 risk forced deep overrides a custom slot named deep", async () => {
  const f = await fixture();
  process.env.JEV_CREW_CONFIG = join(f.ctx.cwd, "crew.json");
  await writeFile(
    process.env.JEV_CREW_CONFIG,
    JSON.stringify({ mode: "budget", slots: [{ name: "deep", model: "local/fast" }] }),
  );
  f.response({
    answers: {
      tier: { choice: "slot::deep", confidence: 0.9 },
      effort: { choice: "medium", confidence: 0.95 },
      risky: { noul: 0.95 },
    },
  });
  const input = { agent: "worker", task: "Read the logs", model: "local/balanced" };
  await f.call(input);
  expect(input.model).toBe("local/deep:high");
});
test("CREW-13 invalid eligible target fails before classifier", async () => {
  const f = await fixture();
  process.env.JEV_CREW_CONFIG = join(f.ctx.cwd, "crew.json");
  await writeFile(
    process.env.JEV_CREW_CONFIG,
    JSON.stringify({ mode: "budget", slots: [{ name: "alpha", model: "local/missing" }] }),
  );
  await expect(f.call({ agent: "worker", task: "Read the logs" })).rejects.toThrow(
    "exact physical",
  );
  expect(f.requests()).toBe(0);
});

test("routing-settings ordinary worker consumes public effective JSON tiers after session_start", async () => {
  const f = await fixture();
  for (const tier of ["FAST", "BALANCED", "DEEP"]) delete process.env[`JEV_TIER_${tier}`];
  f.settings({
    unrelated: { preserved: true },
    jevPilot: {
      mainRoutingEnabled: false,
      tiers: {
        fast: "local/fast",
        balanced: "local/balanced",
        deep: "local/deep",
      },
    },
  });
  await f.fire("session_start");
  const input = {
    agent: "worker",
    model: "local/deep",
    task: "Implement specified change with tests",
  };
  await f.call(input);
  expect(input.model).toBe("local/balanced:medium");
  expect(f.requests()).toBe(1);
  f.settings({ jevPilot: { tiers: null } });
  await f.fire("session_start");
  const fork = { ...input, context: "fork" };
  await f.call(fork);
  expect(f.requests()).toBe(1);
  process.env.JEV_WORKER_ROUTING_ENABLED = "false";
  await f.call({ ...input });
  expect(f.requests()).toBe(1);
});

const tierNames = ["fast", "balanced", "deep"] as const;
const configuredModels = { fast: "local/fast", balanced: "local/balanced", deep: "local/deep" };
const sentQuestions = (f: Awaited<ReturnType<typeof fixture>>, index = 0) =>
  f.payloads[index]!.questions as Record<string, { criteria: object }>;
const answer = (choice: string, risky = 0, tier: Record<string, unknown> = {}) => ({
  answers: {
    tier: { choice, confidence: 0.95, ...tier },
    effort: { choice: "medium", confidence: 0.45 },
    risky: { noul: risky },
  },
});
const configure = async (f: Awaited<ReturnType<typeof fixture>>, tiers: unknown) => {
  f.settings({ jevPilot: { tiers } });
  await f.fire("session_start");
};

for (const absent of ["missing", "", "   "])
  for (const hidden of tierNames)
    test(`SPARSE-01 ${absent === "missing" ? "absent" : JSON.stringify(absent)} ${hidden} tier is hidden from classification`, async () => {
      const f = await fixture();
      const tiers: Record<string, string> = { ...configuredModels };
      if (absent === "missing") delete tiers[hidden];
      else tiers[hidden] = absent;
      await configure(f, tiers);
      await f.call({ agent: "worker", model: "local/deep", task: "Implement work" });
      expect(Object.keys(sentQuestions(f).tier!.criteria)).toEqual(
        tierNames.filter((name) => name !== hidden),
      );
    });

test("SPARSE-01 a response choosing a hidden tier is a schema error that changes nothing", async () => {
  const f = await fixture();
  await configure(f, { balanced: "local/balanced", deep: "local/deep" });
  f.response(answer("fast"));
  const input = { agent: "worker", model: "local/deep", task: "Implement work" };
  await f.call(input);
  expect(f.requests()).toBe(1);
  expect(input.model).toBe("local/deep");
});

for (const value of [null, true, 1, {}, [], "unqualified", "local/white space"])
  test(`SPARSE-01 malformed tier ${JSON.stringify(value)} names the setting and sends nothing`, async () => {
    const f = await fixture();
    await configure(f, { ...configuredModels, balanced: value });
    const input = { agent: "worker", model: "local/deep", task: "Implement work" };
    await expect(f.call(input)).rejects.toThrow("jevPilot.tiers.balanced");
    expect(f.requests()).toBe(0);
    expect(input.model).toBe("local/deep");
  });

for (const tiers of [undefined, {}, { fast: "", balanced: " ", deep: "\t" }]) {
  test(`SPARSE-01 no tier configured (${JSON.stringify(tiers)}) sends no tier question and keeps the baseline`, async () => {
    const f = await fixture();
    f.settings(tiers === undefined ? {} : { jevPilot: { tiers } });
    await f.fire("session_start");
    f.response(answer("balanced"));
    const input = { agent: "worker", model: "local/deep", task: "Implement work" };
    await f.call(input);
    expect(f.requests()).toBe(1);
    expect(Object.keys(sentQuestions(f))).toEqual(["effort", "risky"]);
    expect(input.model).toBe("local/deep:medium");
  });
}

test("SPARSE-01 no tier and no slot with a high-risk answer changes only effort", async () => {
  const f = await fixture();
  await configure(f, {});
  f.response(answer("balanced", 0.95));
  const input = { agent: "worker", model: "local/deep", task: "Deploy to production" };
  await f.call(input);
  expect(input.model).toBe("local/deep:high");
});

test("SPARSE-01 configured tiers and offered custom slots are offered together", async () => {
  const f = await fixture();
  process.env.JEV_CREW_CONFIG = join(f.ctx.cwd, "crew.json");
  await writeFile(
    process.env.JEV_CREW_CONFIG,
    JSON.stringify({ mode: "budget", slots: [{ name: "alpha", model: "local/fast" }] }),
  );
  await configure(f, { fast: "local/fast", deep: "local/deep" });
  await f.call({ agent: "worker", model: "local/deep", task: "Read the logs" });
  expect(Object.keys(sentQuestions(f).tier!.criteria)).toEqual(["fast", "deep", "slot::alpha"]);
});

test("SPARSE-01 only offered slots are asked when no tier is configured", async () => {
  const f = await fixture();
  process.env.JEV_CREW_CONFIG = join(f.ctx.cwd, "crew.json");
  await writeFile(
    process.env.JEV_CREW_CONFIG,
    JSON.stringify({ mode: "budget", slots: [{ name: "alpha", model: "local/fast" }] }),
  );
  await configure(f, {});
  f.response(answer("slot::alpha"));
  const input = { agent: "worker", model: "local/deep", task: "Read the logs" };
  await f.call(input);
  expect(Object.keys(sentQuestions(f).tier!.criteria)).toEqual(["slot::alpha"]);
  expect(input.model).toBe("local/fast:medium");
});

test("SPARSE-01 the request snapshot also validates response probability distributions", async () => {
  const f = await fixture();
  await configure(f, { fast: "local/fast", balanced: "local/balanced" });
  f.response(answer("balanced", 0, { probabilities: { balanced: 0.5, deep: 0.5 } }));
  const rejected = { agent: "worker", model: "local/fast", task: "Implement work" };
  await f.call(rejected);
  expect(rejected.model).toBe("local/fast");
  f.response(answer("balanced", 0, { probabilities: { fast: 0.4, balanced: 0.6 } }));
  const accepted = { agent: "worker", model: "local/fast", task: "Implement work" };
  await f.call(accepted);
  expect(accepted.model).toBe("local/balanced:medium");
});

test("SPARSE-01 high risk selects deep, else the highest configured tier, else nothing", async () => {
  const f = await fixture();
  f.response(answer("fast", 0.95, { confidence: 0.01 }));
  const cases: [Record<string, string>, string, string][] = [
    [configuredModels, "local/fast", "local/deep:high"],
    [{ fast: "local/fast", balanced: "local/balanced" }, "local/fast", "local/balanced:high"],
    [{ fast: "local/fast" }, "local/deep", "local/fast:high"],
    [{}, "local/deep", "local/deep:high"],
  ];
  for (const [tiers, baseline, expected] of cases) {
    await configure(f, tiers);
    const input = { agent: "worker", model: baseline, task: "Deploy to production" };
    await f.call(input);
    expect(input.model).toBe(expected);
  }
});

test("SPARSE-01 specialized agents without their tier keep the executor model and ask nothing", async () => {
  const f = await fixture();
  await configure(f, {});
  const junior = { agent: "jev-pilot:junior", task: "Do work", model: "local/deep" };
  const reviewer = { agent: "jev-pilot:codex-review", task: "Review work", model: "local/deep" };
  await f.call(junior);
  await f.call(reviewer);
  expect(junior.model).toBe("local/deep");
  expect(reviewer.model).toBe("local/deep");
  expect(f.requests()).toBe(0);
});
