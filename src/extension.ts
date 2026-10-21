import type {
  ExtensionAPI,
  ExtensionContext,
  SessionEntry,
} from "@earendil-works/pi-coding-agent";
import {
  clampThinkingLevel,
  type ModelThinkingLevel,
} from "@earendil-works/pi-ai";
import {
  isContinuation,
  selectEffort,
  type EffortDecision,
} from "./effort-policy.ts";
import { classify, systemOneConfig } from "./system-one.ts";
import { classifierState } from "./classifier-context.ts";

const STATE_TYPE = "jev-pilot:effort";
const APPLICATION_TYPE = "jev-pilot:effort-application";
const RESTORED_TYPE = "jev-pilot:effort-restored";

/** Effort-only adapter: never replaces the selected model or writes global defaults. */
export default function (pi: ExtensionAPI): void {
  let active: AbortController | undefined;
  let pending: PendingEffort[] = [];
  const dispose = () => {
    active?.abort();
    active = undefined;
    pending = [];
  };
  const commitPending = (ctx: ExtensionContext) => {
    const branch = ctx.sessionManager.getBranch();
    for (const state of pending) {
      if (
        state.signal.aborted ||
        state.sessionId !== ctx.sessionManager.getSessionId()
      )
        continue;
      const applicationIndex = branch.findIndex(
        (entry) => entry.id === state.data.applicationId,
      );
      if (applicationIndex === -1) continue;
      const owner = branch
        .slice(applicationIndex + 1)
        .find(
          (entry) => entry.type === "message" && entry.message.role === "user",
        );
      if (owner)
        pi.appendEntry(STATE_TYPE, { ...state.data, ownerEntryId: owner.id });
    }
    pending = [];
  };
  const restoreThinking = (ctx: ExtensionContext, fromTree: boolean) => {
    const branch = ctx.sessionManager.getBranch();
    const desired = ownedThinking(branch);
    if (!desired) return;
    const recorded = branch.findLast(
      (entry) => entry.type === "thinking_level_change",
    );
    // A startup CLI/user override differs from recorded history and remains authoritative.
    // Tree navigation does not restore thinking in Pi 1.3.0, so restore its owned prefix.
    const restored =
      fromTree ||
      (recorded?.type === "thinking_level_change" &&
        pi.getThinkingLevel() === recorded.thinkingLevel)
        ? desired
        : pi.getThinkingLevel();
    // Close any application whose user was excluded, including when an explicit
    // startup override wins. A future unrelated user must never become its owner.
    pi.appendEntry(RESTORED_TYPE, { thinkingLevel: restored });
    pi.setThinkingLevel(restored);
  };
  pi.on("session_shutdown", dispose);
  pi.on("session_start", (_event, ctx) => {
    dispose();
    restoreThinking(ctx, false);
  });
  pi.on("session_tree", (_event, ctx) => {
    dispose();
    restoreThinking(ctx, true);
  });
  pi.on("agent_end", () => {
    pending = [];
  });
  pi.on("context", (_event, ctx) => {
    commitPending(ctx);
  });

  // before_agent_start has no active agent signal in Pi 1.3.0. User message_start
  // is awaited before request preparation, includes queued input, and owns cancellation.
  pi.on("message_start", async (event, ctx) => {
    if (event.message.role !== "user") return;
    // Pi persisted the preceding queued user at message_end. Commit it before a
    // following continuation reads its predecessor, even in steering mode "all".
    commitPending(ctx);
    const prompt =
      typeof event.message.content === "string"
        ? event.message.content
        : event.message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");
    if (!prompt.trim() || /^\/\S/.test(prompt.trim())) return;
    let config;
    try {
      config = systemOneConfig();
      if (!ctx.model || !ctx.modelRegistry.hasConfiguredAuth(ctx.model))
        throw new Error(
          "Select a configured physical Pi model with authentication before submitting work.",
        );
    } catch (error) {
      ctx.ui.notify(
        error instanceof Error
          ? error.message
          : "Invalid Jev Pilot configuration.",
        "error",
      );
      ctx.abort();
      return;
    }
    const controller = new AbortController();
    active = controller;
    const parentSignal = ctx.signal;
    const cancel = () => controller.abort();
    parentSignal?.addEventListener("abort", cancel, { once: true });
    if (parentSignal?.aborted) cancel();
    try {
      const previous = previousDecision(ctx);
      const reused = previous !== null && isContinuation(prompt);
      const result = reused
        ? { outcome: "classified" as const, decision: previous }
        : await classify(
            config,
            await classifierState(
              ctx,
              prompt,
              pi.getAllTools().map((tool) => tool.name),
            ),
            controller.signal,
          );
      if (controller.signal.aborted) return;
      const current = pi.getThinkingLevel();
      const decision = result.outcome === "classified" ? result.decision : null;
      const requested = decision
        ? (selectEffort(decision, current, prompt) ?? current)
        : current;
      const effective = clampThinkingLevel(ctx.model!, requested);
      // setThinkingLevel appends before the owning user is persisted. Record its
      // baseline first so a branch excluding that user can discard this change.
      const state: DecisionState = {
        requested,
        effective,
        outcome: reused ? "reused" : result.outcome,
        decision: decision ?? previous,
      };
      pi.appendEntry(APPLICATION_TYPE, { baseline: current, ...state });
      const applicationId = ctx.sessionManager.getLeafId()!;
      pi.setThinkingLevel(requested);
      pending.push({
        sessionId: ctx.sessionManager.getSessionId(),
        signal: parentSignal ?? controller.signal,
        data: { applicationId, ...state },
      });
      ctx.ui.setStatus(
        "jev-pilot",
        `jev · ${requested} → ${effective} · ${reused ? "reused" : result.outcome}`,
      );
    } catch {
      if (!controller.signal.aborted)
        ctx.ui.notify(
          "Jev Pilot could not classify this input; current effort is unchanged.",
          "warning",
        );
    } finally {
      parentSignal?.removeEventListener("abort", cancel);
      if (active === controller) active = undefined;
    }
  });
}

