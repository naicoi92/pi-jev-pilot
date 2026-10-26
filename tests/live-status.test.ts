import { expect, test } from "bun:test";
import type {
  ExtensionAPI,
  ExtensionUIContext,
  SessionEntry,
  Theme,
} from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { visibleWidth } from "@earendil-works/pi-tui";
import { DECISION_TYPE } from "../src/decision-visibility.ts";
import { LiveStatusLine, observeActivity, restoreLiveState } from "../src/live-status.ts";

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

type Factory = (tui: TUI, theme: Theme) => Component & { dispose?(): void };

function host() {
  const widgets: { key: string; content: Factory | string[] | undefined }[] = [];
  let renders = 0;
  const ui = {
    setWidget(key: string, content: Factory | string[] | undefined) {
      widgets.push({ key, content });
    },
  } as unknown as ExtensionUIContext;
  const tui = { requestRender: () => renders++ } as unknown as TUI;
  const theme = { fg: (color: string, text: string) => `\x1b[36m${text}\x1b[39m` } as Theme;
  const factory = () => widgets.at(-1)!.content as Factory;
  const mount = () => factory()(tui, theme);
  const plain = (width: number) =>
    mount()
      .render(width)
      .map((line) => line.replace(ANSI, ""));
  return { ui, widgets, plain, mount, renders: () => renders, tui, theme };
}

test("LIVE-1 attached line starts ready, one row, right-aligned with one column of padding", () => {
  const h = host();
  new LiveStatusLine().attach(h.ui);
  expect(h.widgets.at(-1)?.key).toBe("jev-pilot");
  const lines = h.plain(40);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toBe(`${" ".repeat(40 - "  Jev · ready".length - 1)}  Jev · ready`);
  expect(visibleWidth(lines[0]!)).toBeLessThanOrEqual(40);
});

function mounted(width = 120) {
  const h = host();
  const line = new LiveStatusLine();
  line.attach(h.ui);
  const text = () => h.plain(width)[0]!.trim();
  return { h, line, text };
}

test("LIVE-2 choosing effort shows spinner only while busy, then settled decision stays visible while idle", () => {
  const { line, text } = mounted();
  const token = line.choose();
  expect(text()).toMatch(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Jev · choosing effort$/);
  line.settle(token, {
    kind: "decided",
    effort: "high",
    requested: "high",
    skill: "systematic-debugging",
  });
  line.agentRunning(true);
  expect(text()).toBe("Jev · working · high · /systematic-debugging");
  line.agentRunning(false);
  expect(text()).toBe("Jev · high · /systematic-debugging");
});

test("LIVE-3 missing skill is omitted rather than carried from the previous turn", () => {
  const { line, text } = mounted();
  line.settle(line.choose(), { kind: "decided", effort: "high", requested: "high", skill: "tdd" });
  line.settle(line.choose(), { kind: "decided", effort: "low", requested: "low" });
  expect(text()).toBe("Jev · low");
});

test("LIVE-4 non-direct strategy advice is shown, wanted effort only when materially constrained", () => {
  const { line, text } = mounted();
  line.settle(line.choose(), {
    kind: "decided",
    effort: "medium",
    requested: "high",
    strategy: "parallel",
  });
  expect(text()).toBe("Jev · medium (wanted high) · strategy parallel");
});

test("LIVE-5 fallback warning keeps retained effort and survives activity updates until a new decision", () => {
  const { line, text } = mounted();
  line.settle(line.choose(), { kind: "fallback", effort: "medium", reason: "timeout" });
  expect(text()).toBe("Jev · fallback · medium · timeout");
  line.agentRunning(true);
  line.toolStarted("call-1", "read");
  expect(text()).toBe("Jev · reading · fallback · medium · timeout");
  line.toolFinished("call-1");
  line.settle(line.choose(), { kind: "skipped" });
  line.settle(line.choose(), { kind: "cancelled" });
  expect(text()).toBe("Jev · working · fallback · medium · timeout");
  line.settle(line.choose(), { kind: "decided", effort: "high", requested: "high" });
  line.agentRunning(false);
  expect(text()).toBe("Jev · high");
});

