import { afterEach, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { PiFixture, answer, type RecordData } from "./fixtures/pi-cli.ts";

let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});
const task = "Please debug this failing test and implement the fully specified repair";
const body =
  "# Debug procedure\nRead references/steps.md, then reproduce the failure. SELECTED_BODY_TOKEN";
const routing = {
  mainRoutingEnabled: true,
  tiers: {
    fast: "fixture-fast/lookup",
    balanced: "fixture/fixture-model",
    deep: "fixture-deep/judgment",
  },
};
function response(name = "debugging", confidence = 0.9, gate = 0.9): RecordData {
  return {
    answers: {
      ...(answer().answers as RecordData),
      tier: { choice: "deep", confidence: 0.95 },
      which: { choice: name, confidence },
      "gate::acts_on_user_system": { noul: gate },
      "gate::would_follow_documented_procedure": { noul: gate },
      "gate::prose_suffices": { noul: 1 - gate },
    },
  };
}
async function start(env: Record<string, string> = {}, virtual = false): Promise<PiFixture> {
  fixture = new PiFixture();
  fixture.skills = [
    { name: "debugging", body },
    { name: "slides", body: "UNSELECTED_BODY_TOKEN" },
  ];
  fixture.response = response();
  if (virtual) {
    fixture.selectRouter = true;
  }
  return fixture.startWithRouting(virtual ? routing : {}, env);
}
function providerText(f: PiFixture, index = 0): string {
  const messages = f.generations[index]?.messages as
    | { content: string | { text?: string }[] }[]
    | undefined;
  return (messages ?? [])
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : (message.content ?? []).map((part) => part.text ?? "").join("\n"),
    )
    .join("\n");
}
function questions(f: PiFixture, index = 0): Record<string, RecordData> {
  return f.classifications[index]!.questions as Record<string, RecordData>;
}

test("SK14-content selected real resource body reaches provider without resource mutation", async () => {
  const f = await start();
  const path = `${f.directory}/agent/skills/debugging/SKILL.md`;
  const original = await readFile(path, "utf8");
  await f.prompt(task);
  expect(providerText(f)).toContain(body);
  expect(providerText(f)).toContain(`${f.directory}/agent/skills/debugging`);
  expect(providerText(f).split("SELECTED_BODY_TOKEN")).toHaveLength(2);
  expect(providerText(f)).not.toContain("UNSELECTED_BODY_TOKEN");
  expect(providerText(f)).toContain("<available_skills>");
  expect(await readFile(path, "utf8")).toBe(original);
}, 20000);

for (const virtual of [false, true]) {
  test(`SK09-${virtual ? "virtual" : "physical"} ordinary skill and routing share one request`, async () => {
    const f = await start({}, virtual);
    await f.prompt(task);
    expect(f.classifications).toHaveLength(1);
    expect(Object.keys(questions(f)).sort()).toEqual([
      "effort",
      "gate::acts_on_user_system",
      "gate::prose_suffices",
      "gate::would_follow_documented_procedure",
      "risky",
      ...(virtual ? ["tier"] : []),
      "which",
    ]);
    expect(f.generations[0]).toMatchObject({
      model: virtual ? "judgment" : "fixture-model",
      reasoning_effort: "high",
    });
    expect(providerText(f)).toContain("SELECTED_BODY_TOKEN");
  }, 20000);
}

for (const [name, confidence, gate, selected] of [
  ["(none)", 0.99, 0.99, false],
  ["debugging", 0.5, 0.09, true],
  ["debugging", 0.49, 0.29, false],
  ["debugging", 0.3, 0.3, true],
  ["debugging", 0.299, 0.9, false],
  ["debugging", undefined, 0.9, false],
] as const) {
  test(`SK14-policy ${name} confidence=${confidence} gate=${gate}`, async () => {
    const f = await start();
    const value = response(name, confidence, gate);
    if (confidence === undefined)
      delete ((value.answers as RecordData).which as RecordData).confidence;
    f.response = value;
    await f.prompt(task);
    expect(providerText(f).includes("SELECTED_BODY_TOKEN")).toBe(selected);
    expect(f.classifications).toHaveLength(1);
  }, 20000);
}

