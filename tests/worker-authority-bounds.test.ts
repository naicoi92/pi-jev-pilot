import { expect, test } from "bun:test";
import { createWorkerAuthority } from "../src/worker-authority.ts";
import {
  registerWorkerDecisionAuthority,
  prepareWorkerDecision,
  getWorkerDecisionState,
} from "pi-subagents/worker-decision-authority";

// F4: public preparation retains complete identity; external classifier gets bounded factual fields only.
test("F4 classifier projection bounds task type and description without shrinking authority identity", async () => {
  let state: unknown;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      state = (await request.json()).state;
      return Response.json({
        answers: { effort: { choice: "low", confidence: 0 }, risky: { noul: 0 } },
      });
    },
  });
  const saved = { ...process.env };
  const sessionId = `/fixture/${crypto.randomUUID()}`;
  process.env.JEV_SYSTEM_ONE_URL = server.url.toString();
  process.env.JEV_SYSTEM_ONE_API_KEY = "fixture";
  const authority = registerWorkerDecisionAuthority({
    sessionId,
    lifetimeDeadline: Number.MAX_SAFE_INTEGER,
    assessmentTimeoutMs: 5000,
    authority: createWorkerAuthority({
      tiers: {},
      crew: { mode: "standard", slots: [], offered: [] },
      warn() {},
      configurationError() {},
    }),
  });
  const revisions = { definitionRevision: "definition", constraintRevision: "constraints" };
  const original = {
    kind: "verified" as const,
    model: "local/model",
    thinking: "high" as const,
    provenance: "host-effective" as const,
    ...revisions,
  };
  const input = {
    sessionId,
    control: {
      logicalLaunchId: "bounded",
      runtimeAttemptId: "first",
      ownerGeneration: authority.generation,
      context: "fresh" as const,
      launchDeadline: Date.now() + 10000,
    },
    facts: {
      task: "T".repeat(2000) + "PRIVATE_TASK_TAIL",
      role: {
        name: "R".repeat(128) + "PRIVATE_ROLE_TAIL",
        description: "D".repeat(512) + "PRIVATE_DESCRIPTION_TAIL",
        provenance: "resolved-agent" as const,
      },
    },
    policyContext: {
      ...revisions,
      modelContract: { kind: "selectable" as const, models: ["local/model"] },
      comparison: {
        kind: "resolved" as const,
        model: "local/model",
        provenance: "parent" as const,
      },
      original,
    },
    classifierTimeoutMs: 5000,
    host: {
      getCurrentRevisions: () => revisions,
      async resolveTarget() {
        return {
          kind: "resolved" as const,
          model: "local/model",
          supportedThinking: ["low", "high"] as const,
          baseline: original,
          ...revisions,
        };
      },
      async validate() {
        return { kind: "valid" as const };
      },
    },
  };
  try {
    expect((await prepareWorkerDecision(input)).kind).toBe("committed");
    expect(state).toEqual({
      prompt: "T".repeat(2000),
      agentType: "R".repeat(128),
      description: "D".repeat(512),
    });
    expect(JSON.stringify(state)).not.toContain("PRIVATE_");
    expect(getWorkerDecisionState(sessionId, "bounded").kind).toBe("committed");
    const changed = await prepareWorkerDecision({
      ...input,
      facts: { ...input.facts, task: input.facts.task + "CHANGED" },
    });
    expect(changed).toEqual({ kind: "blocked", reason: "identity-conflict" });
    expect(input.facts.task).toEndWith("PRIVATE_TASK_TAIL");
  } finally {
    authority.dispose();
    server.stop(true);
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
