import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  isContinuation,
  selectEffort,
  type EffortDecision,
} from "./effort-policy.ts";
import { classify, systemOneConfig } from "./system-one.ts";
import { classifierState } from "./classifier-context.ts";

const STATE_TYPE = "jev-pilot:effort";

/** Effort-only adapter: never replaces the selected model or writes global defaults. */
export default function (pi: ExtensionAPI): void {
  let active: AbortController | undefined;
  let pending:
    | { sessionId: string; signal: AbortSignal; data: EffortState }
    | undefined;
  const dispose = () => {
    active?.abort();
    active = undefined;
    pending = undefined;
  };
  pi.on("session_shutdown", dispose);
  pi.on("session_start", dispose);
  pi.on("session_tree", dispose);
  pi.on("agent_end", () => {
    pending = undefined;
  });
  pi.on("context", (_event, ctx) => {
    const state = pending;
    pending = undefined;
    if (
      state &&
      !state.signal.aborted &&
      state.sessionId === ctx.sessionManager.getSessionId()
    )
      pi.appendEntry(STATE_TYPE, state.data);
  });

  // before_agent_start has no active agent signal in Pi 1.3.0. User message_start
  // is awaited before request preparation, includes queued input, and owns cancellation.
  pi.on("message_start", async (event, ctx) => {
    if (event.message.role !== "user") return;
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
    const current = pi.getThinkingLevel();
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
      const decision = result.outcome === "classified" ? result.decision : null;
      const requested = decision
        ? (selectEffort(decision, current, prompt) ?? current)
        : current;
      pi.setThinkingLevel(requested);
      const effective = pi.getThinkingLevel();
      // Commit only after Pi persists the owning user message. A fork before that
      // message must not inherit its decision. No prompt text is stored here.
      pending = {
        sessionId: ctx.sessionManager.getSessionId(),
        signal: controller.signal,
        data: {
          requested,
          effective,
          outcome: reused ? "reused" : result.outcome,
          decision: decision ?? previous,
        },
      };
      ctx.ui.setStatus(
        "jev-pilot",
        `jev · ${requested} → ${effective} · ${reused ? "reused" : result.outcome}`,
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        ctx.ui.notify(
          "Jev Pilot could not classify this input; current effort is unchanged.",
          "warning",
        );
      }
    } finally {
      parentSignal?.removeEventListener("abort", cancel);
      if (active === controller) active = undefined;
    }
  });
}

interface EffortState {
  requested: string;
  effective: string;
  outcome: string;
  decision: EffortDecision | null;
}

function previousDecision(ctx: ExtensionContext): EffortDecision | null {
  for (const entry of ctx.sessionManager.getBranch().reverse()) {
    if (entry.type !== "custom" || entry.customType !== STATE_TYPE) continue;
    const data = entry.data as { decision?: EffortDecision } | undefined;
    return data?.decision ?? null;
  }
  return null;
}
