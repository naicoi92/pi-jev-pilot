import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  LEDGER_SIZE,
  appendLedgerEntry,
  ledgerPath,
  loadLedger,
  markCorrected,
  readLedgerEntry,
  recordCorrection,
  recordTurn,
  resetLedger,
  summarizeLedger,
  type LedgerEntry,
} from "../src/ledger.ts";

const START = 1_700_000_000_000;
function entry(n: number, patch: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    version: 1,
    id: `session-a:turn${n}`,
    at: START + n,
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
    ...patch,
  };
}

let directory = "";
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pi-jev-ledger-"));
  process.env.PI_CODING_AGENT_DIR = directory;
});
afterEach(async () => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  await rm(directory, { recursive: true, force: true });
});

test("AC-22 LEDGER-22-bound keeps the latest 500 valid entries and drops invalid stored values", () => {
  expect(LEDGER_SIZE).toBe(500);
  let stored: unknown = [{ prompt: "PRIVATE_TASK" }, "junk", entry(0)];
  const appended: LedgerEntry[] = [];
  for (let n = 1; n <= 504; n++) {
    const next = entry(n);
    appended.push(next);
    stored = appendLedgerEntry(stored, next);
  }
  const kept = stored as LedgerEntry[];
  expect(kept).toHaveLength(500);
  // 505 valid entries were offered (turn0..turn504): turns 5..504 survive.
  expect(kept[0]!.id).toBe("session-a:turn5");
  expect(kept[499]!.id).toBe("session-a:turn504");
  expect(JSON.stringify(kept)).not.toContain("PRIVATE_TASK");
});

test("AC-22 LEDGER-22-schema strict reader accepts the contract and rejects prompt-like or malformed fields", () => {
  expect(readLedgerEntry(entry(1))).toEqual(entry(1));
  expect(readLedgerEntry(entry(1, { corrected: true }))).toMatchObject({ corrected: true });
  expect(readLedgerEntry({ ...entry(1), prompt: "PRIVATE_TASK" })).toBeUndefined();
  expect(readLedgerEntry({ ...entry(1), text: "PRIVATE_TASK" })).toBeUndefined();
  expect(readLedgerEntry({ ...entry(1), id: "has space:turn" })).toBeUndefined();
  expect(readLedgerEntry({ ...entry(1), outcome: "PRIVATE_TASK" })).toBeUndefined();
  expect(readLedgerEntry({ ...entry(1), requested: "PRIVATE_TASK" })).toBeUndefined();
  expect(readLedgerEntry({ ...entry(1), effortConfidence: 1.5 })).toBeUndefined();
  expect(readLedgerEntry({ ...entry(1), outputTokens: -1 })).toBeUndefined();
  expect(readLedgerEntry({ ...entry(1), version: 2 })).toBeUndefined();
  expect(readLedgerEntry(null)).toBeUndefined();
});

test("AC-23 LEDGER-23-mark marks only the entry with the exact turn identity", () => {
  const marked = markCorrected([entry(1), entry(2)], "session-a:turn2", true);
  expect(marked.map((row) => row.corrected)).toEqual([undefined, true]);
  expect(markCorrected(marked, "session-b:turn2", true)).toEqual(marked);
  expect(markCorrected(marked, "session-a:turn2", false)[1]!.corrected).toBe(false);
});

test("AC-22 LEDGER-22-store persists a bounded file and tolerates an unreadable file", async () => {
  expect(ledgerPath()).toBe(join(directory, "jev-pilot", "ledger.json"));
  expect(loadLedger()).toEqual([]);
  recordTurn(entry(1));
  recordTurn(entry(2));
  const file = JSON.parse(await readFile(ledgerPath(), "utf8"));
  expect(file).toEqual({ version: 1, entries: [entry(1), entry(2)] });
  recordCorrection("session-a:turn1", true);
  expect(loadLedger().map((row) => row.corrected)).toEqual([true, undefined]);
  await writeFile(ledgerPath(), "{ not json");
  expect(() => loadLedger()).toThrow();
  // A later observation starts a fresh list, as upstream does for a non-list store value.
  recordTurn(entry(3));
  expect(loadLedger()).toEqual([entry(3)]);
});

