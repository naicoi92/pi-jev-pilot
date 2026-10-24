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
import { TIER_ORDER } from "./tier-policy.ts";
import { configuredTiers } from "./routing-settings.ts";
import { crewConfig } from "./crew-config.ts";
import { selectWorkerModel } from "./crew-policy.ts";
import { WorkerVisibility, workerTarget } from "./worker-visibility.ts";
import {
  appendDecisionRow,
  safeIdentity,
  safeEffort,
  type WorkerDecisionRow,
} from "./decision-visibility.ts";

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
  let settings: unknown = {};
  const visibility = new WorkerVisibility((row) => appendDecisionRow(pi, row));
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
  pi.on("session_start", (_event, ctx) => {
    visibility.clear();
    visibility.restore(ctx.sessionManager.getBranch());
    settings = pi.getSettings();
    childExtension?.dispose();
    childExtension = undefined;
  });
  const active = new Set<AbortController>();
  const allowedLaunches = new Set<string>();
  const owned = new Map<string, { signal?: AbortSignal; cancel: () => void }>();
  const stop = (id: string) =>
    pi.events.emit("subagents:rpc:v1:request", {
      version: 1,
      requestId: crypto.randomUUID(),
      method: "stop",
      params: { id },
    });
  const clear = () => {
    visibility.clear();
    for (const controller of active) controller.abort();
    active.clear();
    allowedLaunches.clear();
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
    allowedLaunches.clear();
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
    visibility.complete(event.runId, "state" in event ? event.state : undefined);
    const run = owned.get(event.runId);
    run?.signal?.removeEventListener("abort", run.cancel);
    owned.delete(event.runId);
  });
  pi.on("tool_result", (event, ctx) => {
    if (event.toolName === "subagent") visibility.result(event.toolCallId, event.details);
    if (
      event.toolName !== "subagent" ||
      !allowedLaunches.delete(event.toolCallId) ||
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
    const owner = visibility.start(
      event.toolCallId,
      ctx.ui,
      undefined,
      typeof input.model === "string" ? identity(input.model) : undefined,
    );
    const finish = (
      message: string,
      metadata?: Partial<
        Pick<WorkerDecisionRow, "retained" | "model" | "requested" | "effective" | "outcome">
      >,
    ) => visibility.finish(owner, message, false, metadata);
    const block = (reason: string, summary: string) => {
      visibility.finish(owner, `not launched · ${summary}`, true);
      return { block: true as const, reason };
    };
    const cancelled = () =>
      block("Jev worker classification cancelled; no child launched.", "cancelled");
    try {
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
          visibility.finish(owner, "not launched · child helper registration conflict", true);
          return {
            block: true,
            reason: `Jev child helper cannot register alongside an existing required-child-extension owner; original input is unchanged and no child launched. ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      }
      if (!routing) {
        finish("unchanged · routing disabled · executor-owned");
        return;
      }
      if (input.workflow) {
        finish("executor-owned · workflow inner launches");
        return;
      }
      if (typeof input.agent !== "string") {
        finish("unchanged · unsupported envelope · executor-owned");
        return;
      }
      const options =
        input.options && typeof input.options === "object"
          ? (input.options as Record<string, unknown>)
          : {};
      const field = (name: string) => {
        if (
          input[name] !== undefined &&
          options[name] !== undefined &&
          input[name] !== options[name]
        )
          throw new Error(`Conflicting subagent ${name} values at top level and options.`);
        return options[name] ?? input[name];
      };
      const context = field("context");
      const agentScope = field("agentScope");
      if (context === "fork") {
        finish("executor-owned · fork model + effort");
        return;
      }
      if (context === "profile")
        return block(
          "Jev adapter cannot resolve context: profile through the public preflight API in Pi 1.4 / pi-subagents 0.80; original input is unchanged and no child launched.",
          "profile preflight unavailable",
        );
      if (context !== undefined && context !== "fresh")
        return block(
          "Invalid subagent context; use fresh, fork or a supported executor profile path.",
          "invalid context",
        );
      if (
        agentScope !== undefined &&
        agentScope !== "user" &&
        agentScope !== "project" &&
        agentScope !== "both"
      )
        return block(
          "Invalid subagent agentScope; use user, project or both.",
          "invalid agent scope",
        );
      if (typeof input.task !== "string" || !input.task.trim()) {
        finish("unchanged · empty task · executor-owned");
        return;
      }
      const tiers = configuredTiers(settings);
      for (const tier of TIER_ORDER) physical(ctx, tiers[tier]);
      const crew = crewConfig(ctx.cwd);
      for (const slot of crew.offered) physical(ctx, slot.model);
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
          context,
          agentScope,
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
        if (preview.ok)
          visibility.describe(
            owner,
            preview.contract.agent.name,
            preview.contract.model ? identity(preview.contract.model) : undefined,
            preview.contract.thinking,
          );
        if (preview.ok && preview.contract.context === "fork") {
          finish("executor-owned · fork model + effort");
          return;
        }
        // Runtime agents are executor-owned; a disk-only discovery miss is not authority to block them.
        if (!preview.ok && preview.code !== "missing_agent")
          return block(preview.message, "preflight rejected");
        const specialized =
          input.agent === "jev-pilot:junior"
            ? (crew.junior?.model ?? tiers.balanced)
            : ["jev-pilot:codex-review", "jev-pilot:opencode-review"].includes(input.agent)
              ? tiers.fast
              : undefined;
        if (specialized) {
          if (controller.signal.aborted) return cancelled();
          input.model = specialized;
          finish(
            `Jev plan · selected ${workerTarget(specialized)} · specialized slot · launch unconfirmed`,
            { model: safeIdentity(specialized), outcome: "specialized" },
          );
          allowedLaunches.add(event.toolCallId);
          return;
        }
        const baseline =
          typeof input.model === "string" ? identity(input.model) : parentIdentity(ctx);
        physical(ctx, baseline);
        if (controller.signal.aborted) return cancelled();
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
          { tier: true, effort: true, slots: crew.offered },
          {
            effort: WORKER_EFFORT_QUESTION,
          },
        );
        if (controller.signal.aborted) return cancelled();
        const retainedTarget = workerTarget(
          preview.ok ? preview.contract.model : input.model,
          preview.ok ? preview.contract.thinking : undefined,
        );
        if (result.outcome !== "classified") {
          finish(
            `unchanged · ${result.outcome} · retained ${retainedTarget} · launch unconfirmed`,
            {
              retained: safeIdentity(
                preview.ok ? identity(preview.contract.model ?? "") : input.model,
              ),
              model: safeIdentity(
                preview.ok ? identity(preview.contract.model ?? "") : input.model,
              ),
              outcome: result.outcome === "timeout" ? "timeout" : "error",
            },
          );
          allowedLaunches.add(event.toolCallId);
          return;
        }
        const selected = result.decision.tier
          ? selectWorkerModel(
              {
                tier: result.decision.tier,
                slot: result.decision.slot,
                confidence: result.decision.confidence ?? null,
                risky: result.decision.risky,
              },
              baseline,
              tiers,
              crew.offered,
            )
          : null;
        // Policy comparison is not authority to replace an omitted executor default.
        const requested = selectEffort(result.decision, "", input.task);
        if (!selected && !requested) {
          finish(`Jev plan · kept ${retainedTarget} · no applicable change · launch unconfirmed`, {
            retained: safeIdentity(
              preview.ok ? identity(preview.contract.model ?? "") : input.model,
            ),
            model: safeIdentity(preview.ok ? identity(preview.contract.model ?? "") : input.model),
            outcome: "kept",
          });
          allowedLaunches.add(event.toolCallId);
          return;
        }
        const retained =
          typeof input.model === "string"
            ? input.model
            : preview.ok
              ? preview.contract.model
              : undefined;
        const finalIdentity = selected ?? (retained ? identity(retained) : undefined);
        if (!finalIdentity)
          return block(
            "Jev cannot resolve the retained worker target for an effort-only decision through public preflight; supply an exact worker model. Original input is unchanged and no child launched.",
            "executor default/unknown for effort-only decision",
          );
        const model = physical(ctx, finalIdentity);
        const effective = requested ? clampThinkingLevel(model, requested) : undefined;
        if (controller.signal.aborted) return cancelled();
        input.model = `${finalIdentity}${effective ? `:${effective}` : ""}`;
        finish(
          `Jev plan · ${selected ? "selected" : "kept"} ${workerTarget(finalIdentity, effective)}${requested ? ` · ${requested} → ${effective}` : ""} · launch unconfirmed`,
          {
            retained: safeIdentity(retained ? identity(retained) : undefined),
            model: safeIdentity(finalIdentity),
            requested: safeEffort(requested),
            effective: safeEffort(effective),
            outcome: "classified",
          },
        );
        allowedLaunches.add(event.toolCallId);
        pi.appendEntry("jev-pilot:worker-route", {
          toolCallId: event.toolCallId,
          physical: finalIdentity,
          requested,
          effective,
          outcome: result.outcome,
        });
      } catch (error) {
        if (controller.signal.aborted) return cancelled();
        throw error;
      } finally {
        active.delete(controller);
        ctx.signal?.removeEventListener("abort", cancel);
      }
    } catch (error) {
      finish("decision error · launch unconfirmed");
      throw error;
    }
  });
}
