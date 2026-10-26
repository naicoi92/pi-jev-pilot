import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import * as dependencyApi from "pi-subagents/worker-decision-authority";

/** Public API observer/control; loaded before executor and Jev, never used in production. */
export default async function (pi: ExtensionAPI) {
  const executorApiPath = process.env.JEV_OWNER_EXECUTOR_API!;
  const executorApi: typeof dependencyApi = await import(pathToFileURL(executorApiPath).href);
  const key = (ctx: ExtensionContext) =>
    ctx.sessionManager.getSessionFile() ?? ctx.sessionManager.getSessionId();
  const log = (phase: string, ctx: ExtensionContext) =>
    appendFileSync(
      process.env.JEV_OWNER_LOG!,
      JSON.stringify({
        phase,
        sessionId: key(ctx),
        uuid: ctx.sessionManager.getSessionId(),
        dependencyPath: import.meta.resolve("pi-subagents/worker-decision-authority"),
        executorApiPath,
        dependency: dependencyApi.getWorkerDecisionAuthoritySnapshot(key(ctx)),
        executor: executorApi.getWorkerDecisionAuthoritySnapshot(key(ctx)),
      }) + "\n",
    );
  pi.on("session_start", (_event, ctx) => {
    // Model the incident's retained, formerly owned session without touching registry internals.
    if (executorApi.getWorkerDecisionAuthoritySnapshot(key(ctx)).kind === "never-owned") {
      executorApi
        .registerWorkerDecisionAuthority({
          sessionId: key(ctx),
          lifetimeDeadline: Number.MAX_SAFE_INTEGER,
          assessmentTimeoutMs: 5000,
          authority: {
            async decide() {
              return { kind: "reject", reason: "assessment-unavailable" };
            },
          },
        })
        .dispose();
    }
  });
  pi.registerCommand("owner-status", { handler: async (_args, ctx) => log("status", ctx) });
  pi.registerCommand("owner-reload", {
    handler: async (_args, ctx) => {
      await ctx.reload();
    },
  });
  pi.registerCommand("owner-missing", {
    handler: async (_args, ctx) => {
      const snapshot = executorApi.getWorkerDecisionAuthoritySnapshot(key(ctx));
      if (snapshot.kind === "active")
        executorApi.invalidateWorkerDecisionAuthority(key(ctx), snapshot.generation);
      log("missing", ctx);
    },
  });
  pi.registerCommand("owner-mismatch", {
    handler: async (_args, ctx) => {
      const sessionId = key(ctx);
      const snapshot = executorApi.getWorkerDecisionAuthoritySnapshot(sessionId);
      if (snapshot.kind === "active")
        executorApi.invalidateWorkerDecisionAuthority(sessionId, snapshot.generation);
      let owner: dependencyApi.WorkerDecisionAuthorityRegistration;
      owner = executorApi.registerWorkerDecisionAuthority({
        sessionId,
        lifetimeDeadline: Number.MAX_SAFE_INTEGER,
        assessmentTimeoutMs: 5000,
        authority: {
          async decide() {
            owner.dispose();
            executorApi.registerWorkerDecisionAuthority({
              sessionId,
              lifetimeDeadline: Number.MAX_SAFE_INTEGER,
              assessmentTimeoutMs: 5000,
              authority: {
                async decide() {
                  return { kind: "reject", reason: "assessment-unavailable" };
                },
              },
            });
            return {
              kind: "apply",
              model: "fixture/fixture-model",
              thinking: "low",
              reason: "assessed",
            };
          },
        },
      });
    },
  });
}
