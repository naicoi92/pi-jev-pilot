import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { clampThinkingLevel } from "@earendil-works/pi-ai";
import { resolveSubagentLaunchContract } from "pi-subagents/preflight";
import {
  registerRequiredChildExtensions,
  type RequiredChildExtensionRegistration,
} from "pi-subagents/required-child-extensions";
import { fileURLToPath } from "node:url";
import { classify, systemOneConfig, WORKER_EFFORT_QUESTION, effortEnabled } from "./system-one.ts";
import { guidanceEnabled } from "./guidance-policy.ts";
import { selectEffort } from "./effort-policy.ts";
import { selectTier, TIER_ORDER, type Tiers } from "./tier-policy.ts";

function enabled(): boolean {
  const value = process.env.JEV_WORKER_ROUTING_ENABLED ?? "true";
  if (value !== "true" && value !== "false")
    throw new Error("JEV_WORKER_ROUTING_ENABLED must be true or false.");
  return value === "true";
}
function identity(value: string): string {
  return value.replace(/:(off|minimal|low|medium|high|xhigh|max)$/, "");
}
function physical(ctx: ExtensionContext, value: string) {
  const slash = value.indexOf("/");
  const model = ctx.modelRegistry.find(value.slice(0, slash), value.slice(slash + 1));
  if (!model || model.api === "pi-virtual" || slash < 1)
    throw new Error(`Jev worker target ${value} must resolve to an exact physical Pi model.`);
  if (!ctx.modelRegistry.hasConfiguredAuth(model))
    throw new Error(`Configure Pi authentication for Jev worker target ${value}.`);
  return model;
}
function parentIdentity(ctx: ExtensionContext): string {
  if (ctx.model?.api !== "pi-virtual" && ctx.model) return `${ctx.model.provider}/${ctx.model.id}`;
  for (const entry of [...ctx.sessionManager.getBranch()].reverse()) {
    if (
      entry.type === "message" &&
      entry.message.role === "assistant" &&
      entry.message.provider !== "jev" &&
      entry.message.stopReason !== "error" &&
      entry.message.stopReason !== "aborted"
    )
      return `${entry.message.provider}/${entry.message.model}`;
  }
  throw new Error(
    "Jev worker routing needs a completed physical parent route or an explicit qualified worker model.",
  );
}

