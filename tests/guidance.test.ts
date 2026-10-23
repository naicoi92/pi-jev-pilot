import { afterEach, expect, test } from "bun:test";
import { PiFixture, type RecordData } from "./fixtures/pi-cli.ts";

let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});
function contentText(content: string | { text?: string }[] | null): string {
  return typeof content === "string"
    ? content
    : (content ?? []).map((p) => p.text ?? "").join("\n");
}
function text(f: PiFixture, index = 0): string {
  const messages = f.generations[index]?.messages as {
    content: string | { text?: string }[] | null;
  }[];
  return messages
    .map((m) =>
      typeof m.content === "string"
        ? m.content
        : (m.content ?? []).map((p) => p.text ?? "").join("\n"),
    )
    .join("\n");
}
const routing = {
  mainRoutingEnabled: true,
  tiers: {
    fast: "fixture-fast/lookup",
    balanced: "fixture/fixture-model",
    deep: "fixture-deep/judgment",
  },
};
async function start(env: Record<string, string> = {}, virtual = false) {
  fixture = new PiFixture();
  if (virtual) {
    fixture.selectRouter = true;
  }
  fixture.response = {
    answers: {
      bugfix: { noul: 0.8 },
      sensitive: { noul: 0.8 },
      underspecified: { noul: 0.85 },
      corrects: { noul: 0.7 },
    },
  };
  return fixture.startWithRouting(virtual ? routing : {}, {
    JEV_EFFORT_ENABLED: "false",
    JEV_QUALITY_ENABLED: "true",
    ...env,
  });
}
test("G09-quality-only sends four nouls in one actual installed request", async () => {
  const f = await start();
  await f.prompt("Fix the broken payment validation");
  expect(f.classifications).toHaveLength(1);
  expect(Object.keys(f.classifications[0]!.questions as RecordData).sort()).toEqual([
    "bugfix",
    "corrects",
    "sensitive",
    "underspecified",
  ]);
  expect(text(f)).toContain("<jev_quality>");
  expect(text(f)).toContain("If a test or command can reproduce it cheaply");
  expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "medium" });
}, 20000);

test("G15-guidance-only-physical strategy tier gates do not route the physical model", async () => {
  const f = await start({ JEV_STRATEGY_ENABLED: "true", JEV_QUALITY_ENABLED: "false" });
  f.response = {
    answers: {
      tier: { choice: "deep", confidence: 0.95 },
      strategy: { choice: "graph", confidence: 0.8 },
    },
  };
  await f.prompt("Build the specified multi-module system in dependent waves");
  expect(Object.keys(f.classifications[0]!.questions as RecordData).sort()).toEqual([
    "strategy",
    "tier",
  ]);
  expect(text(f)).toContain("<execution_strategy>");
  expect(text(f)).toContain("as: graph.");
  expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "medium" });
}, 20000);

test("G16-edits fourth real write adds step-back without effort or classifier change", async () => {
  fixture = new PiFixture();
  fixture.tools = "read,write,bash";
  const f = await fixture.start({ JEV_EFFORT_ENABLED: "false", JEV_QUALITY_ENABLED: "true" });
  f.response = {
    answers: {
      bugfix: { noul: 0 },
      corrects: { noul: 0 },
      sensitive: { noul: 0 },
      underspecified: { noul: 0 },
    },
  };
  f.toolCalls = Array.from({ length: 5 }, (_, i) => ({
    name: "write",
    input: { path: `${f.directory}/loop.txt`, content: `value ${i}` },
  }));
  await f.prompt("Perform the specified writes");
  expect(f.generations).toHaveLength(6);
  expect(text(f, 3)).not.toContain("may be going in circles");
  expect(text(f, 4)).toContain("the same file (loop.txt) was edited 4 times in this turn");
  expect(text(f, 5).split("may be going in circles")).toHaveLength(2);
  expect(f.classifications).toHaveLength(1);
  expect(f.generations.map((g) => g.reasoning_effort)).toEqual(Array(6).fill("medium"));
}, 20000);

