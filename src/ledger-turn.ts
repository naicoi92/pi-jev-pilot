import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { VisibleEffort } from "./decision-visibility.ts";
import type { LedgerEntry, LedgerOutcome } from "./ledger.ts";

/** What is known about a main turn before it completes; never contains prompt text. */
export interface LedgerDraft {
  sessionId: string;
  startedAt: number;
  answered: boolean;
  ms: number | null;
  effortLevel: number | null;
  effortConfidence: number | null;
  startedFrom: VisibleEffort;
  requested: VisibleEffort | null;
  started: VisibleEffort | null;
  strategy: string | null;
  strategyConfidence: number | null;
  advised: boolean;
}

export function newDraft(
  sessionId: string,
  startedAt: number,
  startedFrom: VisibleEffort,
): LedgerDraft {
  return {
    sessionId,
    startedAt,
    answered: false,
    ms: null,
    effortLevel: null,
    effortConfidence: null,
    startedFrom,
    requested: null,
    started: null,
    strategy: null,
    strategyConfidence: null,
    advised: false,
  };
}

/** Counts top-level tool results: all calls, and the longest run of failed ones. */
export class ToolTally {
  calls = 0;
  failures = 0;
  private run = 0;
  observe(failed: boolean): void {
    this.calls++;
    this.run = failed ? this.run + 1 : 0;
    this.failures = Math.max(this.failures, this.run);
  }
  reset(): void {
    this.calls = 0;
    this.failures = 0;
    this.run = 0;
  }
}

/**
 * Stable identity of the latest user message on this branch. Pi assigns the
 * entry id when it persists the message, so it survives resume, reload and
 * compaction, and a branch that excludes the message cannot resolve it.
 */
export function lastUserTurnId(sessionId: string, branch: SessionEntry[]): string | undefined {
  for (let index = branch.length - 1; index >= 0; index--) {
    const entry = branch[index]!;
    if (entry.type === "message" && entry.message.role === "user")
      return `${sessionId}:${entry.id}`;
  }
}

const OUTCOMES: Record<string, LedgerOutcome> = {
  stop: "answer",
  length: "length",
  aborted: "aborted",
  error: "error",
};

export function completedEntry(
  draft: LedgerDraft,
  tally: ToolTally,
  messages: readonly { role: string }[],
  id: string,
  now: number,
): LedgerEntry {
  const replies = messages.filter(
    (message): message is AssistantMessage => message.role === "assistant",
  );
  const last = replies.at(-1);
  const sum = (pick: (reply: AssistantMessage) => number) =>
    replies.length ? replies.reduce((total, reply) => total + pick(reply), 0) : null;
  return {
    version: 1,
    id,
    at: draft.startedAt,
    answered: draft.answered,
    ms: draft.ms,
    effortLevel: draft.effortLevel,
    effortConfidence: draft.effortConfidence,
    startedFrom: draft.startedFrom,
    requested: draft.requested,
    started: draft.started,
    toolCalls: tally.calls,
    failures: tally.failures,
    strategy: draft.strategy,
    strategyConfidence: draft.strategyConfidence,
    advised: draft.advised,
    outcome: (last && OUTCOMES[last.stopReason]) || "unknown",
    durationMs: Math.max(0, now - draft.startedAt),
    inputTokens: sum((reply) => reply.usage.input),
    outputTokens: sum((reply) => reply.usage.output),
  };
}
