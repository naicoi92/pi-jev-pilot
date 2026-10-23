import { expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import juniorTurnBound from "../src/junior-turn-bound.ts";

function fixture(initial: SessionEntry[] = [], sessionId = "owned-child") {
  const entries = [...initial];
  const hooks = new Map<string, Function[]>();
  let aborts = 0;
  let failPersistence = false;
  const ctx = {
    sessionManager: { getSessionId: () => sessionId, getEntries: () => entries },
    abort: () => aborts++,
  } as unknown as ExtensionContext;
  const pi = {
    on: (name: string, fn: Function) => hooks.set(name, [...(hooks.get(name) ?? []), fn]),
    appendEntry: (customType: string, data: unknown) => {
      if (failPersistence) throw new Error("fixture write failure");
      entries.push({ type: "custom", customType, data } as SessionEntry);
    },
    events: { emit() {} },
  } as unknown as ExtensionAPI;
  const load = () => {
    hooks.clear();
    juniorTurnBound(pi);
  };
  load();
  return {
    entries,
    load,
    failPersistence: () => {
      failPersistence = true;
    },
    aborts: () => aborts,
    async fire(name: string, event: object = {}) {
      let result;
      for (const fn of hooks.get(name) ?? []) result = await fn(event, ctx);
      return result;
    },
  };
}

test("BOUND-19 reserves assistant turns, not successful responses or tool calls", async () => {
  const f = fixture();
  await f.fire("session_start");
  for (let turn = 1; turn <= 40; turn++) {
    await f.fire("turn_start");
    for (let tool = 0; tool < 3; tool++) expect(await f.fire("tool_call")).toBeUndefined();
    await f.fire("turn_end", {
      message: { role: "assistant", stopReason: turn === 1 ? "error" : "stop" },
    });
  }
  expect(f.aborts()).toBe(0);
  await f.fire("turn_start");
  expect(f.aborts()).toBe(1);
  expect(await f.fire("tool_call")).toMatchObject({ block: true });
  const reservations = f.entries.filter(
    (e) => e.type === "custom" && e.customType === "jev-pilot:junior-turns",
  );
  expect(reservations).toHaveLength(40);
  await f.fire("turn_end", { message: { role: "assistant", stopReason: "aborted" } });
  await f.fire("turn_start");
  expect(
    f.entries.filter((e) => e.type === "custom" && e.customType === "jev-pilot:junior-turns"),
  ).toHaveLength(40);
});

test("BOUND-19 retained session reload and compaction do not refund cancelled turns", async () => {
  const f = fixture();
  await f.fire("session_start");
  for (let turn = 1; turn <= 39; turn++) await f.fire("turn_start");
  await f.fire("turn_end", { message: { role: "assistant", stopReason: "aborted" } });
  f.entries.push({ type: "compaction" } as SessionEntry);
  f.load();
  await f.fire("session_start");
  await f.fire("before_agent_start");
  expect(f.aborts()).toBe(0);
  await f.fire("turn_start");
  await f.fire("turn_end", { message: { role: "assistant", stopReason: "toolUse" } });
  expect(f.aborts()).toBe(1);
  f.load();
  await f.fire("session_start");
  await f.fire("before_agent_start");
  expect(f.aborts()).toBe(2);
});

test("BOUND-19 fresh independent session does not inherit another child's quota", async () => {
  const first = fixture();
  await first.fire("session_start");
  for (let turn = 1; turn <= 40; turn++) await first.fire("turn_start");
  const second = fixture(first.entries, "fresh-independent-child");
  await second.fire("session_start");
  await second.fire("before_agent_start");
  await second.fire("turn_start");
  expect(second.aborts()).toBe(0);
});

test("BOUND-19 cap reports a truthful error without discarding partial output", async () => {
  const f = fixture();
  await f.fire("session_start");
  for (let turn = 1; turn <= 40; turn++) await f.fire("turn_start");
  await f.fire("turn_end", { message: { role: "assistant", stopReason: "toolUse" } });
  const result = await f.fire("message_end", {
    message: {
      role: "assistant",
      content: [{ type: "text", text: "partial" }],
      stopReason: "error",
      errorMessage: "aborted",
    },
  });
  expect(result.message).toMatchObject({
    stopReason: "error",
    errorMessage: expect.stringContaining("40 assistant turns"),
  });
  expect(result.message.content[0].text).toBe("partial");
});

test("BOUND-19 exhausted sessions cannot compact or warm the provider cache", async () => {
  const f = fixture();
  await f.fire("session_start");
  for (let turn = 1; turn <= 40; turn++) await f.fire("turn_start");
  expect(await f.fire("cache_warming_decision")).toEqual({ action: "stop" });
  expect(await f.fire("session_before_compact")).toEqual({ cancel: true });
  expect(f.aborts()).toBe(1);
});

test("BOUND-19 persistence failure aborts without further tool activity", async () => {
  const f = fixture();
  await f.fire("session_start");
  f.failPersistence();
  await f.fire("turn_start");
  expect(f.aborts()).toBe(1);
  expect(await f.fire("tool_call")).toMatchObject({
    block: true,
    reason: expect.stringContaining("could not persist"),
  });
  const result = await f.fire("message_end", {
    message: { role: "assistant", stopReason: "aborted", content: [] },
  });
  expect(result.message.errorMessage).toContain("could not persist");
});