for (const [strategy, tier, confidence, expected] of [
  ["direct", "deep", 1, false],
  ["delegate", "fast", 0.6, true],
  ["delegate", "deep", 0.599, false],
  ["parallel", "fast", 0.99, false],
  ["parallel", "balanced", 0.6, true],
  ["parallel", "deep", 0.599, false],
  ["graph", "balanced", 1, false],
  ["graph", "deep", 0.8, true],
  ["graph", "deep", 0.799, false],
  ["delegate", "balanced", undefined, false],
  ["invented", "deep", 1, false],
  ["junior", "balanced", 1, false],
] as const) {
  test(`G15-strategy-boundaries ${strategy}/${tier}/${confidence}`, async () => {
    const f = await start({ JEV_STRATEGY_ENABLED: "true", JEV_QUALITY_ENABLED: "false" });
    f.response = {
      answers: {
        tier: { choice: tier, confidence: 0.99 },
        strategy: { choice: strategy, confidence },
      },
    };
    await f.prompt("Implement the specified task");
    expect(text(f).includes("<execution_strategy>")).toBe(expected);
    expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "medium" });
  }, 20000);
}
for (const [name, below, at, phrase] of [
  ["underspecified", 0.849, 0.85, "ask the user one short question"],
  ["bugfix", 0.799, 0.8, "If a test or command can reproduce it cheaply"],
  ["sensitive", 0.799, 0.8, "Make sure a test covers the case you changed"],
  ["corrects", 0.699, 0.7, "<jev_quality>"],
] as const) {
  test(`G15-quality-boundaries ${name}`, async () => {
    const f = await start();
    f.response = { answers: { [name]: { noul: below } } };
    await f.prompt("Assess the specified change");
    expect(text(f)).not.toContain("<jev_quality>");
    f.response = { answers: { [name]: { noul: at } } };
    await f.prompt("Assess another specified change");
    expect(text(f, 1).includes(phrase)).toBe(name !== "corrects");
  }, 20000);
}
for (const virtual of [false, true]) {
  test(`G09-combined-${virtual ? "virtual" : "physical"} all applicable questions share one request`, async () => {
    fixture = new PiFixture();
    fixture.skills = [{ name: "procedure", body: "GUIDANCE_SELECTED_SKILL" }];
    if (virtual) {
      fixture.selectRouter = true;
    }
    const f = await fixture.startWithRouting(routing, {
      JEV_EFFORT_ENABLED: "true",
      JEV_STRATEGY_ENABLED: "true",
      JEV_QUALITY_ENABLED: "true",
    });
    f.response = {
      answers: {
        tier: { choice: "deep", confidence: 0.99 },
        effort: { choice: "high", confidence: 0.99 },
        risky: { noul: 0 },
        strategy: { choice: "delegate", confidence: 0.6 },
        bugfix: { noul: 0.8 },
        which: { choice: "procedure", confidence: 0.9 },
        "gate::acts_on_user_system": { noul: 0.9 },
        "gate::would_follow_documented_procedure": { noul: 0.9 },
        "gate::prose_suffices": { noul: 0.1 },
      },
    };
    await f.prompt("Repair this fully specified failure");
    expect(f.classifications).toHaveLength(1);
    expect(Object.keys(f.classifications[0]!.questions as RecordData).sort()).toEqual([
      "bugfix",
      "corrects",
      "effort",
      "gate::acts_on_user_system",
      "gate::prose_suffices",
      "gate::would_follow_documented_procedure",
      "risky",
      "sensitive",
      "strategy",
      "tier",
      "underspecified",
      "which",
    ]);
    expect(text(f).split("<execution_strategy>")).toHaveLength(2);
    expect(text(f).split("<jev_quality>")).toHaveLength(2);
    expect(text(f)).toContain("GUIDANCE_SELECTED_SKILL");
    expect(f.generations[0]).toMatchObject({
      model: virtual ? "judgment" : "fixture-model",
      reasoning_effort: "high",
    });
  }, 20000);
  test(`G15-retry-continue ${virtual} advice stays owned and appears once`, async () => {
    const f = await start({}, virtual);
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        risky: { noul: 0 },
        bugfix: { noul: 0.8 },
      },
    };
    f.modelFailures = 3;
    await f.command("set_auto_retry", { enabled: true });
    await f.prompt("Fix the concrete failure");
    await f.prompt("continue");
    expect(f.classifications).toHaveLength(1);
    for (let i = 0; i < f.generations.length; i++)
      expect(text(f, i).split("<jev_quality>")).toHaveLength(2);
  }, 20000);
  for (const mode of ["abort", "thinking", "model", "timeout"] as const) {
    test(`G15-cancel ${virtual}/${mode} drops stale advice`, async () => {
      const f = await start({ JEV_TIMEOUT_MS: mode === "timeout" ? "80" : "5000" }, virtual);
      f.classifierDelay = 500;
      const offset = f.records.length;
      await f.command("prompt", { message: "Fix the concrete bug" });
      await f.wait(() => f.classifications.length === 1);
      if (mode === "abort") await f.command("abort");
      if (mode === "thinking") await f.command("set_thinking_level", { level: "low" });
      if (mode === "model")
        await f.command("set_model", { provider: "fixture", modelId: "fixture-other-model" });
      await f.wait(() => f.records.slice(offset).some((r) => r.type === "agent_settled"));
      await f.wait(() => f.classifierAborts === 1);
      expect(f.classifications).toHaveLength(1);
      if (f.generations.length) expect(text(f)).not.toContain("<jev_quality>");
      if (mode === "abort" || (virtual && mode !== "timeout"))
        expect(f.generations).toHaveLength(0);
      const entries = (
        (await f.command("get_entries")).data as { entries: { customType?: string }[] }
      ).entries;
      expect(entries.filter((e) => e.customType === "jev-pilot:advice")).toHaveLength(0);
    }, 20000);
  }
}

