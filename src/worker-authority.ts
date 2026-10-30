import type {
  ThinkingLevel,
  WorkerDecision,
  WorkerDecisionAuthority,
  WorkerDecisionBaseline,
} from "pi-subagents/worker-decision-authority";
import { classify, systemOneConfig, WORKER_EFFORT_QUESTION } from "./system-one.ts";
import { selectEffort } from "./effort-policy.ts";
import { type EffortAssessment } from "./effort-assessment.ts";
import { selectsSlot, selectWorkerModel } from "./crew-policy.ts";
import { cascadeTiers } from "./tier-fallback.ts";
import { TIER_ORDER, type Tiers, type Tier } from "./tier-policy.ts";
import type { Crew } from "./crew-config.ts";
import { isAbsolute } from "node:path";
import { MAX_WORKER_TOOL_QUESTIONS, workerToolQuestions } from "./worker-tool-questions.ts";

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
  assessment: EffortAssessment;
  tiers: Tiers;
  crew: Crew;
  warn(message: string): void;
  configurationError(message: string): void;
  selectedTier?(tier: Tier): void;
}): WorkerDecisionAuthority {
  let warnedUnsupported = false;
  return {
    async decide(request, context) {
      const assessment = options.assessment;
      const { original, modelContract, comparison } = request.policyContext;
      const fork = request.control.context !== "fresh";
      const agent =
        request.facts.role?.provenance === "resolved-agent" ? request.facts.role.name : undefined;
      if (!agent)
        return fork ? retain(original) : { kind: "reject", reason: "assessment-unavailable" };
      const remaining = context.assessmentCutoff - Date.now();
      if (!context.assessmentAvailable || remaining <= 0) return retain(original);
      for (const slot of fork ? [] : options.crew.offered) {
        if ((await context.resolveTarget(slot.model)).kind === "unresolved")
          return { kind: "reject", reason: "target-unavailable" };
      }
      const specializedRole =
        !fork &&
        (agent === "jev-pilot:junior" ||
          ["jev-pilot:codex-review", "jev-pilot:opencode-review"].includes(agent));
      const specialized =
        !fork && agent === "jev-pilot:junior"
          ? (options.crew.junior?.model ?? options.tiers.balanced)
          : !fork && ["jev-pilot:codex-review", "jev-pilot:opencode-review"].includes(agent)
            ? options.tiers.fast
            : undefined;
      if (specializedRole && !specialized) return retain(original);
      const specializedTarget = specialized
        ? await context.resolveTarget(
            modelContract.kind === "fixed" ? modelContract.model : specialized,
          )
        : undefined;
      if (specializedTarget?.kind === "unresolved")
        return { kind: "reject", reason: specializedTarget.reason };
      const fixedBaseline = fork
        ? original
        : specializedTarget?.kind === "resolved" && specializedTarget.baseline.kind === "verified"
          ? specializedTarget.baseline
          : undefined;
      if (fixedBaseline && !assessment.config.workerToolSelectionEnabled)
        return retain(fixedBaseline);
      let config;
      try {
        config = systemOneConfig(assessment);
      } catch (error) {
        options.configurationError(error instanceof Error ? error.message : String(error));
        return fork ? retain(original) : { kind: "reject", reason: "assessment-unavailable" };
      }
      const enabled = assessment.config.workerToolSelectionEnabled;
      const toolSelectionSupported = request.facts.toolSelection === "supported";
      if (enabled && request.facts.toolsIncomplete)
        options.warn("Worker tool inventory is incomplete.");
      if (enabled && !toolSelectionSupported && request.facts.tools?.length && !warnedUnsupported) {
        warnedUnsupported = true;
        options.warn("Worker tool selection is unavailable for this launch.");
      }
      const candidates =
        enabled && toolSelectionSupported
          ? (request.facts.tools ?? []).filter(
              (tool) =>
                !!tool.sourcePath &&
                isAbsolute(tool.sourcePath) &&
                !request.facts.callerTools?.includes(tool.name) &&
                !tool.name.startsWith("mcp__") &&
                ![
                  "list_mcp_resources",
                  "list_mcp_resource_templates",
                  "read_mcp_resource",
                  "codemode",
                  "models",
                ].includes(tool.name),
            )
          : [];
      if (candidates.length > MAX_WORKER_TOOL_QUESTIONS)
        options.warn("Worker tool inventory exceeds the scoring limit.");
      const offeredTools = candidates.slice(0, MAX_WORKER_TOOL_QUESTIONS);
      if (fixedBaseline && !offeredTools.length) return retain(fixedBaseline);
      const result = await classify(
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
          tier:
            !specialized &&
            (Object.values(options.tiers).some(Boolean) || options.crew.offered.length > 0),
          effort: true,
          tiers: specialized ? [] : TIER_ORDER.filter((tier) => options.tiers[tier]),
          slots: specialized ? [] : options.crew.offered,
        },
        { effort: WORKER_EFFORT_QUESTION, ...workerToolQuestions(offeredTools) },
      );
      const answers =
        result.value && typeof result.value === "object" && "answers" in result.value
          ? (result.value as { answers?: Record<string, { noul?: unknown }> }).answers
          : undefined;
      if (!answers && offeredTools.length) options.warn("Worker tool scores unavailable.");
      const selectedTools = offeredTools.flatMap((tool, index) => {
        if (!answers) return [];
        const score = answers?.[`tool_${index}`]?.noul;
        if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
          options.warn(`Worker tool score unavailable: ${tool.name}.`);
          return [];
        }
        return score >= assessment.config.workerToolThreshold
          ? [
              {
                name: tool.name,
                ...(tool.namespace ? { namespace: tool.namespace } : {}),
                sourcePath: tool.sourcePath,
              },
            ]
          : [];
      });
      if (fixedBaseline || result.outcome !== "classified") {
        const baseline = retain(
          fixedBaseline ??
            (specializedTarget?.kind === "resolved" ? specializedTarget.baseline : original),
        );
        return baseline.kind === "apply" && selectedTools.length
          ? { ...baseline, selectedTools }
          : baseline;
      }
      const decision = result.decision;
      const tierDecision = decision?.tier
        ? {
            tier: decision.tier,
            slot: decision.slot,
            confidence: decision.confidence ?? null,
            risky: decision.risky,
            expertNeeded: decision.expertNeeded ?? null,
          }
        : undefined;
      let selectedTier: Tier | undefined;
      const chosen =
        specialized ??
        (tierDecision
          ? selectWorkerModel(
              tierDecision,
              comparison.kind === "resolved" ? comparison.model : "",
              options.tiers,
              options.crew.offered,
              (tier) => {
                selectedTier = tier;
              },
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
              ? `Falling back to tier ${cascade.fallbackTier} (jev-pilot.json tiers.${cascade.fallbackTier}) at its highest supported effort.`
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
          ? selectEffort(decision, "", request.facts.task, assessment.tuning)
          : undefined;
      if (!requested) {
        const baseline = specialized ? target.baseline : original;
        const retained = retain(baseline);
        return retained.kind === "apply" && selectedTools.length
          ? { ...retained, selectedTools }
          : retained;
      }
      const thinking = supported.includes(requested)
        ? requested
        : (supported.filter((level) => LEVELS.indexOf(level) <= LEVELS.indexOf(requested)).at(-1) ??
          supported[0]);
      if (!thinking) return { kind: "reject", reason: "target-unavailable" };
      // Metadata only when tier policy selected this exact target; retained/slot/fixed pairs have no tier.
      const actualTier = cascade?.fallbackTier ?? selectedTier;
      if (modelContract.kind !== "fixed" && actualTier && options.tiers[actualTier] === selected)
        options.selectedTier?.(actualTier);
      return {
        kind: "apply",
        model: selected,
        thinking,
        requestedThinking: requested,
        reason: "assessed",
        ...(selectedTools.length ? { selectedTools } : {}),
      };
    },
  };
}
