import { expect, test } from "bun:test";
import { captureEffortAssessment } from "../src/effort-assessment.ts";

test("worker assessment overrides only registered timeout", () => {
  const current = captureEffortAssessment();
  const worker = captureEffortAssessment(98765);
  expect(worker.tuning.timeoutMs).toBe(98765);
  expect({ ...worker.tuning, timeoutMs: current.tuning.timeoutMs }).toEqual(current.tuning);
  expect(worker.config).toEqual(current.config);
});

test("registered worker timeout reaches HTTP timer", async () => {
  const { systemOneConfig, classify } = await import("../src/system-one.ts");
  const old = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = "test-only";
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      await Bun.sleep(500);
      return Response.json({
        answers: { effort: { choice: "low", confidence: 1 }, risky: { noul: 0 } },
      });
    },
  });
  try {
    const assessment = captureEffortAssessment(100);
    const config = { ...systemOneConfig(assessment), url: server.url.toString() };
    expect(config.timeoutMs).toBe(100);
    const result = await classify(config, {}, new AbortController().signal);
    expect(result.outcome).toBe("timeout");
  } finally {
    server.stop(true);
    if (old === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = old;
  }
});
