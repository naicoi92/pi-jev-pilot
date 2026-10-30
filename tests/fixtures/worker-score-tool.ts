import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@earendil-works/pi-ai";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "fixture_score_tool",
    label: "Fixture score tool",
    description: "Find fixture evidence for a worker task.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      appendFileSync(join(ctx.cwd, "fixture-score-tool-invoked"), "called\n");
      return { content: [{ type: "text", text: "fixture selected tool executed" }], details: {} };
    },
  });
}