interface EffortState extends DecisionState {
  applicationId: string;
  ownerEntryId?: string;
}
interface DecisionState {
  requested: ModelThinkingLevel;
  effective: ModelThinkingLevel;
  outcome: string;
  decision: EffortDecision | null;
}
interface PendingEffort {
  sessionId: string;
  signal: AbortSignal;
  data: EffortState;
}
interface EffortApplication extends DecisionState {
  baseline: ModelThinkingLevel;
}

function ownedApplications(branch: SessionEntry[]): Set<string> {
  const owned = new Set<string>();
  let applicationId: string | undefined;
  for (const entry of branch) {
    if (entry.type === "custom" && entry.customType === RESTORED_TYPE)
      applicationId = undefined;
    if (entry.type === "custom" && entry.customType === APPLICATION_TYPE)
      applicationId = entry.id;
    if (
      entry.type === "message" &&
      entry.message.role === "user" &&
      applicationId
    ) {
      owned.add(applicationId);
      applicationId = undefined;
    }
  }
  return owned;
}

/** Replay manual changes and only applications whose owning user is on this branch. */
function ownedThinking(branch: SessionEntry[]): ModelThinkingLevel | undefined {
  const committed = ownedApplications(branch);
  let level: ModelThinkingLevel | undefined;
  let application: { id: string; data: EffortApplication } | undefined;
  for (const entry of branch) {
    if (entry.type === "custom" && entry.customType === APPLICATION_TYPE) {
      application = { id: entry.id, data: entry.data as EffortApplication };
      level ??= application.data.baseline;
      continue;
    }
    if (entry.type === "custom" && entry.customType === RESTORED_TYPE) {
      level = (entry.data as { thinkingLevel: ModelThinkingLevel })
        .thinkingLevel;
    }
    if (entry.type === "thinking_level_change") {
      const provisional =
        application &&
        application.data.baseline !== application.data.effective &&
        entry.thinkingLevel === application.data.effective;
      if (!provisional || committed.has(application!.id))
        level = entry.thinkingLevel as ModelThinkingLevel;
    }
    application = undefined;
  }
  return level;
}

function previousDecision(ctx: ExtensionContext): EffortDecision | null {
  const branch = ctx.sessionManager.getBranch();
  const owned = ownedApplications(branch);
  for (const entry of branch.reverse()) {
    if (entry.type !== "custom") continue;
    if (
      entry.customType !== STATE_TYPE &&
      !(entry.customType === APPLICATION_TYPE && owned.has(entry.id))
    )
      continue;
    const data = entry.data as DecisionState | undefined;
    return data?.decision ?? null;
  }
  return null;
}
