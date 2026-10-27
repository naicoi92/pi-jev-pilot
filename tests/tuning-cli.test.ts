import { afterEach, expect, test } from "bun:test";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PiFixture, answer, type RecordData } from "./fixtures/pi-cli.ts";

let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

const jevDirectory = (f: PiFixture) => join(f.directory, "agent", "jev-pilot");
const ledgerFile = (f: PiFixture) => join(jevDirectory(f), "ledger.json");
const tuningFile = (f: PiFixture) => join(jevDirectory(f), "tuning.json");
function notifications(f: PiFixture) {
  return f.records
    .filter((row) => row.type === "extension_ui_request" && row.method === "notify")
    .map((row) => String(row.message));
}
async function say(f: PiFixture, command: string): Promise<string> {
  const before = notifications(f).length;
  await f.command("prompt", { message: command });
  const added = notifications(f).slice(before);
  expect(added).toHaveLength(1);
  return added[0]!;
}
async function ledgerRows(f: PiFixture): Promise<RecordData[]> {
  return (JSON.parse(await readFile(ledgerFile(f), "utf8")) as { entries: RecordData[] }).entries;
}
async function thinking(f: PiFixture): Promise<string> {
  return ((await f.command("get_state")).data as { thinkingLevel: string }).thinkingLevel;
}
/**
 * Upstream easyHigh: turns started at high that finished in two tool calls or fewer, clean.
 * Hand-written, not produced by the extension.
 */
function easyHigh(n: number): RecordData {
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
    toolCalls: 1,
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
async function seedLedger(f: PiFixture, count: number) {
  await mkdir(jevDirectory(f), { recursive: true });
  await writeFile(
    ledgerFile(f),
    JSON.stringify({
      version: 1,
      entries: Array.from({ length: count }, (_, n) => easyHigh(n + 1)),
    }),
  );
}
const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );
/** AE-2: valid high at confidence .55 applies regardless of stored confidence bars. */
const BORDERLINE = () => answer("high", 0.55);

test("AC-25 TUNE-CLI-25-propose-only: 20 fresh turns produce a proposal, never a change", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(f, 20);
  const text = await say(f, "/jev tune");
  expect(text).toContain("From your last 20 turns, it suggests:");
  expect(text).toContain("minHighConfidence: 0.5 → 0.6");
  expect(await exists(tuningFile(f))).toBe(false);
  f.response = BORDERLINE();
  await f.prompt("Please review the complete patch with particular care for failure modes");
  expect(await thinking(f)).toBe("high");
  expect(await exists(tuningFile(f))).toBe(false);
  expect(f.classifications).toHaveLength(1);
}, 20000);

test("AC-25 TUNE-CLI-25-too-few: 19 fresh turns suggest nothing and apply changes nothing", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(f, 19);
  expect(await say(f, "/jev tune")).toContain("No suggestion yet: 19 of the 20 turns");
  expect(await say(f, "/jev tune apply")).toContain("Nothing to apply.");
  expect(await exists(tuningFile(f))).toBe(false);
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(0);
});

test("AC-25 TUNE-CLI-25-apply-reset: stored confidence tuning cannot veto effort, ledger untouched", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(f, 20);
  const task = "Please review the complete patch with particular care for failure modes";
  f.response = BORDERLINE();
  await f.prompt(task);
  expect(await thinking(f)).toBe("high"); // valid assessment; confidence diagnostic
  await f.command("set_thinking_level", { level: "medium" });

  const applyText = await say(f, "/jev tune apply");
  expect(applyText).toContain("Applied minHighConfidence 0.5 → 0.6");
  expect(applyText).toContain("minHighConfidence        base: 0.5  overlay: 0.6  effective: 0.6");
  expect(applyText).toContain("No suggestion yet: 0 of the 20 turns");
  const stored = JSON.parse(await readFile(tuningFile(f), "utf8")) as RecordData;
  expect(stored).toMatchObject({ version: 1, values: { minHighConfidence: 0.6 } });
  expect(typeof stored.since).toBe("number");
  // Repeating the command without 20 new turns pushes nothing.
  const afterApply = await readFile(tuningFile(f), "utf8");
  expect(await say(f, "/jev tune apply")).toContain("Nothing to apply.");
  expect(await readFile(tuningFile(f), "utf8")).toBe(afterApply);

  await f.prompt(task);
  expect(await thinking(f)).toBe("high"); // stored bar .6 cannot veto valid high
  const ledgerBeforeReset = await readFile(ledgerFile(f), "utf8");

  const resetText = await say(f, "/jev tune reset");
  expect(resetText).toContain("Tuning cleared");
  expect(resetText).toContain("overlay: none");
  expect(JSON.parse(await readFile(tuningFile(f), "utf8"))).toMatchObject({ values: {} });
  expect(await readFile(ledgerFile(f), "utf8")).toBe(ledgerBeforeReset);
  await f.prompt(task);
  expect(await thinking(f)).toBe("high"); // reset preserves authoritative selection
  expect((await ledgerRows(f)).length).toBe(23);
}, 40000);

