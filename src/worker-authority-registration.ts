import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  registerWorkerDecisionAuthority,
  WorkerDecisionAuthorityError,
  type WorkerDecisionAuthorityRegistration,
} from "pi-subagents/worker-decision-authority";
import { createWorkerAuthority } from "./worker-authority.ts";
import { configuredTiers } from "./routing-settings.ts";
import { crewConfig } from "./crew-config.ts";
import { effectiveTunables } from "./tuning.ts";
import type { WorkerStatus } from "./worker-status.ts";

const sessionKey = (ctx: ExtensionContext) =>
  ctx.sessionManager.getSessionFile() ?? ctx.sessionManager.getSessionId();

/** Registration belongs to this extension instance; never invalidate a cleanup-time current owner. */
export function registerWorkerAuthorityLifecycle(
  pi: ExtensionAPI,
  enabled: () => boolean,
  assess?: () => () => void,
  status?: WorkerStatus,
) {
  let registration: WorkerDecisionAuthorityRegistration | undefined;
  let sessionId: string | undefined;
  let failed = false;
  const assessments = new Set<AbortController>();
  const cancel = () => {
    for (const controller of assessments) controller.abort();
  };
  const dispose = () => {
    cancel();
    const captured = registration;
    registration = undefined;
    sessionId = undefined;
    captured?.dispose();
    status?.attach();
  };
  pi.on("session_start", (_event, ctx) => {
    dispose();
    failed = true;
    if (!enabled()) {
      failed = false;
      return;
    }
    sessionId = sessionKey(ctx);
    registration = registerWorkerDecisionAuthority({
      sessionId,
      // Public host exposes no session expiry. Launch timeout remains independently executor-owned.
      lifetimeDeadline: Number.MAX_SAFE_INTEGER,
      assessmentTimeoutMs: effectiveTunables().timeoutMs,
      authority: {
        async decide(request, context) {
          const controller = new AbortController();
          const abort = () => controller.abort();
          context.signal.addEventListener("abort", abort, { once: true });
          if (context.signal.aborted) abort();
          assessments.add(controller);
          const presentation = controller.signal.aborted ? undefined : status?.assessing(request);
          const finishAssessment = controller.signal.aborted ? undefined : assess?.();
          controller.signal.addEventListener("abort", () => finishAssessment?.(), { once: true });
          try {
            const result = await createWorkerAuthority({
              tiers: configuredTiers(pi.getSettings()),
              crew: crewConfig(ctx.cwd),
              warn: (message) => ctx.ui.notify(message, "warning"),
              configurationError: (message) => ctx.ui.notify(message, "error"),
              selectedTier: (tier) => status?.tier(presentation, tier),
            }).decide(request, { ...context, signal: controller.signal });
            if (controller.signal.aborted) throw new WorkerDecisionAuthorityError("cancelled");
            return result;
          } catch (error) {
            if (controller.signal.aborted) throw new WorkerDecisionAuthorityError("cancelled");
            throw error;
          } finally {
            finishAssessment?.();
            assessments.delete(controller);
            context.signal.removeEventListener("abort", abort);
          }
        },
        onApplied(receipt) {
          status?.applied(receipt);
        },
      },
    });
    status?.attach(sessionId, registration.generation);
    failed = false;
  });
  // Before-navigation events can be cancelled. Actual session_start disposes prior session;
  // shutdown covers reload even when executor never observed this registration.
  pi.on("session_shutdown", dispose);
  pi.on("model_select", cancel);
  pi.on("thinking_level_select", cancel);
  pi.on("session_before_switch", cancel);
  pi.on("session_before_fork", cancel);
  pi.on("session_before_tree", cancel);
  pi.on("session_before_compact", cancel);
  return {
    assertReady(ctx: ExtensionContext) {
      if (failed)
        throw new Error(
          "Jev worker authority registration failed; no legacy fallback is authorized.",
        );
      if (!registration)
        throw new Error(
          "Jev worker authority owner unavailable; no legacy fallback is authorized.",
        );
      if (sessionId !== sessionKey(ctx))
        throw new Error("Jev worker authority session mismatch; no child launched.");
      // Missing/replaced registry owners remain executor failures, never legacy-classification permission.
    },
  };
}
