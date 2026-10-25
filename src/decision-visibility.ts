import type {
  EntryRenderer,
  ExtensionAPI,
  ExtensionContext,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { loadLedger, resetLedger, summarizeLedger } from "./ledger.ts";

export const DECISION_TYPE = "jev-pilot:decision:v1";
export const MAX_WORKER_SEQUENCE = 999_999_999;
/** Canonical bounded labels keep restored history out of numeric overflow paths. */
export function readWorkerInvocation(
  value: unknown,
): { sequence: number; rollover: boolean } | undefined {
  if (typeof value !== "string" || value.length > 43) return;
  const match = /^w([1-9]\d{0,8})-([a-f0-9]{6}|[a-f0-9]{32})$/.exec(value);
  if (!match) return;
  const sequence = Number(match[1]);
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > MAX_WORKER_SEQUENCE) return;
  return { sequence, rollover: match[2]!.length === 32 };
}
const LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max", "unknown"] as const;
export type VisibleEffort = (typeof LEVELS)[number];
const OUTCOMES = [
  "classified",
  "reused",
  "skipped",
  "timeout",
  "error",
  "cancelled",
  "kept",
  "specialized",
  "executor-owned",
  "blocked",
  "receipt",
  "unconfirmed",
] as const;
export type VisibleOutcome = (typeof OUTCOMES)[number];
export interface MainDecisionRow {
  version: 1;
  kind: "main";
  model: string;
  previous: VisibleEffort;
  requested: VisibleEffort;
  effective: VisibleEffort;
  outcome: VisibleOutcome;
  elapsedMs: number;
}
export interface WorkerDecisionRow {
  version: 1;
  kind: "worker";
  invocation: string;
  agent: string;
  stage: "plan" | "executor";
  retained: string;
  model: string;
  requested: VisibleEffort;
  effective: VisibleEffort;
  outcome: VisibleOutcome;
  elapsedMs: number;
}
export type DecisionRow = MainDecisionRow | WorkerDecisionRow;
export function safeIdentity(value: unknown): string {
  return typeof value === "string" &&
    value.length <= 120 &&
    /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._:/-]+$/.test(value)
    ? value
    : "unknown";
}
export function safeAgent(value: unknown): string {
  return typeof value === "string" &&
    value.length <= 64 &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(value)
    ? value
    : "unknown";
}
export function safeEffort(value: unknown): VisibleEffort {
  return LEVELS.includes(value as VisibleEffort) ? (value as VisibleEffort) : "unknown";
}
/** Reject extra keys too: restored UI records must obey the same privacy boundary. */
export function readDecisionRow(value: unknown): DecisionRow | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const row = value as Record<string, unknown>;
  const common = ["version", "kind", "model", "requested", "effective", "outcome", "elapsedMs"];
  const keys =
    row.kind === "main"
      ? [...common, "previous"]
      : [...common, "invocation", "agent", "stage", "retained"];
  if (
    Object.keys(row).length !== keys.length ||
    Object.keys(row).some((key) => !keys.includes(key))
  )
    return;
  if (
    row.version !== 1 ||
    !OUTCOMES.includes(row.outcome as VisibleOutcome) ||
    !Number.isSafeInteger(row.elapsedMs) ||
    (row.elapsedMs as number) < 0
  )
    return;
  if (![row.requested, row.effective].every((level) => LEVELS.includes(level as VisibleEffort)))
    return;
  if (row.model !== "unknown" && safeIdentity(row.model) !== row.model) return;
  if (row.kind === "main") {
    if (!LEVELS.includes(row.previous as VisibleEffort)) return;
  } else if (row.kind === "worker") {
    if (!readWorkerInvocation(row.invocation) || safeAgent(row.agent) !== row.agent) return;
    if (row.stage !== "plan" && row.stage !== "executor") return;
    if (row.retained !== "unknown" && safeIdentity(row.retained) !== row.retained) return;
  } else return;
  return value as DecisionRow;
}
export function decisionLines(row: DecisionRow, expanded: boolean): string[] {
  const heading =
    row.kind === "main"
      ? `Jev main · ${row.model} · ${row.requested} → ${row.effective} · ${row.outcome}${row.previous === row.effective ? " · kept" : ""} · ${row.elapsedMs}ms`
      : `Jev worker ${row.stage} · ${row.agent} ${row.invocation} · ${row.model} · ${row.requested} → ${row.effective} · ${row.outcome} · ${row.stage === "plan" ? "launch unconfirmed" : row.outcome === "receipt" ? "executor-reported" : "model/effort unconfirmed"}`;
  if (!expanded) return [heading];
  return [
    heading,
    ...(row.kind === "main"
      ? [
          `Previous effort: ${row.previous}`,
          `Requested effort: ${row.requested}`,
          `Effective effort: ${row.effective}`,
          `Main model (Pi-selected): ${row.model}`,
        ]
      : [
          `Retained → selected target: ${row.retained} → ${row.model}`,
          `Requested → effective effort: ${row.requested} → ${row.effective}`,
          `Elapsed: ${row.elapsedMs}ms`,
          "Executor receipt reports launch target, not server-resolved identity.",
        ]),
  ];
}
export const decisionRenderer: EntryRenderer = (entry, { expanded }) => {
  const row = readDecisionRow(entry.data);
  return row ? new Text(decisionLines(row, expanded).join("\n"), 0, 0) : undefined;
};
export function latestDecisionRows(branch: SessionEntry[]): DecisionRow[] {
  const workers = new Map<string, WorkerDecisionRow>();
  let main: MainDecisionRow | undefined;
  for (const entry of branch) {
    if (entry.type !== "custom" || entry.customType !== DECISION_TYPE) continue;
    const row = readDecisionRow(entry.data);
    if (!row) continue;
    if (row.kind === "main") main = row;
    else {
      workers.delete(row.invocation);
      workers.set(row.invocation, row);
      if (workers.size > 12) workers.delete(workers.keys().next().value!);
    }
  }
  return [...(main ? [main] : []), ...workers.values()];
}
function flag(name: string): string {
  const value = process.env[`JEV_${name}_ENABLED`] ?? "true";
  return value === "true" ? "enabled" : value === "false" ? "disabled" : "invalid configuration";
}
export function statusLines(pi: ExtensionAPI, ctx: ExtensionContext): string[] {
  const rows = latestDecisionRows(ctx.sessionManager.getBranch());
  return [
    "Jev loaded · durable decision UI",
    `Capabilities: effort ${flag("EFFORT")}; workers ${flag("WORKER_ROUTING")}; skills ${flag("SKILLS")}; strategy ${flag("STRATEGY")}; quality ${flag("QUALITY")}; design ${flag("DESIGN")}`,
    `Main model (Pi-selected): ${safeIdentity(ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined)}`,
    `Current effort: ${safeEffort(pi.getThinkingLevel())}`,
    ...(rows.length ? rows.flatMap((row) => decisionLines(row, true)) : ["No selection yet"]),
    ...(!rows.some((row) => row.kind === "worker") ? ["No worker decision yet"] : []),
  ];
}
export function registerDecisionVisibility(pi: ExtensionAPI): void {
  pi.registerEntryRenderer(DECISION_TYPE, decisionRenderer);
  pi.registerCommand("jev", {
    description: "Read-only Jev status and ledger report (no inference): /jev status | report",
    handler: async (args, ctx) => {
      const command = args.trim();
      if (command === "report") ctx.ui.notify(reportText(), "info");
      else if (command === "report reset") ctx.ui.notify(resetText(), "info");
      else if (command === "status" || command === "")
        ctx.ui.notify(statusLines(pi, ctx).join("\n"), "info");
      else ctx.ui.notify("Usage: /jev status | report | report reset", "info");
    },
  });
}
function reportText(): string {
  try {
    return summarizeLedger(loadLedger());
  } catch (error) {
    return `The Jev Pilot ledger could not be read: ${error instanceof Error ? error.message : String(error)} Nothing was changed.`;
  }
}
function resetText(): string {
  try {
    resetLedger();
    return "The Jev Pilot decision ledger was cleared. Configuration and tuning were not changed.";
  } catch (error) {
    return `The Jev Pilot ledger could not be cleared: ${error instanceof Error ? error.message : String(error)}`;
  }
}
export function appendDecisionRow(pi: ExtensionAPI, row: DecisionRow): void {
  if (readDecisionRow(row)) pi.appendEntry(DECISION_TYPE, row);
}
