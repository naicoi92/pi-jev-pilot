// Proposal rules, ranges and lifecycle adapted from Jev Pilot 0.12.1 hooks/tuning.ts and
// hooks/ledger.ts suggestions(); see NOTICE.md.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { DEFAULT_EFFORT_THRESHOLDS, type EffortThresholds } from "./effort-policy.ts";
import { loadLedger, percentile, share, type LedgerEntry } from "./ledger.ts";
import { loadJevConfig } from "./jev-config.ts";

/** The settings learned values may overlay; every other threshold is fixed. */
export interface TunableConfig extends EffortThresholds {
  timeoutMs: number;
}

export interface Suggestion {
  option: keyof TunableConfig;
  from: number;
  to: number;
  why: string;
}

/** Learned values and the time of the last explicit change; only later turns are evidence. */
export interface Tuning {
  values: Partial<TunableConfig>;
  since: number;
}

/** Below this many fresh turns nothing is suggested. */
export const MIN_TURNS_TO_SUGGEST = 20;

/** The range each learned value is kept in, whatever the file holds. */
const RANGES: Record<keyof TunableConfig, [number, number]> = {
  timeoutMs: [300, 5000],
  minDowngradeConfidence: [0, 0.95],
  effortCloseMargin: [0, 0.5],
  minHighConfidence: [0, 0.95],
};
const KEYS = Object.keys(RANGES) as (keyof TunableConfig)[];

/** Base configuration: fixed effort defaults and the JSON classifier timeout. */
export function baseTunables(): TunableConfig {
  return { ...DEFAULT_EFFORT_THRESHOLDS, timeoutMs: loadJevConfig().classifier.timeoutMs };
}

/** A tuning read back from storage: unknown keys dropped, values kept in range. */
export function tuningOf(stored: unknown): Tuning {
  if (!stored || typeof stored !== "object" || Array.isArray(stored))
    return { values: {}, since: 0 };
  const raw = stored as { values?: unknown; since?: unknown };
  const values: Partial<TunableConfig> = {};
  if (raw.values && typeof raw.values === "object" && !Array.isArray(raw.values)) {
    for (const key of KEYS) {
      const value = (raw.values as Record<string, unknown>)[key];
      const [low, high] = RANGES[key];
      if (typeof value === "number" && Number.isFinite(value))
        values[key] = Math.min(high, Math.max(low, value));
    }
  }
  return {
    values,
    since: typeof raw.since === "number" && Number.isFinite(raw.since) ? raw.since : 0,
  };
}

/** The base configuration with learned values on top. */
export function overlay(base: TunableConfig, tuning: Tuning): TunableConfig {
  return { ...base, ...tuning.values };
}

