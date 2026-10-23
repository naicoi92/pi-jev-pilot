import { afterEach, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { PiFixture, answer, type RecordData } from "./fixtures/pi-cli.ts";

const task = "Please review the complete patch with particular care for failure modes";
const config = {
  mainRoutingEnabled: true,
  tiers: {
    fast: "fixture-fast/lookup",
    balanced: "fixture/fixture-model",
    deep: "fixture-deep/judgment",
  },
};
let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});
function routed(tier = "deep", level = "high", confidence = 0.95, risky = 0): RecordData {
  return {
    answers: {
      ...(answer(level).answers as RecordData),
      tier: { choice: tier, confidence },
      risky: { noul: risky },
    },
  };
}
async function start(
  env: Record<string, string> = {},
  tiers: Partial<typeof config.tiers> = {},
): Promise<PiFixture> {
  fixture = new PiFixture();
  fixture.selectRouter = true;
  fixture.response = routed();
  return fixture.startWithRouting({ ...config, tiers: { ...config.tiers, ...tiers } }, env);
}

test("MAIN-05a virtual selection dispatches configured deep with one combined decision", async () => {
  const f = await start();
  await f.prompt(task);
  expect((await f.command("get_state")).data).toMatchObject({
    model: { provider: "jev", id: "auto" },
  });
  expect(f.generations).toHaveLength(1);
  expect(f.generations[0]).toMatchObject({ model: "judgment", reasoning_effort: "high" });
  expect(f.classifications).toHaveLength(1);
  const entries = ((await f.command("get_entries")).data as { entries: { message?: RecordData }[] })
    .entries;
  expect(entries.findLast((entry) => entry.message?.role === "assistant")?.message).toMatchObject({
    provider: "fixture-deep",
    model: "judgment",
    thinkingLevel: "high",
  });
  expect(Object.keys(f.classifications[0]!.questions as object).sort()).toEqual([
    "effort",
    "risky",
    "tier",
  ]);
}, 20000);

test("MAIN-05b effort-disabled routing asks tier and risk only", async () => {
  const f = await start({ JEV_EFFORT_ENABLED: "false" });
  f.response = { answers: { tier: { choice: "fast", confidence: 0.99 }, risky: { noul: 0 } } };
  await f.prompt(task);
  expect(f.generations[0]).toMatchObject({ model: "lookup", reasoning_effort: "medium" });
  expect(Object.keys(f.classifications[0]!.questions as object).sort()).toEqual(["risky", "tier"]);
}, 20000);

test("MAIN-05c non-reasoning candidate set omits unused effort questions", async () => {
  const f = await start(
    {},
    {
      fast: "fixture/fixture-plain-model",
      balanced: "fixture/fixture-plain-model",
      deep: "fixture/fixture-plain-model",
    },
  );
  f.response = { answers: { tier: { choice: "deep", confidence: 0.99 }, risky: { noul: 0 } } };
  await f.prompt(task);
  expect(f.generations[0]!.model).toBe("fixture-plain-model");
  expect(Object.keys(f.classifications[0]!.questions as object).sort()).toEqual(["risky", "tier"]);
}, 20000);

test("MAIN-02a default-off ignores unused tier config without changing physical selection or defaults", async () => {
  fixture = new PiFixture();
  fixture.settings = { jevPilot: { tiers: { fast: "invalid" } } };
  await fixture.start();
  const settings = await Bun.file(`${fixture.directory}/agent/settings.json`).text();
  await fixture.prompt(task);
  expect(fixture.generations[0]!.model).toBe("fixture-model");
  expect((await fixture.command("get_state")).data).toMatchObject({
    model: { provider: "fixture", id: "fixture-model" },
  });
  expect(await Bun.file(`${fixture.directory}/agent/settings.json`).text()).toBe(settings);
  expect((await fixture.command("get_available_models")).data).not.toMatchObject({
    models: expect.arrayContaining([expect.objectContaining({ provider: "jev" })]),
  });
}, 20000);

test("MAIN-02b enabled physical selection remains explicit effort-only", async () => {
  fixture = new PiFixture();
  await fixture.startWithRouting(config);
  await fixture.prompt(task);
  expect(fixture.generations[0]!.model).toBe("fixture-model");
  expect(Object.keys(fixture.classifications[0]!.questions as object).sort()).toEqual([
    "effort",
    "risky",
  ]);
}, 20000);

