import { expect, test } from "bun:test";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  SessionEntry,
  Theme,
} from "@earendil-works/pi-coding-agent";
import {
  DECISION_TYPE,
  appendDecisionRow,
  decisionLines,
  decisionRenderer,
  latestDecisionRows,
  readDecisionRow,
  registerDecisionVisibility,
  type DecisionRow,
} from "../src/decision-visibility.ts";
import { WorkerVisibility } from "../src/worker-visibility.ts";

const main: DecisionRow = {
  version: 1,
  kind: "main",
  model: "local/parent",
  previous: "low",
  requested: "high",
  effective: "medium",
  outcome: "classified",
  elapsedMs: 123,
};
function entry(data: unknown): SessionEntry {
  return {
    type: "custom",
    id: "fixture",
    parentId: null,
    timestamp: "2026-01-01T00:00:00Z",
    customType: DECISION_TYPE,
    data,
  };
}
function rendered(data: unknown, expanded: boolean, width = 100) {
  const component = decisionRenderer(
    entry(data) as Parameters<typeof decisionRenderer>[0],
    { expanded },
    {} as Theme,
  );
  return component
    ?.render(width)
    .map((line) => line.trimEnd())
    .join("\n");
}
const timedOut: DecisionRow = { ...main, outcome: "timeout" };
test("AC-1 MAIN-1 public entry renderer collapses a main fallback warning", () => {
  expect(rendered(timedOut, false)).toBe(
    "Jev main · local/parent · high → medium · timeout · 123ms",
  );
});
test("AC-1 MAIN-1 public entry renderer expands previous requested effective effort", () => {
  expect(rendered(timedOut, true)).toContain(
    "Previous effort: low\nRequested effort: high\nEffective effort: medium\nMain model (Pi-selected): local/parent",
  );
  expect(
    rendered(timedOut, true, 20)
      ?.split("\n")
      .every((line) => line.length <= 20),
  ).toBe(true);
});
for (const outcome of ["timeout", "error"] as const) {
  test(`AC-6 MAIN-2 safe ${outcome} warning renders`, () => {
    expect(rendered({ ...main, outcome }, false)).toContain(` · ${outcome} · 123ms`);
  });
}
for (const outcome of ["classified", "reused", "kept", "skipped", "cancelled"] as const) {
  test(`P12 HIDE-1 ordinary ${outcome} main row is not rendered but stays readable evidence`, () => {
    expect(rendered({ ...main, outcome }, false)).toBeUndefined();
    expect(readDecisionRow({ ...main, outcome })).toBeDefined();
  });
}
const worker = (outcome: string): DecisionRow => ({
  version: 1,
  kind: "worker",
  invocation: "w1-abcdef",
  agent: "worker",
  stage: "executor",
  retained: "local/old",
  model: "local/new",
  requested: "high",
  effective: "medium",
  outcome: outcome as DecisionRow["outcome"],
  elapsedMs: 3,
});
for (const outcome of [
  "classified",
  "kept",
  "specialized",
  "executor-owned",
  "receipt",
  "unconfirmed",
  "cancelled",
])
  test(`P12 HIDE-2 ordinary ${outcome} worker row is not rendered`, () => {
    expect(rendered(worker(outcome), true)).toBeUndefined();
  });
for (const outcome of ["timeout", "error", "blocked"])
  test(`P12 HIDE-3 worker ${outcome} warning stays expandable`, () => {
    expect(rendered(worker(outcome), false)).toContain(`${outcome}`);
    expect(rendered(worker(outcome), true)).toContain("Retained → selected target");
  });