test("SK14-eligibility explicit skill invocation bypasses ordinary matching", async () => {
  const f = await start();
  await f.prompt("/skill:slides make a deck");
  expect(f.classifications).toHaveLength(0);
  expect(providerText(f)).toContain("UNSELECTED_BODY_TOKEN");
  expect(providerText(f)).not.toContain("<skill_relevance>");
}, 20000);

for (const nonReasoning of [false, true]) {
  test(`SK09-gating skill-only ${nonReasoning ? "non-reasoning" : "effort-disabled"}`, async () => {
    const f = await start({ JEV_EFFORT_ENABLED: "false" });
    if (nonReasoning) {
      await f.command("set_model", { provider: "fixture", modelId: "fixture-plain-model" });
      await f.command("prompt", { message: "/fixture-effort true" });
    }
    await f.prompt(task);
    expect(Object.keys(questions(f)).sort()).toEqual([
      "gate::acts_on_user_system",
      "gate::prose_suffices",
      "gate::would_follow_documented_procedure",
      "which",
    ]);
    expect(providerText(f)).toContain("SELECTED_BODY_TOKEN");
    const entries = (
      (await f.command("get_entries")).data as { entries: { customType?: string }[] }
    ).entries;
    expect(
      entries.filter((entry) => entry.customType === "jev-pilot:effort-application"),
    ).toHaveLength(0);
  }, 20000);
}

test("SK09-gating disabled matching leaves standalone effort routing", async () => {
  const f = await start({ JEV_SKILLS_ENABLED: "false" });
  await f.prompt(task);
  expect(Object.keys(questions(f)).sort()).toEqual(["effort", "risky"]);
  expect(providerText(f)).not.toContain("<skill_relevance>");
}, 20000);

test("SK09-gating both disabled means zero HTTP with unusable classifier config", async () => {
  const f = await start({
    JEV_SKILLS_ENABLED: "false",
    JEV_EFFORT_ENABLED: "false",
    JEV_SYSTEM_ONE_URL: "invalid",
    JEV_SYSTEM_ONE_API_KEY: "",
  });
  await f.prompt(task);
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(1);
  expect(providerText(f)).not.toContain("<skill_relevance>");
}, 20000);

test("SK14-eligibility disabled-model-invocation is not offered; empty eligible roster routes alone", async () => {
  fixture = new PiFixture();
  fixture.skills = [{ name: "private-procedure", disabled: true, body: "NEVER_TRANSMIT_TOKEN" }];
  await fixture.start();
  await fixture.prompt(task);
  expect(Object.keys(questions(fixture)).sort()).toEqual(["effort", "risky"]);
  expect(JSON.stringify(fixture.classifications)).not.toContain("NEVER_TRANSMIT_TOKEN");
  expect(providerText(fixture)).not.toContain("NEVER_TRANSMIT_TOKEN");
}, 20000);

test("SK09-gating empty eligible roster with inapplicable effort performs zero HTTP", async () => {
  fixture = new PiFixture();
  fixture.reasoning = false;
  fixture.skills = [{ name: "manual-only", disabled: true, body: "BARRED_BODY" }];
  await fixture.start({ JEV_SYSTEM_ONE_URL: "invalid", JEV_SYSTEM_ONE_API_KEY: "" });
  await fixture.prompt(task);
  expect(fixture.classifications).toHaveLength(0);
  expect(fixture.generations).toHaveLength(1);
}, 20000);

