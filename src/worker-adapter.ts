import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  registerRequiredChildExtensions,
  type RequiredChildExtensionRegistration,
} from "pi-subagents/required-child-extensions";
import { fileURLToPath } from "node:url";
import { effortEnabled } from "./system-one.ts";
import { guidanceEnabled } from "./guidance-policy.ts";
import { registerWorkerAuthorityLifecycle } from "./worker-authority-registration.ts";
import { WorkerVisibility } from "./worker-visibility.ts";
import { configuredTiers } from "./routing-settings.ts";
import { crewConfig } from "./crew-config.ts";
import { appendDecisionRow } from "./decision-visibility.ts";

function enabled(): boolean {
  const value = process.env.JEV_WORKER_ROUTING_ENABLED ?? "true";
  if (value !== "true" && value !== "false")
    throw new Error("JEV_WORKER_ROUTING_ENABLED must be true or false.");
  return value === "true";
}
function identity(value: string): string {
  return value.replace(/:(off|minimal|low|medium|high|xhigh|max)$/, "");
}
/** Ordinary tool envelopes only; workflow inner launches remain executor-owned. */
export function registerWorkerAdapter(
  pi: ExtensionAPI,
  onWorkersRunning?: (count: number) => void,
): void {
  const visibility = new WorkerVisibility((row) => appendDecisionRow(pi, row), onWorkersRunning);
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
    childExtension?.dispose();
    childExtension = undefined;
  });
  const authority = registerWorkerAuthorityLifecycle(pi, enabled);
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
    visibility.settle();
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
    const finish = (message: string) => visibility.finish(owner, message, false);
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
      authority.assertReady(ctx);
      if (
        input.context === "fork" ||
        (input.options as Record<string, unknown> | undefined)?.context === "fork"
      ) {
        finish("executor-owned · fork model + effort");
        return;
      }
      configuredTiers(pi.getSettings());
      for (const slot of crewConfig(ctx.cwd).offered) {
        const slash = slot.model.indexOf("/");
        const model = ctx.modelRegistry.find(
          slot.model.slice(0, slash),
          slot.model.slice(slash + 1),
        );
        if (!model || model.api === "pi-virtual")
          throw new Error(
            `Jev worker target ${slot.model} must resolve to an exact physical Pi model.`,
          );
        if (!ctx.modelRegistry.hasConfiguredAuth(model))
          throw new Error(`Configure Pi authentication for Jev worker target ${slot.model}.`);
      }
      finish("executor authority · decision pending · launch unconfirmed");
      allowedLaunches.add(event.toolCallId);
    } catch (error) {
      finish("decision error · launch unconfirmed");
      visibility.refuse(owner);
      throw error;
    }
  });
}
