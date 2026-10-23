import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerAgentViaEvents } from "pi-subagents/agents";
import { crewConfig } from "./crew-config.ts";
// Pinned hooks/crew.ts juniorSpec. Tool names use the equivalent Pi tools.
const definition = {
  description:
    "A junior developer on a cheaper model. Give it one easy, well-specified coding change: the files to change, the exact behavior, and the command that proves it (usually the tests). It implements and reports; review its diff yourself before calling the work done.",
  systemPrompt: [
    "You are the junior developer on a small team. Your lead gives you one well-specified coding task.",
    "Do exactly that: change only what the brief names, follow the existing code style, and run the command the brief gives to prove it (usually the tests).",
    "Don't refactor, rename or add anything that wasn't asked for.",
    "If the brief is unclear, or the task turns out bigger than it says, stop and say so instead of guessing.",
    "When you are done, reply with: what you changed (file by file, one line each), the command you ran and its result, and anything you were unsure about.",
  ].join("\n"),
  tools: ["read", "edit", "write", "grep", "find", "bash"],
  defaultContext: "fresh" as const,
};
/** Registration belongs to the installed executor; absence never breaks main-only startup. */
export function registerCrewJunior(pi: ExtensionAPI): void {
  let registration: { dispose(): void } | undefined;
  let error: string | undefined;
  const clear = () => {
    registration?.dispose();
    registration = undefined;
    error = undefined;
  };
  const ensure = (ctx: ExtensionContext) => {
    const junior = crewConfig(ctx.cwd).junior;
    if (!junior || registration) return;
    try {
      const slash = junior.model.indexOf("/");
      const model = ctx.modelRegistry.find(
        junior.model.slice(0, slash),
        junior.model.slice(slash + 1),
      );
      if (!model || model.api === "pi-virtual")
        throw new Error(
          `Jev junior target ${junior.model} must resolve to an exact physical Pi model.`,
        );
      if (!ctx.modelRegistry.hasConfiguredAuth(model))
        throw new Error(`Configure Pi authentication for Jev junior target ${junior.model}.`);
      registration = registerAgentViaEvents({
        pi,
        name: "jev-pilot:junior",
        definition: { ...definition, model: junior.model },
      });
      error = undefined;
    } catch (cause) {
      error = `Jev junior registration failed: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
  };
  pi.on("session_start", (_event, ctx) => {
    clear();
    ensure(ctx);
  });
  pi.on("session_shutdown", clear);
  pi.on("session_before_switch", clear);
  pi.on("session_before_fork", clear);
  pi.on("tool_call", (event, ctx) => {
    if (event.toolName !== "subagent" || event.input.agent !== "jev-pilot:junior") return;
    ensure(ctx);
    if (error) return { block: true, reason: error };
  });
}