for (const rerank of [false, true]) {
  test(`SK10-excerpts ${rerank ? "rerank shortlist" : "ordinary"} transmits bounded resource text only`, async () => {
    fixture = new PiFixture();
    fixture.skills = [
      {
        name: "debugging",
        description: "Debug failing tests",
        body: "X".repeat(300) + "PRIVATE_RESOURCE_TAIL",
      },
    ];
    fixture.classifierResponse = (request) =>
      (request.questions as RecordData)["fits::debugging"]
        ? { answers: { which: { choice: "debugging" }, "fits::debugging": { noul: 0.9 } } }
        : response();
    const f = await fixture.start({ JEV_SKILL_RERANK: String(rerank) });
    await f.prompt(task);
    const firstCriteria = questions(f).which!.criteria as RecordData;
    expect(firstCriteria.debugging).toBe(
      rerank ? "Debug failing tests" : `Debug failing tests — ${"X".repeat(300)}`,
    );
    expect(JSON.stringify(f.classifications)).not.toContain("PRIVATE_RESOURCE_TAIL");
    expect(JSON.stringify(f.classifications)).not.toContain(f.directory);
    expect(JSON.stringify(f.classifications)).not.toContain("fixture-not-a-credential");
    if (rerank)
      expect((questions(f, 1).which!.criteria as RecordData).debugging).toBe(
        `Debug failing tests — ${"X".repeat(300)}`,
      );
    expect(providerText(f)).toContain("PRIVATE_RESOURCE_TAIL");
  }, 20000);
}

for (const rerank of [false, true]) {
  test(`SK09-${rerank ? "rerank-batches" : "batches"} all 255 resources offered once with upstream limits`, async () => {
    fixture = new PiFixture();
    fixture.skills = Array.from({ length: 255 }, (_, i) => ({
      name: `skill-${String(i).padStart(3, "0")}`,
      body: `BODY_${i}`,
    }));
    fixture.classifierResponse = (request) => {
      const q = request.questions as Record<string, RecordData>;
      const names = Object.keys(q.which!.criteria as object).filter((name) => name !== "(none)");
      if (Object.keys(q).some((key) => key.startsWith("fits::")))
        return {
          answers: {
            which: { choice: names[0] },
            ...Object.fromEntries(names.map((name) => [`fits::${name}`, { noul: 0.8 }])),
          },
        };
      const value = response(names[0]);
      ((value.answers as RecordData).which as RecordData).probabilities = Object.fromEntries(
        names.map((name, index) => [name, index < 3 ? 0.3 : 0.001]),
      );
      return value;
    };
    const f = await fixture.start({ JEV_SKILL_RERANK: String(rerank) });
    await f.prompt(task);
    expect(f.classifications).toHaveLength(rerank ? 3 : 2);
    const wide = f.classifications
      .slice(0, 2)
      .sort(
        (a, b) =>
          Number("effort" in (b.questions as object)) - Number("effort" in (a.questions as object)),
      );
    const candidateNames = wide.map((request) =>
      Object.keys(
        ((request.questions as RecordData).which as RecordData).criteria as object,
      ).filter((name) => name !== "(none)"),
    );
    expect(candidateNames.map((names) => names.length)).toEqual([128, 127]);
    expect(new Set(candidateNames.flat()).size).toBe(255);
    expect(Object.keys(wide[1]!.questions as object)).toEqual(["which"]);
    if (rerank) expect(Object.keys(questions(f, 2).which!.criteria as object)).toHaveLength(6);
    expect(providerText(f).split("<skill_relevance>")).toHaveLength(2);
  }, 20000);
}

for (const mode of ["reject-all", "winner-low", "stray", "failure", "select"] as const) {
  test(`SK14-rerank ${mode} follows independent fit gate`, async () => {
    const f = await start({ JEV_SKILL_RERANK: "true" });
    f.classifierResponse = (request) => {
      if (!(request.questions as RecordData)["fits::debugging"])
        return {
          answers: {
            ...(response().answers as object),
            which: { choice: "debugging", probabilities: { debugging: 0.7, slides: 0.3 } },
          },
        };
      if (mode === "failure") return "invalid JSON";
      return {
        answers: {
          which: { choice: mode === "stray" ? "unknown" : "debugging" },
          "fits::debugging": { noul: mode === "select" ? 0.3 : 0.2 },
          "fits::slides": { noul: mode === "winner-low" ? 0.9 : 0.1 },
        },
      };
    };
    await f.prompt(task);
    expect(f.classifications).toHaveLength(2);
    expect(providerText(f).includes("SELECTED_BODY_TOKEN")).toBe(mode === "select");
    expect(Object.keys(questions(f, 1)).sort()).toEqual([
      "fits::debugging",
      "fits::slides",
      "which",
    ]);
  }, 20000);
}

