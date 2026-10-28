import { expect, test } from "bun:test";
import type {
  AppliedWorkerDecision,
  WorkerDecisionRequest,
} from "pi-subagents/worker-decision-authority";
import { WorkerStatus } from "../src/worker-status.ts";

const receipt = (logicalLaunchId = "logical-a", thinking = "low"): AppliedWorkerDecision =>
  ({
    logicalLaunchId,
    ownerGeneration: "generation-a",
    model: "local/fast",
    thinking,
    reason: "assessed",
    definitionRevision: "definition",
    constraintRevision: "constraints",
    digest: "a".repeat(64),
  }) as AppliedWorkerDecision;
const request = (logicalLaunchId = "logical-a"): WorkerDecisionRequest =>
  ({
    control: {
      logicalLaunchId,
      ownerGeneration: "generation-a",
      runtimeAttemptId: "attempt",
      context: "fresh",
    },
    facts: {
      task: "PRIVATE_TASK",
      role: { name: "worker", description: "PRIVATE_DESCRIPTION", provenance: "resolved-agent" },
    },
  }) as WorkerDecisionRequest;
const accepted = (value = receipt(), toolCallId = "call-a", runId = "run-a") => ({
  version: 1,
  sessionId: "session-a",
  toolCallId,
  runId,
  logicalLaunchId: value.logicalLaunchId,
  receipt: value,
});
const child = (runId = "run-a", status = "started", ts = 1) => ({
  type: "subagent.child-status",
  version: 1,
  runId,
  childId: `${runId}-child`,
  status,
  ts,
});
function fixture() {
  const state = new WorkerStatus();
  state.attach("session-a", "generation-a");
  const assess = (id = "logical-a", thinking = "low") => {
    const owner = state.assessing(request(id));
    state.tier(owner, "fast");
    state.applied(receipt(id, thinking));
    return owner;
  };
  return { state, assess };
}

test("worker-status exact assessment receipt supplies details; accepted is not running", () => {
  const { state, assess } = fixture();
  assess();
  expect(state.summary()).toBeUndefined();
  state.accepted(accepted());
  expect(state.summary()).toMatchObject({
    activity: "1 worker accepted",
    effort: "low",
    running: 0,
  });
  expect(state.details("call-a")).toEqual([
    "worker · fast · assessed · local/fast · low · accepted",
  ]);
  state.child(child());
  expect(state.summary()).toMatchObject({
    activity: "1 worker running",
    effort: "low",
    running: 1,
  });
  state.complete({ sessionId: "session-a", runId: "run-a", state: "complete" });
  expect(state.summary()).toMatchObject({
    activity: "1 worker completed",
    effort: "low",
    running: 0,
  });
});

for (const [name, expected] of [
  ["failed", "failed"],
  ["stopped", "cancelled"],
])
  test(`worker-status ${name} terminal sticky across duplicates/reordered starts`, () => {
    const { state, assess } = fixture();
    assess();
    state.accepted(accepted());
    state.child(child());
    state.complete({ sessionId: "session-a", runId: "run-a", state: name });
    state.accepted(accepted());
    state.child(child("run-a", "started", 0));
    state.child(child("run-a", "started", 9));
    state.complete({ sessionId: "session-a", runId: "run-a", state: "complete" });
    expect(state.details("call-a")[0]).toEndWith(expected!);
    expect(state.summary()?.running).toBe(0);
  });

test("worker-status rejects mismatched receipt/generation/session and stale reload callbacks", () => {
  const { state, assess } = fixture();
  const owner = assess();
  for (const value of [
    { ...accepted(), sessionId: "old" },
    accepted({ ...receipt(), digest: "b".repeat(64) }),
    accepted({ ...receipt(), ownerGeneration: "old" }),
    { ...accepted(), logicalLaunchId: "other" },
  ])
    state.accepted(value);
  state.child(child());
  expect(state.summary()).toBeUndefined();
  state.attach("session-a", "generation-new");
  state.tier(owner, "deep");
  state.applied(receipt());
  state.accepted(accepted());
  state.child(child());
  expect(state.summary()).toBeUndefined();
});

test("worker-status overlap uses mixed efforts, completion leaves only active effort", () => {
  const { state, assess } = fixture();
  assess();
  assess("logical-b", "high");
  state.accepted(accepted());
  state.accepted(accepted(receipt("logical-b", "high"), "call-b", "run-b"));
  state.child(child());
  state.child(child("run-b"));
  expect(state.summary()).toMatchObject({
    activity: "2 workers running",
    effort: "mixed",
    running: 2,
  });
  state.complete({ sessionId: "session-a", runId: "run-a", state: "failed" });
  expect(state.summary()).toMatchObject({
    activity: "1 worker running",
    effort: "high",
    running: 1,
  });
});