test("G09-none no applicable questions ignores invalid backend", async () => {
  const f = await start({ JEV_QUALITY_ENABLED: "false", JEV_SYSTEM_ONE_URL: "invalid" });
  await f.prompt("Perform the task");
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(1);
}, 20000);
test("G09-continuation guidance-only has zero questions even invalid backend", async () => {
  const f = await start({ JEV_STRATEGY_ENABLED: "true", JEV_SYSTEM_ONE_URL: "invalid" });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(1);
}, 20000);

for (const virtual of [false, true]) {
  test(`G15-lifecycle ${virtual} reload resume fork retain only included owners`, async () => {
    const f = await start({}, virtual);
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        risky: { noul: 0 },
        bugfix: { noul: 0.8 },
      },
    };
    await f.prompt("Fix this concrete bug");
    const state = (await f.command("get_state")).data as { sessionFile: string };
    let entries = (
      (await f.command("get_entries")).data as {
        entries: { id: string; type: string; message?: RecordData }[];
      }
    ).entries;
    const assistant = entries.findLast((e) => e.message?.role === "assistant")!;
    await f.command("prompt", { message: `/fixture-fork-at ${assistant.id}` });
    await f.prompt("continue");
    expect(text(f, 1).split("<jev_quality>")).toHaveLength(2);
    await f.command("prompt", { message: "/fixture-reload" });
    await f.prompt("continue");
    expect(text(f, 2).split("<jev_quality>")).toHaveLength(2);
    await f.command("new_session");
    await f.prompt("continue");
    expect(text(f, 3)).not.toContain("<jev_quality>");
    await f.command("switch_session", { sessionPath: state.sessionFile });
    entries = (
      (await f.command("get_entries")).data as {
        entries: { id: string; type: string; message?: RecordData }[];
      }
    ).entries;
    const userIndex = entries.findIndex((e) => e.message?.role === "user");
    await f.command("prompt", { message: `/fixture-tree ${entries[userIndex - 1]!.id}` });
    await f.prompt("continue");
    expect(text(f, 4)).not.toContain("<jev_quality>");
  }, 20000);
  test(`G15-queued ${virtual} own the substantive user not the trailing continuation`, async () => {
    const f = await start({}, virtual);
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        risky: { noul: 0 },
        bugfix: { noul: 0.8 },
      },
    };
    f.modelDelay = 200;
    await f.command("set_steering_mode", { mode: "all" });
    await f.command("prompt", { message: "Fix first bug" });
    await f.wait(() => f.generations.length === 1);
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        risky: { noul: 0 },
        sensitive: { noul: 0.8 },
      },
    };
    await f.command("prompt", {
      message: "Change permissions precisely",
      streamingBehavior: "steer",
    });
    await f.command("prompt", { message: "continue", streamingBehavior: "steer" });
    await f.wait(() => f.generations.length === 2);
    await f.wait(() => f.records.some((e) => e.type === "agent_settled"));
    expect(f.classifications).toHaveLength(2);
    const messages = (
      f.generations[1]!.messages as { role: string; content: string | { text?: string }[] | null }[]
    ).map((m) => contentText(m.content));
    const permission = messages.find((m) => m.startsWith("Change permissions precisely"))!;
    const continuation = messages.find((m) => m === "continue")!;
    expect(permission).toContain("Make sure a test covers the case you changed");
    expect(continuation).toBe("continue");
    const entries = (
      (await f.command("get_entries")).data as {
        entries: { message?: { role: string; content: unknown } }[];
      }
    ).entries;
    const users = entries.filter((e) => e.message?.role === "user").map((e) => e.message!.content);
    expect(JSON.stringify(users)).not.toContain("<jev_quality>");
    expect(JSON.stringify(f.generations)).not.toContain("jevPilotInputId");
  }, 20000);
  test(`G15-stripped-identity ${virtual} newer missing owner never receives old or new advice`, async () => {
    const f = await start({}, virtual);
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        risky: { noul: 0 },
        bugfix: { noul: 0.8 },
      },
    };
    await f.prompt("Fix the initial bug");
    await f.command("prompt", { message: "/fixture-drop-input-identity" });
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        risky: { noul: 0 },
        sensitive: { noul: 0.8 },
      },
    };
    await f.prompt("Change permissions for a second request");
    const messages = (
      f.generations[1]!.messages as { content: string | { text?: string }[] | null }[]
    ).map((m) => contentText(m.content));
    const user = messages.find((m) => m.startsWith("Change permissions"))!;
    expect(user).toBe("Change permissions for a second request");
    expect(text(f, 1).split("<jev_quality>")).toHaveLength(2); // only the historical first request
    expect(text(f, 1)).not.toContain("Make sure a test covers the case you changed");
  }, 20000);
}
for (const mode of [
  "distribution",
  "explicit",
  "invalid-confidence",
  "invalid-distribution",
] as const) {
  test(`G15-distribution ${mode} confidence uses source precedence`, async () => {
    const f = await start({ JEV_STRATEGY_ENABLED: "true", JEV_QUALITY_ENABLED: "false" });
    f.response = {
      answers: {
        tier: { choice: "deep", confidence: 0.99 },
        strategy: {
          choice: "delegate",
          probabilities:
            mode === "invalid-distribution"
              ? { delegate: 1.2, direct: -0.2 }
              : { delegate: 0.3, direct: 0.7 },
          ...(mode === "explicit"
            ? { confidence: 0.59 }
            : mode === "invalid-confidence"
              ? { confidence: 1.2 }
              : {}),
        },
      },
    };
    await f.prompt("Process the specified task");
    expect(text(f).includes("<execution_strategy>")).toBe(mode === "distribution");
  }, 20000);
}