for (const virtual of [false, true]) {
  test(`SK14-lifecycle ${virtual ? "virtual" : "physical"} tool and continuation preserve one projected body`, async () => {
    const f = await start({}, virtual);
    const path = `${f.directory}/tool.txt`;
    await writeFile(path, "PRIVATE_TOOL_RESULT");
    f.nextReadPath = path;
    await f.prompt(task);
    expect(f.generations).toHaveLength(2);
    expect(f.classifications).toHaveLength(1);
    expect(providerText(f, 1).split("SELECTED_BODY_TOKEN")).toHaveLength(2);
    await f.prompt("continue");
    expect(f.classifications).toHaveLength(1);
    expect(providerText(f, 2).split("SELECTED_BODY_TOKEN")).toHaveLength(2);
    f.response = response("(none)");
    await f.prompt("Go ahead with the proposed implementation");
    expect(f.classifications).toHaveLength(2);
    expect(JSON.stringify(f.classifications.at(-1))).not.toContain("PRIVATE_TOOL_RESULT");
    expect(JSON.stringify(f.classifications.at(-1)!.state)).not.toContain("SELECTED_BODY_TOKEN");
  }, 20000);

  test(`SK14-lifecycle ${virtual ? "virtual" : "physical"} provider retry does not duplicate selected body`, async () => {
    const f = await start({}, virtual);
    f.modelFailures = 3;
    await f.command("set_auto_retry", { enabled: true });
    await f.prompt(task);
    expect(f.classifications).toHaveLength(1);
    expect(f.generations.length).toBeGreaterThan(3);
    for (let i = 0; i < f.generations.length; i++)
      expect(providerText(f, i).split("SELECTED_BODY_TOKEN")).toHaveLength(2);
  }, 20000);

  test(`SK14-lifecycle ${virtual ? "virtual" : "physical"} reload and resume retain only owned content`, async () => {
    const f = await start({}, virtual);
    await f.prompt(task);
    const state = (await f.command("get_state")).data as { sessionFile: string };
    await f.command("prompt", { message: "/fixture-reload" });
    await f.prompt("continue");
    expect(f.classifications).toHaveLength(1);
    expect(providerText(f, 1).split("SELECTED_BODY_TOKEN")).toHaveLength(2);
    await f.command("new_session");
    await f.prompt("continue");
    expect(providerText(f, 2)).not.toContain("SELECTED_BODY_TOKEN");
    await f.command("switch_session", { sessionPath: state.sessionFile });
    await f.prompt("continue");
    expect(providerText(f, 3).split("SELECTED_BODY_TOKEN")).toHaveLength(2);
  }, 20000);

  test(`SK14-branch-prefix ${virtual ? "virtual" : "physical"} tree excluding owning user cannot leak selected content`, async () => {
    const f = await start({}, virtual);
    await f.prompt(task);
    const entries = (
      (await f.command("get_entries")).data as {
        entries: { id: string; type: string; message?: RecordData }[];
      }
    ).entries;
    const userIndex = entries.findIndex((entry) => entry.message?.role === "user");
    const prefix = entries[userIndex - 1]!;
    await f.command("prompt", { message: `/fixture-tree ${prefix.id}` });
    await f.prompt("continue");
    expect(providerText(f, 1)).not.toContain("SELECTED_BODY_TOKEN");
  }, 20000);

  test(`SK14-lifecycle ${virtual ? "virtual" : "physical"} fork including response preserves selected content`, async () => {
    const f = await start({}, virtual);
    await f.prompt(task);
    const entries = (
      (await f.command("get_entries")).data as { entries: { id: string; message?: RecordData }[] }
    ).entries;
    const assistant = entries.findLast((entry) => entry.message?.role === "assistant")!;
    await f.command("prompt", { message: `/fixture-fork-at ${assistant.id}` });
    await f.prompt("continue");
    expect(f.classifications).toHaveLength(1);
    expect(providerText(f, 1).split("SELECTED_BODY_TOKEN")).toHaveLength(2);
  }, 20000);

  test(`SK14-lifecycle ${virtual ? "virtual" : "physical"} queued continuation stays with immediately preceding work`, async () => {
    const f = await start({}, virtual);
    f.modelDelay = 200;
    await f.command("set_steering_mode", { mode: "all" });
    await f.command("prompt", { message: task });
    await f.wait(() => f.generations.length === 1);
    f.response = response("slides");
    await f.command("prompt", {
      message: "Please create a presentation from the diagnosis",
      streamingBehavior: "steer",
    });
    await f.command("prompt", { message: "continue", streamingBehavior: "steer" });
    await f.wait(() => f.generations.length === 2);
    await f.wait(() => f.records.some((entry) => entry.type === "agent_settled"));
    expect(f.classifications).toHaveLength(2);
    expect(providerText(f, 1).split("SELECTED_BODY_TOKEN")).toHaveLength(3); // prior debugging plus selected slides
    expect(providerText(f, 1).split("<skill_relevance>")).toHaveLength(3);
  }, 20000);

  for (const mode of ["abort", "thinking", "model", "timeout"] as const) {
    test(`SK14-cancel ${virtual ? "virtual" : "physical"} ${mode} never applies stale selected content`, async () => {
      const f = await start({ JEV_TIMEOUT_MS: mode === "timeout" ? "80" : "5000" }, virtual);
      f.classifierDelay = 500;
      const offset = f.records.length;
      await f.command("prompt", { message: task });
      await f.wait(() => f.classifications.length === 1);
      if (mode === "abort") await f.command("abort");
      if (mode === "thinking") await f.command("set_thinking_level", { level: "low" });
      if (mode === "model")
        await f.command("set_model", { provider: "fixture", modelId: "fixture-other-model" });
      await f.wait(() => f.records.slice(offset).some((entry) => entry.type === "agent_settled"));
      await f.wait(() => f.classifierAborts === 1);
      expect(f.classifications).toHaveLength(1);
      expect(providerText(f)).not.toContain("<skill_relevance>");
      if (mode === "abort" || (virtual && mode !== "timeout"))
        expect(f.generations).toHaveLength(0);
      if (mode === "timeout") expect(f.generations).toHaveLength(1);
      const entries = (
        (await f.command("get_entries")).data as { entries: { customType?: string }[] }
      ).entries;
      expect(entries.filter((entry) => entry.customType === "jev-pilot:skill")).toHaveLength(0);
    }, 20000);
  }
}

