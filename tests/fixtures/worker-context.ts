import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Refresh fixture-owned public model metadata before native dispatch. */
export default function (pi: ExtensionAPI) {
  pi.registerCommand("fixture-crew", {
    handler: async () => {
      process.env.JEV_CREW_CONFIG = "crew.json";
    },
  });
  pi.registerCommand("fixture-model-refresh", {
    handler: async (_args, ctx) => {
      await ctx.modelRegistry.refresh();
    },
  });
}