test("G15-restrictions workflow guidance defers authority and never dispatches", async () => {
  const f = await start({ JEV_STRATEGY_ENABLED: "true", JEV_QUALITY_ENABLED: "false" });
  f.response = {
    answers: {
      tier: { choice: "deep", confidence: 0.99 },
      strategy: { choice: "graph", confidence: 1 },
    },
  };
  await f.prompt("Do the specified work directly. Project forbids workers.");
  expect(text(f)).toContain("User and project delegation restrictions take precedence");
  expect(text(f)).toContain("Workflow-script inner agents are not transparently intercepted");
  expect(text(f)).toContain("configured fast model for searching, reading and reporting");
  expect(f.records.filter((r) => r.type === "tool_execution_start")).toHaveLength(0);
  expect(f.generations).toHaveLength(1);
}, 20000);

test("G27-exclusions quality guidance has no external-review or escalation machinery", async () => {
  const f = await start();
  await f.prompt("Fix the concrete error");
  const context = text(f);
  for (const excluded of [
    "/model fable",
    "external reviewer",
    "jev-pilot:junior",
    "<design_pack>",
    "<jev_pet>",
    "raise effort",
    "mandatory review",
    "ledger",
  ])
    expect(context).not.toContain(excluded);
  expect(f.records.filter((r) => r.type === "tool_execution_start")).toHaveLength(0);
}, 20000);

