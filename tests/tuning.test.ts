import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectEffort } from "../src/effort-policy.ts";
import { ledgerPath, type LedgerEntry } from "../src/ledger.ts";
import {
  applied,
  baseTunables,
  describeTuning,
  effectiveTunables,
  loadTuning,
  proposals,
  suggestions,
  tuneCommand,
  tuningOf,
  tuningPath,
  type TunableConfig,
} from "../src/tuning.ts";

// Upstream tests/tuning.spec.ts `settings`; every expected value below comes from that spec's
// literals or is hand-derived from the upstream rule text, never from this module's output.
const base: TunableConfig = {
  timeoutMs: 1500,
  minDowngradeConfidence: 0.6,
  effortCloseMargin: 0.15,
  minHighConfidence: 0.5,
};

function turn(at: number, started: LedgerEntry["started"], patch: Partial<LedgerEntry> = {}) {
  return {
    version: 1,
    id: `session-a:t${at}`,
    at,
    answered: true,
    ms: 500,
    effortLevel: 1,
    effortConfidence: 0.9,
    startedFrom: "medium",
    requested: started,
    started,
    toolCalls: 6,
    failures: 0,
    strategy: null,
    strategyConfidence: null,
    advised: false,
    outcome: "answer",
    durationMs: 1000,
    inputTokens: 10,
    outputTokens: 500,
    ...patch,
  } satisfies LedgerEntry as LedgerEntry;
}
/** Upstream `easyHigh`: 20 turns started at high, 15 of which finished in one tool call. */
const easyHigh = (from: number) =>
  Array.from({ length: 20 }, (_, i) => turn(from + i, "high", i < 15 ? { toolCalls: 1 } : {}));

let directory = "";
const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
const previousTimeout = process.env.JEV_TIMEOUT_MS;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pi-jev-tuning-"));
  process.env.PI_CODING_AGENT_DIR = directory;
  delete process.env.JEV_TIMEOUT_MS;
});
afterEach(async () => {
  if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
  if (previousTimeout === undefined) delete process.env.JEV_TIMEOUT_MS;
  else process.env.JEV_TIMEOUT_MS = previousTimeout;
  await rm(directory, { recursive: true, force: true });
});

test("AC-25 TUNE-25-easy-high: high starts that finish short and clean raise the high bar by .1", () => {
  // upstream tuning.spec: [['minHighConfidence', 0.5, 0.6]]
  expect(
    proposals(easyHigh(1), base, { values: {}, since: 0 }).map((s) => [s.option, s.from, s.to]),
  ).toEqual([["minHighConfidence", 0.5, 0.6]]);
});

test("AC-25 TUNE-25-fresh-count: fewer than 20 fresh turns propose nothing, the 20th does", () => {
  const entries = easyHigh(1);
  expect(suggestions(entries.slice(0, 19), base)).toEqual([]);
  expect(suggestions(entries, base)).toHaveLength(1);
  // 20 turns exist, but a change at at=10 leaves only 10 fresh ones.
  expect(proposals(entries, base, { values: {}, since: 10 })).toEqual([]);
});

test("AC-25 TUNE-25-no-repeat: after an applied change the same evidence never pushes twice", () => {
  // upstream tuning.spec: applied at 1000, same turns -> none, 20 newer easy turns -> .6 -> .7
  const entries = easyHigh(1);
  const next = applied(
    { values: {}, since: 0 },
    proposals(entries, base, { values: {}, since: 0 }),
    1000,
  );
  expect(next).toEqual({ values: { minHighConfidence: 0.6 }, since: 1000 });
  expect(proposals(entries, base, next)).toEqual([]);
  expect(proposals([...entries, ...easyHigh(2000)], base, next).map((s) => s.to)).toEqual([0.7]);
});

