import type { ExtensionUIContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { Details } from "pi-subagents/shared-types";
import { createHash, randomUUID } from "node:crypto";
import {
  latestDecisionRows,
  MAX_WORKER_SEQUENCE,
  readWorkerInvocation,
  safeAgent,
  safeIdentity,
  safeEffort,
  type WorkerDecisionRow,
  type VisibleOutcome,
} from "./decision-visibility.ts";

const VISIBLE_ROWS = 4;
const HISTORY_ROWS = 12;
function nativeReceipt(
  details: Partial<Details>,
  result: Details["results"][number] | undefined,
): boolean {
  return (
    typeof details.runId === "string" &&
    !!details.runId &&
    typeof result?.launchContractDigest === "string" &&
    /^[a-f0-9]{64}$/.test(result.launchContractDigest) &&
    result.launchResolvedExtensions?.source === "launch-resolved" &&
    result.launchResolvedExtensions.version === 1 &&
    typeof result.exitCode === "number" &&
    (result.usage?.turns ?? 0) > 0
  );
}
const LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);

/** Only model identifiers and enumerated effort cross this UI boundary, never task text. */
export function workerTarget(model: unknown, thinking?: unknown): string {
  const value = typeof model === "string" ? model : "";
  const suffix = value.match(/:(off|minimal|low|medium|high|xhigh|max)$/)?.[1];
  const identity = suffix ? value.slice(0, -(suffix.length + 1)) : value;
  const safeModel = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._:/-]+$/.test(identity) && identity.length <= 120;
  const effort = typeof thinking === "string" && LEVELS.has(thinking) ? thinking : suffix;
  return `${safeModel ? identity : "executor default/unknown"} · effort ${effort ?? "executor-owned/unknown"}`;
}

interface WorkerRow {
  toolCallId: string;
  label: string;
  decision: string;
  executor?: string;
  asyncId?: string;
  blocked?: boolean;
  started: number;
  agent: string;
  plan: WorkerDecisionRow;
  planRecorded?: boolean;
  executorRecorded?: boolean;
}
export type WorkerVisibilityOwner = WorkerRow;

/** Bounded presentation state only. Executor cancellation/ownership remains in the adapter. */
export class WorkerVisibility {
  private rows = new Map<string, WorkerRow>();
  private sequence = 0;
  private rollover = false;
  /** Launch-allowed calls awaiting their tool result, and executor-accepted async runs
   * awaiting completion. Kept outside the bounded history so eviction cannot lose them. */
  private launched = new Map<string, WorkerRow>();
  private asyncRuns = new Set<string>();
  private reportedRunning = 0;

  constructor(
    private readonly persist?: (row: WorkerDecisionRow) => void,
    private readonly onRunning?: (count: number) => void,
    private readonly onRows?: (rows: readonly string[]) => void,
  ) {}

  private notifyRunning(): void {
    const count = this.launched.size + this.asyncRuns.size;
    if (count === this.reportedRunning) return;
    this.reportedRunning = count;
    this.onRunning?.(count);
  }

  /** The adapter threw after deciding, so the executor never receives the call. */
  refuse(owner: WorkerVisibilityOwner): void {
    if (this.launched.get(owner.toolCallId) === owner) this.launched.delete(owner.toolCallId);
    this.notifyRunning();
  }

  /** The agent is idle: any call still awaiting a result can no longer be running. */
  settle(): void {
    this.launched.clear();
    this.notifyRunning();
  }

  restore(branch: SessionEntry[]): void {
    let legacySequence = 0;
    let rolloverSequence = 0;
    for (const row of latestDecisionRows(branch)) {
      if (row.kind !== "worker") continue;
      const invocation = readWorkerInvocation(row.invocation);
      if (!invocation) continue;
      if (invocation.rollover) rolloverSequence = Math.max(rolloverSequence, invocation.sequence);
      else legacySequence = Math.max(legacySequence, invocation.sequence);
    }
    if (rolloverSequence && !this.rollover) {
      this.rollover = true;
      this.sequence = rolloverSequence;
    } else
      this.sequence = Math.max(this.sequence, this.rollover ? rolloverSequence : legacySequence);
  }

  private nextLabel(source: string): string {
    // After exhaustion never reuse legacy hash labels, including after branch restore.
    if (this.sequence >= MAX_WORKER_SEQUENCE) {
      this.sequence = 0;
      this.rollover = true;
    }
    const suffix = this.rollover
      ? randomUUID().replaceAll("-", "")
      : createHash("sha256").update(source).digest("hex").slice(0, 6);
    return `w${++this.sequence}-${suffix}`;
  }

  start(
    toolCallId: string,
    _ui: ExtensionUIContext,
    agent?: unknown,
    retained?: unknown,
  ): WorkerVisibilityOwner {
    const label = this.nextLabel(toolCallId);
    const row: WorkerRow = {
      toolCallId,
      label,
      agent: safeAgent(agent),
      started: Date.now(),
      plan: {
        version: 1,
        kind: "worker",
        invocation: label,
        agent: safeAgent(agent),
        stage: "plan",
        retained: safeIdentity(retained),
        model: "unknown",
        requested: "unknown",
        effective: "unknown",
        outcome: "unconfirmed",
        elapsedMs: 0,
      },
      decision: "choosing model + effort…",
    };
    this.launched.delete(toolCallId);
    this.rows.delete(toolCallId);
    this.rows.set(toolCallId, row);
    while (this.rows.size > HISTORY_ROWS) this.rows.delete(this.rows.keys().next().value!);
    this.render();
    return row;
  }

