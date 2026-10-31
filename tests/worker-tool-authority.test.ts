import { expect, test } from "bun:test";
import { loadJevConfig } from "../src/jev-config.ts";
import { DEFAULT_EFFORT_THRESHOLDS } from "../src/effort-policy.ts";
import { createWorkerAuthority } from "../src/worker-authority.ts";
import {
  prepareWorkerDecision,
  registerWorkerDecisionAuthority,
} from "pi-subagents/worker-decision-authority";

test("AC1 and AC7: one worker assessment selects the host identity", async () => {
  let body: any;
  let calls = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      calls++;
      body = await request.json();
      return Response.json({
        answers: {
          effort: { choice: "low", confidence: 0.9 },
          risky: { noul: 0 },
          tool_0: { noul: 0.1 },
        },
      });
    },
  });
  const key = "JEV_TOOL_TEST_KEY";
  process.env[key] = "fixture";
  const sessionId = crypto.randomUUID();
  const owner = registerWorkerDecisionAuthority({
    sessionId,
    lifetimeDeadline: Date.now() + 10000,
    assessmentTimeoutMs: 5000,
    authority: createWorkerAuthority({
      assessment: {
        config: {
          ...loadJevConfig(),
          classifier: {
            url: server.url.toString(),
            apiKeyEnv: key,
            model: "jev-latest",
            timeoutMs: 1000,
          },
        },
        tuning: { ...DEFAULT_EFFORT_THRESHOLDS, timeoutMs: 1000 },
      },
      tiers: {},
      crew: { mode: "standard", slots: [], offered: [] },
      warn() {},
      configurationError() {},
    }),
  });
  const revisions = { definitionRevision: "d", constraintRevision: "c" };
  const original = {
    kind: "verified" as const,
    model: "local/model",
    thinking: "high" as const,
    provenance: "host-effective" as const,
    ...revisions,
  };
  try {
    const result = await prepareWorkerDecision({
      sessionId,
      control: {
        logicalLaunchId: "leaf",
        runtimeAttemptId: "attempt",
        ownerGeneration: owner.generation,
        context: "fresh",
        launchDeadline: Date.now() + 5000,
      },
      facts: {
        task: "Find the defect",
        toolSelection: "supported",
        tools: [
          {
            name: "search",
            namespace: "plugin",
            sourcePath: "/tmp/plugin.ts",
            description: "Search source",
          },
        ],
        role: { name: "worker", description: "Review code", provenance: "resolved-agent" },
      },
      policyContext: {
        ...revisions,
        modelContract: { kind: "fixed", model: "local/model" },
        comparison: { kind: "resolved", model: "local/model", provenance: "parent" },
        original,
      },
      classifierTimeoutMs: 2000,
      host: {
        getCurrentRevisions: () => revisions,
        async resolveTarget() {
          return {
            kind: "resolved",
            model: "local/model",
            supportedThinking: ["low", "high"],
            baseline: original,
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
      expect(result.receipt.selectedTools).toEqual([
        { name: "search", namespace: "plugin", sourcePath: "/tmp/plugin.ts" },
      ]);
    expect(calls).toBe(1);
    expect(Object.keys(body.questions)).toContain("effort");
    expect(Object.keys(body.questions)).toContain("tool_0");
    expect(JSON.stringify(body)).not.toContain("/tmp/plugin.ts");
  } finally {
    owner.dispose();
    server.stop(true);
    delete process.env[key];
  }
});

test("worker authority reports selected and not-selected tool counts without tool identities", async () => {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      return Response.json({
        answers: {
          effort: { choice: "low", confidence: 0.9 },
          risky: { noul: 0 },
          tool_0: { noul: 0.1 },
          tool_1: { noul: 0.9 },
          tool_2: { noul: "bad" },
        },
      });
    },
  });
  const key = "JEV_TOOL_COUNT_KEY";
  process.env[key] = "fixture";
  const reported: unknown[] = [];
  const revisions = { definitionRevision: "d", constraintRevision: "c" };
  const original = {
    kind: "verified" as const,
    model: "local/model",
    thinking: "high" as const,
    provenance: "host-effective" as const,
    ...revisions,
  };
  const authority = createWorkerAuthority({
    assessment: {
      config: {
        ...loadJevConfig(),
        classifier: {
          url: server.url.toString(),
          apiKeyEnv: key,
          model: "jev-latest",
          timeoutMs: 1000,
        },
      },
      tuning: { ...DEFAULT_EFFORT_THRESHOLDS, timeoutMs: 1000 },
    },
    tiers: {},
    crew: { mode: "standard", slots: [], offered: [] },
    warn() {},
    configurationError() {},
    toolsScored: (counts) => reported.push(counts),
  });
  try {
    const tool = (name: string) => ({ name, sourcePath: `/tmp/${name}.ts`, description: name });
    await authority.decide(
      {
        control: {
          logicalLaunchId: "leaf",
          runtimeAttemptId: "a",
          ownerGeneration: "g",
          context: "fresh",
        },
        facts: {
          task: "Find the defect",
          toolSelection: "supported",
          tools: [tool("a"), tool("b"), tool("c"), tool("codemode"), tool("granted")],
          callerTools: ["granted"],
          role: { name: "worker", description: "Review", provenance: "resolved-agent" },
        },
        policyContext: {
          ...revisions,
          modelContract: { kind: "fixed", model: "local/model" },
          comparison: { kind: "resolved", model: "local/model", provenance: "parent" },
          original,
        },
      } as any,
      {
        signal: new AbortController().signal,
        assessmentCutoff: Date.now() + 5000,
        hardDeadline: Date.now() + 5000,
        assessmentAvailable: true,
        async resolveTarget() {
          return {
            kind: "resolved",
            model: "local/model",
            supportedThinking: ["low", "high"],
            baseline: original,
            ...revisions,
          };
        },
      },
    );
    expect(reported).toEqual([
      { selected: 1, rejected: 4, reasons: { danger: 1, invalid: 1, ineligible: 2 } },
    ]);
  } finally {
    server.stop(true);
    delete process.env[key];
  }
});
