import { expect, test } from "bun:test";
import { selectEffort } from "../src/effort-policy.ts";
import { classify, WORKER_EFFORT_QUESTION } from "../src/system-one.ts";

// AE-4: neutral main question, unchanged worker instructions and shared five-level rubric.
test("CONTRACT-AE-4 asks neutral main effort question with common rubric", async () => {
  let asked: Record<string, { instructions: string; criteria: Record<string, string> }> = {};
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      asked = (await request.json()).questions;
      return Response.json({ answers: { effort: { choice: "low" }, risky: { noul: 0 } } });
    },
  });
  try {
    await classify(
      { url: server.url.toString(), apiKey: "fixture", model: "fixture", timeoutMs: 1000 },
      {},
      new AbortController().signal,
    );
    expect(asked.effort!.instructions).toBe(
      "How much step-by-step reasoning does carrying out this request need? Rate the work requested, using recent conversation to identify work approved or continued.",
    );
    expect(asked.effort!.criteria).toEqual(WORKER_EFFORT_QUESTION.criteria);
    expect(Object.keys(asked.effort!.criteria)).toEqual(["low", "medium", "high", "xhigh", "max"]);
  } finally {
    server.stop(true);
  }
});

async function assess(effort: unknown) {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => Response.json({ answers: { effort, risky: { noul: 0 } } }),
  });
  try {
    return await classify(
      { url: server.url.toString(), apiKey: "fixture", model: "fixture", timeoutMs: 1000 },
      {},
      new AbortController().signal,
    );
  } finally {
    server.stop(true);
  }
}

// AE-3: invalid supplied fields cannot be rescued by an otherwise valid score/distribution.
for (const [name, effort] of [
  ["non-max choice", { choice: "low", probabilities: { medium: 1 } }],
  ["unknown choice", { choice: "bad", probabilities: { medium: 1 } }],
  ["null choice", { choice: null, score: 1 }],
  ["invalid score", { choice: "low", score: 9 }],
  ["null score", { choice: "low", score: null }],
  ["invalid confidence", { choice: "low", confidence: -1 }],
  ["invalid distribution", { choice: "low", probabilities: { low: 0.1 } }],
] as const) {
  test(`CONTRACT-AE-3 rejects ${name}`, async () => {
    expect((await assess(effort)).outcome).toBe("schema-error");
  });
}

for (const [name, effort] of [
  ["tied choice", { choice: "medium", probabilities: { medium: 0.5, high: 0.5 } }],
  [
    "float-noise tie",
    { choice: "medium", probabilities: { medium: 0.499999999, high: 0.500000001 } },
  ],
] as const) {
  test(`CONTRACT-AE-3 accepts ${name}`, async () => {
    const result = await assess(effort);
    expect(result.outcome).toBe("classified");
    if (result.outcome !== "classified") throw new Error(result.outcome);
    expect(selectEffort(result.decision, "high", "yes")).toBe("medium");
  });
}

// AE-3: approved explicit choice wins; without a choice, legacy close-call lean remains.
for (const [name, effort, expected] of [
  [
    "explicit choice",
    { choice: "medium", confidence: 0, probabilities: { medium: 0.55, high: 0.45 } },
    "medium",
  ],
  ["legacy distribution", { confidence: 0, probabilities: { medium: 0.55, high: 0.45 } }, "high"],
] as const) {
  test(`CONTRACT-AE-3 ${name} selects the assessed effort`, async () => {
    const result = await assess(effort);
    expect(result.outcome).toBe("classified");
    if (result.outcome !== "classified") throw new Error(result.outcome);
    expect(selectEffort(result.decision, "high", "option 1")).toBe(expected);
  });
}