test("LIVE-6 invalid configuration is an error warning without an effort claim", () => {
  const { line, text } = mounted();
  line.settle(line.choose(), { kind: "error", reason: "invalid configuration" });
  expect(text()).toBe("Jev · error · invalid configuration");
});

test("LIVE-7 activity derives from public tool events and observed thinking only", () => {
  const { line, text } = mounted();
  line.agentRunning(true);
  const activity = () => text();
  expect(activity()).toBe("Jev · working");
  line.thinking(true);
  expect(activity()).toBe("Jev · thinking");
  line.thinking(false);
  for (const [tool, label] of [
    ["read", "reading"],
    ["grep", "searching"],
    ["find", "searching"],
    ["edit", "writing"],
    ["write", "writing"],
    ["bash", "running"],
    ["mystery-tool", "working"],
  ] as const) {
    line.toolStarted("c", tool);
    expect(activity()).toBe(`Jev · ${label}`);
    line.toolFinished("c");
  }
  line.toolStarted("a", "read");
  line.toolStarted("b", "bash");
  line.toolFinished("b");
  expect(activity()).toBe("Jev · reading");
  line.agentRunning(false);
  expect(text()).toBe("Jev · ready");
});

test("LIVE-8 stale choose token cannot overwrite a newer decision", () => {
  const { line, text } = mounted();
  const old = line.choose();
  const latest = line.choose();
  line.settle(latest, { kind: "decided", effort: "high", requested: "high" });
  line.settle(old, { kind: "fallback", effort: "low", reason: "timeout" });
  expect(text()).toBe("Jev · high");
});

test("LIVE-9 observed running workers: suffix while main is busy, activity when main is idle", () => {
  const { line, text } = mounted();
  line.settle(line.choose(), { kind: "decided", effort: "high", requested: "high", skill: "tdd" });
  line.setWorkers(1);
  expect(text()).toBe("Jev · 1 worker running · high · /tdd");
  line.setWorkers(2);
  line.agentRunning(true);
  line.toolStarted("c", "read");
  expect(text()).toBe("Jev · reading · high · /tdd · 2 workers");
  line.agentRunning(false);
  line.setWorkers(0);
  expect(text()).toBe("Jev · high · /tdd");
});

test("LIVE-10 narrowing drops strategy, then workers, then truncates skill; activity and effort stay", () => {
  const { h, line } = mounted();
  line.settle(line.choose(), {
    kind: "decided",
    effort: "high",
    requested: "high",
    skill: "very-long-skill-name",
    strategy: "parallel",
  });
  line.agentRunning(true);
  line.toolStarted("c", "read");
  line.setWorkers(2);
  const at = (width: number) => h.plain(width)[0]!.trim();
  const full = "Jev · reading · high · /very-long-skill-name · strategy parallel · 2 workers";
  const noStrategy = "Jev · reading · high · /very-long-skill-name · 2 workers";
  const noWorkers = "Jev · reading · high · /very-long-skill-name";
  expect(at(full.length + 3)).toBe(full);
  expect(at(full.length + 2)).toBe(noStrategy);
  expect(at(noStrategy.length + 3)).toBe(noStrategy);
  expect(at(noStrategy.length + 2)).toBe(noWorkers);
  expect(at(noWorkers.length + 3)).toBe(noWorkers);
  expect(at(noWorkers.length + 2)).toBe(`${noWorkers.slice(0, -2)}…`);
  expect(at("Jev · reading · high".length + 3)).toBe("Jev · reading · high");
  for (let width = 1; width <= full.length + 6; width++)
    for (const row of h.plain(width)) expect(visibleWidth(row)).toBeLessThanOrEqual(width);
});

