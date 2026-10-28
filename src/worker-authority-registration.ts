import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  registerWorkerDecisionAuthority,
  WorkerDecisionAuthorityError,
  type WorkerDecisionAuthorityRegistration,
} from "pi-subagents/worker-decision-authority";
import { createWorkerAuthority } from "./worker-authority.ts";
import { assertRegisteredJunior } from "./crew-junior.ts";
import { captureEffortAssessment, type EffortAssessment } from "./effort-assessment.ts";
import type { WorkerStatus } from "./worker-status.ts";

const sessionKey = (ctx: ExtensionContext) =>
  ctx.sessionManager.getSessionFile() ?? ctx.sessionManager.getSessionId();

/** Registration belongs to this extension instance; never invalidate a cleanup-time current owner. */
export function registerWorkerAuthorityLifecycle(
  pi: ExtensionAPI,
  registered: () => EffortAssessment | undefined,
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
    const snapshot = registered();
    if (!snapshot?.config.workerRoutingEnabled) {
      failed = false;
      return;
    }
    sessionId = sessionKey(ctx);
    registration = registerWorkerDecisionAuthority({
      sessionId,
      // Public host exposes no session expiry. Launch timeout remains independently executor-owned.
      lifetimeDeadline: Number.MAX_SAFE_INTEGER,
      assessmentTimeoutMs: snapshot.tuning.timeoutMs,
      authority: {
        async decide(request, context) {
          const assessment = (() => {
            try {
              return captureEffortAssessment(snapshot.tuning.timeoutMs);
            } catch (error) {
              ctx.ui.notify(
                error instanceof Error ? error.message : "Invalid Jev worker configuration.",
                "error",
              );
              throw error;
            }
          })();
          const crew = {
            ...assessment.config.crew,
            slots: [...assessment.config.crew.slots],
            offered: [...assessment.config.crew.offered],
          };
          assertRegisteredJunior(pi, crew, (message) => ctx.ui.notify(message, "warning"));
          for (const slot of crew.offered) {
            const slash = slot.model.indexOf("/");
            const model = ctx.modelRegistry.find(
              slot.model.slice(0, slash),
              slot.model.slice(slash + 1),
            );
            const error =
              !model || model.api === "pi-virtual"
                ? "Jev worker slot must resolve to an exact physical Pi model."
                : !ctx.modelRegistry.hasConfiguredAuth(model)
                  ? "Configure Pi authentication for Jev worker slot."
                  : undefined;
            if (error) {
              ctx.ui.notify(error, "error");
              throw new Error(error);
            }
          }
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
              assessment,
              tiers: assessment.config.tiers,
              crew,
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
