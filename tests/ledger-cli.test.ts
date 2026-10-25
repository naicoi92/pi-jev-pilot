import { afterEach, expect, test } from "bun:test";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PiFixture, answer, type RecordData } from "./fixtures/pi-cli.ts";

let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

type Row = RecordData & {
  id: string;
  corrected?: boolean;
  answered: boolean;
  ms: number | null;
};
const ledgerFile = (f: PiFixture) => join(f.directory, "agent", "jev-pilot", "ledger.json");
async function ledger(f: PiFixture): Promise<Row[]> {
  try {
    return (JSON.parse(await readFile(ledgerFile(f), "utf8")) as { entries: Row[] }).entries;
  } catch {
    return [];
  }
}
async function sessionEntries(f: PiFixture) {
  return ((await f.command("get_entries")).data as { entries: RecordData[] }).entries;
}
async function sessionId(f: PiFixture) {
  return ((await f.command("get_state")).data as { sessionId: string }).sessionId;
}
const userEntries = (entries: RecordData[]) =>
  entries.filter((row) => (row.message as RecordData | undefined)?.role === "user");
const assistantEntries = (entries: RecordData[]) =>
  entries.filter((row) => (row.message as RecordData | undefined)?.role === "assistant");
function notifications(f: PiFixture) {
  return f.records
    .filter((row) => row.type === "extension_ui_request" && row.method === "notify")
    .map((row) => String(row.message));
}
/** Classifier answer whose correction read is `corrects` when quality guidance is enabled. */
function judged(corrects: number): RecordData {
  return {
    answers: {
      tier: { choice: "balanced", confidence: 0.99 },
      effort: { choice: "high", confidence: 0.95 },
      risky: { noul: 0 },
      corrects: { noul: corrects },
    },
  };
}
async function guided(corrections: number[]) {
  const f = (fixture = new PiFixture());
  f.useGuidanceDefaults = true;
  let call = 0;
  f.classifierResponse = () => judged(corrections[call++] ?? 0);
  await f.start();
  return f;
}
function seed(n: number): Row {
  return {
    version: 1,
    id: `seed:t${n}`,
    at: 1_700_000_000_000 + n,
    answered: true,
    ms: 100,
    effortLevel: 2,
    effortConfidence: 0.9,
    startedFrom: "medium",
    requested: "high",
    started: "high",
    toolCalls: 0,
    failures: 0,
    strategy: null,
    strategyConfidence: null,
    advised: false,
    outcome: "answer",
    durationMs: 10,
    inputTokens: 10,
    outputTokens: 4,
  };
}
async function seedLedger(f: PiFixture, rows: Row[]) {
  await mkdir(join(f.directory, "agent", "jev-pilot"), { recursive: true });
  await writeFile(ledgerFile(f), JSON.stringify({ version: 1, entries: rows }));
}

test("AC-22 LEDGER-22-turn completed Pi turn persists one allowlisted entry without prompt text", async () => {
  const f = await (fixture = new PiFixture()).start();
  f.response = answer("high");
  await f.prompt("PRIVATE_TASK: review this patch carefully");
  const rows = await ledger(f);
  expect(rows).toHaveLength(1);
  const row = rows[0]!;
  const user = userEntries(await sessionEntries(f))[0]!;
  expect(row.id).toBe(`${await sessionId(f)}:${user.id}`);
  expect(row).toMatchObject({
    version: 1,
    answered: true,
    effortLevel: 2,
    effortConfidence: 0.95,
    startedFrom: "medium",
    requested: "high",
    started: "high",
    toolCalls: 0,
    failures: 0,
    strategy: null,
    advised: false,
    outcome: "answer",
    inputTokens: 10,
    outputTokens: 4,
  });
  expect(Number.isInteger(row.ms)).toBe(true);
  expect(Object.keys(row).sort()).toEqual(
    [
      "version",
      "id",
      "at",
      "answered",
      "ms",
      "effortLevel",
      "effortConfidence",
      "startedFrom",
      "requested",
      "started",
      "toolCalls",
      "failures",
      "strategy",
      "strategyConfidence",
      "advised",
      "outcome",
      "durationMs",
      "inputTokens",
      "outputTokens",
    ].sort(),
  );
  const persisted = await readFile(ledgerFile(f), "utf8");
  expect(persisted).not.toContain("PRIVATE_TASK");
  expect(persisted).not.toContain("Fixture answer");
  expect(f.classifications).toHaveLength(1);
});

test("AC-22 LEDGER-22-tools counts tool calls and the longest failed-call run", async () => {
  const f = await (fixture = new PiFixture()).start();
  await Bun.write(join(f.directory, "ok.txt"), "fine");
  f.toolCalls = [
    { name: "read", input: { path: join(f.directory, "missing-a.txt") } },
    { name: "read", input: { path: join(f.directory, "missing-b.txt") } },
    { name: "read", input: { path: join(f.directory, "ok.txt") } },
    { name: "read", input: { path: join(f.directory, "missing-c.txt") } },
  ];
  await f.prompt("Inspect the files carefully");
  const rows = await ledger(f);
  expect(rows).toHaveLength(1);
  // Four calls: fail, fail, ok, fail -> longest consecutive failure run is 2.
  expect(rows[0]).toMatchObject({ toolCalls: 4, failures: 2, outcome: "answer" });
  expect(await readFile(ledgerFile(f), "utf8")).not.toContain("missing-a");
});