test("AC-4 SAFE-1 persisted extra private fields are rejected", () => {
  for (const invalid of [
    { ...main, task: "SECRET" },
    { ...main, model: "local/model\nSECRET" },
    { ...main, outcome: "RAW_ERROR" },
    { ...main, elapsedMs: NaN },
    null,
    [],
    { kind: "worker" },
  ]) {
    expect(readDecisionRow(invalid)).toBeUndefined();
    expect(rendered(invalid, true)).toBeUndefined();
  }
});
test("AC-5 RESTORE-1 active branch restores bounded snapshots without appending", () => {
  const rows = [
    entry(main),
    entry({ ...main, outcome: "reused" }),
    entry({ ...main, task: "PRIVATE" }),
  ];
  for (let i = 1; i <= 20; i++)
    rows.push(
      entry({
        version: 1,
        kind: "worker",
        invocation: `w${i}-abcdef`,
        agent: "worker",
        stage: "plan",
        retained: "local/old",
        model: "local/new",
        requested: "high",
        effective: "medium",
        outcome: "classified",
        elapsedMs: 3,
      }),
    );
  expect(latestDecisionRows(rows)).toHaveLength(13);
  expect(latestDecisionRows(rows)[0]).toMatchObject({ outcome: "reused" });
  expect(latestDecisionRows(rows).at(1)).toMatchObject({ invocation: "w9-abcdef" });
  expect(latestDecisionRows([])).toEqual([]);
});
test("AC-2 STATUS-1 command is available before selection with no inference API", async () => {
  let handler: (args: string, ctx: ExtensionCommandContext) => Promise<void> = async () => {};
  const notices: string[] = [];
  registerDecisionVisibility({
    registerEntryRenderer() {},
    registerCommand(name: string, command: Parameters<ExtensionAPI["registerCommand"]>[1]) {
      expect(name).toBe("jev");
      handler = command.handler;
    },
    getThinkingLevel: () => "low",
  } as unknown as ExtensionAPI);
  await handler("status", {
    model: { provider: "local", id: "parent" },
    sessionManager: { getBranch: () => [] },
    ui: { notify: (text: string) => notices.push(text) },
  } as unknown as ExtensionCommandContext);
  expect(notices.join()).toContain("Jev loaded");
  expect(notices.join()).toContain("No selection yet");
  expect(notices.join()).toContain("Main model (Pi-selected): local/parent");
  expect(notices.join()).toContain("Current effort: low");
});
function workerFixture() {
  const entries: DecisionRow[] = [];
  const lines: string[][] = [];
  const visibility = new WorkerVisibility((row) => entries.push(row));
  const ui = {
    setWidget(_key: string, value: string[] | undefined) {
      if (value) lines.push(value);
    },
    setStatus() {},
  } as unknown as ExtensionContext["ui"];
  return { entries, lines, visibility, ui };
}
function receipt(model: string, thinking: string) {
  return {
    mode: "single",
    runId: "PRIVATE_RUN_ID",
    results: [
      {
        model,
        thinking,
        exitCode: 0,
        usage: { turns: 1 },
        launchContractDigest: "a".repeat(64),
        launchResolvedExtensions: { source: "launch-resolved", version: 1 },
      },
    ],
  };
}
test("AC-3 WORKER-3 concurrent same-agent decisions retain separate out-of-order receipts", () => {
  const f = workerFixture();
  const first = f.visibility.start("PRIVATE_CALL_1", f.ui, "worker", "local/old");
  const second = f.visibility.start("PRIVATE_CALL_2", f.ui, "worker", "local/old");
  f.visibility.finish(first, "selected", false, {
    model: "local/fast",
    requested: "low",
    effective: "low",
    outcome: "classified",
  });
  f.visibility.finish(second, "selected", false, {
    model: "local/deep",
    requested: "high",
    effective: "medium",
    outcome: "classified",
  });
  f.visibility.result("PRIVATE_CALL_2", receipt("local/deep", "medium"));
  f.visibility.result("PRIVATE_CALL_1", receipt("local/fast", "low"));
  f.visibility.result("PRIVATE_CALL_1", receipt("local/wrong", "high"));
  expect(f.entries).toHaveLength(4);
  expect(f.entries[0]).toMatchObject({ agent: "worker", model: "local/fast", stage: "plan" });
  expect(f.entries[1]).toMatchObject({ agent: "worker", model: "local/deep", stage: "plan" });
  expect(f.entries[2]).toMatchObject({
    invocation: second.label,
    model: "local/deep",
    effective: "medium",
    outcome: "receipt",
  });
  expect(f.entries[3]).toMatchObject({
    invocation: first.label,
    model: "local/fast",
    effective: "low",
    outcome: "receipt",
  });
  expect(first.label).not.toBe(second.label);
  expect(JSON.stringify(f.entries)).not.toContain("PRIVATE");
  expect(f.lines.at(-1)).toHaveLength(2);
});
test("AC-3 WORKER-4 async acknowledgement never claims verified launch", () => {
  const f = workerFixture();
  const owner = f.visibility.start("call", f.ui, "worker");
  f.visibility.finish(owner, "selected", false, { model: "local/fast", outcome: "classified" });
  f.visibility.result("call", { asyncId: "PRIVATE_ASYNC_ID" });
  f.visibility.complete("PRIVATE_ASYNC_ID", "complete");
  expect(f.entries).toHaveLength(2);
  expect(f.entries[1]).toMatchObject({
    invocation: owner.label,
    stage: "executor",
    outcome: "unconfirmed",
    model: "unknown",
    effective: "unknown",
  });
  expect(decisionLines(f.entries[1]!, true).join("\n")).toContain("model/effort unconfirmed");
  expect(JSON.stringify(f.entries)).not.toContain("PRIVATE");
});
test("AC-5 RESTORE-2 clearing lifecycle rejects stale worker persistence", () => {
  const f = workerFixture();
  const owner = f.visibility.start("call", f.ui, "worker");
  f.visibility.clear();
  f.visibility.finish(owner, "selected");
  f.visibility.result("call", receipt("local/fast", "low"));
  expect(f.entries).toEqual([]);
});
test("AC-3 WORKER-5 workflow results expose bounded executor-only child receipts", () => {
  const f = workerFixture();
  const owner = f.visibility.start("workflow-call", f.ui);
  f.visibility.finish(owner, "executor-owned · workflow inner launches");
  const child = receipt("local/deep", "high").results[0]!;
  f.visibility.result("workflow-call", {
    mode: "workflow",
    runId: "PRIVATE_RUN_ID",
    results: [
      { ...child, index: 0, agent: "worker" },
      { ...child, model: "local/fast", thinking: "low", index: 1, agent: "worker" },
    ],
  });
  expect(f.entries).toHaveLength(3);
  expect(f.entries[1]).toMatchObject({
    agent: "worker",
    stage: "executor",
    model: "local/deep",
    effective: "high",
    requested: "unknown",
    outcome: "receipt",
  });
  expect(f.entries[2]).toMatchObject({
    agent: "worker",
    stage: "executor",
    model: "local/fast",
    effective: "low",
    outcome: "receipt",
  });
  expect(
    f.entries[1]?.kind === "worker" &&
      f.entries[2]?.kind === "worker" &&
      f.entries[1].invocation !== f.entries[2].invocation,
  ).toBe(true);
  expect(JSON.stringify(f.entries)).not.toContain("PRIVATE");
});
test("AC-5 RESTORE-5 restored invocation sequence cannot reuse same-call label", () => {
  const f = workerFixture();
  const old = f.visibility.start("call", f.ui, "worker");
  f.visibility.finish(old, "selected");
  const replacement = workerFixture();
  replacement.visibility.restore(f.entries.map(entry));
  const next = replacement.visibility.start("call", replacement.ui, "worker");
  expect(next.label).not.toBe(old.label);
  expect(next.label).toStartWith("w2-");
});
test("AC-2 STATUS-2 disabled flag stays legible without claiming classification", async () => {
  const previous = process.env.JEV_EFFORT_ENABLED;
  process.env.JEV_EFFORT_ENABLED = "false";
  try {
    const { statusLines } = await import("../src/decision-visibility.ts");
    const text = statusLines(
      { getThinkingLevel: () => "low" } as ExtensionAPI,
      { sessionManager: { getBranch: () => [] }, model: undefined } as unknown as ExtensionContext,
    ).join("\n");
    expect(text).toContain("effort disabled");
    expect(text).toContain("No selection yet");
    expect(text).not.toContain("classified");
  } finally {
    if (previous === undefined) delete process.env.JEV_EFFORT_ENABLED;
    else process.env.JEV_EFFORT_ENABLED = previous;
  }
});

