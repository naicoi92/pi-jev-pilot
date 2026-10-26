import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Native proof observer only: delegates every real renderer, never manufactures lifecycle events. */
export default function (pi: ExtensionAPI) {
  const emit = (type: string, data: unknown) =>
    appendFileSync(process.env.JEV_STATUS_EVENTS!, JSON.stringify({ type, data }) + "\n");
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");
  let runId: string | undefined;
  pi.events.on("subagent:worker-decision-accepted", (value: unknown) => {
    if (value && typeof value === "object" && "runId" in value && typeof value.runId === "string")
      runId = value.runId;
  });
  pi.registerCommand("summary-stop", {
    handler: async () => {
      if (!runId) throw new Error("No accepted native run to stop");
      pi.events.emit("subagents:rpc:v1:request", {
        version: 1,
        requestId: crypto.randomUUID(),
        method: "stop",
        params: { id: runId },
      });
    },
  });
  for (const event of [
    "subagent:worker-decision-accepted",
    "subagent:child-status",
    "subagent:async-complete",
    "subagent:foreground-complete",
  ])
    pi.events.on(event, (data) => emit(event, data));
  pi.registerToolRenderer((name, next) => {
    const native = next();
    if (name !== "subagent" || !native) return native;
    return {
      ...native,
      renderCall(args, theme, context) {
        const component = native.renderCall!(args, theme, context);
        let previous = "";
        return {
          render(width) {
            const lines = component.render(width);
            const data = {
              toolCallId: context.toolCallId,
              expanded: context.expanded,
              lines: lines.map((line) => line.replace(ansi, "")),
            };
            const signature = JSON.stringify(data);
            if (signature !== previous) {
              previous = signature;
              emit("worker-render", data);
            }
            return lines;
          },
          invalidate: () => component.invalidate(),
        };
      },
    };
  });
  pi.on("tool_execution_end", (event) => {
    if (event.toolName === "subagent") emit("worker-result", event);
  });
}