for (const mode of ["error", "timeout"] as const) {
  test(`AC-22 LEDGER-22-classifier-${mode} records an unanswered turn that kept the current effort`, async () => {
    const f = await (fixture = new PiFixture()).start(
      mode === "timeout" ? { JEV_TIMEOUT_MS: "100" } : {},
    );
    if (mode === "error") {
      f.status = 503;
      f.response = "PRIVATE_PROVIDER_ERROR";
    } else f.classifierDelay = 700;
    await f.prompt("Review this patch carefully");
    const rows = await ledger(f);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      answered: false,
      effortLevel: null,
      startedFrom: "medium",
      requested: "medium",
      started: "medium",
      outcome: "answer",
    });
    expect(typeof rows[0]!.ms).toBe("number");
    expect(await readFile(ledgerFile(f), "utf8")).not.toContain("PRIVATE");
  });
}

test("AC-22 LEDGER-22-retention-cli 499 seeded plus two turns keeps the latest 500", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(
    f,
    Array.from({ length: 499 }, (_, n) => seed(n)),
  );
  await f.prompt("First new turn");
  await f.prompt("Second new turn");
  const rows = await ledger(f);
  expect(rows).toHaveLength(500);
  // 501 offered (seed t0..t498 plus two new): the single oldest seed drops.
  expect(rows[0]!.id).toBe("seed:t1");
  expect(rows[497]!.id).toBe("seed:t498");
  expect(rows.slice(498).some((row) => row.id.startsWith("seed:"))).toBe(false);
}, 20000);

test("AC-22 LEDGER-22-disabled JEV_RECORD_DECISIONS=false writes nothing", async () => {
  const f = await (fixture = new PiFixture()).start({ JEV_RECORD_DECISIONS: "false" });
  await f.prompt("Review this patch carefully");
  expect(await ledger(f)).toEqual([]);
  await expect(stat(ledgerFile(f))).rejects.toThrow();
  expect(f.classifications).toHaveLength(1);
});

test("AC-23 LEDGER-23-correction a classified correction marks the preceding completed turn only", async () => {
  const f = await guided([0.1, 0.9, 0.5]);
  await f.prompt("Add a dark mode toggle");
  await f.prompt("That is wrong, it does not work");
  let rows = await ledger(f);
  expect(rows.map((row) => row.corrected)).toEqual([true, undefined]);
  await f.prompt("Thanks, now something new");
  rows = await ledger(f);
  // .5 is below the upstream 0.7 correction bar: judged, and not corrected.
  expect(rows.map((row) => row.corrected)).toEqual([true, false, undefined]);
}, 20000);

test("AC-23 LEDGER-23-resume resumed session attributes to its own last turn", async () => {
  const f = await guided([0.1, 0.1, 0.9]);
  await f.prompt("Add a dark mode toggle");
  const original = (await f.command("get_state")).data as {
    sessionFile: string;
    sessionId: string;
  };
  await f.command("new_session");
  await f.prompt("Unrelated task in another session");
  await f.command("switch_session", { sessionPath: original.sessionFile });
  await f.prompt("It does not work, redo it");
  const rows = await ledger(f);
  const first = userEntries(await sessionEntries(f))[0]!;
  const byId = new Map(rows.map((row) => [row.id, row]));
  expect(rows).toHaveLength(3);
  expect(byId.get(`${original.sessionId}:${first.id}`)!.corrected).toBe(true);
  const others = rows.filter((row) => row.id !== `${original.sessionId}:${first.id}`);
  expect(others.map((row) => row.corrected)).toEqual([undefined, undefined]);
}, 30000);

test("AC-23 LEDGER-23-branch correction after navigating back marks the branch turn, not the abandoned one", async () => {
  const f = await guided([0.1, 0.1, 0.9]);
  await f.prompt("First request");
  await f.prompt("Second request");
  const entries = await sessionEntries(f);
  const [firstReply] = assistantEntries(entries);
  await f.command("prompt", { message: `/fixture-tree ${firstReply!.id}` });
  await f.prompt("That first answer is wrong");
  const rows = await ledger(f);
  const [first, second] = userEntries(entries);
  const id = await sessionId(f);
  const byId = new Map(rows.map((row) => [row.id, row]));
  expect(byId.get(`${id}:${first!.id}`)!.corrected).toBe(true);
  expect(byId.get(`${id}:${second!.id}`)!.corrected).toBeUndefined();
}, 30000);

test("AC-23 LEDGER-23-new-session a correction with no prior turn in the session marks nothing", async () => {
  const f = await guided([0.1, 0.9]);
  await f.prompt("First request");
  await f.command("new_session");
  await f.prompt("This is wrong");
  const rows = await ledger(f);
  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.corrected)).toEqual([undefined, undefined]);
}, 20000);