/** Ordinary tool envelopes only; workflow inner launches remain executor-owned. */
export function registerWorkerAdapter(pi: ExtensionAPI): void {
  let childExtension: RequiredChildExtensionRegistration | undefined;
  const deliverChildExtension = (_event: unknown, ctx: ExtensionContext) => {
    childExtension?.dispose();
    childExtension = registerRequiredChildExtensions({
      sessionId: ctx.sessionManager.getSessionId(),
      extensions: [
        {
          id: "jev-pilot-child",
          path: fileURLToPath(new URL("./worker-child.ts", import.meta.url)),
        },
      ],
    });
  };
  pi.on("session_start", () => {
    childExtension?.dispose();
    childExtension = undefined;
  });
  const active = new Set<AbortController>();
  const routed = new Set<string>();
  const owned = new Map<string, { signal?: AbortSignal; cancel: () => void }>();
  const stop = (id: string) =>
    pi.events.emit("subagents:rpc:v1:request", {
      version: 1,
      requestId: crypto.randomUUID(),
      method: "stop",
      params: { id },
    });
  const clear = () => {
    for (const controller of active) controller.abort();
    active.clear();
    routed.clear();
    for (const [id, run] of owned) {
      run.signal?.removeEventListener("abort", run.cancel);
      stop(id);
    }
    owned.clear();
  };
  pi.on("session_shutdown", () => {
    clear();
    childExtension?.dispose();
    childExtension = undefined;
  });
  pi.on("agent_settled", (event) => {
    routed.clear();
    if (event.aborted) clear();
  });
  const leaveSession = () => {
    clear();
    childExtension?.dispose();
    childExtension = undefined;
  };
  pi.on("session_before_switch", leaveSession);
  pi.on("session_before_fork", leaveSession);
  pi.on("session_before_compact", clear);
  pi.on("session_before_tree", clear);
  pi.on("model_select", () => {
    for (const controller of active) controller.abort();
  });
  pi.on("thinking_level_select", () => {
    for (const controller of active) controller.abort();
  });
  pi.events.on("subagent:async-complete", (event: unknown) => {
    if (
      !event ||
      typeof event !== "object" ||
      !("runId" in event) ||
      typeof event.runId !== "string"
    )
      return;
    const run = owned.get(event.runId);
    run?.signal?.removeEventListener("abort", run.cancel);
    owned.delete(event.runId);
  });
  pi.on("tool_result", (event, ctx) => {
    if (
      event.toolName !== "subagent" ||
      !routed.delete(event.toolCallId) ||
      !event.details ||
      typeof event.details !== "object" ||
      !("asyncId" in event.details) ||
      typeof event.details.asyncId !== "string"
    )
      return;
    const id = event.details.asyncId;
    const cancel = () => {
      if (owned.delete(id)) stop(id);
    };
    owned.set(id, { signal: ctx.signal, cancel });
    if (ctx.signal?.aborted) cancel();
    else ctx.signal?.addEventListener("abort", cancel, { once: true });
  });
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "subagent") return;
    const input = event.input as Record<string, unknown>;
    if (input.action) return;
    const routing = enabled();
    const automaticMain =
      effortEnabled() ||
      process.env.JEV_SKILLS_ENABLED !== "false" ||
      guidanceEnabled("QUALITY") ||
      guidanceEnabled("STRATEGY") ||
      guidanceEnabled("DESIGN");
    if (typeof input.agent === "string" && !childExtension && (routing || automaticMain)) {
      try {
        deliverChildExtension(undefined, ctx);
      } catch (error) {
        return {
          block: true,
          reason: `Jev child helper cannot register alongside an existing required-child-extension owner; original input is unchanged and no child launched. ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
    if (!routing) return;
    if (input.workflow) {
      ctx.ui.notify(
        "Jev workflow advice: use fast for mechanical work, balanced for ordinary changes, deep for design or risky work; set each inner launch model and supported effort explicitly. Inner launches remain workflow-owned.",
        "info",
      );
      return;
    }
    if (typeof input.agent !== "string") return;
    const options =
      input.options && typeof input.options === "object"
        ? (input.options as Record<string, unknown>)
        : {};
    if ((options.context ?? input.context) === "fork") return;
    if (typeof input.task !== "string" || !input.task.trim()) return;
    const tiers = Object.fromEntries(
      TIER_ORDER.map((tier) => [tier, process.env[`JEV_TIER_${tier.toUpperCase()}`] ?? ""]),
    ) as Tiers;
    for (const tier of TIER_ORDER) physical(ctx, tiers[tier]);
    const controller = new AbortController();
    const cancel = () => controller.abort();
    ctx.signal?.addEventListener("abort", cancel, { once: true });
    active.add(controller);
    try {
      if (ctx.signal?.aborted) controller.abort();
      const preview = await resolveSubagentLaunchContract({
        agent: input.agent,
        task: input.task,
        cwd: typeof input.cwd === "string" ? input.cwd : ctx.cwd,
        context: options.context === "fresh" ? "fresh" : undefined,
        model: typeof input.model === "string" ? input.model : undefined,
        parentModel: ctx.model?.api !== "pi-virtual" ? ctx.model : undefined,
        availableModels: ctx.modelRegistry.getAvailable(),
        scopedModelIds: ctx.scopedModels.map(({ model }) => `${model.provider}/${model.id}`),
        projectTrusted: ctx.isProjectTrusted(),
        parentSessionId: ctx.sessionManager.getSessionId(),
        parentSessionFile: ctx.sessionManager.getSessionFile(),
        parentLeafId: ctx.sessionManager.getLeafId(),
        runtimeSnapshotHost: pi,
      });
      if (preview.ok && preview.contract.context === "fork") return;
      // Runtime agents are executor-owned; a disk-only discovery miss is not authority to block them.
      if (!preview.ok && preview.code !== "missing_agent")
        return { block: true, reason: preview.message };
      const specialized =
        input.agent === "jev-pilot:junior"
          ? tiers.balanced
          : ["jev-pilot:codex-review", "jev-pilot:opencode-review"].includes(input.agent)
            ? tiers.fast
            : undefined;
      if (specialized) {
        if (controller.signal.aborted)
          return { block: true, reason: "Jev worker classification cancelled; no child launched." };
        input.model = specialized;
        return;
      }
      const baseline =
        typeof input.model === "string" ? identity(input.model) : parentIdentity(ctx);
      physical(ctx, baseline);
      if (controller.signal.aborted)
        return { block: true, reason: "Jev worker classification cancelled; no child launched." };
      const result = await classify(
        systemOneConfig(),
        {
          prompt: input.task.slice(0, 2000),
          agentType: input.agent.slice(0, 128),
          ...(typeof input.description === "string"
            ? { description: input.description.slice(0, 512) }
            : {}),
        },
        controller.signal,
        { tier: true, effort: true },
        {
          effort: WORKER_EFFORT_QUESTION,
        },
      );
      if (controller.signal.aborted)
        return { block: true, reason: "Jev worker classification cancelled; no child launched." };
      if (result.outcome !== "classified") return;
      const selected = result.decision.tier
        ? selectTier(
            {
              tier: result.decision.tier,
              confidence: result.decision.confidence ?? null,
              risky: result.decision.risky,
            },
            baseline,
            tiers,
          )
        : null;
      const finalIdentity = selected ?? baseline;
      const model = physical(ctx, finalIdentity);
      // No executor default is a veto. Unknown current effort permits upgrades only.
      const requested = selectEffort(result.decision, "", input.task);
      if (!selected && !requested) return;
      const effective = requested ? clampThinkingLevel(model, requested) : undefined;
      if (controller.signal.aborted)
        return { block: true, reason: "Jev worker classification cancelled; no child launched." };
      input.model = `${finalIdentity}${effective ? `:${effective}` : ""}`;
      routed.add(event.toolCallId);
      pi.appendEntry("jev-pilot:worker-route", {
        toolCallId: event.toolCallId,
        physical: finalIdentity,
        requested,
        effective,
        outcome: result.outcome,
      });
    } catch (error) {
      if (controller.signal.aborted)
        return { block: true, reason: "Jev worker classification cancelled; no child launched." };
      throw error;
    } finally {
      active.delete(controller);
      ctx.signal?.removeEventListener("abort", cancel);
    }
  });
}