for (const virtual of [false, true]) {
  test(`G16-failed-commands ${virtual} success resets normalized failure counter without escalation`, async () => {
    fixture = new PiFixture();
    fixture.tools = "bash";
    if (virtual) {
      fixture.selectRouter = true;
    }
    const f = await fixture.startWithRouting(virtual ? routing : {}, {
      JEV_EFFORT_ENABLED: "true",
      JEV_QUALITY_ENABLED: "true",
    });
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        effort: { choice: "low", confidence: 0.99 },
        risky: { noul: 0 },
      },
    };
    const command = `test -f ${f.directory}/ready`;
    f.toolCalls = [
      { name: "bash", input: { command } },
      { name: "bash", input: { command: `touch ${f.directory}/ready` } },
      { name: "bash", input: { command } },
      { name: "bash", input: { command: `rm ${f.directory}/ready` } },
      { name: "bash", input: { command } },
      { name: "bash", input: { command: `  test   -f ${f.directory}/ready  ` } },
      { name: "bash", input: { command } },
      { name: "bash", input: { command } },
    ];
    await f.prompt(
      "Please run the specified independent command checks and report their actual results without changing anything else",
    );
    expect(f.generations).toHaveLength(9);
    expect(text(f, 6)).not.toContain("may be going in circles");
    expect(text(f, 7)).toContain("failed 3 times in this turn");
    expect(text(f, 8).split("may be going in circles")).toHaveLength(2);
    expect(f.classifications).toHaveLength(1);
    expect(f.generations.map((g) => g.reasoning_effort)).toEqual(Array(9).fill("low"));
    expect(new Set(f.generations.map((g) => g.model))).toEqual(new Set(["fixture-model"]));
    expect(
      f.records
        .filter((r) => r.type === "tool_execution_start")
        .every((r) => r.toolName === "bash"),
    ).toBe(true);
    const entries = (
      (await f.command("get_entries")).data as { entries: { customType?: string }[] }
    ).entries;
    expect(entries.filter((e) => e.customType?.includes("escalat"))).toHaveLength(0);
    f.toolCalls = Array.from({ length: 2 }, () => ({ name: "bash", input: { command } }));
    await f.prompt("Start a separate request and run two checks");
    const messages = f.generations.at(-1)!.messages as {
      role: string;
      content: string | { text?: string }[] | null;
    }[];
    expect(
      messages
        .filter((m) => m.role === "tool")
        .map((m) => contentText(m.content))
        .filter((s) => s.includes("may be going in circles")),
    ).toHaveLength(1); // historical prior note only
  }, 20000);
}

test("G16-disabled repeated failed commands do not attach loop advice", async () => {
  fixture = new PiFixture();
  fixture.tools = "bash";
  const f = await fixture.start({ JEV_EFFORT_ENABLED: "false", JEV_QUALITY_ENABLED: "false" });
  f.toolCalls = Array.from({ length: 4 }, () => ({ name: "bash", input: { command: "exit 7" } }));
  await f.prompt("Run controlled commands");
  expect(text(f, 4)).not.toContain("may be going in circles");
  expect(f.classifications).toHaveLength(0);
}, 20000);

test("G16-edits actual edit results count the same file and reset for a fresh user", async () => {
  fixture = new PiFixture();
  fixture.tools = "write,edit";
  const f = await fixture.start({ JEV_EFFORT_ENABLED: "false", JEV_QUALITY_ENABLED: "true" });
  f.response = { answers: {} };
  const path = `${f.directory}/edit.txt`;
  f.toolCalls = [
    { name: "write", input: { path, content: "one" } },
    { name: "edit", input: { path, oldText: "one", newText: "two" } },
    { name: "edit", input: { path, oldText: "two", newText: "three" } },
    { name: "edit", input: { path, oldText: "three", newText: "four" } },
  ];
  await f.prompt("Make the specified file changes");
  expect(text(f, 3)).not.toContain("may be going in circles");
  expect(text(f, 4)).toContain("the same file (edit.txt) was edited 4 times");
  f.toolCalls = [{ name: "edit", input: { path, oldText: "four", newText: "five" } }];
  await f.prompt("Make one further change");
  expect(text(f, 6).split("may be going in circles")).toHaveLength(2); // prior note only
}, 20000);

test("G09-batches advice questions appear only in the first skill batch", async () => {
  fixture = new PiFixture();
  fixture.skills = Array.from({ length: 255 }, (_, i) => ({
    name: `procedure-${i}`,
    body: "BATCH_BODY",
  }));
  const f = await fixture.start({
    JEV_EFFORT_ENABLED: "false",
    JEV_QUALITY_ENABLED: "true",
    JEV_STRATEGY_ENABLED: "true",
  });
  f.classifierResponse = (request) => {
    const q = request.questions as Record<string, RecordData>;
    const name = Object.keys(q.which!.criteria as object)[0]!;
    return {
      answers: {
        tier: { choice: "deep", confidence: 0.99 },
        strategy: { choice: "graph", confidence: 0.8 },
        bugfix: { noul: 0.8 },
        which: { choice: name, confidence: 0.9 },
        "gate::acts_on_user_system": { noul: 0.9 },
        "gate::would_follow_documented_procedure": { noul: 0.9 },
        "gate::prose_suffices": { noul: 0.1 },
      },
    };
  };
  await f.prompt("Repair the well-specified failure");
  expect(f.classifications).toHaveLength(2);
  expect(
    f.classifications.map((c) => Object.keys(c.questions as object).length).sort((a, b) => a - b),
  ).toEqual([1, 10]);
  expect(text(f).split("<execution_strategy>")).toHaveLength(2);
  expect(text(f).split("<jev_quality>")).toHaveLength(2);
}, 20000);