test("AC-26 LIFECYCLE-26-reload reload keeps the ledger and attribution", async () => {
  const f = await guided([0.1, 0.9]);
  await f.prompt("First request");
  await f.command("prompt", { message: "/fixture-reload" });
  expect((await ledger(f)).map((row) => row.corrected)).toEqual([undefined]);
  await f.prompt("That is wrong");
  expect((await ledger(f)).map((row) => row.corrected)).toEqual([true, undefined]);
}, 30000);

test("AC-26 LIFECYCLE-26-compaction compaction keeps turn identity and the correction marks the latest turn", async () => {
  const f = await guided([0.1, 0.1, 0.9]);
  const filler = "background detail ".repeat(120);
  await f.prompt(`First request ${filler}`);
  await f.prompt(`Second request ${filler}`);
  await f.command("compact");
  const entries = await sessionEntries(f);
  expect(entries.some((row) => row.type === "compaction")).toBe(true);
  await f.prompt("That second answer is wrong");
  const rows = await ledger(f);
  const [, second] = userEntries(entries);
  const id = await sessionId(f);
  expect(rows).toHaveLength(3);
  expect(rows.find((row) => row.id === `${id}:${second!.id}`)!.corrected).toBe(true);
  expect(rows.filter((row) => row.corrected === true)).toHaveLength(1);
}, 30000);

test("AC-26 LIFECYCLE-26-replace a turn abandoned by session replacement is never corrected", async () => {
  const f = await guided([0.1, 0.9]);
  f.classifierDelay = 1200;
  await f.command("prompt", { message: "Abandoned request" });
  await f.wait(() => f.classifications.length === 1);
  await f.command("new_session");
  await Bun.sleep(1300);
  f.classifierDelay = 0;
  await f.prompt("This is wrong");
  const rows = await ledger(f);
  expect(rows.some((row) => row.corrected === true)).toBe(false);
}, 30000);

test("AC-24 REPORT-24-cli-summary reports seeded observations with no inference", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(f, [
    { ...seed(1), ms: 100, toolCalls: 3, outputTokens: 100, inputTokens: 50, corrected: true },
    { ...seed(2), ms: 300, toolCalls: 1, outputTokens: 200, inputTokens: 70, corrected: false },
    { ...seed(3), ms: 200, toolCalls: 2, failures: 1, outcome: "aborted" },
  ]);
  await f.command("prompt", { message: "/jev report" });
  const text = notifications(f).join("\n");
  expect(text).toContain("Decision ledger: 3 turns since 2023-11-14.");
  expect(text).toContain("answered 3 (100%); latency median 200 ms, 90th percentile 300 ms.");
  expect(text).toContain("| high | 3 | 50% of 2 | 2.0 | 101 |");
  expect(text).toContain("Turns with failed tool calls: 1 of 3.");
  expect(text).toContain("Outcomes: answer 2, aborted 1.");
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(0);
});

test("AC-24 REPORT-24-cli-reset removes ledger observations and leaves configuration and tuning", async () => {
  const f = await (fixture = new PiFixture()).startWithRouting({
    tiers: {
      fast: "fixture-fast/lookup",
      balanced: "fixture/fixture-model",
      deep: "fixture-deep/judgment",
    },
  });
  await seedLedger(f, [seed(1), seed(2)]);
  const tuning = join(f.directory, "agent", "jev-pilot", "tuning.json");
  await writeFile(tuning, '{"timeoutMs":2000}');
  const settings = join(f.directory, "agent", "settings.json");
  const settingsBefore = await readFile(settings, "utf8");
  await f.command("prompt", { message: "/jev report reset" });
  expect(notifications(f).join("\n")).toContain("ledger was cleared");
  expect(await ledger(f)).toEqual([]);
  await expect(stat(ledgerFile(f))).rejects.toThrow();
  expect(await readFile(tuning, "utf8")).toBe('{"timeoutMs":2000}');
  expect(await readFile(settings, "utf8")).toBe(settingsBefore);
  expect(f.classifications).toHaveLength(0);
});

test("AC-24 REPORT-24-cli-empty-and-unreadable empty and unreadable ledgers are reported without being rewritten", async () => {
  const f = await (fixture = new PiFixture()).start();
  await f.command("prompt", { message: "/jev report" });
  expect(notifications(f).join("\n")).toContain("The decision ledger is empty");
  await mkdir(join(f.directory, "agent", "jev-pilot"), { recursive: true });
  await writeFile(ledgerFile(f), "{ PRIVATE not json");
  await f.command("prompt", { message: "/jev report" });
  expect(notifications(f).join("\n")).toContain("ledger could not be read");
  expect(await readFile(ledgerFile(f), "utf8")).toBe("{ PRIVATE not json");
});

test("AC-24 REPORT-24-cli-usage unknown report arguments show usage without inference", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(f, [seed(1)]);
  await f.command("prompt", { message: "/jev report bogus" });
  await f.command("prompt", { message: "/jev bogus" });
  expect(
    notifications(f).filter((text) => text === "Usage: /jev status | report | report reset"),
  ).toHaveLength(2);
  expect(await ledger(f)).toHaveLength(1);
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(0);
});
