import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Observes real component renders without replacing state, lifecycle, or authority. */
export default function (pi: ExtensionAPI) {
  const emit = (type: string, data: unknown) =>
    appendFileSync(process.env.JEV_STATUS_EVENTS!, JSON.stringify({ type, data }) + "\n");
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");
  const strip = (text: string) => text.replace(ansi, "");
  pi.on("session_start", (_event, ctx) => {
    const original = ctx.ui.setWidget.bind(ctx.ui);
    ctx.ui.setWidget = (key, value, options) => {
      emit("widget", { key, active: value !== undefined });
      if (typeof value !== "function") return original(key, value, options);
      return original(
        key,
        (tui, theme) => {
          const component = value(tui, theme);
          let previous = "";
          return {
            render(width) {
              const lines = component.render(width);
              const plain = lines.map(strip);
              const signature = JSON.stringify(plain).replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, "SPINNER");
              if (signature !== previous) {
                previous = signature;
                emit("render", { key, width, lines: plain });
              }
              return lines;
            },
            invalidate: () => component.invalidate(),
            dispose: () => component.dispose?.(),
          };
        },
        options,
      );
    };
    emit("ready", { model: ctx.model?.id });
  });
  pi.on("agent_settled", () => emit("settled", {}));
  pi.on("tool_execution_end", (event) => {
    if (event.toolName === "subagent")
      emit("worker-result", { isError: event.isError, result: event.result });
  });
}
