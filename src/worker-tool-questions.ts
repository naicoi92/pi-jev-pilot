import type { WorkerToolMetadata } from "pi-subagents/worker-decision-authority";

/** Keep classifier payload bounded when a session exposes a large registry. */
export const MAX_WORKER_TOOL_QUESTIONS = 32;

export function workerToolQuestions(tools: readonly WorkerToolMetadata[]): Record<string, unknown> {
  return Object.fromEntries(
    tools.map((tool, index) => [
      `tool_${index}`,
      {
        type: "noul",
        instructions: `Is the tool ${tool.name} appropriate for the worker's task and role? Tool description: ${tool.description}`,
      },
    ]),
  );
}
