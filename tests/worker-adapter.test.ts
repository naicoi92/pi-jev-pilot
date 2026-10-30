import { afterEach, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerWorkerAdapter } from "../src/worker-adapter.ts";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerRequiredChildExtensions } from "pi-subagents/required-child-extensions";
import { fileURLToPath } from "node:url";
import { prepareFixtureWorker } from "./fixtures/worker-authority.ts";

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
  const entries: Record<string, unknown>[] = [];
  const notices: string[] = [];
  const signal = new AbortController();
  const session = crypto.randomUUID();
  let settings: unknown = {
    jevPilot: { tiers: { fast: "local/fast", balanced: "local/balanced", deep: "local/deep" } },
  };
  const pi = {
    registerToolRenderer() {},
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
    appendEntry(_name: string, value: Record<string, unknown>) {
      entries.push(value);
    },
  };
  const models = ["fast", "balanced", "deep", "expert"].map((id) => ({
    provider: "local",
    id,
    api: "openai-completions",
    reasoning: true,
    thinkingLevelMap: { low: "low", medium: "medium", high: "high" },
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
    ui: { notify: (message: string) => notices.push(message) },
  } as unknown as ExtensionContext;
  registerWorkerAdapter(pi as unknown as ExtensionAPI);
  const fire = async (name: string, event: unknown = {}) => {
    let result;
    for (const handler of hooks.get(name) ?? []) result = await handler(event, ctx);
    return result;
  };
  const selections = new WeakMap<object, string>();
  const call = async (input: Record<string, unknown>, id = "call") => {
    const blocked = await fire("tool_call", { toolName: "subagent", toolCallId: id, input });
    if (
      blocked?.block ||
      input.action ||
      input.workflow ||
      JSON.parse(await readFile(join(agent, "jev-pilot.json"), "utf8")).workerRoutingEnabled ===
        false
    )
      return blocked;
    const result = await prepareFixtureWorker(ctx, input, defaultContext);
    if (result.kind === "committed") {
      selections.set(input, result.receipt.model + ":" + result.receipt.thinking);
      return;
    }
    return { block: true, reason: result.kind === "blocked" ? result.reason : "unowned" };
  };
  shutdowns.push(() => fire("session_shutdown"));
  await fire("session_start");
  let requests = 0;
  const payloads: Record<string, unknown>[] = [];
  let delay = 0;
  let response: { answers: Record<string, unknown> } = {
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
  await writeFile(
    join(agent, "jev-pilot.json"),
    JSON.stringify({
      tiers: { fast: "local/fast", balanced: "local/balanced", deep: "local/deep" },
      classifier: { url: server.url.toString(), apiKeyEnv: "JEV_SYSTEM_ONE_API_KEY" },
    }),
  );
  const config = async (value: Record<string, unknown>) => {
    const path = join(agent, "jev-pilot.json");
    await writeFile(
      path,
      JSON.stringify({ ...JSON.parse(await readFile(path, "utf8")), ...value }),
    );
  };
  return {
    call,
    selected: (input: object) => selections.get(input),
    config,
    settings: async (value: unknown) => {
      settings = value;
      await config({ tiers: (value as { jevPilot?: { tiers?: unknown } }).jevPilot?.tiers ?? {} });
    },
    fire,
    pi,
    ctx,
    signal,
    controls,
    entries,
    notices,
    requests: () => requests,
    payloads,
    delay: (value: number) => {
      delay = value;
    },
    response: (value: { answers: Record<string, unknown> }) => {
      response = value;
    },
  };
}

// AE-2: effort confidence is diagnostic; tier confidence gates and risk remain unchanged.
test("WORKER-03 effort authority preserves tier confidence gates", async () => {
  const f = await fixture();
  const input = {
    agent: "worker",
    model: "local/deep",
    task: "Implement a complete well specified change with tests",
    options: { context: "fresh" },
  };
  await f.call(input);
  expect(f.selected(input)).toBe("local/balanced:medium");
  f.response({
    answers: {
      tier: { choice: "fast", confidence: 0.1 },
      effort: { choice: "low", confidence: 0.1 },
      risky: { noul: 0.8 },
    },
  });
  await f.call(input);
  expect(f.selected(input)).toBe("local/deep:high");
  f.response({
    answers: {
      tier: { choice: "fast", confidence: 0.2 },
      effort: { choice: "low", confidence: 0.2 },
      risky: { noul: 0 },
    },
  });
  await f.call(input);
  expect(f.selected(input)).toBe("local/deep:low");
});

test("WORKER-20 explicit and implicit fork bypass worker classification", async () => {
  const f = await fixture("fork");
  const implicit = { agent: "worker", task: "Do work", model: "local/fast" };
  await f.call(implicit);
  expect(f.selected(implicit)).toBe("local/fast:high");
  await f.call({ ...implicit, options: { context: "fork" } });
  expect(f.requests()).toBe(0);
});

test("fork retains baseline when an unrelated crew slot is unavailable", async () => {
  const f = await fixture("fork");
  await f.config({ crew: { mode: "budget", slots: [{ name: "alpha", model: "local/missing" }] } });
  const input = { agent: "worker", task: "Do work", model: "local/fast" };
  expect(await f.call(input)).toBeUndefined();
  expect(f.selected(input)).toBe("local/fast:high");
  expect(f.requests()).toBe(0);
});

test("WORKER-20 specialized reviewer and junior retain deterministic slots", async () => {
  const f = await fixture();
  const junior = { agent: "jev-pilot:junior", task: "Do work", model: "local/deep" };
  const reviewer = { agent: "jev-pilot:codex-review", task: "Review work", model: "local/deep" };
  await f.call(junior);
  await f.call(reviewer);
  expect(f.selected(junior)).toBe("local/balanced:high");
  expect(f.selected(reviewer)).toBe("local/fast:high");
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
  "abort",
  "model_select",
  "thinking_level_select",
  "session_before_switch",
  "session_before_fork",
  "session_before_tree",
  "session_before_compact",
])
  test(`WORKER-26 ${transition} blocks pending authority preparation`, async () => {
    const f = await fixture();
    f.delay(150);
    const input = { agent: "worker", model: "local/fast", task: "Implement work" };
    const pending = f.call(input);
    while (!f.requests()) await Bun.sleep(5);
    if (transition === "abort") f.signal.abort();
    else await f.fire(transition);
    expect(await pending).toMatchObject({ block: true, reason: "cancelled" });
    expect(input.model).toBe("local/fast");
    expect(f.selected(input)).toBeUndefined();
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
  await f.config({
    crew: {
      mode: "budget",
      slots: ["fast", "balanced", "deep"].map((name) => ({ name, model: "local/fast" })),
    },
  });
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
    expect(f.selected(input)).toBe(
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
  await f.config({ crew: { mode: "budget", slots: [{ name: "deep", model: "local/fast" }] } });
  f.response({
    answers: {
      tier: { choice: "slot::deep", confidence: 0.9 },
      effort: { choice: "medium", confidence: 0.95 },
      risky: { noul: 0.95 },
    },
  });
  const input = { agent: "worker", task: "Read the logs", model: "local/balanced" };
  await f.call(input);
  expect(f.selected(input)).toBe("local/deep:high");
});
test("CREW-13 invalid eligible target fails before classifier", async () => {
  const f = await fixture();
  await f.config({ crew: { mode: "budget", slots: [{ name: "alpha", model: "local/missing" }] } });
  expect(await f.call({ agent: "worker", task: "Read the logs" })).toMatchObject({ block: true });
  expect(f.requests()).toBe(0);
});

test("routing-settings ordinary worker consumes public effective JSON tiers after session_start", async () => {
  const f = await fixture();
  for (const tier of ["FAST", "BALANCED", "DEEP"]) delete process.env[`JEV_TIER_${tier}`];
  await f.settings({
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
  expect(f.selected(input)).toBe("local/balanced:medium");
  expect(f.requests()).toBe(1);
  await f.settings({ jevPilot: { tiers: null } });
  await f.fire("session_start");
  const fork = { ...input, context: "fork" };
  await f.call(fork);
  expect(f.requests()).toBe(1);
  await f.config({ workerRoutingEnabled: false });
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
  await f.settings({ jevPilot: { tiers } });
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
  expect(f.selected(input)).toBe("local/deep:high");
});

for (const value of [null, true, 1, {}, [], "unqualified", "local/white space"])
  test(`SPARSE-01 malformed tier ${JSON.stringify(value)} names the setting and sends nothing`, async () => {
    const f = await fixture();
    await configure(f, { ...configuredModels, balanced: value });
    const input = { agent: "worker", model: "local/deep", task: "Implement work" };
    expect(await f.call(input)).toMatchObject({ block: true });
    expect(f.requests()).toBe(0);
    expect(input.model).toBe("local/deep");
  });

for (const tiers of [undefined, {}, { fast: "", balanced: " ", deep: "\t" }]) {
  test(`SPARSE-01 no tier configured (${JSON.stringify(tiers)}) sends no tier question and keeps the baseline`, async () => {
    const f = await fixture();
    await f.settings(tiers === undefined ? {} : { jevPilot: { tiers } });
    await f.fire("session_start");
    f.response(answer("balanced"));
    const input = { agent: "worker", model: "local/deep", task: "Implement work" };
    await f.call(input);
    expect(f.requests()).toBe(1);
    expect(Object.keys(sentQuestions(f))).toEqual(["effort", "risky"]);
    expect(f.selected(input)).toBe("local/deep:medium");
  });
}

test("SPARSE-01 no tier and no slot with a high-risk answer changes only effort", async () => {
  const f = await fixture();
  await configure(f, {});
  f.response(answer("balanced", 0.95));
  const input = { agent: "worker", model: "local/deep", task: "Deploy to production" };
  await f.call(input);
  expect(f.selected(input)).toBe("local/deep:high");
});

test("SPARSE-01 configured tiers and offered custom slots are offered together", async () => {
  const f = await fixture();
  await f.config({ crew: { mode: "budget", slots: [{ name: "alpha", model: "local/fast" }] } });
  await configure(f, { fast: "local/fast", deep: "local/deep" });
  await f.call({ agent: "worker", model: "local/deep", task: "Read the logs" });
  expect(Object.keys(sentQuestions(f).tier!.criteria)).toEqual(["fast", "deep", "slot::alpha"]);
});

test("SPARSE-01 only offered slots are asked when no tier is configured", async () => {
  const f = await fixture();
  await f.config({ crew: { mode: "budget", slots: [{ name: "alpha", model: "local/fast" }] } });
  await configure(f, {});
  f.response(answer("slot::alpha"));
  const input = { agent: "worker", model: "local/deep", task: "Read the logs" };
  await f.call(input);
  expect(Object.keys(sentQuestions(f).tier!.criteria)).toEqual(["slot::alpha"]);
  expect(f.selected(input)).toBe("local/fast:medium");
});

test("SPARSE-01 the request snapshot also validates response probability distributions", async () => {
  const f = await fixture();
  await configure(f, { fast: "local/fast", balanced: "local/balanced" });
  f.response(answer("balanced", 0, { probabilities: { balanced: 0.5, deep: 0.5 } }));
  const rejected = { agent: "worker", model: "local/fast", task: "Implement work" };
  await f.call(rejected);
  expect(f.selected(rejected)).toBe("local/fast:high");
  f.response(answer("balanced", 0, { probabilities: { fast: 0.4, balanced: 0.6 } }));
  const accepted = { agent: "worker", model: "local/fast", task: "Implement work" };
  await f.call(accepted);
  expect(f.selected(accepted)).toBe("local/balanced:medium");
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
    expect(f.selected(input)).toBe(expected);
  }
});

test("SPARSE-01 specialized agents without their tier keep the executor model and ask nothing", async () => {
  const f = await fixture();
  await configure(f, {});
  const junior = { agent: "jev-pilot:junior", task: "Do work", model: "local/deep" };
  const reviewer = { agent: "jev-pilot:codex-review", task: "Review work", model: "local/deep" };
  await f.call(junior);
  await f.call(reviewer);
  expect(f.selected(junior)).toBe("local/deep:high");
  expect(f.selected(reviewer)).toBe("local/deep:high");
  expect(f.requests()).toBe(0);
});

const expertModels = { ...configuredModels, expert: "local/expert" };
const withExpertNeeded = (choice: string, expertNeeded: unknown, risky = 0) => ({
  answers: {
    ...answer(choice, risky).answers,
    ...(expertNeeded === undefined ? {} : { expert_needed: expertNeeded }),
  },
});
const askExpert = async (
  f: Awaited<ReturnType<typeof fixture>>,
  response: { answers: Record<string, unknown> },
  baseline = "local/deep",
) => {
  f.response(response);
  const input = { agent: "worker", model: baseline, task: "Resolve the open design decision" };
  await f.call(input);
  return f.selected(input);
};

test("EXPERT-02 tier order is fast, balanced, deep, expert and expert is offered when configured", async () => {
  const f = await fixture();
  await configure(f, expertModels);
  await f.call({ agent: "worker", model: "local/deep", task: "Resolve the design decision" });
  expect(Object.keys(sentQuestions(f).tier!.criteria)).toEqual([
    "fast",
    "balanced",
    "deep",
    "expert",
  ]);
});

for (const absent of ["missing", "", "  "])
  test(`EXPERT-02 expert ${absent === "missing" ? "absent" : JSON.stringify(absent)} sends no expert choice, question or placeholder and the unchanged deep rubric`, async () => {
    const reference = await fixture();
    await configure(reference, configuredModels);
    await reference.call({ agent: "worker", model: "local/deep", task: "Resolve design" });
    const f = await fixture();
    await configure(
      f,
      absent === "missing" ? configuredModels : { ...configuredModels, expert: absent },
    );
    f.response(answer("deep"));
    const input = { agent: "worker", model: "local/fast", task: "Resolve design" };
    await f.call(input);
    expect(Object.keys(sentQuestions(f))).toEqual(["tier", "effort", "risky"]);
    expect(Object.keys(sentQuestions(f).tier!.criteria)).toEqual(["fast", "balanced", "deep"]);
    expect(JSON.stringify(f.payloads[0])).not.toContain("expert");
    expect(f.payloads[0]!.questions).toEqual(reference.payloads[0]!.questions);
    expect(f.selected(input)).toBe("local/deep:medium");
  });

test("EXPERT-02 a response without an expert answer is accepted when expert is absent", async () => {
  const f = await fixture();
  await configure(f, configuredModels);
  expect(await askExpert(f, answer("deep"), "local/fast")).toBe("local/deep:medium");
});

test("EXPERT-02 expert configured adds the choice, the fixed expert_needed question and differentiated rubrics", async () => {
  const reference = await fixture();
  await configure(reference, configuredModels);
  await reference.call({ agent: "worker", model: "local/deep", task: "Resolve design" });
  const f = await fixture();
  await configure(f, expertModels);
  await f.call({
    agent: "worker",
    model: "local/deep",
    task: "Resolve design",
    description: "per call text",
  });
  const asked = f.payloads[0]!.questions as Record<
    string,
    { type?: string; instructions?: string; criteria: Record<string, string> }
  >;
  expect(f.requests()).toBe(1);
  expect(Object.keys(asked).sort()).toEqual(["effort", "expert_needed", "risky", "tier"]);
  expect(asked.expert_needed!.type).toBe("noul");
  expect(Object.keys(asked.expert_needed!.criteria).sort()).toEqual(["false", "true"]);
  expect(asked.tier!.criteria.deep).not.toBe(
    sentQuestions(reference).tier!.criteria["deep" as never],
  );
  expect(asked.tier!.criteria.expert).toContain("exceptionally difficult");
  const fixed = JSON.stringify(asked.expert_needed);
  expect(fixed).not.toContain("per call text");
  expect(fixed).not.toContain("Resolve design");
  expect(JSON.stringify(asked.tier)).not.toMatch(/architect(?!ural)|oracle/i);
});

test("EXPERT-02 expert_needed 0.91 admits expert", async () => {
  const f = await fixture();
  await configure(f, expertModels);
  expect(await askExpert(f, withExpertNeeded("expert", { noul: 0.91 }))).toBe(
    "local/expert:medium",
  );
  expect(f.requests()).toBe(1);
});

test("EXPERT-02 expert_needed accepts the probability spelling", async () => {
  const f = await fixture();
  await configure(f, expertModels);
  expect(await askExpert(f, withExpertNeeded("expert", { probability: 0.99 }))).toBe(
    "local/expert:medium",
  );
});

for (const [name, value] of [
  ["exactly 0.9", { noul: 0.9 }],
  ["below", { noul: 0.2 }],
  ["missing", undefined],
  ["out of range", { noul: 1.5 }],
  ["non-numeric", { noul: "0.99" }],
  ["wrong shape", 0.99],
] as const)
  test(`EXPERT-02 expert_needed ${name} falls back to deep`, async () => {
    const f = await fixture();
    await configure(f, expertModels);
    expect(await askExpert(f, withExpertNeeded("expert", value), "local/fast")).toBe(
      "local/deep:medium",
    );
  });

test("EXPERT-02 a rejected expert choice never silently uses expert and keeps the baseline without deep", async () => {
  const f = await fixture();
  await configure(f, { fast: "local/fast", balanced: "local/balanced", expert: "local/expert" });
  expect(await askExpert(f, withExpertNeeded("expert", { noul: 0.9 }), "local/fast")).toBe(
    "local/fast:medium",
  );
  expect(await askExpert(f, withExpertNeeded("expert", { noul: 0.95 }), "local/fast")).toBe(
    "local/expert:medium",
  );
});

test("EXPERT-02 a non-expert choice is unaffected by a high expert_needed answer", async () => {
  const f = await fixture();
  await configure(f, expertModels);
  expect(await askExpert(f, withExpertNeeded("balanced", { noul: 0.99 }))).toBe(
    "local/balanced:medium",
  );
});

test("EXPERT-02 high risk alone never selects expert", async () => {
  const f = await fixture();
  await configure(f, expertModels);
  expect(await askExpert(f, withExpertNeeded("fast", { noul: 0.99 }, 0.95), "local/fast")).toBe(
    "local/deep:high",
  );
  expect(await askExpert(f, withExpertNeeded("deep", { noul: 0.99 }, 0.95), "local/fast")).toBe(
    "local/deep:high",
  );
});

test("EXPERT-02 risk override picks the highest non-expert tier when deep is absent", async () => {
  const f = await fixture();
  await configure(f, { fast: "local/fast", balanced: "local/balanced", expert: "local/expert" });
  expect(await askExpert(f, withExpertNeeded("fast", { noul: 0.99 }, 0.95), "local/fast")).toBe(
    "local/balanced:high",
  );
  await configure(f, { expert: "local/expert" });
  expect(await askExpert(f, withExpertNeeded("expert", { noul: 0.2 }, 0.95), "local/deep")).toBe(
    "local/deep:high",
  );
});

test("EXPERT-02 risk override cannot suppress an admitted expert choice or bypass a failed gate", async () => {
  const f = await fixture();
  await configure(f, expertModels);
  expect(await askExpert(f, withExpertNeeded("expert", { noul: 0.95 }, 0.95), "local/fast")).toBe(
    "local/expert:high",
  );
  expect(await askExpert(f, withExpertNeeded("expert", { noul: 0.9 }, 0.95), "local/fast")).toBe(
    "local/deep:high",
  );
});

test("EXPERT-02 a malformed response stays a schema error with expert configured", async () => {
  const f = await fixture();
  await configure(f, expertModels);
  expect(await askExpert(f, { answers: { tier: { choice: "expert" } } })).toBe("local/deep:high");
  expect(await askExpert(f, withExpertNeeded("expert", { noul: 0.99 }, 0.0), "local/deep")).toBe(
    "local/expert:medium",
  );
  f.response({
    answers: {
      ...withExpertNeeded("expert", { noul: 0.99 }).answers,
      tier: { choice: "expert", confidence: 7 },
    },
  });
  const input = { agent: "worker", model: "local/deep", task: "Resolve" };
  await f.call(input);
  expect(f.selected(input)).toBe("local/deep:high");
});

test("EXPERT-02 existing confidence gates still apply to the admitted expert model", async () => {
  const f = await fixture();
  await configure(f, expertModels);
  f.response({
    answers: {
      ...withExpertNeeded("expert", { noul: 0.99 }).answers,
      tier: { choice: "expert", confidence: 0.1 },
    },
  });
  const input = { agent: "worker", model: "local/deep", task: "Resolve" };
  await f.call(input);
  expect(f.selected(input)).toBe("local/deep:medium");
});

test("EXPERT-02 malformed expert identity names the setting and sends nothing", async () => {
  const f = await fixture();
  await configure(f, { ...configuredModels, expert: null });
  const input = { agent: "worker", model: "local/deep", task: "Resolve" };
  expect(await f.call(input)).toMatchObject({ block: true });
  expect(f.requests()).toBe(0);
});

test("FALLBACK-04 an unresolvable selected tier is reported with its setting and the next lower tier runs at its highest supported effort", async () => {
  const f = await fixture();
  await configure(f, { ...configuredModels, deep: "missing/unknown" });
  f.response(answer("deep"));
  const input = { agent: "worker", model: "local/fast", task: "Implement work" };
  await f.call(input);
  expect(f.selected(input)).toBe("local/balanced:high");
  expect(f.requests()).toBe(1);
  expect(f.notices).toHaveLength(1);
  expect(f.notices[0]).toContain("deep");
  expect(f.notices[0]).toContain("tiers.deep");
  expect(f.notices[0]).toContain("missing/unknown");
});

const fallbackCall = async (
  f: Awaited<ReturnType<typeof fixture>>,
  choice: string,
  baseline = "local/fast",
  risky = 0,
  tier: Record<string, unknown> = {},
) => {
  f.response(
    risky || choice === "expert"
      ? withExpertNeeded(choice, { noul: 0.99 }, risky)
      : answer(choice, risky, tier),
  );
  const input = { agent: "worker", model: baseline, task: "Implement work" };
  await f.call(input);
  return f.selected(input);
};
const registryModel = (f: Awaited<ReturnType<typeof fixture>>, id: string) =>
  f.ctx.modelRegistry.find("local", id)! as unknown as Record<string, unknown>;

for (const [levels, highest] of [
  [{}, "high"],
  [{ xhigh: "xhigh" }, "xhigh"],
  [{ xhigh: "xhigh", max: "max" }, "max"],
  [{ high: null, xhigh: "xhigh" }, "xhigh"],
] as const)
  test(`FALLBACK-04 a fallback tier whose model supports up to ${highest} runs at ${highest}`, async () => {
    const f = await fixture();
    await configure(f, { ...configuredModels, deep: "missing/unknown" });
    registryModel(f, "balanced").thinkingLevelMap = {
      low: "low",
      medium: "medium",
      high: "high",
      ...levels,
    };
    expect(await fallbackCall(f, "deep")).toBe(`local/balanced:${highest}`);
  });

test("FALLBACK-04 a fallback tier whose model has no reasoning runs at off", async () => {
  const f = await fixture();
  await configure(f, { ...configuredModels, deep: "missing/unknown" });
  registryModel(f, "balanced").reasoning = false;
  expect(await fallbackCall(f, "deep")).toBe("local/balanced:off");
});

test("FALLBACK-04 a usable selected tier keeps the classified effort and reports nothing", async () => {
  const f = await fixture();
  await configure(f, { ...configuredModels, fast: "missing/unknown" });
  expect(await fallbackCall(f, "balanced")).toBe("local/balanced:medium");
  expect(f.notices).toEqual([]);
});

test("FALLBACK-04 an admitted expert tier that cannot run cascades downward through every unusable tier", async () => {
  const f = await fixture();
  await configure(f, { ...expertModels, expert: "missing/expert", deep: "missing/deep" });
  expect(await fallbackCall(f, "expert")).toBe("local/balanced:high");
  expect(f.notices).toHaveLength(1);
  const report = f.notices[0]!;
  expect(report).toContain("tiers.expert");
  expect(report).toContain("tiers.deep");
  expect(report).not.toContain("Jev tier balanced");
  expect(report).toContain("Falling back to tier balanced");
  expect(report.indexOf("tiers.expert")).toBeLessThan(report.indexOf("tiers.deep"));
});

test("FALLBACK-04 the cascade stops at the first lower tier that runs", async () => {
  const f = await fixture();
  await configure(f, { ...configuredModels, deep: "missing/deep", balanced: "local/balanced" });
  expect(await fallbackCall(f, "deep")).toBe("local/balanced:high");
});

test("FALLBACK-04 expert is never a fallback for an unusable deep tier", async () => {
  const f = await fixture();
  await configure(f, { fast: "local/fast", deep: "missing/deep", expert: "local/expert" });
  expect(await fallbackCall(f, "deep", "local/balanced")).toBe("local/fast:high");
});

test("FALLBACK-04 no configured tier runs retains the baseline model and reports every tier tried", async () => {
  const f = await fixture();
  await configure(f, { balanced: "missing/balanced", deep: "missing/deep" });
  expect(await fallbackCall(f, "deep", "local/fast")).toBe("local/fast:medium");
  expect(f.notices).toHaveLength(1);
  expect(f.notices[0]).toContain("tiers.deep");
  expect(f.notices[0]).toContain("tiers.balanced");
  expect(f.notices[0]).toContain("keeping the retained worker model");
});

test("FALLBACK-04 the lowest tier unusable has nothing below it and retains the baseline", async () => {
  const f = await fixture();
  await configure(f, { fast: "missing/fast", deep: "local/deep" });
  expect(await fallbackCall(f, "fast", "local/deep")).toBe("local/deep:medium");
  expect(f.notices[0]).toContain("tiers.fast");
});

test("FALLBACK-04 a tier model without configured authentication is reported and cascades", async () => {
  const f = await fixture();
  await configure(f, configuredModels);
  f.ctx.modelRegistry.hasConfiguredAuth = (model) => model.id !== "deep";
  expect(await fallbackCall(f, "deep")).toBe("local/balanced:high");
  expect(f.notices[0]).toContain("tiers.deep");
  expect(f.notices[0]).toContain("target-unavailable");
});

test("FALLBACK-04 a tier model that launch preflight rejects, as a rate-limited provider drops out of the available models, is reported and cascades", async () => {
  const f = await fixture();
  await configure(f, configuredModels);
  const available = f.ctx.modelRegistry.getAvailable();
  f.ctx.modelRegistry.getAvailable = () => available.filter((model) => model.id !== "deep");
  expect(await fallbackCall(f, "deep")).toBe("local/balanced:high");
  expect(f.notices).toHaveLength(1);
  expect(f.notices[0]).toContain("tiers.deep");
  expect(f.notices[0]).toContain("local/deep");
});

test("FALLBACK-04 high risk moving work to an unusable deep tier cascades at the highest supported effort", async () => {
  const f = await fixture();
  await configure(f, { ...configuredModels, deep: "missing/deep" });
  expect(await fallbackCall(f, "fast", "local/fast", 0.95, { confidence: 0.01 })).toBe(
    "local/balanced:high",
  );
  registryModel(f, "balanced").thinkingLevelMap = { xhigh: "xhigh" };
  expect(await fallbackCall(f, "fast", "local/fast", 0.95, { confidence: 0.01 })).toBe(
    "local/balanced:xhigh",
  );
});

test("FALLBACK-04 tiers sharing an unusable model are all reported and the cascade continues below them", async () => {
  const f = await fixture();
  await configure(f, { fast: "local/fast", balanced: "missing/shared", deep: "missing/shared" });
  expect(await fallbackCall(f, "deep", "local/balanced")).toBe("local/fast:high");
  expect(f.notices[0]).toContain("tiers.deep");
  expect(f.notices[0]).toContain("tiers.balanced");
});

test("FALLBACK-04 an unusable tier that is not selected is not probed or reported", async () => {
  const f = await fixture();
  await configure(f, { ...configuredModels, deep: "missing/unknown" });
  expect(await fallbackCall(f, "balanced")).toBe("local/balanced:medium");
  expect(f.notices).toEqual([]);
});

test("FALLBACK-04 an invalid tier setting is still a configuration error even when another tier is unresolvable", async () => {
  const f = await fixture();
  await configure(f, { fast: "local/fast", balanced: null, deep: "missing/unknown" });
  const input = { agent: "worker", model: "local/fast", task: "Implement work" };
  expect(await f.call(input)).toMatchObject({ block: true });
  expect(f.requests()).toBe(0);
  expect(f.notices.join("\n")).toContain("tiers.balanced");
});

test("FALLBACK-04 a custom slot with an unresolvable model still fails before classification", async () => {
  const f = await fixture();
  await f.config({ crew: { mode: "budget", slots: [{ name: "alpha", model: "local/missing" }] } });
  await configure(f, { ...configuredModels, deep: "missing/unknown" });
  expect(
    await f.call({ agent: "worker", model: "local/fast", task: "Implement work" }),
  ).toMatchObject({ block: true });
  expect(f.requests()).toBe(0);
});

test("FALLBACK-04 the fallback is cancelled with the call and leaves the input untouched", async () => {
  const f = await fixture();
  await configure(f, { ...configuredModels, deep: "missing/unknown" });
  f.response(answer("deep"));
  f.delay(100);
  const input = { agent: "worker", model: "local/fast", task: "Implement work" };
  const pending = f.call(input);
  while (!f.requests()) await Bun.sleep(5);
  f.signal.abort();
  expect(await pending).toMatchObject({ block: true });
  expect(input.model).toBe("local/fast");
  expect(f.selected(input)).toBeUndefined();
  expect(f.notices).toEqual([]);
});

test("FALLBACK-04 an errored subagent tool_result from a rate-limited child run is not cascaded", async () => {
  const f = await fixture();
  await configure(f, configuredModels);
  expect(await fallbackCall(f, "deep")).toBe("local/deep:medium");
  const requests = f.requests();
  await f.fire("tool_result", {
    toolName: "subagent",
    toolCallId: "call",
    isError: true,
    content: [{ type: "text", text: "429 rate limit exceeded for local/deep" }],
    details: {},
  });
  expect(f.requests()).toBe(requests);
  expect(f.notices).toEqual([]);
  expect(f.controls).toEqual([]);
});

test("FALLBACK-04 a custom slot pick sharing a tier model stays outside tier handling when launch preflight rejects it", async () => {
  const f = await fixture();
  await f.config({ crew: { mode: "budget", slots: [{ name: "alpha", model: "local/deep" }] } });
  await configure(f, configuredModels);
  const available = f.ctx.modelRegistry.getAvailable();
  f.ctx.modelRegistry.getAvailable = () => available.filter((model) => model.id !== "deep");
  expect(await fallbackCall(f, "slot::alpha", "local/fast")).toBeUndefined();
  expect(f.requests()).toBe(0);
  expect(f.notices).toEqual([]);
});

// AC-1: two public preparations overlap while their independently captured policies differ.
test("WCFG-concurrent logical launches retain their own captured tiers", async () => {
  const f = await fixture();
  f.delay(100);
  f.response(answer("balanced"));
  const first = { agent: "worker", model: "local/fast", task: "First local worker" };
  const second = { agent: "worker", model: "local/fast", task: "Second local worker" };
  const pending = f.call(first, "first");
  const deadline = Date.now() + 3000;
  while (f.requests() < 1 && Date.now() < deadline) await Bun.sleep(5);
  expect(f.requests()).toBe(1);
  await f.config({ tiers: { balanced: "local/deep" } });
  await f.call(second, "second");
  await pending;
  expect(f.selected(first)).toBe("local/balanced:medium");
  expect(f.selected(second)).toBe("local/deep:medium");
});

test("disabled worker direct boundary rejects malformed configuration", async () => {
  const f = await fixture();
  await f.config({ workerRoutingEnabled: false });
  await f.fire("session_start");
  await writeFile(join(process.env.PI_CODING_AGENT_DIR!, "jev-pilot.json"), "{");
  await expect(f.call({ agent: "worker", task: "work" })).rejects.toThrow("expected valid JSON");
  expect(f.requests()).toBe(0);
});