test("MAIN-02c duplicate tier identities are permitted without changing global defaults", async () => {
  const f = await start(
    {},
    {
      fast: config.tiers.balanced,
      deep: config.tiers.balanced,
    },
  );
  const settings = await Bun.file(`${f.directory}/agent/settings.json`).text();
  await f.prompt(task);
  expect(f.generations[0]!.model).toBe("fixture-model");
  expect(await Bun.file(`${f.directory}/agent/settings.json`).text()).toBe(settings);
}, 20000);

for (const invalid of ["", "unqualified", "fixture/not-found", "jev/auto"]) {
  test(`MAIN-13a invalid tier target ${JSON.stringify(invalid)} stops without substitution`, async () => {
    const f = await start({}, { fast: invalid });
    await f.prompt(task);
    expect(f.generations).toHaveLength(0);
    expect(f.classifications).toHaveLength(0);
    expect(JSON.stringify(f.records)).toMatch(/qualified physical|exact physical/);
  }, 20000);
}
test("MAIN-13b unauthenticated tier stops without probing another provider", async () => {
  fixture = new PiFixture();
  fixture.configuredModelKey = false;
  fixture.selectRouter = true;
  await fixture.startWithRouting(config);
  await fixture.prompt(task);
  expect(fixture.generations).toHaveLength(0);
  expect(fixture.classifications).toHaveLength(0);
  expect(JSON.stringify(fixture.records)).toContain(
    "Configure Pi authentication for Jev target fixture/fixture-model",
  );
}, 20000);

test("MAIN-13c initial classifier failure uses configured balanced as an explicit default", async () => {
  const f = await start();
  f.status = 503;
  await f.prompt(task);
  expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "medium" });
  expect(await routeReceipt(f)).toMatchObject({
    physical: config.tiers.balanced,
    source: "default",
    outcome: "service-error",
    decision: null,
  });
}, 20000);

test("MAIN-13d classifier failure preserves valid previous physical route", async () => {
  const f = await start();
  await f.prompt(task);
  f.status = 503;
  await f.prompt("Please investigate this different failure in full detail before proceeding");
  expect(f.generations.at(-1)).toMatchObject({ model: "judgment", reasoning_effort: "medium" });
  expect(await routeReceipt(f)).toMatchObject({
    physical: config.tiers.deep,
    source: "retained",
    outcome: "service-error",
  });
}, 20000);

test("MAIN-07a real tool continuation keeps route without another classification", async () => {
  const f = await start();
  const path = `${f.directory}/read-me.txt`;
  await writeFile(path, "tool fixture");
  f.nextReadPath = path;
  await f.prompt(task);
  expect(f.generations).toHaveLength(2);
  expect(f.generations.map((request) => [request.model, request.reasoning_effort])).toEqual([
    ["judgment", "high"],
    ["judgment", "high"],
  ]);
  expect(f.classifications).toHaveLength(1);
}, 20000);

test("MAIN-07b ordinary provider retry keeps route without cross-provider failover", async () => {
  const f = await start();
  f.modelFailures = 3;
  await f.command("set_auto_retry", { enabled: true });
  await f.prompt(task);
  expect(f.generations.length).toBeGreaterThan(3);
  expect(
    new Set(f.generations.map((request) => `${request.model}/${request.reasoning_effort}`)),
  ).toEqual(new Set(["judgment/high"]));
  expect(f.classifications).toHaveLength(1);
}, 30000);

test("MAIN-07c plain continuation reuses route while approval reclassifies", async () => {
  const f = await start();
  await f.prompt(task);
  f.response = routed("fast", "low");
  await f.prompt("continue");
  expect(f.generations.at(-1)!.model).toBe("judgment");
  expect(f.classifications).toHaveLength(1);
  expect(await routeReceipt(f)).toMatchObject({ outcome: "reused" });
  await f.prompt("go ahead");
  expect(f.generations.at(-1)).toMatchObject({ model: "lookup", reasoning_effort: "medium" });
  expect(f.classifications).toHaveLength(2);
  expect(JSON.stringify(f.classifications.at(-1))).toContain("Fixture answer");
}, 20000);

test("MAIN-26a reload and resume retain the selected router and branch decision", async () => {
  const f = await start();
  await f.prompt(task);
  const state = (await f.command("get_state")).data as { sessionFile: string };
  await f.command("prompt", { message: "/fixture-reload" });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  expect(f.generations.at(-1)!.model).toBe("judgment");
  await f.command("new_session");
  await f.command("switch_session", { sessionPath: state.sessionFile });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  expect(f.generations.at(-1)!.model).toBe("judgment");
  expect((await f.command("get_state")).data).toMatchObject({
    model: { provider: "jev", id: "auto" },
  });
}, 20000);