for (const sequence of [
  "9".repeat(400),
  "Infinity",
  "9007199254740990",
  "9007199254740991",
  "0",
  "01",
])
  test(`RC-3 RESTORE-OVERFLOW malformed ${sequence.length > 20 ? "400-digits" : sequence} history cannot poison persistence`, () => {
    const branch: SessionEntry[] = [];
    const pi = {
      appendEntry(_customType: string, data: unknown) {
        branch.push(entry(data));
      },
    } as unknown as ExtensionAPI;
    const seed = workerFixture();
    const old = seed.visibility.start("call", seed.ui, "worker");
    seed.visibility.finish(old, "selected");
    pi.appendEntry(DECISION_TYPE, { ...seed.entries[0], invocation: `w${sequence}-abcdef` });
    const visibility = new WorkerVisibility((row) => appendDecisionRow(pi, row));
    visibility.restore(branch);
    const next = visibility.start("call", seed.ui, "worker");
    visibility.finish(next, "selected");
    expect(branch).toHaveLength(2);
    expect(
      readDecisionRow(branch[1]!.type === "custom" ? branch[1]!.data : undefined),
    ).toBeDefined();
    expect(next.label).toStartWith("w1-");
    expect(next.label.length).toBeLessThanOrEqual(43);
    expect(
      readDecisionRow({ ...seed.entries[0], invocation: `w${sequence}-abcdef` }),
    ).toBeUndefined();
  });

test("RC-3 RESTORE-OVERFLOW cap rollover persists distinct bounded labels through reload", () => {
  const f = workerFixture();
  const old = f.visibility.start("same-call", f.ui, "worker");
  f.visibility.finish(old, "selected");
  const branch = [entry({ ...f.entries[0], invocation: "w999999999-abcdef" })];
  const visibility = new WorkerVisibility((row) =>
    appendDecisionRow(
      {
        appendEntry(_type: string, data: unknown) {
          branch.push(entry(data));
        },
      } as unknown as ExtensionAPI,
      row,
    ),
  );
  visibility.restore(branch);
  const first = visibility.start("same-call", f.ui, "worker");
  visibility.finish(first, "selected");
  const second = visibility.start("same-call", f.ui, "worker");
  visibility.finish(second, "selected");
  expect(branch).toHaveLength(3);
  expect(first.label).toMatch(/^w1-[a-f0-9]{32}$/);
  expect(second.label).toMatch(/^w2-[a-f0-9]{32}$/);
  const restored = new WorkerVisibility((row) =>
    appendDecisionRow(
      {
        appendEntry(_type: string, data: unknown) {
          branch.push(entry(data));
        },
      } as unknown as ExtensionAPI,
      row,
    ),
  );
  restored.restore(branch.slice(1));
  const next = restored.start("same-call", f.ui, "worker");
  restored.finish(next, "selected");
  expect(next.label).toMatch(/^w3-[a-f0-9]{32}$/);
  expect(new Set([first.label, second.label, next.label]).size).toBe(3);
  expect(branch).toHaveLength(4);
});