  finish(
    owner: WorkerVisibilityOwner,
    decision: string,
    blocked = false,
    metadata: Partial<
      Pick<WorkerDecisionRow, "retained" | "model" | "requested" | "effective" | "outcome">
    > = {},
  ): void {
    if (this.rows.get(owner.toolCallId) !== owner) return;
    owner.decision = decision;
    owner.blocked = blocked;
    if (blocked) this.launched.delete(owner.toolCallId);
    else this.launched.set(owner.toolCallId, owner);
    this.notifyRunning();
    const outcome: VisibleOutcome = blocked
      ? decision.includes("cancelled")
        ? "cancelled"
        : "blocked"
      : decision.includes("timeout")
        ? "timeout"
        : /error|invalid/.test(decision)
          ? "error"
          : decision.includes("specialized")
            ? "specialized"
            : decision.includes("kept")
              ? "kept"
              : decision.includes("executor-owned")
                ? "executor-owned"
                : "unconfirmed";
    owner.plan = {
      ...owner.plan,
      ...metadata,
      elapsedMs: Date.now() - owner.started,
      outcome: metadata.outcome ?? outcome,
    };
    if (!owner.planRecorded) {
      owner.planRecorded = true;
      this.persist?.(owner.plan);
    }
    this.render();
  }

  /**
   * Binds the executor-accepted decision pair to the originating tool call. The pair is the
   * committed plan, not proof of execution, so the outcome stays `unconfirmed`. Only model
   * identity and enumerated effort cross this boundary, never task text or tool paths.
   */
  applied(
    toolCallId: string,
    pair: { model: unknown; thinking: unknown; requestedThinking?: unknown },
  ): void {
    const owner = this.rows.get(toolCallId);
    if (!owner || owner.blocked) return;
    const model = safeIdentity(pair.model);
    const effective = safeEffort(pair.thinking);
    owner.plan = {
      ...owner.plan,
      model,
      requested: safeEffort(pair.requestedThinking ?? pair.thinking),
      effective,
      elapsedMs: Date.now() - owner.started,
    };
    owner.decision = `plan ${workerTarget(model, effective)} · launch unconfirmed`;
    // Plan row is keyed by invocation, so a later row supersedes the unknown placeholder.
    if (owner.planRecorded) this.persist?.(owner.plan);
    this.render();
  }

  result(toolCallId: string, details: unknown): void {
    if (this.launched.delete(toolCallId)) {
      const asyncId = (details as { asyncId?: unknown } | undefined)?.asyncId;
      if (typeof asyncId === "string" && asyncId) this.asyncRuns.add(asyncId);
      this.notifyRunning();
    }
    const row = this.rows.get(toolCallId);
    if (!row || row.asyncId || row.blocked || row.executor?.startsWith("executor receipt")) return;
    let model = "unknown";
    let effective = safeEffort(undefined);
    let verified = false;
    const receipt = details as (Partial<Details> & { asyncId?: unknown }) | undefined;
    if (typeof receipt?.asyncId === "string" && receipt.asyncId) {
      row.asyncId = receipt.asyncId;
      row.executor = "executor accepted async · launch unconfirmed";
    } else {
      const result =
        receipt?.mode === "single" && Array.isArray(receipt.results) && receipt.results.length === 1
          ? receipt.results[0]
          : undefined;
      // A generic tool success is not a child receipt. Native receipt + an executed
      // turn report a target/effort, not a provider identity or a still-running process.
      verified = !!receipt && nativeReceipt(receipt, result);
      if (verified) {
        row.agent = safeAgent(result?.agent);
        model = safeIdentity(
          typeof result?.model === "string"
            ? result.model.replace(/:(off|minimal|low|medium|high|xhigh|max)$/, "")
            : undefined,
        );
        effective = safeEffort(result?.thinking);
      }
      row.executor = verified
        ? `executor receipt · target ${workerTarget(result?.model, result?.thinking)}`
        : "executor result · launch unconfirmed";
    }
    if (
      !row.executorRecorded &&
      receipt?.mode !== "single" &&
      Array.isArray(receipt?.results) &&
      receipt.results.length
    ) {
      for (const child of receipt.results.slice(0, HISTORY_ROWS)) {
        if (!child || typeof child !== "object") continue;
        const reported = nativeReceipt(receipt, child);
        const label = this.nextLabel(`${row.label}:${child.index}`);
        this.persist?.({
          ...row.plan,
          invocation: label,
          agent: safeAgent(child.agent),
          stage: "executor",
          retained: "unknown",
          model: reported ? safeIdentity(child.model) : "unknown",
          requested: "unknown",
          effective: reported ? safeEffort(child.thinking) : "unknown",
          outcome: reported ? "receipt" : "executor-owned",
          elapsedMs: Date.now() - row.started,
        });
      }
    } else if (!row.executorRecorded)
      this.persist?.({
        ...row.plan,
        agent: row.agent,
        stage: "executor",
        model,
        effective,
        outcome: verified ? "receipt" : "unconfirmed",
        elapsedMs: Date.now() - row.started,
      });
    row.executorRecorded = true;
    this.render();
  }

  complete(runId: string, state: unknown): void {
    if (this.asyncRuns.delete(runId)) this.notifyRunning();
    const row = [...this.rows.values()].find((row) => row.asyncId === runId);
    if (!row) return;
    const outcome =
      state === "complete" || state === "failed" || state === "stopped" ? state : "completed";
    row.executor = `executor ${outcome} · model/effort unconfirmed`;
    this.render();
  }

  clear(): void {
    this.launched.clear();
    this.asyncRuns.clear();
    this.notifyRunning();
    this.rows.clear();
    this.render();
  }

  private render(): void {
    const rows = [...this.rows.values()];
    this.onRows?.(
      rows
        .slice(-VISIBLE_ROWS)
        .map(
          (row) =>
            `worker ${row.agent} ${row.label} · ${row.decision}${row.executor ? ` · ${row.executor}` : ""}`,
        ),
    );
  }
}