test("worker-status unknown terminal and generic stopped child never invent cancellation", () => {
  const { state, assess } = fixture();
  assess();
  state.accepted(accepted());
  state.complete({ sessionId: "session-a", runId: "run-a", state: "whatever" });
  state.child(child("run-a", "stopped"));
  expect(state.details("call-a")[0]).toEndWith("accepted");
});

test("worker-status absent tier omitted; bounded terminal history preserves active worker", () => {
  const { state, assess } = fixture();
  state.assessing(request());
  state.applied(receipt());
  state.accepted(accepted());
  expect(state.details("call-a")).toEqual(["worker · assessed · local/fast · low · accepted"]);
  for (let i = 0; i < 30; i++) {
    const id = `logical-${i}`;
    assess(id);
    state.accepted(accepted(receipt(id), `call-${i}`, `run-${i}`));
    state.complete({ sessionId: "session-a", runId: `run-${i}`, state: "complete" });
  }
  expect(state.historySize()).toBeLessThanOrEqual(12);
  expect(state.details("call-a")[0]).toEndWith("accepted");
  expect(JSON.stringify(state.details("call-a"))).not.toMatch(
    /PRIVATE|unknown|unconfirmed|logical|generation|run-a/,
  );
});

test("worker-status workflow siblings join explicit leaf childRunId not root fanout", () => {
  const { state, assess } = fixture();
  assess();
  assess("logical-b", "high");
  state.accepted({ ...accepted(), parentWorkflowRunId: "workflow", workflowKey: "a" });
  state.accepted({
    ...accepted(receipt("logical-b", "high"), "call-a", "run-b"),
    parentWorkflowRunId: "workflow",
    workflowKey: "b",
  });
  state.child(child("workflow"));
  expect(state.summary()?.running).toBe(0);
  state.child({ ...child("workflow"), childRunId: "run-b", workflowKey: "b" });
  expect(state.summary()?.running).toBe(1);
  expect(state.details("call-a")).toEqual([
    "worker · fast · assessed · local/fast · low · accepted",
    "worker · fast · assessed · local/fast · high · running",
  ]);
  state.complete({ sessionId: "session-a", runId: "workflow", state: "complete" });
  expect(state.summary()?.running).toBe(1);
});

test("worker-status workflow summary details exclude terminal siblings while another runs", () => {
  const { state, assess } = fixture();
  assess();
  assess("logical-b", "high");
  state.accepted({ ...accepted(), parentWorkflowRunId: "workflow", workflowKey: "a" });
  state.accepted({
    ...accepted(receipt("logical-b", "high"), "call-a", "run-b"),
    parentWorkflowRunId: "workflow",
    workflowKey: "b",
  });
  state.child({ ...child("workflow"), childRunId: "run-a", workflowKey: "a" });
  state.child({ ...child("workflow"), childRunId: "run-b", workflowKey: "b" });
  state.complete({ sessionId: "session-a", runId: "run-a", state: "complete" });
  expect(state.summary()?.details).toEqual([
    "worker · fast · assessed · local/fast · high · running",
  ]);
});

test("worker-status workflow summary details show only latest terminal sibling", () => {
  const { state, assess } = fixture();
  assess();
  assess("logical-b", "high");
  state.accepted({ ...accepted(), parentWorkflowRunId: "workflow", workflowKey: "a" });
  state.accepted({
    ...accepted(receipt("logical-b", "high"), "call-a", "run-b"),
    parentWorkflowRunId: "workflow",
    workflowKey: "b",
  });
  state.complete({ sessionId: "session-a", runId: "run-a", state: "complete" });
  state.complete({ sessionId: "session-a", runId: "run-b", state: "failed" });
  expect(state.summary()?.details).toEqual([
    "worker · fast · assessed · local/fast · high · failed",
  ]);
});

test("worker-status bound pre-start error terminalizes exact leaf, never root sibling", () => {
  const { state, assess } = fixture();
  assess();
  assess("logical-b");
  state.accepted(accepted());
  state.accepted(accepted(receipt("logical-b"), "call-a", "run-b"));
  state.result("call-a", { runId: "workflow", results: [] }, true);
  expect(state.details("call-a").every((line) => line.endsWith("accepted"))).toBe(true);
  state.result("call-a", { runId: "run-a", toolCallId: "call-a", results: [] }, true);
  expect(state.details("call-a")[0]).toEndWith("failed");
  expect(state.details("call-a")[1]).toEndWith("accepted");
  expect(state.summary()?.running).toBe(0);
});

