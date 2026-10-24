import type { ExtensionUIContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import type { Details } from "pi-subagents/shared-types";
import { createHash } from "node:crypto";
import {
  latestDecisionRows,
  safeAgent,
  safeIdentity,
  safeEffort,
  type WorkerDecisionRow,
  type VisibleOutcome,
} from "./decision-visibility.ts";

const KEY = "jev-pilot-workers";
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
  private ui: ExtensionUIContext | undefined;
  private sequence = 0;

  constructor(private readonly persist?: (row: WorkerDecisionRow) => void) {}

  restore(branch: SessionEntry[]): void {
    this.sequence = Math.max(
      this.sequence,
      ...latestDecisionRows(branch).flatMap((row) =>
        row.kind === "worker" ? [Number(row.invocation.match(/^w(\d+)-/)?.[1]) || 0] : [],
      ),
    );
  }

  start(
    toolCallId: string,
    ui: ExtensionUIContext,
    agent?: unknown,
    retained?: unknown,
  ): WorkerVisibilityOwner {
    this.ui = ui;
    const label = `w${++this.sequence}-${createHash("sha256").update(toolCallId).digest("hex").slice(0, 6)}`;
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

  describe(
    owner: WorkerVisibilityOwner,
    agent: unknown,
    retained: unknown,
    thinking: unknown,
  ): void {
    if (this.rows.get(owner.toolCallId) !== owner) return;
    owner.agent = safeAgent(agent);
    owner.plan = {
      ...owner.plan,
      agent: owner.agent,
      retained: safeIdentity(retained),
      model: safeIdentity(retained),
      requested: safeEffort(thinking),
      effective: safeEffort(thinking),
    };
    this.render();
  }

  result(toolCallId: string, details: unknown): void {
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
        const label = `w${++this.sequence}-${createHash("sha256").update(`${row.label}:${child.index}`).digest("hex").slice(0, 6)}`;
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
    const row = [...this.rows.values()].find((row) => row.asyncId === runId);
    if (!row) return;
    const outcome =
      state === "complete" || state === "failed" || state === "stopped" ? state : "completed";
    row.executor = `executor ${outcome} · model/effort unconfirmed`;
    this.render();
  }

  clear(): void {
    this.rows.clear();
    this.ui?.setWidget?.(KEY, undefined);
    this.ui?.setStatus?.(KEY, undefined);
    this.ui = undefined;
  }

  private render(): void {
    const rows = [...this.rows.values()];
    this.ui?.setWidget?.(
      KEY,
      rows
        .slice(-VISIBLE_ROWS)
        .map(
          (row) =>
            `Jev worker ${row.agent} ${row.label} · ${row.decision}${row.executor ? ` · ${row.executor}` : ""}`,
        ),
    );
    this.ui?.setStatus?.(
      KEY,
      `jev workers · ${rows.length} recent${rows.length > VISIBLE_ROWS ? ` · showing ${VISIBLE_ROWS}` : ""}`,
    );
  }
}