for (const virtual of [false, true]) {
  test(`G15-compaction ${virtual} removed owners cannot resurrect advice`, async () => {
    const f = await start({}, virtual);
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        risky: { noul: 0 },
        bugfix: { noul: 0.8 },
      },
    };
    await f.prompt("Fix the concrete initial bug");
    f.response = {
      answers: { tier: { choice: "balanced", confidence: 0.99 }, risky: { noul: 0 } },
    };
    f.modelText = "Compaction context. ".repeat(200);
    for (let i = 0; i < 6; i++)
      await f.prompt(`Investigate separate issue ${i} with concrete expected behavior`);
    const calls = f.classifications.length;
    await f.command("compact");
    await f.prompt("continue");
    expect(f.classifications).toHaveLength(calls);
    expect(text(f, f.generations.length - 1)).not.toContain("<jev_quality>");
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        risky: { noul: 0 },
        sensitive: { noul: 0.8 },
      },
    };
    await f.prompt("Change the precisely specified permission check");
    expect(text(f, f.generations.length - 1).split("<jev_quality>")).toHaveLength(2);
  }, 20000);
}
test("G15-raw-tier-risk strategy gate uses raw classified tier before risk-forced routing", async () => {
  const f = await start({ JEV_STRATEGY_ENABLED: "true", JEV_QUALITY_ENABLED: "false" }, true);
  f.response = {
    answers: {
      tier: { choice: "balanced", confidence: 0.99 },
      risky: { noul: 1 },
      strategy: { choice: "graph", confidence: 1 },
    },
  };
  await f.prompt("Do the specified work in waves");
  expect(f.generations[0]!.model).toBe("judgment");
  expect(text(f)).not.toContain("<execution_strategy>");
  f.response = {
    answers: {
      tier: { choice: "fast", confidence: 0.99 },
      risky: { noul: 1 },
      strategy: { choice: "parallel", confidence: 1 },
    },
  };
  await f.prompt("Perform another independent specified task");
  expect(f.generations[1]!.model).toBe("judgment");
  expect(text(f, 1)).not.toContain("<execution_strategy>");
}, 20000);

test("G09-defaults production enables strategy and quality independently of effort", async () => {
  fixture = new PiFixture();
  fixture.useGuidanceDefaults = true;
  const f = await fixture.start({ JEV_EFFORT_ENABLED: "false" });
  f.response = {
    answers: {
      tier: { choice: "deep", confidence: 0.99 },
      strategy: { choice: "graph", confidence: 0.8 },
      bugfix: { noul: 0.8 },
    },
  };
  await f.prompt("Do the concrete work");
  expect(Object.keys(f.classifications[0]!.questions as RecordData).sort()).toEqual([
    "bugfix",
    "corrects",
    "sensitive",
    "strategy",
    "tier",
    "underspecified",
  ]);
  expect(text(f)).toContain("<execution_strategy>");
  expect(text(f)).toContain("<jev_quality>");
}, 20000);