test("worker-status reordered actual start/terminal before acceptance replay only after exact receipt join", () => {
  const { state, assess } = fixture();
  assess();
  state.child(child());
  state.complete({ sessionId: "session-a", runId: "run-a", state: "failed" });
  expect(state.summary()).toBeUndefined();
  state.accepted(accepted());
  expect(state.details("call-a")[0]).toEndWith("failed");
  expect(state.summary()?.running).toBe(0);
});

test("worker-status stale early notifications cleared on session replacement", () => {
  const { state, assess } = fixture();
  state.child(child());
  state.complete({ sessionId: "session-a", runId: "run-a", state: "failed" });
  state.reset();
  assess();
  state.accepted(accepted());
  expect(state.details("call-a")[0]).toEndWith("accepted");
});

test("worker-status acceptance projection does not retain private extra payload or mutable receipt", () => {
  const { state, assess } = fixture();
  assess();
  const event = { ...accepted(), task: "PRIVATE_TASK", auth: "PRIVATE_AUTH" };
  state.accepted(event);
  (event.receipt as { model: string }).model = "local/changed";
  expect(state.details("call-a")[0]).toContain("local/fast");
  expect(JSON.stringify(state)).not.toContain("PRIVATE_");
});

for (const [result, isError, expected] of [
  [{ exitCode: 0 }, false, "completed"],
  [{ exitCode: 1 }, false, "failed"],
  [{ exitCode: 0 }, true, "failed"],
  [{ exitCode: 0, stopped: true }, false, "cancelled"],
  [{ exitCode: 0, interrupted: true }, false, "paused"],
  [{ exitCode: 0, detached: true }, false, "detached"],
  [{ exitCode: 0, timedOut: true }, false, "failed"],
  [{ exitCode: 0, error: "PRIVATE_REASON" }, false, "failed"],
] as const)
  test(`worker-status structured attached terminal ${JSON.stringify(result)} => ${expected}`, () => {
    const { state, assess } = fixture();
    assess();
    state.accepted(accepted());
    state.result(
      "call-a",
      { mode: "single", runId: "run-a", toolCallId: "call-a", results: [result] },
      isError,
    );
    expect(state.details("call-a")[0]).toEndWith(expected);
  });

test("worker-status workflow inventory terminal uses root/key/exact leaf and never root status", () => {
  const { state, assess } = fixture();
  assess();
  assess("logical-b");
  state.accepted({ ...accepted(), parentWorkflowRunId: "workflow", workflowKey: "a" });
  state.accepted({
    ...accepted(receipt("logical-b"), "call-a", "run-b"),
    parentWorkflowRunId: "workflow",
    workflowKey: "b",
  });
  const inventory = {
    version: 1,
    workflowRunId: "workflow",
    parentToolCallId: "call-a",
    inventoryComplete: true,
    children: [
      { childId: "a", runId: "run-a", state: "failed" },
      { childId: "b", runId: "wrong-leaf", state: "completed" },
    ],
  };
  state.complete({
    sessionId: "session-a",
    runId: "workflow",
    state: "failed",
    workflowChildren: inventory,
  });
  expect(state.details("call-a")[0]).toEndWith("failed");
  expect(state.details("call-a")[1]).toEndWith("accepted");
});

test("worker-status explicit user stopped child cancels but arbitrary reason cannot", () => {
  const { state, assess } = fixture();
  assess();
  state.accepted(accepted());
  state.child({ ...child("run-a", "stopped"), reason: "user" });
  expect(state.details("call-a")[0]).toEndWith("cancelled");
});

for (const terminal of ["completed", "failed"] as const)
  test(`P1 foreground workflow result without outer toolCallId closes exact ${terminal} leaf`, () => {
    const { state, assess } = fixture();
    assess();
    assess("logical-b");
    state.accepted({ ...accepted(), parentWorkflowRunId: "workflow", workflowKey: "a" });
    state.accepted({
      ...accepted(receipt("logical-b"), "call-a", "run-b"),
      parentWorkflowRunId: "workflow",
      workflowKey: "b",
    });
    state.child({ ...child("workflow"), childRunId: "run-a" });
    const details = {
      mode: "workflow",
      runId: "workflow",
      results: [],
      workflowChildren: {
        version: 1,
        parentToolCallId: "call-a",
        workflowRunId: "workflow",
        inventoryComplete: true,
        children: [
          { childId: "a", runId: "run-a", state: terminal },
          { childId: "b", runId: "wrong", state: "completed" },
        ],
      },
    };
    state.result("wrong-call", details, false);
    expect(state.details("call-a")[0]).toEndWith("running");
    state.result("call-a", details, false);
    expect(state.details("call-a")[0]).toEndWith(terminal);
    expect(state.details("call-a")[1]).toEndWith("accepted");
  });

