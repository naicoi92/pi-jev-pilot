import { appendFileSync } from "node:fs";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Disposable official-host composition observer. Never reads host internals. */
export default function (pi: ExtensionAPI) {
  let foreign: ReturnType<ExtensionContext["modelRegistry"]["find"]>;
  let other: typeof foreign;
  let physical: string | undefined;
  const log = (phase: string, ctx: ExtensionContext) => {
    const current = ctx.modelRegistry.find("jev", "auto");
    appendFileSync(
      process.env.JEV_OWNERSHIP_LOG!,
      JSON.stringify({
        phase,
        name: current?.name,
        foreignSame: !!foreign && current === foreign,
        otherSame: !!other && ctx.modelRegistry.find("jev", "other") === other,
        physicalSame:
          !!physical &&
          JSON.stringify(ctx.modelRegistry.find("fixture", "fixture-model")) === physical,
      }) + "\n",
    );
  };
  const replace = (ctx: ExtensionContext) => {
    const input: ("text" | "image")[] = ["text"];
    pi.registerVirtualModel({
      provider: "jev",
      id: "auto",
      name: "Foreign Auto",
      input,
      route: () => ({
        model: ctx.modelRegistry.find("fixture", "fixture-model")!,
        thinkingLevel: "medium",
      }),
    });
    pi.registerVirtualModel({
      provider: "jev",
      id: "other",
      name: "Foreign Other",
      route: () => ({
        model: ctx.modelRegistry.find("fixture", "fixture-model")!,
        thinkingLevel: "medium",
      }),
    });
    foreign = ctx.modelRegistry.find("jev", "auto");
    if (foreign?.input !== input) throw new Error("Official Pi input identity seam changed");
    other = ctx.modelRegistry.find("jev", "other");
    physical = JSON.stringify(ctx.modelRegistry.find("fixture", "fixture-model"));
  };
  pi.on("session_start", (_event, ctx) => {
    if (process.env.JEV_OWNERSHIP_BEFORE === "true" && !ctx.modelRegistry.find("jev", "auto"))
      replace(ctx);
    log("start", ctx);
  });
  pi.on("session_shutdown", (_event, ctx) => log("shutdown", ctx));
  pi.registerCommand("ownership-replace", {
    handler: async (_args, ctx) => {
      replace(ctx);
      await ctx.modelRegistry.refresh({ allowNetwork: false });
      log("refresh", ctx);
    },
  });
  pi.registerCommand("ownership-reload", {
    handler: async (_args, ctx) => {
      await ctx.reload();
    },
  });
}