test("SK10-context main conversation remains four messages and at most 2000 characters", async () => {
  const f = await start();
  f.modelText = "MODEL_TEXT ".repeat(200);
  for (let i = 0; i < 5; i++) await f.prompt(`USER_${i} ${"content ".repeat(100)}`);
  const state = f.classifications[4]!.state as RecordData;
  const recent = state.recent_context as string;
  expect(recent.length).toBeLessThanOrEqual(2000);
  expect(recent.split("\n").length).toBeLessThanOrEqual(4);
  expect(recent).not.toContain("USER_0");
  expect(recent).not.toContain("SELECTED_BODY_TOKEN");
  expect(state.prompt).toContain("USER_4");
}, 20000);

test("SK10-explicit-history explicit skill bodies stay out of later classifier history", async () => {
  const f = await start();
  await f.prompt("/skill:debugging run procedure");
  await f.prompt(task);
  expect(JSON.stringify(f.classifications[0]!.state)).not.toContain("SELECTED_BODY_TOKEN");
  expect(JSON.stringify(f.classifications[0]!.state)).not.toContain(f.directory);
}, 20000);

test("SK14-rerank-gate low first gate does not attempt optional rerank", async () => {
  const f = await start({ JEV_SKILL_RERANK: "true" });
  f.response = response("debugging", 0.99, 0.29);
  await f.prompt(task);
  expect(f.classifications).toHaveLength(1);
  expect(providerText(f)).not.toContain("<skill_relevance>");
}, 20000);

