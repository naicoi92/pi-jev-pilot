import { expect, test } from "bun:test";
import { createWorkerAuthority } from "../src/worker-authority.ts";
import {
  prepareWorkerDecision,
  registerWorkerDecisionAuthority,
  type WorkerDecisionComparison,
} from "pi-subagents/worker-decision-authority";

// F2 public claim-bound comparison, independent from verified execution retention.
for (const [name, comparison, selected] of [
  [
    "parent fast with thinking-only original",
    { kind: "resolved", model: "local/fast", provenance: "parent" },
    "local/balanced",
  ],
  [
    "explicit deep caller",
    { kind: "resolved", model: "local/deep", provenance: "explicit-caller" },
    "local/deep",
  ],
  [
    "missing parent stays unresolved",
    { kind: "unresolved", reason: "model-unresolved" },
    "local/balanced",
  ],
] as const) {
  test(`F2 ${name} does not substitute executor retention as comparison`, async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () =>
        Response.json({
          answers: {
            effort: { choice: "low", confidence: 0 },
            risky: { noul: 0 },
            tier: { choice: "balanced", confidence: 0.45 },
          },
        }),
    });
    const saved = { ...process.env };
    process.env.JEV_SYSTEM_ONE_URL = server.url.toString();
    process.env.JEV_SYSTEM_ONE_API_KEY = "fixture";
    const revisions = { definitionRevision: "definition", constraintRevision: "constraint" };
    const original = {
      kind: "verified" as const,
      model: "local/deep",
      thinking: "high" as const,
      provenance: "explicit-launch" as const,
      ...revisions,
    };
    const sessionId = `/fixture/${crypto.randomUUID()}`;
    const owner = registerWorkerDecisionAuthority({
      sessionId,
      lifetimeDeadline: Number.MAX_SAFE_INTEGER,
      assessmentTimeoutMs: 5000,
      authority: createWorkerAuthority({
        tiers: { fast: "local/fast", balanced: "local/balanced", deep: "local/deep" },
        crew: { mode: "standard", slots: [], offered: [] },
        warn() {},
        configurationError() {},
      }),
    });
    try {
      const result = await prepareWorkerDecision({
        sessionId,
        control: {
          logicalLaunchId: "comparison",
          runtimeAttemptId: "native",
          ownerGeneration: owner.generation,
          context: "fresh",
          launchDeadline: Date.now() + 10000,
        },
        facts: {
          task: "Implement local fixture",
          role: { name: "worker", description: "Local worker", provenance: "resolved-agent" },
        },
        policyContext: {
          ...revisions,
          comparison: comparison as WorkerDecisionComparison,
          original,
          modelContract: {
            kind: "selectable",
            models: ["local/fast", "local/balanced", "local/deep"],
          },
        },
        classifierTimeoutMs: 5000,
        host: {
          getCurrentRevisions: () => revisions,
          async resolveTarget(model) {
            return {
              kind: "resolved",
              model,
              supportedThinking: ["low", "high"],
              baseline: { ...original, model },
              ...revisions,
            };
          },
          async validate() {
            return { kind: "valid" };
          },
        },
      });
      expect(result.kind).toBe("committed");
      if (result.kind === "committed")
        expect(result.receipt).toMatchObject({ model: selected, thinking: "low" });
    } finally {
      owner.dispose();
      server.stop(true);
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  });
}