test("G09-rubric source wording and criteria reach the actual classifier", async () => {
  const f = await start({ JEV_STRATEGY_ENABLED: "true" });
  f.response = {
    answers: {
      tier: { choice: "balanced", confidence: 0.99 },
      strategy: { choice: "direct", confidence: 1 },
      corrects: { noul: 1 },
    },
  };
  await f.prompt("Fix what you just did incorrectly");
  const q = f.classifications[0]!.questions as Record<string, RecordData>;
  expect(q.strategy!.instructions).toBe(
    "How should a coding assistant carry out the latest request, given the recent conversation? Prefer the simplest way that does it well.",
  );
  expect((q.strategy!.criteria as RecordData).direct).toBe(
    "The main conversation does it itself: a question, a lookup, a command, or a change to one or a few files. One job with one clear finish line. The right answer for most requests, including most follow-ups.",
  );
  expect(Object.keys(q.strategy!.criteria as object)).toEqual([
    "direct",
    "delegate",
    "parallel",
    "graph",
  ]);
  expect(q.underspecified!.instructions).toContain(
    "Details a capable engineer decides without asking (names, layout, sensible defaults, where to put a file) don't count.",
  );
  expect(q.sensitive!.instructions).toBe(
    "The requested change is to code where a bug is costly: authentication or permissions, payments or money, stored data or migrations, security or secrets, concurrency, or an interface other code depends on.",
  );
  for (const name of ["corrects", "underspecified", "bugfix", "sensitive"]) {
    expect(q[name]!.type).toBe("noul");
    expect(Object.keys(q[name]!.criteria as object)).toEqual(["true", "false"]);
  }
  expect(text(f)).not.toContain("<execution_strategy>");
  expect(text(f)).not.toContain("<jev_quality>");
}, 20000);
for (const value of [undefined, 1.2, -0.1, "yes", null] as const) {
  test(`G15-quality-malformed ${value} adds no invented advice`, async () => {
    const f = await start();
    f.response = {
      answers: {
        bugfix: { noul: value },
        sensitive: { noul: value },
        underspecified: { noul: value },
      },
    };
    await f.prompt("Check the specified task");
    expect(text(f)).not.toContain("<jev_quality>");
    expect(f.generations).toHaveLength(1);
  }, 20000);
}

test("G16-negative distinct failures and repeated successes are not circles", async () => {
  fixture = new PiFixture();
  fixture.tools = "bash";
  const f = await fixture.start({ JEV_EFFORT_ENABLED: "false", JEV_QUALITY_ENABLED: "true" });
  f.response = { answers: {} };
  f.toolCalls = [1, 2, 3]
    .map((i) => ({ name: "bash", input: { command: `exit ${i}` } }))
    .concat(Array.from({ length: 4 }, () => ({ name: "bash", input: { command: "true" } })));
  await f.prompt("Run the specified independent checks");
  expect(f.generations).toHaveLength(8);
  expect(text(f, 7)).not.toContain("may be going in circles");
}, 20000);
test("G16-cancelled aborted work cannot carry loop counters into the next request", async () => {
  fixture = new PiFixture();
  fixture.tools = "bash";
  const f = await fixture.start({ JEV_EFFORT_ENABLED: "false", JEV_QUALITY_ENABLED: "true" });
  f.response = { answers: {} };
  f.modelDelay = 200;
  f.toolCalls = [{ name: "bash", input: { command: "exit 8" } }];
  const offset = f.records.length;
  await f.command("prompt", { message: "Run the first check" });
  await f.wait(() => f.generations.length === 2);
  await f.command("abort");
  await f.wait(() => f.records.slice(offset).some((e) => e.type === "agent_settled"));
  f.modelDelay = 0;
  f.toolCalls = Array.from({ length: 2 }, () => ({ name: "bash", input: { command: "exit 8" } }));
  await f.prompt("Run two checks in new work");
  expect(text(f, f.generations.length - 1)).not.toContain("may be going in circles");
}, 20000);

test("G15-partial-distribution upstream maximum probability need not sum to one", async () => {
  const f = await start({ JEV_STRATEGY_ENABLED: "true", JEV_QUALITY_ENABLED: "false" });
  f.response = {
    answers: {
      tier: { choice: "balanced", confidence: 0.99 },
      strategy: { choice: "delegate", probabilities: { delegate: 0.6 } },
    },
  };
  await f.prompt("Perform the fully specified broad mechanical investigation");
  expect(text(f)).toContain("as: delegate.");
}, 20000);

test("G16-branch abandoned failures cannot carry counters to another branch", async () => {
  fixture = new PiFixture();
  fixture.tools = "bash";
  const f = await fixture.start({ JEV_EFFORT_ENABLED: "false", JEV_QUALITY_ENABLED: "true" });
  f.response = { answers: {} };
  f.toolCalls = Array.from({ length: 2 }, () => ({ name: "bash", input: { command: "exit 9" } }));
  await f.prompt("Run initial controlled checks");
  const entries = (
    (await f.command("get_entries")).data as { entries: { id: string; message?: RecordData }[] }
  ).entries;
  const owner = entries.findIndex((e) => e.message?.role === "user");
  await f.command("prompt", { message: `/fixture-tree ${entries[owner - 1]!.id}` });
  f.toolCalls = Array.from({ length: 2 }, () => ({ name: "bash", input: { command: "exit 9" } }));
  await f.prompt("Run two checks on new work");
  expect(text(f, f.generations.length - 1)).not.toContain("may be going in circles");
  expect(f.classifications).toHaveLength(2);
}, 20000);

