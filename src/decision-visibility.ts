import type {
  EntryRenderer,
  ExtensionAPI,
  ExtensionContext,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { loadLedger, resetLedger, summarizeLedger } from "./ledger.ts";
import { loadJevConfig, type JevConfig } from "./jev-config.ts";
import { tuneCommand, type TuneAction } from "./tuning.ts";

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
/**
 * What the decision model said about effort, as numbers only. Lets a reader tell a high
 * result that the classifier chose from one that a policy floor lifted. Never carries task text.
 */
export interface EffortRead {
  /** Rubric level 0..4 after the close-call lean, or null when none was read. */
  level: number | null;
  confidence: number | null;
  risky: number | null;
  /** Probability for each rubric level 0..4, or null when the model gave none. */
  probabilities: number[] | null;
}
const unit = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const nullable = (value: unknown): boolean => value === null || unit(value);
export function readEffortRead(value: unknown): EffortRead | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const read = value as Record<string, unknown>;
  const keys = ["level", "confidence", "risky", "probabilities"];
  if (Object.keys(read).length !== keys.length || Object.keys(read).some((k) => !keys.includes(k)))
    return;
  const level = read.level;
  if (
    level !== null &&
    !(Number.isInteger(level) && (level as number) >= 0 && (level as number) <= 4)
  )
    return;
  if (!nullable(read.confidence) || !nullable(read.risky)) return;
  const probabilities = read.probabilities;
  if (
    probabilities !== null &&
    !(Array.isArray(probabilities) && probabilities.length === 5 && probabilities.every(unit))
  )
    return;
  return value as EffortRead;
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
  /** Present only when the decision model was asked about effort and answered. */
  effortRead?: EffortRead;
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
      : [
          ...common,
          "invocation",
          "agent",
          "stage",
          "retained",
          ...("effortRead" in row ? ["effortRead"] : []),
        ];
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
    if ("effortRead" in row && !readEffortRead(row.effortRead)) return;
  } else return;
  return value as DecisionRow;
}
function effortReadLine(read: EffortRead): string {
  const probs = read.probabilities?.map((p) => p.toFixed(2)).join("/") ?? "none";
  return `Effort read: level ${read.level ?? "none"} · confidence ${read.confidence ?? "none"} · risky ${read.risky ?? "none"} · P(0..4) ${probs}`;
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
          ...(row.effortRead ? [effortReadLine(row.effortRead)] : []),
          `Elapsed: ${row.elapsedMs}ms`,
          "Executor receipt reports launch target, not server-resolved identity.",
        ]),
  ];
}
/** Only genuine errors and fallbacks earn a conversation row; the live status line
 * carries ordinary selections. Stored rows of every outcome stay for /jev status. */
const WARNING_OUTCOMES: readonly VisibleOutcome[] = ["timeout", "error", "blocked"];
export const decisionRenderer: EntryRenderer = (entry, { expanded }) => {
  const row = readDecisionRow(entry.data);
  return row && WARNING_OUTCOMES.includes(row.outcome) && (row.kind === "main" || expanded)
    ? new Text(decisionLines(row, expanded).join("\n"), 0, 0)
    : undefined;
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
export function statusLines(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  config: JevConfig = loadJevConfig(),
): string[] {
  const rows = latestDecisionRows(ctx.sessionManager.getBranch());
  const capabilities = [
    ["effort", config.effortEnabled],
    ["workers (file; restart required)", config.workerRoutingEnabled],
    ["skills", config.skillsEnabled],
    ["rerank", config.skillRerank],
    ["strategy", config.strategyEnabled],
    ["quality", config.qualityEnabled],
    ["design", config.designEnabled],
    ["recording", config.recordDecisions],
  ]
    .map(([name, on]) => `${name} ${on ? "enabled" : "disabled"}`)
    .join("; ");
  return [
    "Jev loaded · durable decision UI",
    `Capabilities: ${capabilities}`,
    "Configuration: latest validated file; active work retains its captured options. Worker routing and timeout changes require a full Pi restart after work ends; /reload is insufficient.",
    `Main model (Pi-selected): ${safeIdentity(ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined)}`,
    `Current effort: ${safeEffort(pi.getThinkingLevel())}`,
    ...(rows.length ? rows.flatMap((row) => decisionLines(row, true)) : ["No selection yet"]),
    ...(!rows.some((row) => row.kind === "worker") ? ["No worker decision yet"] : []),
  ];
}
export function registerDecisionVisibility(pi: ExtensionAPI): void {
  pi.registerEntryRenderer(DECISION_TYPE, decisionRenderer);
  pi.registerCommand("jev", {
    description:
      "Jev status, ledger report and explicit tuning (no inference): /jev status | report | tune",
    handler: async (args, ctx) => {
      const command = args.trim();
      if (command === "report") ctx.ui.notify(reportText(), "info");
      else if (command === "report reset") ctx.ui.notify(resetText(), "info");
      else if (/^tune(?: (?:apply|reset))?$/.test(command))
        ctx.ui.notify(tuneCommand((command.split(" ")[1] ?? "show") as TuneAction), "info");
      else if (command === "status" || command === "") {
        try {
          ctx.ui.notify(statusLines(pi, ctx).join("\n"), "info");
        } catch (error) {
          ctx.ui.notify(
            error instanceof Error ? error.message : "Invalid Jev Pilot configuration.",
            "error",
          );
        }
      } else
        ctx.ui.notify(
          "Usage: /jev status | report | report reset | tune | tune apply | tune reset",
          "info",
        );
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
