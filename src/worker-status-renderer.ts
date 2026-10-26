import type { ExtensionAPI, ToolRenderers } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth, type Component } from "@earendil-works/pi-tui";
import type { WorkerStatus } from "./worker-status.ts";

/** Uses Pi's app.tools.expand action, including user-remapped keys; never owns keyboard input. */
export function registerWorkerStatusRenderer(pi: ExtensionAPI, status: WorkerStatus): void {
  pi.registerToolRenderer((name, next): ToolRenderers | undefined => {
    if (name !== "subagent") return next();
    const native = next();
    const launch = (args: unknown) =>
      !(args && typeof args === "object" && "action" in args && args.action);
    const empty: Component = { render: () => [], invalidate() {} };
    return {
      renderShell: "self",
      renderCall(args, theme, context) {
        if (!launch(args)) return native?.renderCall?.(args, theme, context) ?? empty;
        const historical = native?.renderCall?.(args, theme, context);
        return {
          render(width) {
            if (!status.observedTool(context.toolCallId) && context.executionStarted)
              return historical?.render(width) ?? [];
            if (!context.expanded) return [];
            const details = status.details(context.toolCallId);
            return (details.length ? details : ["Worker · awaiting executor"]).map((line) =>
              truncateToWidth(theme.fg("muted", line), width, "…"),
            );
          },
          invalidate() {},
        };
      },
      renderResult(result, options, theme, context) {
        if (!launch(context.args) || !status.observedTool(context.toolCallId))
          return (
            native?.renderResult?.(result, options, theme, context) ??
            new Text(
              result.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n"),
              0,
              0,
            )
          );
        if (!options.expanded) return empty;
        // Preserve native useful result/error body, but never use its text as lifecycle evidence.
        return (
          native?.renderResult?.(result, options, theme, context) ??
          new Text(
            result.content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("\n"),
            0,
            0,
          )
        );
      },
    };
  });
}
