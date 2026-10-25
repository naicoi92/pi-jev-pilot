// Ledger shape and report adapted from Jev Pilot 0.12.1 hooks/ledger.ts; see NOTICE.md.
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { STRATEGY_CRITERIA } from "./guidance-policy.ts";
import type { VisibleEffort } from "./decision-visibility.ts";

/** The most entries kept; the oldest go first. */
export const LEDGER_SIZE = 500;

const EFFORTS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "unknown",
] as const satisfies readonly VisibleEffort[];
const OUTCOMES = ["answer", "length", "aborted", "error", "unknown"] as const;
export type LedgerOutcome = (typeof OUTCOMES)[number];

/**
 * One completed main turn. Labels, numbers and outcomes only: prompt text, tool
 * inputs and model output are never part of an entry.
 */
export interface LedgerEntry {
  version: 1;
  /** `<session id>:<entry id of the turn's last user message>`: what a correction marks. */
  id: string;
  /** When the turn started, ms since the epoch. */
  at: number;
  /** Whether the decision model answered (false: timeout, error, reused or not asked). */
  answered: boolean;
  /** Decision latency in ms; null when no backend was asked. */
  ms: number | null;
  /** The rubric level acted on (0..4), after the close-call lean. */
  effortLevel: number | null;
  effortConfidence: number | null;
  /** Pi effort before Jev decided, the level Jev asked for, and the one actually applied. */
  startedFrom: VisibleEffort | null;
  requested: VisibleEffort | null;
  started: VisibleEffort | null;
  toolCalls: number;
  /** The longest run of failed tool calls in the turn. */
  failures: number;
  strategy: string | null;
  strategyConfidence: number | null;
  /** Whether strategy advice was attached to the prompt. */
  advised: boolean;
  outcome: LedgerOutcome;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  /** Whether the next classified message said this turn got it wrong; absent until judged. */
  corrected?: boolean;
}

const REQUIRED_KEYS = [
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
];

function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
function nullable<T>(value: unknown, valid: (value: unknown) => value is T): value is T | null {
  return value === null || valid(value);
}
function unit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}
function effort(value: unknown): value is VisibleEffort {
  return EFFORTS.includes(value as VisibleEffort);
}

/** Strict reader: unknown keys are rejected so restored data keeps the privacy boundary. */
export function readLedgerEntry(value: unknown): LedgerEntry | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.some((key) => !REQUIRED_KEYS.includes(key) && key !== "corrected")) return;
  if (REQUIRED_KEYS.some((key) => !(key in row))) return;
  if (
    row.version !== 1 ||
    typeof row.id !== "string" ||
    !/^[A-Za-z0-9._-]{1,80}:[A-Za-z0-9._-]{1,80}$/.test(row.id) ||
    !count(row.at) ||
    typeof row.answered !== "boolean" ||
    !nullable(row.ms, count) ||
    !nullable(row.effortLevel, (level): level is number => count(level) && level <= 4) ||
    !nullable(row.effortConfidence, unit) ||
    !nullable(row.startedFrom, effort) ||
    !nullable(row.requested, effort) ||
    !nullable(row.started, effort) ||
    !count(row.toolCalls) ||
    !count(row.failures) ||
    !nullable(
      row.strategy,
      (name): name is string => typeof name === "string" && Object.hasOwn(STRATEGY_CRITERIA, name),
    ) ||
    !nullable(row.strategyConfidence, unit) ||
    typeof row.advised !== "boolean" ||
    !OUTCOMES.includes(row.outcome as LedgerOutcome) ||
    !nullable(row.durationMs, count) ||
    !nullable(row.inputTokens, count) ||
    !nullable(row.outputTokens, count) ||
    ("corrected" in row && typeof row.corrected !== "boolean")
  )
    return;
  return row as unknown as LedgerEntry;
}

function entriesOf(stored: unknown): LedgerEntry[] {
  return Array.isArray(stored)
    ? stored.flatMap((value) => {
        const entry = readLedgerEntry(value);
        return entry ? [entry] : [];
      })
    : [];
}

/** The stored list with `entry` appended, bounded to the latest `size` valid entries. */
export function appendLedgerEntry(
  stored: unknown,
  entry: LedgerEntry,
  size = LEDGER_SIZE,
): LedgerEntry[] {
  return [...entriesOf(stored), entry].slice(-size);
}

/** The ledger with the one entry of turn `id` marked as corrected or not. */
export function markCorrected(
  entries: readonly LedgerEntry[],
  id: string,
  corrected: boolean,
): LedgerEntry[] {
  return entries.map((entry) => (entry.id === id ? { ...entry, corrected } : entry));
}

export function ledgerEnabled(): boolean {
  const value = process.env.JEV_RECORD_DECISIONS ?? "true";
  if (value !== "true" && value !== "false")
    throw new Error("Set JEV_RECORD_DECISIONS to true or false (default: true).");
  return value === "true";
}

export function ledgerPath(): string {
  return join(getAgentDir(), "jev-pilot", "ledger.json");
}