test("P1 canonical foreground throw result fails only exact observed non-workflow leaf", async () => {
  const { finalizeToolResult } =
    await import("../node_modules/pi-subagents/src/extension/tool-result.ts");
  const { state, assess } = fixture();
  assess();
  assess("logical-b");
  state.observeTool("call-a");
  state.accepted(accepted());
  state.accepted({
    ...accepted(receipt("logical-b"), "call-a", "run-b"),
    parentWorkflowRunId: "workflow",
    workflowKey: "b",
  });
  state.child(child());
  let canonical: { details: object; isError: boolean } | undefined;
  try {
    finalizeToolResult({
      content: [{ type: "text", text: "PRIVATE_FAILURE" }],
      details: { mode: "single", runId: "run-a", toolCallId: "call-a", results: [] },
      isError: true,
    });
  } catch {
    // Pi's public catch boundary discards executor details when a tool throws.
    canonical = { details: {}, isError: true };
  }
  expect(canonical).toBeDefined();
  state.result("wrong-call", canonical!.details, canonical!.isError);
  expect(state.details("call-a")[0]).toEndWith("running");
  state.result("call-a", canonical!.details, canonical!.isError);
  expect(state.details("call-a")[0]).toEndWith("failed");
  expect(state.details("call-a")[1]).toEndWith("accepted");
  state.child(child("run-a", "started", 10));
  expect(state.details("call-a")[0]).toEndWith("failed");
});

test("P1 canonical empty error never closes unobserved or ambiguous ordinary leaves", () => {
  const { state, assess } = fixture();
  assess();
  state.accepted(accepted());
  state.result("call-a", {}, true);
  expect(state.details("call-a")[0]).toEndWith("accepted");
  state.observeTool("call-a");
  assess("logical-b");
  state.accepted(accepted(receipt("logical-b"), "call-a", "run-b"));
  state.result("call-a", {}, true);
  expect(state.details("call-a").every((line) => line.endsWith("accepted"))).toBe(true);
});

test("P1 empty root error cannot terminalize workflow leaves", () => {
  const { state, assess } = fixture();
  assess();
  state.observeTool("call-a");
  state.accepted({ ...accepted(), parentWorkflowRunId: "workflow", workflowKey: "a" });
  state.child({ ...child("workflow"), childRunId: "run-a" });
  state.result("call-a", {}, true);
  expect(state.details("call-a")[0]).toEndWith("running");
  state.result(
    "call-a",
    {
      workflowChildren: {
        version: 1,
        parentToolCallId: "call-a",
        workflowRunId: "wrong-root",
        children: [{ childId: "a", runId: "run-a", state: "completed" }],
      },
    },
    false,
  );
  expect(state.details("call-a")[0]).toEndWith("running");
});

test("worker-status acceptance reports readiness only after details and summary stored", () => {
  const { state, assess } = fixture();
  assess();
  expect(state.accepted({ ...accepted(), sessionId: "stale" })).toBe(false);
  expect(state.accepted(accepted())).toBe(true);
  expect(state.details("call-a")[0]).toContain("accepted");
  expect(state.summary()?.activity).toBe("1 worker accepted");
  expect(state.accepted(accepted())).toBe(false);
});

test("worker-status typed attached foreground terminal requires exact session/call/root/key/leaf", () => {
  const { state, assess } = fixture();
  assess();
  assess("logical-b");
  state.accepted({ ...accepted(), parentWorkflowRunId: "workflow", workflowKey: "a" });
  state.accepted({
    ...accepted(receipt("logical-b"), "call-a", "run-b"),
    parentWorkflowRunId: "workflow",
    workflowKey: "b",
  });
  const event = {
    version: 1,
    attached: true,
    source: "foreground",
    mode: "single",
    sessionId: "session-a",
    toolCallId: "call-a",
    runId: "run-a",
    parentWorkflowRunId: "workflow",
    workflowKey: "a",
    agent: "worker",
    state: "failed",
    success: false,
    timestamp: 1,
  };
  for (const mismatch of [
    { sessionId: "stale" },
    { toolCallId: "wrong" },
    { parentWorkflowRunId: "wrong" },
    { workflowKey: "b" },
    { version: 2 },
    { source: "async" },
  ]) {
    state.complete({ ...event, ...mismatch });
    expect(state.details("call-a").every((line) => line.endsWith("accepted"))).toBe(true);
  }
  state.complete(event);
  expect(state.details("call-a")[0]).toEndWith("failed");
  expect(state.details("call-a")[1]).toEndWith("accepted");
});
