import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { Details } from "pi-subagents/shared-types";
import { createHash } from "node:crypto";

const KEY = "jev-pilot-workers";
const VISIBLE_ROWS = 4;
const HISTORY_ROWS = 12;
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
}
export type WorkerVisibilityOwner = WorkerRow;

/** Bounded presentation state only. Executor cancellation/ownership remains in the adapter. */
export class WorkerVisibility {
  private rows = new Map<string, WorkerRow>();
  private ui: ExtensionUIContext | undefined;
  private sequence = 0;

  start(toolCallId: string, ui: ExtensionUIContext): WorkerVisibilityOwner {
    this.ui = ui;
    const row: WorkerRow = {
      toolCallId,
      label: `w${++this.sequence}-${createHash("sha256").update(toolCallId).digest("hex").slice(0, 6)}`,
      decision: "choosing model + effort…",
    };
    this.rows.delete(toolCallId);
    this.rows.set(toolCallId, row);
    while (this.rows.size > HISTORY_ROWS) this.rows.delete(this.rows.keys().next().value!);
    this.render();
    return row;
  }

  finish(owner: WorkerVisibilityOwner, decision: string, blocked = false): void {
    if (this.rows.get(owner.toolCallId) !== owner) return;
    owner.decision = decision;
    owner.blocked = blocked;
    this.render();
  }

  result(toolCallId: string, details: unknown): void {
    const row = this.rows.get(toolCallId);
    if (!row || row.asyncId || row.blocked) return;
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
      const verified =
        typeof receipt?.runId === "string" &&
        !!receipt.runId &&
        typeof result?.launchContractDigest === "string" &&
        /^[a-f0-9]{64}$/.test(result.launchContractDigest) &&
        result.launchResolvedExtensions?.source === "launch-resolved" &&
        result.launchResolvedExtensions.version === 1 &&
        typeof result.exitCode === "number" &&
        (result.usage?.turns ?? 0) > 0;
      row.executor = verified
        ? `executor receipt · target ${workerTarget(result?.model, result?.thinking)}`
        : "executor result · launch unconfirmed";
    }
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
            `Jev worker ${row.label} · ${row.decision}${row.executor ? ` · ${row.executor}` : ""}`,
        ),
    );
    this.ui?.setStatus?.(
      KEY,
      `jev workers · ${rows.length} recent${rows.length > VISIBLE_ROWS ? ` · showing ${VISIBLE_ROWS}` : ""}`,
    );
  }
}
