import {
  addWorkerToolCounts,
  formatWorkerToolCounts,
  isWorkerToolCounts,
  type WorkerToolCounts,
} from "./worker-tool-counts.ts";
import type {
  AppliedWorkerDecision,
  WorkerDecisionRequest,
  SubagentWorkerDecisionAcceptedEvent,
} from "pi-subagents/worker-decision-authority";
import type { SubagentAttachedForegroundCompleteEvent } from "pi-subagents/shared-types";
import { safeAgent, safeIdentity } from "./decision-visibility.ts";
import type { Tier } from "./tier-policy.ts";
import type { EffortRead } from "./decision-visibility.ts";

export interface WorkerSummary {
  activity: string;
  effort?: string;
  running: number;
  /** Totals across the shown workers; present only when tools were scored. */
  tools?: WorkerToolCounts;
  details?: string[];
}

type Status = "accepted" | "running" | "completed" | "failed" | "cancelled" | "paused" | "detached";
interface Worker {
  readonly epoch: symbol;
  readonly logicalLaunchId: string;
  role?: string;
  tier?: Tier;
  /** Numbers the decision model gave for effort; never task text. */
  effortRead?: EffortRead;
  /** Scored-tool counts only; identities and paths never reach presentation. */
  tools?: WorkerToolCounts;
  receipt?: AppliedWorkerDecision;
  binding?: SubagentWorkerDecisionAcceptedEvent;
  status?: Status;
  childTs?: number;
}
export type WorkerAssessment = Worker;
const TERMINAL = new Set<Status>(["completed", "failed", "cancelled", "paused", "detached"]);
const HISTORY = 12;
const PENDING = 256; // Same bound as executor's session commitment ledger.
const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

/** Presentation projection only. Admission, cancellation and execution stay executor-owned. */
export class WorkerStatus {
  private epoch = Symbol();
  private sessionId?: string;
  private generation?: string;
  private workers = new Map<string, Worker>();
  private lastTerminal?: Worker;
  private toolCalls = new Set<string>();
  private earlyChildren = new Map<string, Record<string, unknown>>();
  private earlyTerminals = new Map<string, Record<string, unknown>>();

  constructor(private readonly changed?: (summary: WorkerSummary | undefined) => void) {}

  attach(sessionId?: string, generation?: string): void {
    this.epoch = Symbol();
    this.sessionId = sessionId;
    this.generation = generation;
    this.workers.clear();
    this.toolCalls.clear();
    this.earlyChildren.clear();
    this.earlyTerminals.clear();
    this.lastTerminal = undefined;
    this.notify();
  }

  observeTool(toolCallId: string): void {
    this.toolCalls.add(toolCallId);
    if (this.toolCalls.size > PENDING) this.toolCalls.delete(this.toolCalls.values().next().value!);
  }

  observedTool(toolCallId: string): boolean {
    return this.toolCalls.has(toolCallId);
  }

  reset(): void {
    this.attach(this.sessionId, this.generation);
  }

  assessing(request: WorkerDecisionRequest): WorkerAssessment | undefined {
    if (!this.sessionId || request.control.ownerGeneration !== this.generation) return;
    const id = request.control.logicalLaunchId;
    if (this.workers.has(id)) return this.workers.get(id);
    this.trim();
    if (this.workers.size >= PENDING) return;
    const role = request.facts.role;
    const name = role?.provenance === "resolved-agent" ? safeAgent(role.name) : "unknown";
    const worker: Worker = {
      epoch: this.epoch,
      logicalLaunchId: id,
      role: name === "unknown" ? undefined : name,
    };
    this.workers.set(id, worker);
    return worker;
  }

  tier(owner: WorkerAssessment | undefined, tier: Tier): void {
    if (owner?.epoch === this.epoch && !owner.receipt) owner.tier = tier;
  }

  effortRead(owner: WorkerAssessment | undefined, read: EffortRead): void {
    if (owner?.epoch === this.epoch && !owner.receipt) owner.effortRead = { ...read };
  }

