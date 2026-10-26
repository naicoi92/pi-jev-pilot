import {
  prepareWorkerDecision,
  getWorkerDecisionAuthoritySnapshot,
  type ThinkingLevel,
} from "pi-subagents/worker-decision-authority";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Public executor preparation seam with trusted model/admission evidence supplied by fixture. */
export async function prepareFixtureWorker(
  ctx: ExtensionContext,
  input: Record<string, unknown>,
  context = "fresh",
) {
  const sessionId = ctx.sessionManager.getSessionFile() ?? ctx.sessionManager.getSessionId();
  const owner = getWorkerDecisionAuthoritySnapshot(sessionId);
  const modelString = typeof input.model === "string" ? input.model : "local/fast";
  const model = modelString.replace(/:(off|minimal|low|medium|high|xhigh|max)$/, "");
  const thinking = (modelString.match(/:(off|minimal|low|medium|high|xhigh|max)$/)?.[1] ??
    "high") as ThinkingLevel;
  const revisions = {
    definitionRevision: "fixture-definition",
    constraintRevision: "fixture-constraints",
  };
  const levels = (target: string): ThinkingLevel[] => {
    const found = ctx.modelRegistry
      .getAvailable()
      .find((entry) => `${entry.provider}/${entry.id}` === target);
    if (!found || !ctx.modelRegistry.hasConfiguredAuth(found)) return [];
    return found.reasoning === false
      ? ["off"]
      : (["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const).filter(
          (level) =>
            found.thinkingLevelMap?.[level] !== undefined && found.thinkingLevelMap[level] !== null,
        );
  };
  const baseline = (target: string) =>
    levels(target).includes(thinking)
      ? {
          kind: "verified" as const,
          model: target,
          thinking,
          provenance: "host-effective" as const,
          ...revisions,
        }
      : { kind: "unresolved" as const, reason: "thinking-unresolved" as const };
  return prepareWorkerDecision({
    sessionId,
    control: {
      logicalLaunchId: crypto.randomUUID(),
      runtimeAttemptId: crypto.randomUUID(),
      ownerGeneration: owner.kind === "active" ? owner.generation : undefined,
      context: (input.context ??
        (input.options as Record<string, unknown> | undefined)?.context ??
        context) as "fresh" | "fork",
      launchDeadline: Date.now() + 10000,
    },
    facts: {
      task: String(input.task),
      role: { name: String(input.agent), description: "Unit worker", provenance: "resolved-agent" },
    },
    policyContext: {
      ...revisions,
      modelContract: {
        kind: "selectable",
        models: ctx.modelRegistry.getAvailable().map((entry) => `${entry.provider}/${entry.id}`),
      },
      original: baseline(model),
    },
    classifierTimeoutMs: 5000,
    signal: ctx.signal,
    host: {
      getCurrentRevisions: () => revisions,
      async resolveTarget(target) {
        const supportedThinking = levels(target);
        return supportedThinking.length
          ? {
              kind: "resolved",
              model: target,
              supportedThinking,
              baseline: baseline(target),
              ...revisions,
            }
          : { kind: "unresolved", reason: "target-unavailable" };
      },
      async validate(pair) {
        return levels(pair.model).includes(pair.thinking)
          ? { kind: "valid" }
          : { kind: "blocked", reason: "target-unavailable" };
      },
    },
  });
}