test("AC-24 REPORT-24-reset deletes the ledger file only", async () => {
  recordTurn(entry(1));
  const tuning = join(directory, "jev-pilot", "tuning.json");
  await writeFile(tuning, '{"timeoutMs":2000}');
  await writeFile(join(directory, "settings.json"), '{"jevPilot":{"tiers":{}}}');
  resetLedger();
  expect(loadLedger()).toEqual([]);
  expect(await readFile(tuning, "utf8")).toBe('{"timeoutMs":2000}');
  expect(await readFile(join(directory, "settings.json"), "utf8")).toBe(
    '{"jevPilot":{"tiers":{}}}',
  );
  expect(() => resetLedger()).not.toThrow();
});

test("AC-24 REPORT-24-summary reports hand-computed real observations without savings or accuracy claims", () => {
  const entries: LedgerEntry[] = [
    entry(1, {
      ms: 100,
      effortConfidence: 0.8,
      toolCalls: 3,
      outputTokens: 100,
      inputTokens: 50,
      strategy: "delegate",
      strategyConfidence: 0.7,
      advised: true,
      corrected: true,
    }),
    entry(2, {
      ms: 300,
      effortConfidence: 0.6,
      toolCalls: 1,
      outputTokens: 200,
      inputTokens: 70,
      strategy: "parallel",
      strategyConfidence: 0.9,
      advised: true,
      corrected: false,
    }),
    entry(3, {
      ms: 200,
      effortConfidence: 0.7,
      requested: "high",
      started: "medium",
      failures: 2,
      toolCalls: 2,
      outputTokens: null,
      inputTokens: null,
      outcome: "aborted",
    }),
    entry(4, {
      answered: false,
      ms: 1500,
      effortLevel: null,
      effortConfidence: null,
      requested: null,
      started: null,
      outputTokens: 40,
      inputTokens: 20,
    }),
  ];
  const lines = summarizeLedger(entries).split("\n");
  expect(lines).toContain("Decision ledger: 4 turns since 2023-11-14.");
  expect(lines).toContain(
    "Jev was asked on 4 turns and answered 3 (75%); latency median 200 ms, 90th percentile 300 ms.",
  );
  expect(lines).toContain(
    "Mean self-reported decision confidence: 0.70 over 3 answered turns (a classifier signal, not accuracy).",
  );
  expect(lines).toContain(
    "| Started at | Turns | Corrected by you | Avg tool calls | Avg output tokens |",
  );
  expect(lines).toContain("| medium | 1 | — | 2.0 | — |");
  expect(lines).toContain("| high | 2 | 50% of 2 | 2.0 | 150 |");
  expect(lines).toContain("| (not set) | 1 | — | 0.0 | 40 |");
  expect(lines).toContain("Turns with failed tool calls: 1 of 4.");
  expect(lines).toContain("Outcomes: answer 3, aborted 1.");
  expect(lines).toContain("Usage reported on 3 of 4 turns: 140 input tokens, 340 output tokens.");
  expect(lines).toContain("Requested effort differed from the started effort on 1 turn.");
  expect(lines).toContain("Strategy advice attached on 2 turns: delegate 1, parallel 1.");
  expect(lines).toContain(
    "Observed outcomes only: no savings are estimated for models that did not run.",
  );
  const text = lines.join("\n");
  expect(text).not.toMatch(/saved|accuracy rate|suggest/i);
});

test("AC-24 REPORT-24-empty empty ledger has the upstream empty message", () => {
  expect(summarizeLedger([])).toBe(
    "The decision ledger is empty: no main-conversation turn has been recorded yet.",
  );
});