/** The turns that count as evidence: those after the last explicit change. */
export function evidence(entries: readonly LedgerEntry[], since: number): LedgerEntry[] {
  return entries.filter((entry) => entry.at > since);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * What fresh evidence says should change, one step at a time and only where it points
 * one way. Upstream's mid-turn raise signal does not exist in this port, so trouble at a
 * cheap start is a correction by the user alone.
 */
export function suggestions(entries: readonly LedgerEntry[], config: TunableConfig): Suggestion[] {
  if (entries.length < MIN_TURNS_TO_SUGGEST) return [];
  const found: Suggestion[] = [];

  // Answers that did not arrive in time; only turns where a backend was asked count.
  const asked = entries.filter((entry) => entry.ms !== null);
  const missed = asked.filter((entry) => !entry.answered).length;
  const p90 = percentile(
    entries.filter((entry) => entry.answered && entry.ms !== null).map((entry) => entry.ms!),
    0.9,
  );
  if (asked.length > 0 && missed / asked.length > 0.1 && p90 !== null) {
    found.push({
      option: "timeoutMs",
      from: config.timeoutMs,
      to: Math.max(config.timeoutMs + 200, Math.ceil((p90 * 1.25) / 100) * 100),
      why: `${share(missed, asked.length)} of turns got no answer in time; answers that did arrive took up to ${Math.round(p90)} ms (90th percentile)`,
    });
  }

  // Cheap starts the user corrected: the start was too cheap.
  const startedLow = entries.filter(
    (entry) => entry.started === "low" || entry.started === "medium",
  );
  const corrected = startedLow.filter((entry) => entry.corrected === true).length;
  if (startedLow.length >= 10 && corrected / startedLow.length > 0.2) {
    if (config.minDowngradeConfidence < 0.9)
      found.push({
        option: "minDowngradeConfidence",
        from: config.minDowngradeConfidence,
        to: round2(Math.min(0.9, config.minDowngradeConfidence + 0.1)),
        why: `${share(corrected, startedLow.length)} of turns started at low or medium effort were corrected by you`,
      });
    if (config.effortCloseMargin < 0.3)
      found.push({
        option: "effortCloseMargin",
        from: config.effortCloseMargin,
        to: round2(Math.min(0.3, config.effortCloseMargin + 0.05)),
        why: "close calls between two effort levels should lean up more often",
      });
  }

  // Costly starts that finished short and clean: the start may be too costly.
  const easy = (entry: LedgerEntry) =>
    entry.failures === 0 &&
    entry.toolCalls <= 2 &&
    entry.outcome === "answer" &&
    entry.corrected !== true;
  const atHigh = entries.filter((entry) => entry.started === "high");
  const easyAtHigh = atHigh.filter(easy).length;
  const raisedDowngrade = found.some(
    (suggestion) => suggestion.option === "minDowngradeConfidence",
  );
  if (
    atHigh.length >= 10 &&
    easyAtHigh / atHigh.length > 0.6 &&
    config.minHighConfidence < 0.8 &&
    !raisedDowngrade
  )
    found.push({
      option: "minHighConfidence",
      from: config.minHighConfidence,
      to: round2(Math.min(0.8, config.minHighConfidence + 0.1)),
      why: `${share(easyAtHigh, atHigh.length)} of turns started at high finished in two tool calls or fewer, with no failures`,
    });

  const startedHigh = entries.filter(
    (entry) => entry.started === "xhigh" || entry.started === "max",
  );
  const easyHigh = startedHigh.filter(easy).length;
  // Evidence pointing both ways is no evidence: then the margin stays.
  const marginUp = found.some((suggestion) => suggestion.option === "effortCloseMargin");
  if (
    startedHigh.length >= 10 &&
    easyHigh / startedHigh.length > 0.6 &&
    config.effortCloseMargin > 0 &&
    !marginUp
  )
    found.push({
      option: "effortCloseMargin",
      from: config.effortCloseMargin,
      to: round2(Math.max(0, config.effortCloseMargin - 0.05)),
      why: `${share(easyHigh, startedHigh.length)} of turns started at xhigh or max finished in two tool calls or fewer, with no failures`,
    });
  return found;
}

/** What the ledger suggests now: fresh evidence against the effective configuration. */
export function proposals(
  entries: readonly LedgerEntry[],
  base: TunableConfig,
  tuning: Tuning,
): Suggestion[] {
  return suggestions(evidence(entries, tuning.since), overlay(base, tuning));
}

/** The tuning with `found` applied from `now` on, so the same evidence cannot count again. */
export function applied(current: Tuning, found: readonly Suggestion[], now: number): Tuning {
  const values = { ...current.values };
  for (const suggestion of found) values[suggestion.option] = suggestion.to;
  return tuningOf({ values, since: now });
}

/** `/jev tune`: effective values against the base configuration, and what the ledger suggests. */
export function describeTuning(
  entries: readonly LedgerEntry[],
  base: TunableConfig,
  tuning: Tuning,
): string {
  const now = overlay(base, tuning);
  const lines = [
    "Jev Pilot tuning (learned from your ledger; your base configuration is unchanged):",
  ];
  for (const key of KEYS)
    lines.push(
      `  ${key.padEnd(24)} base: ${base[key]}  overlay: ${tuning.values[key] ?? "none"}  effective: ${now[key]}`,
    );
  const fresh = evidence(entries, tuning.since).length;
  const found = proposals(entries, base, tuning);
  lines.push("");
  if (found.length > 0) {
    lines.push(`From your last ${fresh} turns, it suggests:`);
    for (const s of found) lines.push(`  ${s.option}: ${s.from} → ${s.to}, because ${s.why}`);
    lines.push("  /jev tune apply takes these · /jev tune reset goes back to your base values");
  } else if (fresh < MIN_TURNS_TO_SUGGEST) {
    lines.push(
      `No suggestion yet: ${fresh} of the ${MIN_TURNS_TO_SUGGEST} turns it needs since the last change.`,
    );
  } else {
    lines.push(`Nothing to change: your last ${fresh} turns point no one way.`);
  }
  lines.push(
    "",
    "/jev tune reset clears learned values and starts a new evidence window; configuration and ledger stay unchanged.",
    `Learned values are stored in ${tuningPath()}, shared by sessions of this Pi agent directory, and used by main-session and worker-plan decisions; ledger reset does not touch them.`,
  );
  return lines.join("\n");
}

export function tuningPath(): string {
  return join(getAgentDir(), "jev-pilot", "tuning.json");
}

/** The stored tuning; no file means no learned values, an unreadable file throws. */
export function loadTuning(): Tuning {
  let text: string;
  try {
    text = readFileSync(tuningPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { values: {}, since: 0 };
    throw error;
  }
  const file = JSON.parse(text) as { version?: unknown } | null;
  if (!file || file.version !== 1) throw new Error("The file is not a Jev Pilot tuning file.");
  return tuningOf(file);
}

function saveTuning(tuning: Tuning): void {
  const path = tuningPath();
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ version: 1, ...tuning })}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