test("MAIN-26b fork and tree excluding a decision cannot reuse it", async () => {
  const f = await start();
  await f.prompt(task);
  const original = (await f.command("get_state")).data as { sessionFile: string };
  const entries = (
    (await f.command("get_entries")).data as {
      entries: { id: string; message?: { role: string } }[];
    }
  ).entries;
  const user = entries.find((entry) => entry.message?.role === "user")!;
  const prefix = entries[entries.indexOf(user) - 1]!;
  f.response = routed("fast", "low");
  await f.command("fork", { entryId: user.id });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(2);
  expect(f.generations.at(-1)!.model).toBe("lookup");
  await f.command("switch_session", { sessionPath: original.sessionFile });
  await f.command("prompt", { message: `/fixture-tree ${prefix.id}` });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(3);
  expect(f.generations.at(-1)!.model).toBe("lookup");
}, 20000);

test("MAIN-26c compaction uses retained route without classifying summary work", async () => {
  const f = await start();
  f.modelText = "Context for compaction. ".repeat(200);
  for (let i = 0; i < 6; i++)
    await f.prompt(`Please investigate complete failure mode number ${i} with careful reasoning`);
  const count = f.classifications.length;
  await f.command("compact");
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(count);
  expect(new Set(f.generations.map((entry) => entry.model))).toEqual(new Set(["judgment"]));
}, 20000);

test("MAIN-26d new session has no reusable route decision", async () => {
  const f = await start();
  await f.prompt(task);
  await f.command("new_session");
  await f.command("set_model", { provider: "jev", modelId: "auto" });
  f.status = 503;
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(2);
  expect(f.generations.at(-1)!.model).toBe("fixture-model");
  expect(await routeReceipt(f)).toMatchObject({ source: "default", decision: null });
}, 20000);

for (const selection of ["thinking", "model"]) {
  test(`MAIN-26e manual ${selection} invalidates in-flight routing`, async () => {
    const f = await start({ JEV_TIMEOUT_MS: "5000" });
    f.classifierDelay = 300;
    const offset = f.records.length;
    await f.command("prompt", { message: task });
    await f.wait(() => f.classifications.length === 1);
    if (selection === "thinking") await f.command("set_thinking_level", { level: "low" });
    else await f.command("set_model", { provider: "fixture", modelId: "fixture-other-model" });
    await f.wait(() => f.records.slice(offset).some((entry) => entry.type === "agent_settled"));
    await Bun.sleep(350);
    expect(await routeReceipt(f)).toBeUndefined();
    expect(f.generations).toHaveLength(0);
    await f.wait(() => f.classifierAborts === 1);
    expect((await f.command("get_state")).data).toMatchObject(
      selection === "thinking"
        ? { model: { provider: "jev", id: "auto" }, thinkingLevel: "low" }
        : { model: { provider: "fixture", id: "fixture-other-model" } },
    );
    f.classifierDelay = 0;
    await f.prompt(task);
    expect(f.classifications).toHaveLength(2);
    expect(f.generations.at(-1)!.model).toBe(
      selection === "thinking" ? "judgment" : "fixture-other-model",
    );
  }, 20000);
}

test("MAIN-26f parent abort stops classification without fallback generation", async () => {
  const f = await start({ JEV_TIMEOUT_MS: "5000" });
  f.classifierDelay = 2000;
  const offset = f.records.length;
  await f.command("prompt", { message: task });
  await f.wait(() => f.classifications.length === 1);
  await f.command("abort");
  await f.wait(() => f.records.slice(offset).some((entry) => entry.type === "agent_settled"));
  await f.wait(() => f.classifierAborts === 1);
  expect(f.generations).toHaveLength(0);
  expect(await routeReceipt(f)).toBeUndefined();
}, 20000);

test("MAIN-26g deadline aborts HTTP and dispatches default route", async () => {
  const f = await start({ JEV_TIMEOUT_MS: "100" });
  f.classifierDelay = 1500;
  await f.prompt(task);
  await f.wait(() => f.classifierAborts === 1);
  expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "medium" });
  expect(await routeReceipt(f)).toMatchObject({
    source: "default",
    outcome: "timeout",
    decision: null,
  });
}, 20000);

