import { expect, test } from "bun:test";
import type {
  ExtensionAPI,
  Theme,
  ToolRendererResolver,
  ToolRenderers,
} from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { WorkerStatus } from "../src/worker-status.ts";
import { registerWorkerStatusRenderer } from "../src/worker-status-renderer.ts";

test("worker-status-renderer uses standard expansion; default launch output has no debug rows", () => {
  let resolver: ToolRendererResolver | undefined;
  const status = new WorkerStatus();
  status.observeTool("PRIVATE_CALL");
  registerWorkerStatusRenderer(
    {
      registerToolRenderer(value: ToolRendererResolver) {
        resolver = value;
      },
    } as ExtensionAPI,
    status,
  );
  const native = {
    renderCall: () => ({ render: () => ["native"], invalidate() {} }),
  } as ToolRenderers;
  expect(resolver!("read", () => native)).toBe(native);
  const renderer = resolver!("subagent", () => native)!;
  const theme = { fg: (_color: string, text: string) => text } as Theme;
  const context = {
    args: { agent: "PRIVATE_AGENT", task: "PRIVATE_TASK" },
    toolCallId: "PRIVATE_CALL",
    expanded: false,
  } as Parameters<NonNullable<ToolRenderers["renderCall"]>>[2];
  expect(renderer.renderShell).toBe("self");
  expect(renderer.renderCall!(context.args, theme, context).render(100)).toEqual([]);
  expect(
    renderer.renderResult!(
      { content: [{ type: "text", text: "PRIVATE_RECEIPT unknown unconfirmed" }], details: {} },
      { expanded: false, isPartial: false },
      theme,
      context,
    ).render(100),
  ).toEqual([]);
  context.expanded = true;
  expect(renderer.renderCall!(context.args, theme, context).render(100)).toEqual([
    "Worker · awaiting executor",
  ]);
  context.expanded = false;
  expect(renderer.renderCall!(context.args, theme, context).render(100)).toEqual([]);
  context.args = { action: "inspect" };
  expect(renderer.renderCall!(context.args, theme, context).render(100)).toEqual(["native"]);
});

test("worker-status-renderer live details use role/tier/model/effort/status and honor width/theme", () => {
  let resolver: ToolRendererResolver | undefined;
  const status = new WorkerStatus();
  status.attach("session", "generation");
  status.observeTool("call");
  const owner = status.assessing({
    control: { logicalLaunchId: "logical", ownerGeneration: "generation" },
    facts: { role: { name: "worker", provenance: "resolved-agent" } },
  } as never);
  status.tier(owner, "deep");
  const receipt = {
    logicalLaunchId: "logical",
    ownerGeneration: "generation",
    digest: "a".repeat(64),
    reason: "assessed",
    model: "local/deep",
    thinking: "high",
  };
  status.applied(receipt as never);
  status.accepted({
    version: 1,
    sessionId: "session",
    toolCallId: "call",
    runId: "run",
    logicalLaunchId: "logical",
    receipt,
  });
  registerWorkerStatusRenderer(
    {
      registerToolRenderer(value: ToolRendererResolver) {
        resolver = value;
      },
    } as ExtensionAPI,
    status,
  );
  const renderer = resolver!("subagent", () => undefined)!;
  const context = { args: { agent: "worker" }, toolCallId: "call", expanded: true } as Parameters<
    NonNullable<ToolRenderers["renderCall"]>
  >[2];
  const component = renderer.renderCall!(
    context.args,
    { fg: (_color: string, text: string) => text } as Theme,
    context,
  );
  expect(component.render(120)).toEqual([
    "worker · deep · assessed · local/deep · high · accepted",
  ]);
  status.child({
    type: "subagent.child-status",
    version: 1,
    childId: "child",
    runId: "run",
    status: "started",
    ts: 1,
  });
  expect(component.render(120)[0]).toEndWith("running");
  for (let width = 1; width < 120; width++)
    expect(visibleWidth(component.render(width)[0]!)).toBeLessThanOrEqual(width);
});

test("worker-status-renderer preserves historical native output and expanded failure body", () => {
  let resolver: ToolRendererResolver | undefined;
  const status = new WorkerStatus();
  registerWorkerStatusRenderer(
    {
      registerToolRenderer(value: ToolRendererResolver) {
        resolver = value;
      },
    } as ExtensionAPI,
    status,
  );
  const native = {
    renderCall: () => ({ render: () => ["historical call"], invalidate() {} }),
    renderResult: () => ({
      render: () => ["Useful failure reason and retained result"],
      invalidate() {},
    }),
  } as ToolRenderers;
  const renderer = resolver!("subagent", () => native)!;
  const theme = { fg: (_color: string, text: string) => text } as Theme;
  const context = {
    args: { agent: "worker" },
    toolCallId: "historical",
    expanded: false,
    executionStarted: true,
  } as Parameters<NonNullable<ToolRenderers["renderCall"]>>[2];
  const result = { content: [], details: {} };
  expect(renderer.renderCall!(context.args, theme, context).render(100)).toEqual([
    "historical call",
  ]);
  expect(
    renderer.renderResult!(result, { expanded: false, isPartial: false }, theme, context).render(
      100,
    ),
  ).toEqual(["Useful failure reason and retained result"]);
  status.observeTool("historical");
  expect(
    renderer.renderResult!(result, { expanded: false, isPartial: false }, theme, context).render(
      100,
    ),
  ).toEqual([]);
  expect(
    renderer.renderResult!(result, { expanded: true, isPartial: false }, theme, context).render(
      100,
    ),
  ).toEqual(["Useful failure reason and retained result"]);
  status.reset();
  expect(renderer.renderCall!(context.args, theme, context).render(100)).toEqual([
    "historical call",
  ]);
});
