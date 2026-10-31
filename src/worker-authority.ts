import { applyAgentToolPolicy } from "./worker-tool-policy.ts";
import type { WorkerToolCounts } from "./worker-tool-counts.ts";
import type {
  ThinkingLevel,
  WorkerDecision,
  WorkerDecisionAuthority,
  WorkerDecisionBaseline,
} from "pi-subagents/worker-decision-authority";
import { classify, systemOneConfig, WORKER_EFFORT_QUESTION } from "./system-one.ts";
import { effortScore, selectEffort } from "./effort-policy.ts";
import type { EffortRead } from "./decision-visibility.ts";
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
function boundedToolWarning(message: string): string {
  let result = "";
  let bytes = 0;
  for (const char of message) {
    const code = char.codePointAt(0)!;
    const safeChar =
      code < 32 || (code >= 127 && code <= 159) || code === 0x2028 || code === 0x2029 ? " " : char;
    const size = Buffer.byteLength(safeChar, "utf8");
    if (bytes + size > 512) break;
    result += safeChar;
    bytes += size;
  }
  return result;
}

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
  /** Counts only: scored candidates split by threshold. Never tool identities or paths. */
  toolsScored?(counts: WorkerToolCounts): void;
  /** What the decision model said about effort, numbers only. Never task text. */
  effortRead?(read: EffortRead): void;
}): WorkerDecisionAuthority {
  return {
    async decide(request, context) {
      const toolWarnings: string[] = [];
      const warnTool = (message: string) => {
        const safeMessage = boundedToolWarning(message);
        options.warn(safeMessage);
        if (safeMessage && toolWarnings.length < 32) toolWarnings.push(safeMessage);
      };
      const decide = async (): Promise<WorkerDecision> => {
        const assessment = options.assessment;
        const { original, modelContract } = request.policyContext;
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
        const enabled = assessment.config.workerToolSelectionEnabled;
        const toolSelectionSupported = request.facts.toolSelection === "supported";
        if (enabled && request.facts.toolsIncomplete)
          warnTool("Worker tool inventory is incomplete.");
        if (enabled && !toolSelectionSupported && request.facts.tools?.length) {
          warnTool("Worker tool selection is unavailable for this launch.");
        }
        const inventory = enabled && toolSelectionSupported ? (request.facts.tools ?? []) : [];
        // The agent file is the contract: excludeTools always withholds, tools always grants.
        const policy = applyAgentToolPolicy(inventory, request.facts.agent);
        const eligible = (tool: (typeof inventory)[number]) =>
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
          ].includes(tool.name);
        const declaredGrants = policy.declared.filter(eligible);
        const candidates = policy.open.filter(
          (tool) => eligible(tool) && !assessment.config.workerInteractiveTools.includes(tool.name),
        );
        if (candidates.length > MAX_WORKER_TOOL_QUESTIONS)
          warnTool("Worker tool inventory exceeds the scoring limit; unscored tools stay allowed.");
        // Default-allow: every eligible tool is granted unless scored dangerous. Tools past
        // the question cap are not scored and therefore stay allowed.
        const offeredTools = candidates.slice(0, MAX_WORKER_TOOL_QUESTIONS);
        const unscoredTools = candidates.slice(MAX_WORKER_TOOL_QUESTIONS);
        if (fixedBaseline && !offeredTools.length) return retain(fixedBaseline);
        let config;
        try {
          config = systemOneConfig(assessment);
        } catch (error) {
          options.configurationError(error instanceof Error ? error.message : String(error));
          return fork ? retain(original) : { kind: "reject", reason: "assessment-unavailable" };
        }
        const result = await classify(
          { ...config, timeoutMs: Math.min(config.timeoutMs, remaining) },
          {
            prompt: request.facts.task.slice(0, 2000),
            agentType: agent.slice(0, 128),
            ...(request.facts.agent ? { agent: request.facts.agent } : {}),
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
        if (!answers && offeredTools.length) warnTool("Worker tool scores unavailable.");
        const identity = (tool: (typeof candidates)[number]) => ({
          name: tool.name,
          ...(tool.namespace ? { namespace: tool.namespace } : {}),
          sourcePath: tool.sourcePath,
        });
        let invalid = 0;
        let danger = 0;
        const scoredAllowed = offeredTools.flatMap((tool, index) => {
          if (!answers) return [];
          const score = answers?.[`tool_${index}`]?.noul;
          if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
            warnTool(`Worker tool score unavailable: ${tool.name}.`);
            invalid++;
            return [];
          }
          if (score >= assessment.config.workerToolRejectThreshold) {
            danger++;
            return [];
          }
          return [identity(tool)];
        });
        const selectedTools = answers
          ? [...declaredGrants.map(identity), ...scoredAllowed, ...unscoredTools.map(identity)]
          : declaredGrants.map(identity);
        if (offeredTools.length && answers)
          options.toolsScored?.({
            selected: selectedTools.length,
            rejected: inventory.length - selectedTools.length,
            reasons: {
              danger,
              invalid,
              ineligible: inventory.length - selectedTools.length - danger - invalid,
            },
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
        if (decision && options.effortRead) {
          const level = effortScore(decision, assessment.tuning.effortCloseMargin);
          const raw = decision.effortProbabilities;
          const probabilities = raw
            ? [0, 1, 2, 3, 4].map((index) => Number(raw[String(index)] ?? 0))
            : null;
          options.effortRead({
            level,
            confidence: decision.effortConfidence,
            risky: decision.risky,
            probabilities,
          });
        }
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
            ? selectWorkerModel(tierDecision, options.tiers, options.crew.offered, (tier) => {
                selectedTier = tier;
              })
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
          : (supported
              .filter((level) => LEVELS.indexOf(level) <= LEVELS.indexOf(requested))
              .at(-1) ?? supported[0]);
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
      };
      const decision = await decide();
      return decision.kind === "apply" && toolWarnings.length
        ? { ...decision, toolWarnings }
        : decision;
    },
  };
}