/**
 * The configuration decisions use now. Read at each decision so an explicit apply/reset
 * takes effect on the next eligible prompt and survives reload; an unreadable tuning
 * file never blocks a turn and falls back to the base configuration.
 */
export function effectiveTunables(base: TunableConfig = baseTunables()): TunableConfig {
  try {
    return overlay(base, loadTuning());
  } catch {
    return base;
  }
}

export type TuneAction = "show" | "apply" | "reset";

/** The `/jev tune` family. Only apply and reset write, and only the tuning file. */
export function tuneCommand(action: TuneAction, now = Date.now()): string {
  try {
    const base = baseTunables();
    if (action === "reset") {
      // Explicit consent also repairs an unreadable file; the ledger is never touched.
      saveTuning({ values: {}, since: now });
      return `Tuning cleared; decisions use your base values again. The ledger was not changed.\n\n${describeTuning(readLedgerSafely(), base, { values: {}, since: now })}`;
    }
    const tuning = loadTuning();
    const entries = loadLedger();
    if (action === "apply") {
      const found = proposals(entries, base, tuning);
      if (found.length === 0)
        return `Nothing to apply.\n\n${describeTuning(entries, base, tuning)}`;
      const next = applied(tuning, found, now);
      saveTuning(next);
      return `Applied ${found.map((s) => `${s.option} ${s.from} → ${s.to}`).join(", ")}. The next suggestion waits for ${MIN_TURNS_TO_SUGGEST} new turns.\n\n${describeTuning(entries, base, next)}`;
    }
    return describeTuning(entries, base, tuning);
  } catch (error) {
    return `Jev Pilot tuning command failed: ${error instanceof Error ? error.message : String(error)} Nothing was changed.`;
  }
}

function readLedgerSafely(): LedgerEntry[] {
  try {
    return loadLedger();
  } catch {
    return [];
  }
}

/** A proposal worth announcing: every 20th fresh turn, when the evidence points somewhere. */
export function dueProposals(): Suggestion[] {
  const base = baseTunables();
  const tuning = loadTuning();
  const entries = loadLedger();
  const fresh = evidence(entries, tuning.since).length;
  if (fresh < MIN_TURNS_TO_SUGGEST || fresh % MIN_TURNS_TO_SUGGEST !== 0) return [];
  return proposals(entries, base, tuning);
}