  /** The effort read recorded for a launch, if the decision model answered. */
  readFor(logicalLaunchId: string): EffortRead | undefined {
    return this.workers.get(logicalLaunchId)?.effortRead;
  }

  applied(receipt: AppliedWorkerDecision): void {
    const worker = this.workers.get(receipt.logicalLaunchId);
    if (!worker || worker.receipt || receipt.ownerGeneration !== this.generation) return;
    // Copy commitment: callers cannot change presentation by mutating their object later.
    worker.receipt = Object.freeze({ ...receipt });
  }

  tools(owner: WorkerAssessment | undefined, counts: WorkerToolCounts): void {
    if (owner?.epoch !== this.epoch || owner.receipt || !isWorkerToolCounts(counts)) return;
    owner.tools = {
      selected: counts.selected,
      rejected: counts.rejected,
      reasons: { ...counts.reasons },
    };
  }

  accepted(value: unknown): value is SubagentWorkerDecisionAcceptedEvent {
    const event = record(value);
    const receipt = record(event?.receipt);
    if (
      !event ||
      event.version !== 1 ||
      event.sessionId !== this.sessionId ||
      typeof event.logicalLaunchId !== "string" ||
      typeof event.toolCallId !== "string" ||
      !event.toolCallId ||
      typeof event.runId !== "string" ||
      !event.runId ||
      !receipt
    )
      return false;
    const worker = this.workers.get(event.logicalLaunchId);
    const own = worker?.receipt;
    if (
      !worker ||
      !own ||
      worker.binding ||
      own.ownerGeneration !== this.generation ||
      Object.entries(own).some(([key, entry]) => receipt[key] !== entry)
    )
      return false;
    if (receipt.logicalLaunchId !== event.logicalLaunchId) return false;
    worker.binding = Object.freeze({
      version: 1,
      sessionId: this.sessionId!,
      toolCallId: event.toolCallId,
      runId: event.runId,
      logicalLaunchId: event.logicalLaunchId,
      receipt: own,
      ...(typeof event.parentWorkflowRunId === "string"
        ? { parentWorkflowRunId: event.parentWorkflowRunId }
        : {}),
      ...(typeof event.workflowKey === "string" ? { workflowKey: event.workflowKey } : {}),
    });
    worker.status = "accepted";
    this.notify();
    const started = this.earlyChildren.get(worker.binding.runId);
    const ended = this.earlyTerminals.get(worker.binding.runId);
    this.earlyChildren.delete(worker.binding.runId);
    this.earlyTerminals.delete(worker.binding.runId);
    if (started) this.child(started);
    if (ended) this.complete(ended);
    return true;
  }

  child(value: unknown): void {
    const event = record(value);
    if (
      !event ||
      event.type !== "subagent.child-status" ||
      event.version !== 1 ||
      typeof event.childId !== "string" ||
      typeof event.ts !== "number" ||
      !Number.isFinite(event.ts)
    )
      return;
    // Workflow status uses root runId and explicit leaf childRunId. Never fan root out to siblings.
    const runId = typeof event.childRunId === "string" ? event.childRunId : event.runId;
    if (typeof runId !== "string" || !runId) return;
    if (![...this.workers.values()].some((worker) => worker.binding?.runId === runId)) {
      if (event.status === "started")
        this.remember(this.earlyChildren, runId, {
          type: event.type,
          version: event.version,
          runId: event.runId,
          childRunId: event.childRunId,
          childId: event.childId,
          status: event.status,
          ts: event.ts,
        });
      return;
    }
    for (const worker of this.workers.values()) {
      if (
        !worker.binding ||
        worker.binding.runId !== runId ||
        !worker.status ||
        TERMINAL.has(worker.status)
      )
        continue;
      if (worker.childTs !== undefined && event.ts < worker.childTs) continue;
      if (event.status === "started") worker.status = "running";
      // Only explicit user child-stop evidence, never generic teardown.
      else if (event.status === "stopped" && event.reason === "user")
        this.terminal(worker, "cancelled");
      else continue;
      worker.childTs = event.ts;
      this.notify();
    }
  }

