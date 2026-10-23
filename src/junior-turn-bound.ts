import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Pinned hooks/crew.ts juniorSpec declares maxTurns: 40. Pi has no definition field.
const MAX_TURNS = 40;
const ENTRY = "jev-pilot:junior-turns";
const LIMIT_ERROR =
  "Jev junior reached its limit of 40 assistant turns. Start a fresh independent task; this retained run has no turns remaining.";

/** Delivered only by the junior runtime definition, never to the parent or ordinary workers. */
export default function juniorTurnBound(pi: ExtensionAPI): void {
  let used = 0;
  let limited = false;
  let admitted = false;
  let error = LIMIT_ERROR;
  const restore = (ctx: ExtensionContext) => {
    const sessionId = ctx.sessionManager.getSessionId();
    used = 0;
    // All entries, not model context/current branch: compaction/tree must not refund turns.
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type !== "custom" || entry.customType !== ENTRY) continue;
      const data = entry.data as { sessionId?: unknown; used?: unknown } | undefined;
      if (data?.sessionId !== sessionId) continue;
      used = Math.max(
        used,
        Number.isInteger(data.used) && Number(data.used) >= 0 ? Number(data.used) : MAX_TURNS,
      );
    }
    limited = false;
    admitted = false;
    error = LIMIT_ERROR;
  };
  const stop = (ctx: ExtensionContext) => {
    limited = true;
    admitted = false;
    ctx.abort();
  };
  pi.on("session_start", (_event, ctx) => {
    restore(ctx);
    pi.events.emit("subagent:acknowledge-extension", { id: "jev-pilot-junior-turn-bound" });
  });
  pi.on("before_agent_start", (_event, ctx) => {
    restore(ctx);
    if (used >= MAX_TURNS) stop(ctx);
  });
  pi.on("turn_start", (_event, ctx) => {
    if (limited || used >= MAX_TURNS) {
      stop(ctx);
      return;
    }
    // Reserve before generation, including errors/cancellation. A denied synthetic abort
    // is not a new reservation. Tools and HTTP retries are not separate agent turns.
    admitted = true;
    used++;
    try {
      pi.appendEntry(ENTRY, { sessionId: ctx.sessionManager.getSessionId(), used });
    } catch {
      // Extension handler exceptions alone are fail-open in Pi; abort on persistence failure.
      error =
        "Jev junior could not persist its assistant turn budget; stopping this run without further activity.";
      stop(ctx);
    }
  });
  pi.on("tool_call", () => {
    if (!admitted || limited) return { block: true, reason: error };
  });
  pi.on("turn_end", (event, ctx) => {
    admitted = false;
    // Allow a natural final answer at 40. Abort after tools, before Pi's next-turn
    // preparation (which may compact); also prevent error retry after the last turn.
    if (
      used >= MAX_TURNS &&
      event.message.role === "assistant" &&
      event.message.stopReason !== "stop"
    )
      stop(ctx);
  });
  pi.on("cache_warming_decision", () => {
    if (used >= MAX_TURNS || limited) return { action: "stop" };
  });
  pi.on("session_before_compact", (_event, ctx) => {
    if (used >= MAX_TURNS || limited) {
      stop(ctx);
      return { cancel: true };
    }
  });
  pi.on("message_end", (event) => {
    if (
      limited &&
      event.message.role === "assistant" &&
      (event.message.stopReason === "error" || event.message.stopReason === "aborted")
    )
      return { message: { ...event.message, stopReason: "error" as const, errorMessage: error } };
  });
}