test("AC-24 TUNE-CLI-24-ledger-reset: ledger reset preserves stored tuning without an effort veto", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(f, 20);
  await say(f, "/jev tune apply");
  const tuningBefore = await readFile(tuningFile(f), "utf8");
  expect(await say(f, "/jev report reset")).toContain("tuning were not changed");
  expect(await exists(ledgerFile(f))).toBe(false);
  expect(await readFile(tuningFile(f), "utf8")).toBe(tuningBefore);
  expect(await say(f, "/jev tune")).toContain(
    "minHighConfidence        base: 0.5  overlay: 0.6  effective: 0.6",
  );
  f.response = BORDERLINE();
  await f.prompt("Please review the complete patch with particular care for failure modes");
  expect(await thinking(f)).toBe("high");
}, 20000);

test("AC-26 TUNE-CLI-26-reload-and-session: learned tuning survives reload and a new session", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(f, 20);
  await say(f, "/jev tune apply");
  await f.command("prompt", { message: "/fixture-reload" });
  expect(await say(f, "/jev tune")).toContain(
    "minHighConfidence        base: 0.5  overlay: 0.6  effective: 0.6",
  );
  f.response = BORDERLINE();
  const task = "Please review the complete patch with particular care for failure modes";
  await f.prompt(task);
  expect(await thinking(f)).toBe("high");
  await f.command("new_session");
  await f.prompt(task);
  expect(await thinking(f)).toBe("high");
  expect(JSON.parse(await readFile(tuningFile(f), "utf8"))).toMatchObject({
    values: { minHighConfidence: 0.6 },
  });
}, 30000);

test("AC-25 TUNE-CLI-25-announce: the 20th fresh turn announces a proposal once and applies nothing", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(f, 18);
  const task = "Please review the complete patch with particular care for failure modes";
  const announcements = () => notifications(f).filter((text) => text.includes("Jev learned"));
  await f.prompt(task); // 19th fresh turn
  expect(announcements()).toHaveLength(0);
  await f.prompt(`${task} again`); // 20th
  await f.wait(() => announcements().length === 1);
  expect(announcements()[0]).toContain("100% of turns started at high");
  expect(announcements()[0]).toContain("/jev tune apply");
  await f.prompt(`${task} once more`); // 21st
  expect(announcements()).toHaveLength(1);
  expect(await exists(tuningFile(f))).toBe(false);
}, 40000);

test("AC-25 TUNE-CLI-25-timeout: a learned timeout overlays the JSON base for the next decision", async () => {
  const f = new PiFixture();
  fixture = f;
  f.classifierConfig = { timeoutMs: 100 };
  await f.start({ JEV_TIMEOUT_MS: "invalid" });
  f.classifierDelay = 500;
  await mkdir(jevDirectory(f), { recursive: true });
  // Learned value as upstream stores it: kept in 300..5000 ms.
  await writeFile(
    tuningFile(f),
    JSON.stringify({ version: 1, values: { timeoutMs: 2000 }, since: 0 }),
  );
  expect(await say(f, "/jev tune")).toContain(
    "timeoutMs                base: 100  overlay: 2000  effective: 2000",
  );
  await f.prompt("Please review the complete patch with particular care for failure modes");
  expect((await ledgerRows(f))[0]).toMatchObject({ answered: true, requested: "high" });
}, 20000);

test("AC-26 TUNE-CLI-26-unreadable: an unreadable tuning file leaves decisions on base values and is not rewritten by show/apply", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(f, 20);
  await mkdir(jevDirectory(f), { recursive: true });
  await writeFile(tuningFile(f), "{ PRIVATE not json");
  expect(await say(f, "/jev tune")).toContain("Nothing was changed");
  expect(await say(f, "/jev tune apply")).toContain("Nothing was changed");
  expect(await readFile(tuningFile(f), "utf8")).toBe("{ PRIVATE not json");
  f.response = BORDERLINE();
  await f.prompt("Please review the complete patch with particular care for failure modes");
  expect(await thinking(f)).toBe("high");
  expect(await say(f, "/jev tune reset")).toContain("Tuning cleared");
  expect(JSON.parse(await readFile(tuningFile(f), "utf8"))).toMatchObject({ values: {} });
}, 20000);

test("AC-25 TUNE-CLI-25-usage: unknown tune arguments show usage without inference or writes", async () => {
  const f = await (fixture = new PiFixture()).start();
  await seedLedger(f, 20);
  expect(await say(f, "/jev tune bogus")).toBe(
    "Usage: /jev status | report | report reset | tune | tune apply | tune reset",
  );
  expect(await exists(tuningFile(f))).toBe(false);
  expect(f.classifications).toHaveLength(0);
});
