import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Disposable test barrier before Jev outer admission, not a configuration transport. */
export default function (pi: ExtensionAPI) {
  pi.registerCommand("worker-config-reload", {
    handler: async (_args, ctx) => {
      await ctx.reload();
    },
  });
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "subagent" || !existsSync(join(ctx.cwd, "hold-worker"))) return;
    writeFileSync(join(ctx.cwd, "worker-held"), "ready");
    const deadline = Date.now() + 10000;
    while (existsSync(join(ctx.cwd, "hold-worker"))) {
      if (Date.now() >= deadline) throw new Error("Worker fixture barrier timed out.");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  });
}