  result(toolCallId: string, value: unknown, isError: boolean): void {
    const details = record(value);
    if (!details) return;
    const inventory = record(details.workflowChildren);
    if (inventory?.parentToolCallId === toolCallId) {
      this.workflow(inventory);
      this.notify();
    }
    // Pi converts a thrown foreground failure to isError + empty details. Only an
    // observed, uniquely bound ordinary leaf can recover correlation from that call.
    if (isError && Object.keys(details).length === 0 && this.observedTool(toolCallId)) {
      const leaves = [...this.workers.values()].filter(
        (worker) =>
          worker.binding?.toolCallId === toolCallId && !worker.binding.parentWorkflowRunId,
      );
      const worker = leaves.length === 1 ? leaves[0] : undefined;
      if (worker?.status && !TERMINAL.has(worker.status)) {
        this.terminal(worker, "failed");
        this.notify();
      }
      return;
    }
    if (details.toolCallId !== toolCallId) return;
    if (!Array.isArray(details.results)) return;
    const result =
      details.mode === "single" && details.results.length === 1
        ? record(details.results[0])
        : undefined;
    const status = result
      ? this.resultStatus(result, isError)
      : isError && details.results.length === 0
        ? "failed"
        : undefined;
    if (!status) return;
    for (const worker of this.workers.values()) {
      if (
        worker.binding?.toolCallId !== toolCallId ||
        worker.binding.runId !== details.runId ||
        !worker.status ||
        TERMINAL.has(worker.status)
      )
        continue;
      this.terminal(worker, status);
    }
    this.notify();
  }

  complete(value: unknown): void {
    const event = record(value);
    if (!event || (event.sessionId !== undefined && event.sessionId !== this.sessionId)) return;
    if (event.attached === true) {
      const attached = event as unknown as SubagentAttachedForegroundCompleteEvent;
      const worker = [...this.workers.values()].find((entry) => {
        const binding = entry.binding;
        return (
          binding?.runId === attached.runId &&
          binding.sessionId === attached.sessionId &&
          binding.toolCallId === attached.toolCallId &&
          binding.parentWorkflowRunId === attached.parentWorkflowRunId &&
          binding.workflowKey === attached.workflowKey
        );
      });
      if (
        attached.version !== 1 ||
        attached.source !== "foreground" ||
        attached.mode !== "single" ||
        !attached.parentWorkflowRunId ||
        !attached.workflowKey ||
        !worker?.status ||
        TERMINAL.has(worker.status)
      )
        return;
      const terminal = this.terminalStatus(attached.state, attached.success);
      if (terminal) {
        this.terminal(worker, terminal);
        this.notify();
      }
      return;
    }
    this.workflow(event.workflowChildren);
    const status = this.terminalStatus(event.state, event.success);
    this.notify();
    if (!status || typeof event.runId !== "string" || !event.runId) return;
    if (![...this.workers.values()].some((worker) => worker.binding?.runId === event.runId)) {
      this.remember(this.earlyTerminals, event.runId, {
        sessionId: event.sessionId,
        runId: event.runId,
        state: event.state,
      });
      return;
    }
    for (const worker of this.workers.values()) {
      if (worker.binding?.runId !== event.runId || !worker.status || TERMINAL.has(worker.status))
        continue;
      this.terminal(worker, status);
    }
    this.notify();
  }