test("AC-25 TUNE-25-timeout: a >10% miss rate raises the timeout from the answered p90", () => {
  // 20 asked turns: 4 unanswered (20% > 10%); 16 answered at 1000..2500 ms.
  // Hand-derived: sorted[floor(.9*16)=14]=2400; max(1500+200, ceil(2400*1.25/100)*100=3000)=3000.
  const entries = [
    ...Array.from({ length: 16 }, (_, i) => turn(i + 1, "medium", { ms: 1000 + i * 100 })),
    ...Array.from({ length: 4 }, (_, i) => turn(17 + i, "medium", { answered: false, ms: 1500 })),
  ];
  const [found, ...rest] = suggestions(entries, base);
  expect(rest).toEqual([]);
  expect([found!.option, found!.from, found!.to]).toEqual(["timeoutMs", 1500, 3000]);
  // 2 of 20 missed is exactly 10%: not above the bar.
  expect(
    suggestions(
      entries.map((entry, i) => (i >= 16 && i < 18 ? { ...entry, answered: true } : entry)),
      base,
    ),
  ).toEqual([]);
});

test("AC-25 TUNE-25-corrected-cheap-starts: >20% corrected low/medium starts raise both bars", () => {
  // 10 medium starts, 3 corrected (30%), plus 10 neutral low-confidence-free turns at off.
  const entries = [
    ...Array.from({ length: 10 }, (_, i) =>
      turn(i + 1, "medium", i < 3 ? { corrected: true } : {}),
    ),
    ...Array.from({ length: 10 }, (_, i) => turn(11 + i, "off")),
  ];
  expect(suggestions(entries, base).map((s) => [s.option, s.from, s.to])).toEqual([
    ["minDowngradeConfidence", 0.6, 0.7],
    ["effortCloseMargin", 0.15, 0.2],
  ]);
  // 2 of 10 is exactly 20%: not above the bar. 9 low starts are below the 10-turn minimum.
  expect(
    suggestions(
      entries.map((entry, i) => (i === 2 ? { ...entry, corrected: undefined } : entry)),
      base,
    ),
  ).toEqual([]);
  expect(
    suggestions(
      [
        ...entries.slice(0, 9).map((entry) => ({ ...entry, corrected: true })),
        ...entries.slice(9, 10).map((entry) => ({ ...entry, started: "off" as const })),
        ...entries.slice(10),
      ],
      base,
    ),
  ).toEqual([]);
});

test("AC-25 TUNE-25-xhigh-margin: >60% short clean xhigh/max starts lower the margin by .05", () => {
  // 10 starts, 7 easy (70%); hand-derived .15 - .05 = .1.
  const entries = [
    ...Array.from({ length: 10 }, (_, i) =>
      turn(i + 1, i % 2 ? "max" : "xhigh", i < 7 ? { toolCalls: 2 } : {}),
    ),
    ...Array.from({ length: 10 }, (_, i) => turn(11 + i, "off")),
  ];
  expect(suggestions(entries, base).map((s) => [s.option, s.from, s.to])).toEqual([
    ["effortCloseMargin", 0.15, 0.1],
  ]);
  // Evidence pointing both ways is no evidence: corrected cheap starts raise the margin instead.
  const both = [
    ...entries.slice(0, 10),
    ...Array.from({ length: 10 }, (_, i) => turn(11 + i, "low", i < 4 ? { corrected: true } : {})),
  ];
  expect(suggestions(both, base).map((s) => [s.option, s.to])).toEqual([
    ["minDowngradeConfidence", 0.7],
    ["effortCloseMargin", 0.2],
  ]);
});

test("AC-25 TUNE-25-ranges: stored values are clamped to upstream ranges and unknown keys dropped", () => {
  // upstream tuning.spec literals
  expect(
    tuningOf({
      values: { minHighConfidence: 7, timeoutMs: 10, effortCloseMargin: -1, bogus: 3 },
      since: 5,
    }),
  ).toEqual({
    values: { minHighConfidence: 0.95, timeoutMs: 300, effortCloseMargin: 0 },
    since: 5,
  });
  expect(tuningOf("junk")).toEqual({ values: {}, since: 0 });
  expect(tuningOf({ values: { timeoutMs: Number.NaN } })).toEqual({ values: {}, since: 0 });
  expect(tuningOf({ values: { timeoutMs: 9999 } }).values.timeoutMs).toBe(5000);
});

