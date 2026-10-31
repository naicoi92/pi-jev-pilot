import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  registerRequiredChildExtensions,
  type RequiredChildExtensionRegistration,
} from "pi-subagents/required-child-extensions";
import { fileURLToPath } from "node:url";
import { loadJevConfig } from "./jev-config.ts";
import { captureEffortAssessment, type EffortAssessment } from "./effort-assessment.ts";
import { registerWorkerAuthorityLifecycle } from "./worker-authority-registration.ts";
import { WorkerVisibility } from "./worker-visibility.ts";
import { appendDecisionRow } from "./decision-visibility.ts";
import type { LiveStatusLine } from "./live-status.ts";
import { WorkerStatus } from "./worker-status.ts";
import { SUBAGENT_WORKER_DECISION_ACCEPTED_EVENT } from "pi-subagents/worker-decision-authority";

function identity(value: string): string {
  return value.replace(/:(off|minimal|low|medium|high|xhigh|max)$/, "");
}
/** Ordinary tool envelopes only; workflow inner launches remain executor-owned. */
export function registerWorkerAdapter(
  pi: ExtensionAPI,
  onWorkersRunning?: (count: number) => void,
  live?: LiveStatusLine,
): void {
  let registered: EffortAssessment | undefined;
  const enabled = () => registered?.config.workerRoutingEnabled ?? false;
  const status = new WorkerStatus((summary) => {
    live?.setWorkerSummary(summary);
    onWorkersRunning?.(summary?.running ?? 0);
  });
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
    registered = captureEffortAssessment();
    visibility.clear();
    visibility.restore(ctx.sessionManager.getBranch());
    childExtension?.dispose();
    childExtension = undefined;
  });
  const authority = registerWorkerAuthorityLifecycle(
    pi,
    () => registered,
    () => live?.assessWorker() ?? (() => {}),
    status,
  );
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
    status.reset();
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
  // Acceptance is logical commitment, never evidence that a child has started.
  pi.events.on(SUBAGENT_WORKER_DECISION_ACCEPTED_EVENT, (event: unknown) => {
    if (!status.accepted(event)) return;
    const { toolCallId, receipt } = event;
    visibility.applied(toolCallId, receipt);
  });
  pi.events.on("subagent:child-status", (event: unknown) => status.child(event));
  pi.events.on("subagent:foreground-complete", (event: unknown) => status.complete(event));
  pi.events.on("subagent:async-complete", (event: unknown) => {
    status.complete(event);
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
    if (event.toolName === "subagent") {
      visibility.result(event.toolCallId, event.details);
      status.result(event.toolCallId, event.details, event.isError);
    }
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
    status.observeTool(event.toolCallId);
    const owner = visibility.start(
      event.toolCallId,
      ctx.ui,
      undefined,
      typeof input.model === "string" ? identity(input.model) : undefined,
    );
    const finish = (message: string) => visibility.finish(owner, message, false);
    try {
      const routing = enabled();
      const helperOptions = routing ? registered?.config : loadJevConfig();
      const automaticMain =
        helperOptions &&
        (helperOptions.effortEnabled ||
          helperOptions.skillsEnabled ||
          helperOptions.qualityEnabled ||
          helperOptions.strategyEnabled ||
          helperOptions.designEnabled);
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
      finish("executor authority · decision pending · launch unconfirmed");
      allowedLaunches.add(event.toolCallId);
    } catch (error) {
      finish("decision error · launch unconfirmed");
      visibility.refuse(owner);
      throw error;
    }
  });
}