test("LIVE-11 wide characters never overflow the content width", () => {
  const { h, line } = mounted();
  line.settle(line.choose(), { kind: "decided", effort: "high", requested: "high", skill: "調査" });
  for (let width = 1; width <= 40; width++)
    for (const row of h.plain(width)) expect(visibleWidth(row)).toBeLessThanOrEqual(width);
});

test("LIVE-12 spinner repaints only while busy and detach removes widget and timer", async () => {
  const h = host();
  const line = new LiveStatusLine(5);
  line.attach(h.ui);
  const component = h.mount();
  const choice = line.choose();
  const busyFrom = h.renders();
  await Bun.sleep(60);
  expect(h.renders()).toBeGreaterThan(busyFrom + 2);
  line.settle(choice, { kind: "skipped" });
  line.agentRunning(true);
  const idleAt = h.renders();
  await Bun.sleep(40);
  expect(h.renders()).toBe(idleAt);
  line.assessWorker();
  await Bun.sleep(30);
  line.detach();
  expect(h.widgets.at(-1)).toEqual({ key: "jev-pilot", content: undefined });
  const detachedAt = h.renders();
  await Bun.sleep(40);
  expect(h.renders()).toBe(detachedAt);
  component.dispose?.();
});

test("LIVE-13 attach resets to the new session and restores only the supplied durable effort and skill", () => {
  const { h, line, text } = mounted();
  line.settle(line.choose(), { kind: "fallback", effort: "low", reason: "timeout" });
  line.agentRunning(true);
  line.setWorkers(3);
  line.attach(h.ui, { effort: "high", skill: "tdd" });
  expect(text()).toBe("Jev · high · /tdd");
  line.attach(h.ui);
  expect(text()).toBe("Jev · ready");
});

test("LIVE-14 external thinking change updates a known effort and never invents one", () => {
  const { line, text } = mounted();
  line.setEffort("low");
  expect(text()).toBe("Jev · ready");
  line.settle(line.choose(), { kind: "decided", effort: "high", requested: "high" });
  line.setEffort("low");
  expect(text()).toBe("Jev · low");
});

test("LIVE-15 public agent, tool and message events drive activity; nested tool calls are ignored", () => {
  const { line, text } = mounted();
  const handlers = new Map<string, (event: unknown) => void>();
  observeActivity(
    {
      on: (name: string, handler: never) => handlers.set(name, handler),
    } as unknown as ExtensionAPI,
    line,
  );
  const emit = (name: string, event: object = {}) => handlers.get(name)?.({ type: name, ...event });
  const activity = () => text();
  emit("agent_start");
  expect(activity()).toBe("Jev · working");
  emit("message_update", { assistantMessageEvent: { type: "thinking_delta" } });
  expect(activity()).toBe("Jev · thinking");
  emit("message_update", { assistantMessageEvent: { type: "text_start" } });
  expect(activity()).toBe("Jev · working");
  emit("tool_execution_start", { toolCallId: "n", toolName: "bash", parentToolCallId: "outer" });
  expect(activity()).toBe("Jev · working");
  emit("tool_execution_start", { toolCallId: "t", toolName: "grep" });
  expect(activity()).toBe("Jev · searching");
  emit("tool_execution_end", { toolCallId: "t", toolName: "grep" });
  expect(activity()).toBe("Jev · working");
  emit("agent_end");
  expect(text()).toBe("Jev · ready");
});

// AC-5: independent pending identities, including cleanup arriving after reload.
test("STATUS-5 old worker assessment cleanup cannot clear a newer assessment", () => {
  const { h, line, text } = mounted();
  const old = line.assessWorker();
  expect(text()).toMatch(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Jev/);
  line.attach(h.ui);
  const current = line.assessWorker();
  old();
  old();
  expect(text()).toMatch(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Jev/);
  current();
  expect(text()).toBe("Jev · ready");
});

// AC-5: main completion and sibling worker completion own independent pending work.
test("STATUS-5 main completion cannot clear concurrent worker assessments", () => {
  const { line, text } = mounted();
  const main = line.choose();
  const first = line.assessWorker();
  const second = line.assessWorker();
  line.settle(main, { kind: "decided", effort: "medium", requested: "medium" });
  first();
  expect(text()).toMatch(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏] Jev · assessing worker/);
  second();
  expect(text()).toBe("Jev · medium");
});