test("MAIN-05d fresh user routing uses current selected thinking rather than old dispatch effort", async () => {
  const f = await start();
  await f.prompt(task);
  await f.command("set_thinking_level", { level: "low" });
  const response = routed("deep", "high", 0.99);
  (response.answers as RecordData).effort = { choice: "high", confidence: 0.1 };
  f.response = response;
  await f.prompt(task);
  expect(f.generations.at(-1)).toMatchObject({ model: "judgment", reasoning_effort: "low" });
}, 20000);

test("MAIN-05e disabling effort preserves current virtual input on plain continuation", async () => {
  const f = await start();
  await f.prompt(task);
  await f.command("prompt", { message: "/fixture-effort false" });
  await f.command("set_thinking_level", { level: "low" });
  await f.prompt("continue");
  expect(f.generations.at(-1)).toMatchObject({ model: "judgment", reasoning_effort: "low" });
  expect(f.classifications).toHaveLength(1);
}, 20000);

test("MAIN-05f fresh classifier failure retains physical model but respects current thinking input", async () => {
  const f = await start();
  await f.prompt(task);
  f.status = 503;
  await f.command("set_thinking_level", { level: "low" });
  await f.prompt(task);
  expect(f.generations.at(-1)).toMatchObject({ model: "judgment", reasoning_effort: "low" });
}, 20000);

test("MAIN-13e invalid previous route errors instead of silently using balanced", async () => {
  const f = await start();
  await f.prompt(task);
  const path = `${f.directory}/agent/models.json`;
  const models = await Bun.file(path).json();
  // Keep every configured target valid, but remove the formerly routed physical
  // identity after it is no longer a tier mapping.
  models.providers["fixture-deep"].models = [
    { id: "replacement", reasoning: true, input: ["text"], contextWindow: 32000, maxTokens: 512 },
  ];
  await writeFile(path, JSON.stringify(models));
  await f.command("prompt", { message: "/fixture-model-refresh" });
  await f.command("prompt", { message: "/fixture-tier-deep fixture-deep/replacement" });
  const generations = f.generations.length;
  await f.prompt(task);
  expect(f.generations).toHaveLength(generations);
  expect(JSON.stringify(f.records)).toContain("exact physical Pi model");
}, 20000);

for (const policy of [
  { name: "upgrade at .3", tier: "deep", confidence: 0.3, risky: 0, model: "judgment" },
  { name: "upgrade below .3", tier: "deep", confidence: 0.29, risky: 0, model: "fixture-model" },
  { name: "downgrade at .6", tier: "fast", confidence: 0.6, risky: 0, model: "lookup" },
  { name: "downgrade below .6", tier: "fast", confidence: 0.59, risky: 0, model: "fixture-model" },
  { name: "risk above .7", tier: "fast", confidence: 0.01, risky: 0.71, model: "judgment" },
  { name: "risk at .7", tier: "fast", confidence: 0.01, risky: 0.7, model: "fixture-model" },
]) {
  test(`MAIN-03 ${policy.name} reaches physical dispatch`, async () => {
    const f = await start();
    f.response = routed(policy.tier, "low", policy.confidence, policy.risky);
    await f.prompt(task);
    expect(f.generations[0]!.model).toBe(policy.model);
  }, 20000);
}
for (const tier of [
  { choice: "invented" },
  { choice: "deep", confidence: 2 },
  { choice: "deep", probabilities: { fast: -1, deep: 2 } },
]) {
  test(`MAIN-13f malformed tier ${JSON.stringify(tier)} keeps valid default`, async () => {
    const f = await start();
    const response = routed();
    (response.answers as RecordData).tier = tier;
    f.response = response;
    await f.prompt(task);
    expect(f.generations[0]!.model).toBe("fixture-model");
    expect(await routeReceipt(f)).toMatchObject({ source: "default", outcome: "schema-error" });
  }, 20000);
}

test("MAIN-02d disabled capabilities make zero HTTP with unused invalid service config", async () => {
  fixture = new PiFixture();
  fixture.settings = { jevPilot: { tiers: { fast: "invalid" } } };
  await fixture.start({
    JEV_EFFORT_ENABLED: "false",
    JEV_SYSTEM_ONE_URL: "invalid",
  });
  await fixture.prompt(task);
  expect(fixture.classifications).toHaveLength(0);
  expect(fixture.generations[0]!.model).toBe("fixture-model");
}, 20000);

