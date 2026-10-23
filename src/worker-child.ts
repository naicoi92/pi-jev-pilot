import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Loaded only by the executor's public required-child-extension contract. */
export default function (pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    pi.events.emit("jev-pilot:execution-child:v1", {
      sessionId: ctx.sessionManager.getSessionId(),
    });
  });
}