/** The valid entries on disk; no file is an empty ledger, an unreadable file throws. */
export function loadLedger(): LedgerEntry[] {
  let text: string;
  try {
    text = readFileSync(ledgerPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const file = JSON.parse(text) as { version?: unknown; entries?: unknown } | null;
  if (!file || file.version !== 1 || !Array.isArray(file.entries))
    throw new Error("The file is not a Jev Pilot ledger.");
  return entriesOf(file.entries);
}

function save(entries: readonly LedgerEntry[]): void {
  const path = ledgerPath();
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify({ version: 1, entries })}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function loadOrFresh(): LedgerEntry[] {
  try {
    return loadLedger();
  } catch {
    // A first run, or a value some other version wrote, starts a fresh list.
    return [];
  }
}

export function recordTurn(entry: LedgerEntry): void {
  save(appendLedgerEntry(loadOrFresh(), entry));
}

export function recordCorrection(id: string, corrected: boolean): void {
  const entries = loadOrFresh();
  if (entries.some((entry) => entry.id === id)) save(markCorrected(entries, id, corrected));
}

/** Removes ledger observations only; configuration and tuning files are not touched. */
export function resetLedger(): void {
  rmSync(ledgerPath(), { force: true });
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}
function share(part: number, whole: number): string {
  return whole === 0 ? "—" : `${Math.round((100 * part) / whole)}%`;
}
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Observed turns only: no counterfactual savings and no confidence-as-accuracy claims. */
export function summarizeLedger(entries: readonly LedgerEntry[]): string {
  if (entries.length === 0)
    return "The decision ledger is empty: no main-conversation turn has been recorded yet.";
  const first = new Date(entries[0]!.at).toISOString().slice(0, 10);
  const asked = entries.filter((entry) => entry.ms !== null);
  const answered = asked.filter((entry) => entry.answered);
  const latencies = answered.map((entry) => entry.ms as number);
  const confidences = answered.flatMap((entry) =>
    entry.effortConfidence === null ? [] : [entry.effortConfidence],
  );
  const lines = [
    `Decision ledger: ${plural(entries.length, "turn")} since ${first}.`,
    "",
    `Jev was asked on ${plural(asked.length, "turn")} and answered ${answered.length} (${share(answered.length, asked.length)}); latency median ${percentile(latencies, 0.5) ?? "—"} ms, 90th percentile ${percentile(latencies, 0.9) ?? "—"} ms.`,
  ];
  if (confidences.length)
    lines.push(
      `Mean self-reported decision confidence: ${(confidences.reduce((sum, value) => sum + value, 0) / confidences.length).toFixed(2)} over ${confidences.length} answered turns (a classifier signal, not accuracy).`,
    );
  lines.push(
    "",
    "| Started at | Turns | Corrected by you | Avg tool calls | Avg output tokens |",
    "|---|---|---|---|---|",
  );
  const groups: (VisibleEffort | null)[] = [...EFFORTS, null];
  for (const level of groups) {
    const here = entries.filter((entry) => entry.started === level);
    if (here.length === 0) continue;
    const tools = here.reduce((sum, entry) => sum + entry.toolCalls, 0) / here.length;
    const withTokens = here.filter((entry) => entry.outputTokens !== null);
    const tokens = withTokens.length
      ? String(
          Math.round(
            withTokens.reduce((sum, entry) => sum + (entry.outputTokens as number), 0) /
              withTokens.length,
          ),
        )
      : "—";
    // Only turns followed by a classified message could be judged.
    const judged = here.filter((entry) => typeof entry.corrected === "boolean");
    const corrected = judged.filter((entry) => entry.corrected).length;
    lines.push(
      `| ${level ?? "(not set)"} | ${here.length} | ${judged.length ? `${share(corrected, judged.length)} of ${judged.length}` : "—"} | ${tools.toFixed(1)} | ${tokens} |`,
    );
  }
  const failed = entries.filter((entry) => entry.failures > 0).length;
  const outcomes = new Map<string, number>();
  for (const entry of entries) outcomes.set(entry.outcome, (outcomes.get(entry.outcome) ?? 0) + 1);
  const withUsage = entries.filter(
    (entry) => entry.inputTokens !== null || entry.outputTokens !== null,
  );
  const total = (pick: (entry: LedgerEntry) => number | null) =>
    withUsage.reduce((sum, entry) => sum + (pick(entry) ?? 0), 0);
  const differing = entries.filter(
    (entry) =>
      entry.requested !== null && entry.started !== null && entry.requested !== entry.started,
  ).length;
  lines.push(
    "",
    `Turns with failed tool calls: ${failed} of ${entries.length}.`,
    `Outcomes: ${[...outcomes].map(([name, n]) => `${name} ${n}`).join(", ")}.`,
    `Usage reported on ${withUsage.length} of ${entries.length} turns: ${total((entry) => entry.inputTokens)} input tokens, ${total((entry) => entry.outputTokens)} output tokens.`,
  );
  if (differing)
    lines.push(
      `Requested effort differed from the started effort on ${plural(differing, "turn")}.`,
    );
  const advised = entries.filter((entry) => entry.advised);
  if (advised.length) {
    const counts = new Map<string, number>();
    for (const entry of advised)
      counts.set(entry.strategy ?? "?", (counts.get(entry.strategy ?? "?") ?? 0) + 1);
    lines.push(
      `Strategy advice attached on ${plural(advised.length, "turn")}: ${[...counts].map(([name, n]) => `${name} ${n}`).join(", ")}.`,
    );
  }
  lines.push("", "Observed outcomes only: no savings are estimated for models that did not run.");
  return lines.join("\n");
}