test("MAIN-26h queued steering continuation reuses the immediately preceding decision", async () => {
  const f = await start();
  f.modelDelay = 200;
  await f.command("set_steering_mode", { mode: "all" });
  const offset = f.records.length;
  await f.command("prompt", { message: task });
  await f.wait(() => f.generations.length === 1);
  f.response = routed("fast", "low");
  await f.command("steer", {
    message: "Please look up the named symbol in the files and report its location",
  });
  await f.command("steer", { message: "continue" });
  await f.wait(() => f.records.slice(offset).some((entry) => entry.type === "agent_settled"));
  expect(f.classifications).toHaveLength(2);
  expect(f.generations.at(-1)!.model).toBe("lookup");
  expect(f.classifications.at(-1)!.state).toMatchObject({
    prompt: "Please look up the named symbol in the files and report its location",
  });
}, 20000);

test("MAIN-26i fork including completed route keeps its decision", async () => {
  const f = await start();
  await f.prompt(task);
  const entries = (
    (await f.command("get_entries")).data as {
      entries: { id: string; message?: { role: string } }[];
    }
  ).entries;
  const response = entries.findLast((entry) => entry.message?.role === "assistant")!;
  await f.command("prompt", { message: `/fixture-fork-at ${response.id}` });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  expect(f.generations.at(-1)!.model).toBe("judgment");
}, 20000);

test("MAIN-26j abort during physical streaming stops provider transport without fallback", async () => {
  const f = await start();
  f.modelDelay = 2000;
  const offset = f.records.length;
  await f.command("prompt", { message: task });
  await f.wait(() => f.generations.length === 1);
  await f.command("abort");
  await f.wait(() => f.records.slice(offset).some((entry) => entry.type === "agent_settled"));
  await f.wait(() => f.modelAborts === 1);
  expect(f.generations).toHaveLength(1);
  expect(f.classifications).toHaveLength(1);
}, 20000);

for (const batch of [
  {
    id: "k",
    messages: [
      "Please inspect the implementation and suggest a safe plan",
      "Please look up the symbol and report its location",
      "continue",
    ],
    anchor: "Please look up the symbol and report its location",
    calls: 2,
    model: "lookup",
  },
  { id: "l", messages: ["continue", "keep going"], anchor: undefined, calls: 1, model: "judgment" },
  {
    id: "m",
    messages: ["Please look up the symbol and report its location", "yes"],
    anchor: "yes",
    calls: 2,
    model: "lookup",
  },
]) {
  test(`MAIN-26${batch.id} trailing user batch chooses its approved anchor`, async () => {
    const f = await start();
    f.modelDelay = 200;
    await f.command("set_steering_mode", { mode: "all" });
    const offset = f.records.length;
    await f.command("prompt", { message: task });
    await f.wait(() => f.generations.length === 1);
    f.response = routed("fast", "low");
    for (const message of batch.messages) await f.command("steer", { message });
    await f.wait(() => f.records.slice(offset).some((entry) => entry.type === "agent_settled"));
    expect(f.classifications).toHaveLength(batch.calls);
    expect(f.generations.at(-1)!.model).toBe(batch.model);
    if (batch.anchor)
      expect(f.classifications.at(-1)!.state).toMatchObject({ prompt: batch.anchor });
  }, 20000);
}

test("MAIN-26n continuation without a prior decision classifies its own prompt", async () => {
  const f = await start();
  f.response = routed("fast", "low");
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  expect(f.classifications[0]!.state).toMatchObject({ prompt: "continue" });
  expect(f.generations[0]!.model).toBe("lookup");
}, 20000);

test("MAIN-26o queued work after a tool result creates only one new batch decision", async () => {
  const f = await start();
  const path = `${f.directory}/tool.txt`;
  await writeFile(path, "fixture");
  f.nextReadPath = path;
  f.modelDelay = 200;
  await f.command("set_steering_mode", { mode: "all" });
  const offset = f.records.length;
  await f.command("prompt", { message: task });
  await f.wait(() => f.generations.length === 2);
  f.response = routed("fast", "low");
  await f.command("steer", { message: "Please look up another symbol and report its location" });
  await f.command("steer", { message: "continue" });
  await f.wait(() => f.records.slice(offset).some((entry) => entry.type === "agent_settled"));
  expect(f.classifications).toHaveLength(2);
  expect(f.classifications.at(-1)!.state).toMatchObject({
    prompt: "Please look up another symbol and report its location",
  });
  expect(f.generations.at(-1)!.model).toBe("lookup");
}, 20000);