for (const virtual of [false, true]) {
  test(`G15-partial-tier-${virtual ? "virtual" : "physical"} advice does not relax routing validation`, async () => {
    const f = await start(
      {
        JEV_STRATEGY_ENABLED: "true",
        JEV_QUALITY_ENABLED: "false",
        ...(virtual ? { JEV_EFFORT_ENABLED: "true" } : {}),
      },
      virtual,
    );
    f.response = {
      answers: {
        tier: {
          choice: virtual ? "deep" : "balanced",
          probabilities: { [virtual ? "deep" : "balanced"]: 0.6 },
        },
        strategy: { choice: "delegate", confidence: 0.8 },
        ...(virtual ? { effort: { choice: "high", confidence: 0.99 }, risky: { noul: 0 } } : {}),
      },
    };
    await f.prompt("Perform the fully specified broad mechanical investigation");
    expect(f.classifications).toHaveLength(1);
    expect(text(f).split("as: delegate.")).toHaveLength(2);
    expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "medium" });
    if (virtual) {
      const entries = (
        (await f.command("get_entries")).data as {
          entries: { customType?: string; data?: unknown }[];
        }
      ).entries;
      const route = entries.findLast((e) => e.customType === "pi.virtual-model-state");
      expect(JSON.stringify(route)).toContain("schema-error");
      expect(JSON.stringify(route)).not.toContain('"source":"decision"');
    }
  }, 20000);
}
for (const virtual of [false, true]) {
  for (const tier of [
    { choice: "balanced", probabilities: { balanced: 1.2 } },
    { choice: "unknown", probabilities: { balanced: 0.6 } },
  ]) {
    test(`G15-invalid-tier-values ${virtual}/${JSON.stringify(tier)} cannot create advice`, async () => {
      const f = await start(
        {
          JEV_STRATEGY_ENABLED: "true",
          JEV_QUALITY_ENABLED: "false",
          ...(virtual ? { JEV_EFFORT_ENABLED: "true" } : {}),
        },
        virtual,
      );
      f.response = {
        answers: {
          tier,
          strategy: { choice: "delegate", confidence: 0.8 },
          effort: { choice: "high", confidence: 0.99 },
          risky: { noul: 0 },
        },
      };
      await f.prompt("Perform the fully specified broad mechanical investigation");
      expect(f.classifications).toHaveLength(1);
      expect(text(f)).not.toContain("<execution_strategy>");
      expect(f.generations[0]).toMatchObject({
        model: "fixture-model",
        reasoning_effort: "medium",
      });
    }, 20000);
  }
}

for (const [tier, risky, confidence, expected] of [
  ["balanced", 0.5, 0.6, true],
  ["deep", 0, 0.95, false],
  ["balanced", 0.51, 0.95, false],
  ["balanced", 0, 0.59, false],
] as const)
  test(`CREW-15 eligible junior advice ${tier}/${risky}/${confidence}`, async () => {
    const { mkdtemp, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const path = join(await mkdtemp(join(tmpdir(), "jev-crew-guidance-")), "crew.json");
    await writeFile(
      path,
      JSON.stringify({
        mode: "junior-lead",
        slots: [{ name: "alpha", model: "fixture/fixture-model" }],
      }),
    );
    const f = await start({
      JEV_CREW_CONFIG: path,
      JEV_STRATEGY_ENABLED: "true",
      JEV_QUALITY_ENABLED: "false",
    });
    f.response = {
      answers: {
        tier: { choice: tier, confidence: 0.95 },
        strategy: { choice: "junior", confidence },
        risky: { noul: risky },
      },
    };
    await f.prompt("Implement the exact one-file change; project forbids automatic dispatch.");
    expect(text(f).includes("<execution_strategy>")).toBe(expected);
    expect(text(f)).toContain("jev-pilot:junior is a junior developer on fixture/fixture-model");
    expect(text(f)).toContain("User and project delegation restrictions take precedence");
    expect(f.records.filter((r) => r.type === "tool_execution_start")).toHaveLength(0);
    expect(
      Object.keys((f.classifications[0]!.questions as RecordData).strategy as object),
    ).toContain("criteria");
    expect(JSON.stringify((f.classifications[0]!.questions as RecordData).strategy)).toContain(
      '"junior"',
    );
    expect(f.classifications).toHaveLength(1);
  }, 20000);
