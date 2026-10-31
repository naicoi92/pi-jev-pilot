import { expect, test } from "bun:test";
import { loadJevConfig } from "../src/jev-config.ts";
import { DEFAULT_EFFORT_THRESHOLDS } from "../src/effort-policy.ts";
import { createWorkerAuthority } from "../src/worker-authority.ts";
import {
  prepareWorkerDecision,
  registerWorkerDecisionAuthority,
} from "pi-subagents/worker-decision-authority";

async function run(options: {
  answers?: Record<string, unknown>;
  unsupported?: boolean;
  disabled?: boolean;
  incomplete?: boolean;
  tools?: Array<{ name: string; description: string; sourcePath: string }>;
  callerTools?: string[];
  status?: number;
  twice?: boolean;
  fork?: boolean;
  missingRole?: boolean;
  unresolvedCrew?: boolean;
}) {
  const warnings: string[] = [];
  let body: any;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      body = await request.json();
      return options.status
        ? new Response("error", { status: options.status })
        : Response.json({
            answers: options.answers ?? {
              effort: { choice: "low", confidence: 0.9 },
              risky: { noul: 0 },
              tool_0: { noul: 0.1 },
            },
          });
    },
  });
  const key = "JEV_TOOL_MATRIX_KEY";
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
          workerToolSelectionEnabled: !options.disabled,
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
      crew: {
        mode: "standard",
        slots: [],
        offered: options.unresolvedCrew
          ? [{ model: "missing/model", role: "worker" } as never]
          : [],
      },
      warn(message) {
        warnings.push(message);
      },
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
        context: options.fork ? "fork" : "fresh",
        launchDeadline: Date.now() + 5000,
      },
      facts: {
        task: "Find defect",
        toolSelection: options.unsupported ? "unsupported" : "supported",
        toolsIncomplete: options.incomplete,
        callerTools: options.callerTools,
        tools: options.tools ?? [
          { name: "search", description: "Search source", sourcePath: "/tmp/plugin.ts" },
        ],
        role: options.missingRole
          ? undefined
          : { name: "worker", description: "Review code", provenance: "resolved-agent" },
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
    if (options.twice) {
      await prepareWorkerDecision({
        sessionId,
        control: {
          logicalLaunchId: "leaf2",
          runtimeAttemptId: "attempt2",
          ownerGeneration: owner.generation,
          context: "fresh",
          launchDeadline: Date.now() + 5000,
        },
        facts: {
          task: "Find defect",
          toolSelection: "unsupported",
          tools: options.tools ?? [
            { name: "search", description: "Search source", sourcePath: "/tmp/plugin.ts" },
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
    }
    return { result, body, warnings };
  } finally {
    owner.dispose();
    server.stop(true);
    delete process.env[key];
  }
}
const base = { effort: { choice: "low", confidence: 0.9 }, risky: { noul: 0 } };

test("AC7 fork without a resolved role retains its baseline", async () => {
  const x = await run({ fork: true, missingRole: true });
  if (x.result.kind !== "committed") throw Error("not committed");
  expect(x.result.receipt.thinking).toBe("high");
  expect(x.body).toBeUndefined();
});

test("AC7 fork ignores unrelated unresolved crew", async () => {
  const x = await run({ fork: true, unresolvedCrew: true });
  if (x.result.kind !== "committed") throw Error("not committed");
  expect(x.result.receipt.thinking).toBe("high");
  expect(x.result.receipt.selectedTools).toEqual([
    { name: "search", sourcePath: "/tmp/plugin.ts" },
  ]);
});

test("AC7 fork retains baseline when classifier fails", async () => {
  const x = await run({ fork: true, status: 500 });
  if (x.result.kind !== "committed") throw Error("not committed");
  expect(x.result.receipt.thinking).toBe("high");
  expect(x.result.receipt.selectedTools).toBeUndefined();
});

test("AC7 fork with disabled selection skips classifier", async () => {
  const x = await run({ fork: true, disabled: true });
  if (x.result.kind !== "committed") throw Error("not committed");
  expect(x.result.receipt.thinking).toBe("high");
  expect(x.body).toBeUndefined();
});

test("AC7 fork without candidates does not call the classifier", async () => {
  const x = await run({ fork: true, tools: [] });
  if (x.result.kind !== "committed") throw Error("not committed");
  expect(x.result.receipt.thinking).toBe("high");
  expect(x.body).toBeUndefined();
});

test("AC7 fork keeps its model and still scores tools", async () => {
  const x = await run({ fork: true });
  if (x.result.kind !== "committed") throw Error("not committed");
  expect(x.result.receipt.thinking).toBe("high");
  expect(x.result.receipt.selectedTools).toEqual([
    { name: "search", sourcePath: "/tmp/plugin.ts" },
  ]);
});

test("AC7 unsupported launch does not ask tool questions", async () => {
  const x = await run({ unsupported: true });
  expect(x.body.questions.tool_0).toBeUndefined();
  expect(x.warnings.length).toBe(1);
});
test("AC7 unsupported warning is emitted for each launch", async () => {
  const x = await run({ unsupported: true, twice: true });
  expect(x.warnings.length).toBe(2);
});

test("AC7 disabled tool selection keeps original questions", async () => {
  const x = await run({ disabled: true });
  expect(x.body.questions.tool_0).toBeUndefined();
  expect(x.warnings).toEqual([]);
});
test("AC4 service failure retains baseline and warns once", async () => {
  const x = await run({ status: 500 });
  expect(x.result.kind).toBe("committed");
  if (x.result.kind === "committed") {
    expect(x.result.receipt.model).toBe("local/model");
    expect(x.result.receipt.selectedTools).toBeUndefined();
    expect(x.result.receipt.toolWarnings).toEqual(["Worker tool scores unavailable."]);
  }
  expect(x.warnings.length).toBe(1);
});
test("AC4 invalid score omits only that tool", async () => {
  const x = await run({
    tools: [
      { name: "first", description: "first", sourcePath: "/tmp/a" },
      { name: "second", description: "second", sourcePath: "/tmp/b" },
    ],
    answers: { ...base, tool_0: { noul: "bad" }, tool_1: { noul: 0.1 } },
  });
  if (x.result.kind !== "committed") throw Error("not committed");
  expect(x.result.receipt.selectedTools).toEqual([{ name: "second", sourcePath: "/tmp/b" }]);
  expect(x.warnings.some((x) => x.includes("first"))).toBe(true);
  expect(x.result.receipt.toolWarnings).toEqual(["Worker tool score unavailable: first."]);
});
test("AC4 Unicode tool warnings are byte-bounded and sanitize control characters", async () => {
  const name = `tool\n${"界".repeat(200)}`;
  const x = await run({
    tools: [{ name, description: "search", sourcePath: "/tmp/plugin.ts" }],
    answers: { ...base, tool_0: { noul: "invalid" } },
  });
  if (x.result.kind !== "committed") throw Error("not committed");
  const warning = x.result.receipt.toolWarnings?.[0];
  expect(warning).toBeDefined();
  expect(Buffer.byteLength(warning!, "utf8")).toBeLessThanOrEqual(512);
  expect([...warning!].every((char) => char.codePointAt(0)! >= 32)).toBe(true);
  expect(warning).not.toContain("\ufffd");
});

test("AC1 reject threshold is inclusive: dangerous at or above it is dropped", async () => {
  const x = await run({
    tools: [
      { name: "below", description: "below", sourcePath: "/tmp/a" },
      { name: "edge", description: "edge", sourcePath: "/tmp/b" },
    ],
    answers: { ...base, tool_0: { noul: 0.69 }, tool_1: { noul: 0.7 } },
  });
  if (x.result.kind !== "committed") throw Error("not committed");
  expect(x.result.receipt.selectedTools).toEqual([{ name: "below", sourcePath: "/tmp/a" }]);
});
test("AC4 invalid effort retains original with valid tool score", async () => {
  const x = await run({
    answers: { effort: { choice: "invalid" }, risky: { noul: 0 }, tool_0: { noul: 0.1 } },
  });
  if (x.result.kind !== "committed") throw Error("not committed");
  expect(x.result.receipt.thinking).toBe("high");
  expect(x.result.receipt.selectedTools).toEqual([
    { name: "search", sourcePath: "/tmp/plugin.ts" },
  ]);
});
test("AC2 incomplete and capped inventory warns", async () => {
  const tools = Array.from({ length: 33 }, (_, i) => ({
    name: `tool${i}`,
    description: `tool${i}`,
    sourcePath: `/tmp/${i}`,
  }));
  const x = await run({ incomplete: true, tools });
  expect(Object.keys(x.body.questions).filter((k) => k.startsWith("tool_")).length).toBe(32);
  expect(x.warnings.some((x) => x.includes("incomplete"))).toBe(true);
  expect(x.warnings.some((x) => x.includes("limit"))).toBe(true);
});
test("AC2 unsupported and caller tools are not scored", async () => {
  const names = ["caller", "mcp__x", "read_mcp_resource", "codemode", "models", "relative"];
  const x = await run({
    callerTools: ["caller"],
    tools: names.map((name) => ({
      name,
      description: name,
      sourcePath: name === "relative" ? "relative" : "/tmp/plugin",
    })),
  });
  expect(Object.keys(x.body.questions).filter((k) => k.startsWith("tool_"))).toEqual([]);
});

test("default-allow: tools beyond the scoring cap are allowed, only flagged ones are dropped", async () => {
  const tools = Array.from({ length: 40 }, (_, i) => ({
    name: `tool${i}`,
    description: `tool${i}`,
    sourcePath: `/tmp/${i}`,
  }));
  const answers: Record<string, unknown> = { ...base };
  for (let i = 0; i < 32; i++) answers[`tool_${i}`] = { noul: i === 3 ? 0.95 : 0.1 };
  const x = await run({ tools, answers });
  if (x.result.kind !== "committed") throw Error("not committed");
  const names = x.result.receipt.selectedTools!.map((tool) => tool.name);
  expect(names).toHaveLength(39);
  expect(names).not.toContain("tool3");
  expect(names).toContain("tool39");
});

test("interactive tools are never scored or granted to a worker", async () => {
  const x = await run({
    tools: [
      { name: "ask_user_question", description: "Ask the user", sourcePath: "/tmp/ask.ts" },
      { name: "search", description: "Search source", sourcePath: "/tmp/plugin.ts" },
    ],
  });
  if (x.result.kind !== "committed") throw Error("not committed");
  const questions = Object.values(x.body.questions as Record<string, { instructions?: string }>);
  expect(questions.some((q) => q.instructions?.includes("ask_user_question"))).toBe(false);
  expect(x.result.receipt.selectedTools?.map((tool) => tool.name)).toEqual(["search"]);
});
