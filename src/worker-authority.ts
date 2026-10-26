import type {
  ThinkingLevel,
  WorkerDecision,
  WorkerDecisionAuthority,
  WorkerDecisionBaseline,
} from "pi-subagents/worker-decision-authority";
import { classify, systemOneConfig, WORKER_EFFORT_QUESTION } from "./system-one.ts";
import { selectEffort } from "./effort-policy.ts";
import { effectiveTunables } from "./tuning.ts";
import { selectsSlot, selectWorkerModel } from "./crew-policy.ts";
import { cascadeTiers } from "./tier-fallback.ts";
import { TIER_ORDER, type Tiers } from "./tier-policy.ts";
import type { Crew } from "./crew-config.ts";

const LEVELS: readonly ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];
const retain = (baseline: WorkerDecisionBaseline): WorkerDecision =>
  baseline.kind === "verified"
    ? {
        kind: "apply",
        model: baseline.model,
        thinking: baseline.thinking,
        reason: "verified-original-retained",
      }
    : { kind: "reject", reason: "baseline-unresolved" };

/** Executor facts feed assessment; host target evidence, never SDK guesses, binds the final pair. */
export function createWorkerAuthority(options: {
  tiers: Tiers;
  crew: Crew;
  warn(message: string): void;
  configurationError(message: string): void;
}): WorkerDecisionAuthority {
  return {
    async decide(request, context) {
      const { original, modelContract } = request.policyContext;
      // Existing fork policy is executor-owned: retain only its verified effective pair.
      if (request.control.context !== "fresh") return retain(original);
      const agent =
        request.facts.role?.provenance === "resolved-agent" ? request.facts.role.name : undefined;
      if (!agent) return { kind: "reject", reason: "assessment-unavailable" };
      const remaining = context.assessmentCutoff - Date.now();
      if (!context.assessmentAvailable || remaining <= 0) return retain(original);
      for (const slot of options.crew.offered) {
        if ((await context.resolveTarget(slot.model)).kind === "unresolved")
          return { kind: "reject", reason: "target-unavailable" };
      }
      const specializedRole =
        agent === "jev-pilot:junior" ||
        ["jev-pilot:codex-review", "jev-pilot:opencode-review"].includes(agent);
      const specialized =
        agent === "jev-pilot:junior"
          ? (options.crew.junior?.model ?? options.tiers.balanced)
          : ["jev-pilot:codex-review", "jev-pilot:opencode-review"].includes(agent)
            ? options.tiers.fast
            : undefined;
      if (specializedRole && !specialized) return retain(original);
      let result;
      if (!specialized) {
        let config;
        try {
          config = systemOneConfig();
        } catch (error) {
          options.configurationError(error instanceof Error ? error.message : String(error));
          return { kind: "reject", reason: "assessment-unavailable" };
        }
        result = await classify(
          { ...config, timeoutMs: Math.min(config.timeoutMs, remaining) },
          {
            prompt: request.facts.task.slice(0, 2000),
            agentType: agent.slice(0, 128),
            ...(request.facts.role
              ? { description: request.facts.role.description.slice(0, 512) }
              : {}),
          },
          context.signal,
          {
            tier: Object.values(options.tiers).some(Boolean) || options.crew.offered.length > 0,
            effort: true,
            tiers: TIER_ORDER.filter((tier) => options.tiers[tier]),
            slots: options.crew.offered,
          },
          { effort: WORKER_EFFORT_QUESTION },
        );
        if (result.outcome !== "classified") return retain(original);
      }
      const decision = result?.decision;
      const tierDecision = decision?.tier
        ? {
            tier: decision.tier,
            slot: decision.slot,
            confidence: decision.confidence ?? null,
            risky: decision.risky,
            expertNeeded: decision.expertNeeded ?? null,
          }
        : undefined;
      const chosen =
        specialized ??
        (tierDecision
          ? selectWorkerModel(
              tierDecision,
              original.kind === "verified" ? original.model : "",
              options.tiers,
              options.crew.offered,
            )
          : null);
      const cascade =
        chosen && !specialized && tierDecision && !selectsSlot(tierDecision, options.tiers)
          ? await cascadeTiers(options.tiers, chosen, async (model) => {
              const target = await context.resolveTarget(model);
              return target.kind === "unresolved" ? target.reason : undefined;
            })
          : undefined;
      if (cascade?.failures.length)
        options.warn(
          [
            ...cascade.failures.map(
              ({ tier, setting, reason }) =>
                `Jev tier ${tier} (${setting}) cannot run: ${options.tiers[tier]} · ${reason}`,
            ),
            cascade.fallbackTier
              ? `Falling back to tier ${cascade.fallbackTier} (jevPilot.tiers.${cascade.fallbackTier}) at its highest supported effort.`
              : "No configured tier can run; keeping the retained worker model.",
          ].join("\n"),
        );
      const selected =
        modelContract.kind === "fixed"
          ? modelContract.model
          : ((cascade ? cascade.model : chosen) ??
            (original.kind === "verified" ? original.model : undefined));
      if (!selected) return { kind: "reject", reason: "baseline-unresolved" };
      const target = await context.resolveTarget(selected);
      if (target.kind === "unresolved") return { kind: "reject", reason: target.reason };
      const supported = LEVELS.filter((level) => target.supportedThinking.includes(level));
      const requested = cascade?.fallbackTier
        ? supported.at(-1)
        : decision
          ? selectEffort(decision, "", request.facts.task, effectiveTunables())
          : undefined;
      if (!requested) {
        const baseline = specialized ? target.baseline : original;
        return retain(baseline);
      }
      const thinking = supported.includes(requested)
        ? requested
        : (supported.filter((level) => LEVELS.indexOf(level) <= LEVELS.indexOf(requested)).at(-1) ??
          supported[0]);
      if (!thinking) return { kind: "reject", reason: "target-unavailable" };
      return {
        kind: "apply",
        model: selected,
        thinking,
        requestedThinking: requested,
        reason: "assessed",
      };
    },
  };
}
