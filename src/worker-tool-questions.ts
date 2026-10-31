import type { WorkerToolMetadata } from "pi-subagents/worker-decision-authority";

/** Keep classifier payload bounded. Tools beyond the cap are allowed unscored (default-allow). */
export const MAX_WORKER_TOOL_QUESTIONS = 32;

export function workerToolQuestions(tools: readonly WorkerToolMetadata[]): Record<string, unknown> {
  return Object.fromEntries(
    tools.map((tool, index) => [
      `tool_${index}`,
      {
        type: "noul",
        instructions: `Is the tool ${tool.name} dangerous or clearly inappropriate for this worker's task and role? Tool description: ${tool.description}`,
      },
    ]),
  );
}