test("MAIN-13g fresh failure keeps latest successful physical selection instead of old Jev state", async () => {
  const f = await start();
  await f.prompt(task);
  await f.command("set_model", { provider: "fixture-fast", modelId: "lookup" });
  f.response = answer("low");
  await f.prompt(task);
  await f.command("set_model", { provider: "jev", modelId: "auto" });
  f.status = 503;
  await f.prompt(task);
  expect(f.generations.at(-1)!.model).toBe("lookup");
  f.status = 200;
  f.response = routed("fast", "low");
  await f.prompt(task);
  expect(f.generations.at(-1)!.model).toBe("lookup");
  // A reusable decision does not turn the previous manual physical model into
  // an immutable pin: a later eligible decision can still upgrade it.
  f.response = routed("deep");
  await f.prompt(task);
  expect(f.generations.at(-1)!.model).toBe("judgment");
}, 20000);

test("MAIN-13h invalid selected previous is not masked by valid saved Jev state", async () => {
  const f = await start();
  await f.prompt(task);
  await f.command("set_model", { provider: "fixture", modelId: "fixture-other-model" });
  f.response = answer();
  await f.prompt(task);
  await f.command("set_model", { provider: "jev", modelId: "auto" });
  const path = `${f.directory}/agent/models.json`;
  const models = await Bun.file(path).json();
  models.providers.fixture.models = models.providers.fixture.models.filter(
    (model: { id: string }) => model.id !== "fixture-other-model",
  );
  await writeFile(path, JSON.stringify(models));
  await f.command("prompt", { message: "/fixture-model-refresh" });
  const count = f.generations.length;
  await f.prompt(task);
  expect(f.generations).toHaveLength(count);
  expect(JSON.stringify(f.records)).toContain(
    "fixture/fixture-other-model must resolve to an exact physical Pi model",
  );
}, 20000);

test("MAIN-13i unused stale saved identity cannot block valid latest physical baseline", async () => {
  const f = await start();
  await f.prompt(task);
  await f.command("set_model", { provider: "fixture-fast", modelId: "lookup" });
  f.response = answer();
  await f.prompt(task);
  await f.command("set_model", { provider: "jev", modelId: "auto" });
  const path = `${f.directory}/agent/models.json`;
  const models = await Bun.file(path).json();
  models.providers["fixture-deep"].models = [
    { id: "replacement", reasoning: true, input: ["text"], contextWindow: 32000, maxTokens: 512 },
  ];
  await writeFile(path, JSON.stringify(models));
  await f.command("prompt", { message: "/fixture-model-refresh" });
  await f.command("prompt", { message: "/fixture-tier-deep fixture-deep/replacement" });
  f.status = 503;
  await f.prompt(task);
  expect(f.generations.at(-1)!.model).toBe("lookup");
}, 20000);

test("MAIN-13j latest successful target missing auth errors instead of using saved route", async () => {
  const f = await start();
  await f.prompt(task);
  await f.command("set_model", { provider: "fixture-fast", modelId: "lookup" });
  f.response = answer();
  await f.prompt(task);
  await f.command("set_model", { provider: "jev", modelId: "auto" });
  const path = `${f.directory}/agent/models.json`;
  const models = await Bun.file(path).json();
  delete models.providers["fixture-fast"].apiKey;
  await writeFile(path, JSON.stringify(models));
  await f.command("prompt", { message: "/fixture-model-refresh" });
  const count = f.generations.length;
  await f.prompt(task);
  expect(f.generations).toHaveLength(count);
  expect(JSON.stringify(f.records)).toContain(
    "Configure Pi authentication for Jev target fixture-fast/lookup",
  );
}, 20000);

async function routeReceipt(f: PiFixture): Promise<RecordData | undefined> {
  const data = (await f.command("get_entries")).data as {
    entries: { customType?: string; data?: { provider?: string; state?: RecordData } }[];
  };
  return data.entries
    .filter(
      (entry) => entry.customType === "pi.virtual-model-state" && entry.data?.provider === "jev",
    )
    .at(-1)?.data?.state;
}

test("MAIN-06 requested xhigh is recorded separately from supported high", async () => {
  const f = await start();
  f.response = routed("deep", "xhigh");
  await f.prompt(task);
  expect(await routeReceipt(f)).toMatchObject({
    physical: "fixture-deep/judgment",
    requested: "xhigh",
    effective: "high",
    source: "decision",
  });
  expect(f.generations[0]).toMatchObject({ model: "judgment", reasoning_effort: "high" });
}, 20000);