test("AC-25 TUNE-25-bars-stop: no step is proposed past the upstream ceilings", () => {
  const high = [...easyHigh(1)];
  expect(suggestions(high, { ...base, minHighConfidence: 0.8 })).toEqual([]);
  const cheap = Array.from({ length: 20 }, (_, i) => turn(i + 1, "low", { corrected: true }));
  expect(
    suggestions(cheap, { ...base, minDowngradeConfidence: 0.9, effortCloseMargin: 0.3 }),
  ).toEqual([]);
});

test("AC-25 TUNE-25-describe: shows effective value against base and the suggestion", () => {
  // upstream tuning.spec: text contains the tuned/settings pair and 'x → y'.
  const text = describeTuning(easyHigh(1), base, { values: { minHighConfidence: 0.6 }, since: 0 });
  expect(text).toContain("minHighConfidence        0.6   (base: 0.5)");
  expect(text).toContain("minHighConfidence: 0.6 → 0.7");
  expect(text).toContain("/jev tune apply");
  expect(describeTuning([], base, { values: {}, since: 0 })).toContain(
    "No suggestion yet: 0 of the 20",
  );
});

test("AE-2 TUNE-25-effective-policy: legacy confidence tuning cannot veto effort", () => {
  // Approved effort authority supersedes confidence gates; stored fields remain compatible.
  const decision = { effort: 2, effortConfidence: 0.55, risky: 0 };
  const prompt = "Please review the complete patch with particular care for failure modes";
  expect(selectEffort(decision, "medium", prompt)).toBe("high");
  expect(selectEffort(decision, "medium", prompt, { ...base, minHighConfidence: 0.6 })).toBe(
    "high",
  );
  const lower = { effort: 1, effortConfidence: 0.65, risky: 0 };
  expect(selectEffort(lower, "high", prompt)).toBe("medium");
  expect(selectEffort(lower, "high", prompt, { ...base, minDowngradeConfidence: 0.7 })).toBe(
    "medium",
  );
  // Close call: probabilities .5/.4 (gap .1) lean up at margin .15, not at margin .05.
  const close = {
    effort: 0.9,
    effortConfidence: 0.5,
    effortProbabilities: { 0: 0.5, 1: 0.4, 2: 0.1 },
    risky: 0,
  };
  expect(selectEffort(close, "low", prompt)).toBe("medium");
  expect(selectEffort(close, "low", prompt, { ...base, effortCloseMargin: 0.05 })).toBe("low");
});

test("AC-26 TUNE-26-persist: an applied tuning is read back from disk and overlays the base", async () => {
  expect(loadTuning()).toEqual({ values: {}, since: 0 });
  expect(effectiveTunables()).toEqual(baseTunables());
  await Bun.write(ledgerPath(), JSON.stringify({ version: 1, entries: easyHigh(1) }));
  const ledgerBefore = await readFile(ledgerPath(), "utf8");
  expect(tuneCommand("apply", 5000)).toContain("Applied minHighConfidence 0.5 → 0.6");
  // A fresh read: no in-memory state is involved.
  expect(loadTuning()).toEqual({ values: { minHighConfidence: 0.6 }, since: 5000 });
  expect(effectiveTunables()).toEqual({ ...baseTunables(), minHighConfidence: 0.6 });
  expect(await readFile(ledgerPath(), "utf8")).toBe(ledgerBefore);
});

test("AC-26 TUNE-26-unreadable: an unreadable tuning file never blocks decisions and is left for reset", async () => {
  await Bun.write(tuningPath(), "{ PRIVATE not json");
  expect(effectiveTunables()).toEqual(baseTunables());
  expect(tuneCommand("show")).toContain("Nothing was changed");
  expect(tuneCommand("apply")).toContain("Nothing was changed");
  expect(await readFile(tuningPath(), "utf8")).toBe("{ PRIVATE not json");
  expect(tuneCommand("reset", 7)).toContain("Tuning cleared");
  expect(loadTuning()).toEqual({ values: {}, since: 7 });
});

test("AC-25 TUNE-25-base-timeout: JEV_TIMEOUT_MS is the base and invalid values are rejected", () => {
  process.env.JEV_TIMEOUT_MS = "100";
  expect(baseTunables().timeoutMs).toBe(100);
  process.env.JEV_TIMEOUT_MS = "0";
  expect(() => baseTunables()).toThrow("Set JEV_TIMEOUT_MS");
});