for (const bad of ["unknown", "confidence", "gate", "missing"]) {
  test(`SK14-malformed ${bad} never injects an invented selection`, async () => {
    const f = await start();
    const value = response();
    const answers = value.answers as RecordData;
    if (bad === "unknown") (answers.which as RecordData).choice = "fabricated";
    if (bad === "confidence") (answers.which as RecordData).confidence = 1.2;
    if (bad === "gate") answers["gate::prose_suffices"] = { noul: "yes" };
    if (bad === "missing") delete answers.which;
    f.response = value;
    await f.prompt(task);
    expect(f.generations).toHaveLength(1);
    expect(providerText(f)).not.toContain("<skill_relevance>");
  }, 20000);
}

test("SK14-batch-failure missing later batch rejects skill while first routing remains usable", async () => {
  fixture = new PiFixture();
  fixture.skills = Array.from({ length: 255 }, (_, i) => ({
    name: `skill-${i}`,
    body: "BATCH_SKILL_BODY",
  }));
  fixture.classifierResponse = (request) => {
    const q = request.questions as Record<string, RecordData>;
    if (!("effort" in q)) return { answers: {} };
    return response(Object.keys(q.which!.criteria as object)[0]);
  };
  await fixture.start();
  await fixture.prompt(task);
  expect(fixture.classifications).toHaveLength(2);
  expect(fixture.generations[0]).toMatchObject({ reasoning_effort: "high" });
  expect(providerText(fixture)).not.toContain("BATCH_SKILL_BODY");
}, 20000);

test("SK14-no-questions-continuation without previous effort skips matching and classifier HTTP", async () => {
  const f = await start({ JEV_EFFORT_ENABLED: "false", JEV_SYSTEM_ONE_URL: "invalid" });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(1);
  expect(providerText(f)).not.toContain("<skill_relevance>");
}, 20000);

for (const virtual of [false, true]) {
  test(`SK14-repeated-content ${virtual ? "virtual" : "physical"} repeated selection references unchanged visible instructions`, async () => {
    const f = await start({}, virtual);
    await f.prompt(task);
    await f.prompt("Please diagnose the next independent failing test using that procedure");
    expect(f.classifications).toHaveLength(2);
    expect(providerText(f, 1).split("SELECTED_BODY_TOKEN")).toHaveLength(2);
    expect(providerText(f, 1)).toContain("already loaded above; instructions unchanged");
  }, 20000);
}

for (const virtual of [false, true]) {
  test(`SK14-compaction ${virtual ? "virtual" : "physical"} fresh selection reloads content removed from visible history`, async () => {
    const f = await start({}, virtual);
    await f.prompt(task);
    f.response = response("(none)");
    f.modelText = "Compaction context. ".repeat(200);
    for (let i = 0; i < 6; i++)
      await f.prompt(`Please investigate distinct issue ${i} carefully before continuing`);
    const calls = f.classifications.length;
    await f.command("compact");
    await f.prompt("continue");
    expect(f.classifications).toHaveLength(calls);
    expect(providerText(f, f.generations.length - 1)).not.toContain("SELECTED_BODY_TOKEN");
    f.response = response();
    await f.prompt("Please diagnose the next independent failing test using that procedure");
    expect(providerText(f, f.generations.length - 1).split("SELECTED_BODY_TOKEN")).toHaveLength(2);
  }, 20000);
}

for (const winner of ["debugging", "(none)"]) {
  test(`SK14-distribution ${winner} leader overrides choice and confidence`, async () => {
    const f = await start();
    f.response = {
      answers: {
        ...(response("slides", 0.99).answers as object),
        which: {
          choice: "slides",
          confidence: 0.99,
          probabilities: { [winner]: 0.6, slides: 0.4 },
        },
      },
    };
    await f.prompt(task);
    expect(providerText(f).includes("<skill_relevance>")).toBe(winner === "debugging");
    expect(providerText(f)).not.toContain("UNSELECTED_BODY_TOKEN");
  }, 20000);
}