  summary(): WorkerSummary | undefined {
    const active = [...this.workers.values()].filter(
      (worker) => worker.status && !TERMINAL.has(worker.status),
    );
    const selected = active.length ? active : this.lastTerminal ? [this.lastTerminal] : [];
    if (!selected.length) return;
    const statuses = new Map<Status, number>();
    for (const worker of selected)
      statuses.set(worker.status!, (statuses.get(worker.status!) ?? 0) + 1);
    const activity = [...statuses]
      .map(([status, count]) => `${count} ${count === 1 ? "worker" : "workers"} ${status}`)
      .join(" · ");
    const efforts = new Set(selected.map((worker) => worker.receipt?.thinking));
    const effort = efforts.size > 1 ? "mixed" : selected[0]?.receipt?.thinking;
    const scored = selected.flatMap((worker) => (worker.tools ? [worker.tools] : []));
    const tools = scored.length ? addWorkerToolCounts(scored) : undefined;
    return {
      activity,
      ...(effort ? { effort } : {}),
      ...(tools ? { tools } : {}),
      running: active.filter((worker) => worker.status === "running").length,
      details: selected.map((worker) => this.formatDetails(worker)),
    };
  }

  details(toolCallId: string): string[] {
    return [...this.workers.values()]
      .filter((worker) => worker.binding?.toolCallId === toolCallId)
      .map((worker) => this.formatDetails(worker));
  }

  private formatDetails(worker: Worker): string {
    return [
      worker.role ?? "Worker",
      worker.tier,
      worker.receipt?.reason,
      safeIdentity(worker.receipt?.model),
      worker.receipt?.thinking,
      worker.tools ? formatWorkerToolCounts(worker.tools) : undefined,
      worker.status,
    ]
      .filter(Boolean)
      .join(" · ");
  }

  historySize(): number {
    return [...this.workers.values()].filter(
      (worker) => worker.status && TERMINAL.has(worker.status),
    ).length;
  }

  private resultStatus(result: Record<string, unknown>, isError: boolean): Status | undefined {
    if (result.stopped === true) return "cancelled";
    if (result.detached === true) return "detached";
    if (result.interrupted === true) return "paused";
    if (
      isError ||
      result.timedOut === true ||
      result.error ||
      (typeof result.exitCode === "number" && result.exitCode !== 0)
    )
      return "failed";
    if (result.exitCode === 0) return "completed";
  }

  private terminalStatus(state: unknown, success?: unknown): Status | undefined {
    if (state === "stopped") return "cancelled";
    if (state === "paused" || state === "detached") return state;
    if (state === "failed" || state === "rejected" || state === "partial" || success === false)
      return "failed";
    if (state === "complete" || state === "completed") return "completed";
  }

  private workflow(value: unknown): void {
    const inventory = record(value);
    if (!inventory || inventory.version !== 1 || !Array.isArray(inventory.children)) return;
    for (const worker of this.workers.values()) {
      const binding = worker.binding;
      if (
        !binding?.parentWorkflowRunId ||
        binding.parentWorkflowRunId !== inventory.workflowRunId ||
        binding.toolCallId !== inventory.parentToolCallId ||
        !binding.workflowKey ||
        !worker.status ||
        TERMINAL.has(worker.status)
      )
        continue;
      const child = inventory.children
        .map(record)
        .find(
          (entry) =>
            entry !== undefined &&
            entry.childId === binding.workflowKey &&
            (entry.runId === undefined || entry.runId === binding.runId),
        );
      const status = child && this.terminalStatus(child.state);
      if (status) this.terminal(worker, status);
    }
  }

  private terminal(worker: Worker, status: Status): void {
    worker.status = status;
    this.lastTerminal = worker;
    this.trim();
  }

  private trim(): void {
    const finished = [...this.workers.values()].filter(
      (worker) => worker.status && TERMINAL.has(worker.status),
    );
    for (const worker of finished.slice(0, Math.max(0, finished.length - HISTORY)))
      this.workers.delete(worker.logicalLaunchId);
  }

  private remember(
    cache: Map<string, Record<string, unknown>>,
    runId: string,
    event: Record<string, unknown>,
  ): void {
    if (cache.has(runId)) return;
    cache.set(runId, event);
    if (cache.size > PENDING) cache.delete(cache.keys().next().value!);
  }

  private notify(): void {
    this.changed?.(this.summary());
  }
}