test("worker-status summary stays single concise row at every width, not main effort", () => {
  const { h, line, text } = mounted();
  line.settle(line.choose(), { kind: "decided", effort: "high", requested: "high", skill: "tdd" });
  line.agentRunning(true);
  line.setWorkerSummary({ activity: "1 worker running", effort: "low", running: 1 });
  expect(text()).toBe("Jev · 1 worker running · low");
  expect(h.widgets).toHaveLength(1);
  expect(h.plain(160)).toHaveLength(1);
  for (let width = 1; width <= 160; width++)
    for (const row of h.plain(width)) expect(visibleWidth(row)).toBeLessThanOrEqual(width);
  line.setWorkerSummary({ activity: "2 workers accepted", effort: "mixed", running: 0 });
  expect(text()).toBe("Jev · 2 workers accepted · mixed");
});

const user = (inputId: string | undefined, id: string) =>
  ({
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-01-01T00:00:00Z",
    message: { role: "user", content: "task", ...(inputId ? { jevPilotInputId: inputId } : {}) },
  }) as unknown as SessionEntry;
const custom = (customType: string, data: unknown, id: string) =>
  ({
    type: "custom",
    id,
    parentId: null,
    timestamp: "2026-01-01T00:00:00Z",
    customType,
    data,
  }) as SessionEntry;
const mainRow = (outcome: string, effective: string) => ({
  version: 1,
  kind: "main",
  model: "local/parent",
  previous: "low",
  requested: effective,
  effective,
  outcome,
  elapsedMs: 5,
});

test("LIVE-16 restore takes the latest valid effort and only the latest turn's skill", () => {
  const skill = (inputId: string, name: string, id: string) =>
    custom("jev-pilot:skill", { inputId, skill: { name } }, id);
  expect(restoreLiveState([])).toEqual({});
  expect(
    restoreLiveState([
      user("a", "u1"),
      skill("a", "tdd", "s1"),
      custom(DECISION_TYPE, mainRow("classified", "high"), "d1"),
    ]),
  ).toEqual({ effort: "high", skill: "tdd" });
  expect(
    restoreLiveState([
      user("a", "u1"),
      skill("a", "tdd", "s1"),
      custom(DECISION_TYPE, mainRow("classified", "high"), "d1"),
      user(undefined, "u2"),
    ]),
  ).toEqual({ effort: "high" });
  expect(
    restoreLiveState([
      user("a", "u1"),
      skill("a", "tdd", "s1"),
      user("b", "u2"),
      custom(DECISION_TYPE, mainRow("timeout", "medium"), "d2"),
    ]),
  ).toEqual({ effort: "medium" });
});

test("LIVE-17 restore ignores malformed, unknown, cancelled and private values", () => {
  expect(
    restoreLiveState([
      user("a", "u1"),
      custom("jev-pilot:skill", { inputId: "a", skill: { name: "/etc/passwd secret path" } }, "s"),
      custom(DECISION_TYPE, { ...mainRow("classified", "high"), task: "PRIVATE" }, "bad"),
      custom(DECISION_TYPE, mainRow("cancelled", "low"), "cancelled"),
      custom(DECISION_TYPE, mainRow("classified", "unknown"), "unknown"),
    ]),
  ).toEqual({});
});

test("LIVE-18 a skipped effort decision still shows the skill and strategy actually selected, never a stale effort", () => {
  const { line, text } = mounted();
  line.settle(line.choose(), { kind: "skipped", skill: "tdd", strategy: "delegate" });
  expect(text()).toBe("Jev · /tdd · strategy delegate");
  line.settle(line.choose(), {
    kind: "fallback",
    effort: "medium",
    reason: "timeout",
    skill: "tdd",
  });
  expect(text()).toBe("Jev · fallback · medium · timeout · /tdd");
});