test("SK14-batch-none other qualifying batch leader can win without dropped candidates", async () => {
  fixture = new PiFixture();
  fixture.skills = Array.from({ length: 255 }, (_, i) => ({
    name: `skill-${String(i).padStart(3, "0")}`,
    body: `BODY_${i}_END`,
  }));
  fixture.classifierResponse = (request) => {
    const q = request.questions as Record<string, RecordData>;
    const names = Object.keys(q.which!.criteria as object);
    return response(names.includes("skill-254") ? "skill-254" : "(none)", 0.9);
  };
  await fixture.start();
  await fixture.prompt(task);
  expect(fixture.classifications).toHaveLength(2);
  expect(providerText(fixture)).toContain("BODY_254_END");
  expect(providerText(fixture)).not.toContain("BODY_0_END");
}, 20000);

for (const virtual of [false, true]) {
  test(`SK14-rerank-cancel ${virtual ? "virtual" : "physical"} abort during optional second call stops generation`, async () => {
    const f = await start({ JEV_SKILL_RERANK: "true", JEV_TIMEOUT_MS: "5000" }, virtual);
    f.classifierResponse = () => {
      f.classifierDelay = 2000;
      return response();
    };
    const offset = f.records.length;
    await f.command("prompt", { message: task });
    await f.wait(() => f.classifications.length === 2);
    await f.command("abort");
    await f.wait(() => f.records.slice(offset).some((entry) => entry.type === "agent_settled"));
    await f.wait(() => f.classifierAborts === 1);
    expect(f.generations).toHaveLength(0);
    const entries = (
      (await f.command("get_entries")).data as { entries: { customType?: string }[] }
    ).entries;
    expect(entries.filter((entry) => entry.customType === "jev-pilot:skill")).toHaveLength(0);
  }, 20000);
}

for (const virtual of [false, true]) {
  test(`SK14-stripped-identity ${virtual ? "virtual" : "physical"} newer unidentified selection cannot resurrect older skill`, async () => {
    const f = await start({}, virtual);
    await f.prompt(task);
    await f.command("prompt", { message: "/fixture-drop-input-identity" });
    f.response = response("slides");
    await f.prompt("Please make a presentation using the diagnosis");
    const messages = f.generations[1]!.messages as { role: string; content: unknown }[];
    expect(JSON.stringify(messages.filter((m) => m.role === "user").at(-1))).not.toContain(
      "<skill_relevance>",
    );
    expect(providerText(f, 1)).not.toContain("UNSELECTED_BODY_TOKEN");
    f.response = response("(none)");
    await f.prompt("Please assess whether a further procedure is needed");
    const newest = f.generations[2]!.messages as { role: string; content: unknown }[];
    expect(JSON.stringify(newest.filter((m) => m.role === "user").at(-1))).not.toContain(
      "<skill_relevance>",
    );
    expect(providerText(f, 2).split("SELECTED_BODY_TOKEN")).toHaveLength(2);
  }, 20000);
}

for (const disabled of [false, true]) {
  test(`SK14-no-ownership virtual ${disabled ? "disabled" : "no eligible"} skill path does not tag user`, async () => {
    fixture = new PiFixture();
    fixture.skills = [{ name: "debugging", disabled: !disabled, body }];
    fixture.selectRouter = true;
    fixture.response = response();
    await fixture.startWithRouting(routing, { JEV_SKILLS_ENABLED: String(!disabled) });
    await fixture.prompt(task);
    const entries = (
      (await fixture.command("get_entries")).data as {
        entries: { message?: RecordData; customType?: string }[];
      }
    ).entries;
    expect(entries.find((entry) => entry.message?.role === "user")!.message).not.toHaveProperty(
      "jevPilotInputId",
    );
    expect(entries.filter((entry) => entry.customType === "jev-pilot:skill")).toHaveLength(0);
  }, 20000);
}

