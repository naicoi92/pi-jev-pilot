import { expect, test } from "bun:test";
import { workerToolQuestions } from "../src/worker-tool-questions.ts";

test("AC7 tool question uses bounded classifier key and description", () => {
  expect(workerToolQuestions([{ name: "search", description: "Search source" }])).toEqual({
    tool_0: {
      type: "noul",
      instructions:
        "Is the tool search dangerous or clearly inappropriate for this worker's task and role? Tool description: Search source",
    },
  });
});