test("SK14-owned-user physical combined uses one persisted identity without raw content mutation or provider metadata leak", async () => {
  const f = await start();
  await f.prompt(task);
  const entries = (
    (await f.command("get_entries")).data as {
      entries: { message?: RecordData; customType?: string; data?: RecordData }[];
    }
  ).entries;
  const user = entries.find((entry) => entry.message?.role === "user")!.message!;
  const id = user.jevPilotInputId;
  expect(typeof id).toBe("string");
  expect(JSON.stringify(user.content)).not.toContain("<skill_relevance>");
  expect(JSON.stringify(user.content)).toContain(task);
  expect(entries.find((entry) => entry.customType === "jev-pilot:skill")!.data!.inputId).toBe(id);
  expect(
    entries.find((entry) => entry.customType === "jev-pilot:effort-application")!.data!.inputId,
  ).toBe(id);
  expect(JSON.stringify(f.generations)).not.toContain(id as string);
  expect(JSON.stringify(f.classifications)).not.toContain(id as string);
}, 20000);

for (const virtual of [false, true]) {
  test(`SK14-native-auto ${virtual ? "virtual" : "physical"} exact visible native resource needs reference only`, async () => {
    const f = await start({}, virtual);
    await f.prompt("/skill:debugging run procedure");
    await f.prompt(task);
    expect(f.classifications).toHaveLength(1);
    expect(providerText(f, 1).split(body)).toHaveLength(2);
    expect(providerText(f, 1)).toContain("already loaded above; instructions unchanged");
  }, 20000);
}

for (const virtual of [false, true]) {
  test(`SK14-native-changed ${virtual ? "virtual" : "physical"} changed body must be injected fully`, async () => {
    const f = await start({}, virtual);
    await f.prompt("/skill:debugging run procedure");
    const path = `${f.directory}/agent/skills/debugging/SKILL.md`;
    const original = await readFile(path, "utf8");
    const changed = `${body}\nCHANGED_BODY_SENTINEL`;
    await writeFile(path, original.replace(body, changed));
    await f.prompt(task);
    expect(providerText(f, 1).split(changed)).toHaveLength(2);
    expect(providerText(f, 1)).not.toContain("already loaded above; instructions unchanged");
    expect(await readFile(path, "utf8")).toBe(original.replace(body, changed));
  }, 20000);

  test(`SK14-native-other ${virtual ? "virtual" : "physical"} identical body at different resource path does not suppress selection`, async () => {
    fixture = new PiFixture();
    fixture.skills = [
      { name: "debugging", body },
      { name: "other-debugging", body },
    ];
    fixture.response = response();
    if (virtual) {
      fixture.selectRouter = true;
    }
    const f = await fixture.startWithRouting(virtual ? routing : {});
    await f.prompt("/skill:other-debugging run procedure");
    await f.prompt(task);
    expect(providerText(f, 1).split(body)).toHaveLength(3);
    expect(providerText(f, 1)).not.toContain("already loaded above; instructions unchanged");
  }, 20000);

  test(`SK14-native-compacted ${virtual ? "virtual" : "physical"} absent native body cannot suppress fresh selection`, async () => {
    const f = await start({}, virtual);
    await f.prompt("/skill:debugging run procedure");
    f.response = response("(none)");
    f.modelText = "Compaction context. ".repeat(200);
    for (let i = 0; i < 6; i++) await f.prompt(`Please investigate distinct issue ${i} carefully`);
    await f.command("compact");
    await f.prompt("continue");
    expect(providerText(f, f.generations.length - 1)).not.toContain(body);
    f.response = response();
    await f.prompt(task);
    expect(providerText(f, f.generations.length - 1).split(body)).toHaveLength(2);
    expect(providerText(f, f.generations.length - 1)).not.toContain(
      "already loaded above; instructions unchanged",
    );
  }, 20000);
}
