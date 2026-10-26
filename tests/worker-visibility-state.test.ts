import { expect, test } from "bun:test";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { WorkerVisibility, workerTarget } from "../src/worker-visibility.ts";

function uiFixture() {
  let lines: readonly string[] = [];
  let status: string | undefined;
  const ui = {
    setWidget(_key: string, value: string[] | undefined) {
      lines = value ?? [];
    },
    setStatus(_key: string, value: string | undefined) {
      status = value;
    },
  } as ExtensionUIContext;
  return {
    ui,
    lines: () => lines,
    status: () => status,
    onRows: (value: readonly string[]) => {
      lines = value;
    },
  };
}

test("UNIT-WV-bounds WV-05 visible rows and retained owners remain bounded", () => {
  const f = uiFixture();
  const visibility = new WorkerVisibility(undefined, undefined, f.onRows);
  const oldest = visibility.start("oldest", f.ui);
  for (let i = 1; i <= 20; i++)
    visibility.finish(visibility.start(`call-${i}`, f.ui), `decision ${i}`);
  expect(f.lines()).toHaveLength(4);
  expect(f.status()).toBeUndefined();
  const before = f.lines();
  visibility.finish(oldest, "stale");
  visibility.result("oldest", { asyncId: "old-run" });
  visibility.complete("old-run", "complete");
  expect(f.lines()).toEqual(before);
});

test("UNIT-WV-stale WV-05 old completion cannot overwrite replacement owner", () => {
  const f = uiFixture();
  const visibility = new WorkerVisibility(undefined, undefined, f.onRows);
  const old = visibility.start("same-id", f.ui);
  visibility.start("same-id", f.ui);
  visibility.finish(old, "stale");
  expect(f.lines()?.join()).toContain("choosing model + effort");
  visibility.clear();
  visibility.finish(old, "stale");
  visibility.result("same-id", { asyncId: "run" });
  expect(f.lines()).toEqual([]);
  expect(f.status()).toBeUndefined();
});

test("UNIT-WV-privacy-target WV-07 only identifiers and enumerated effort enter UI", () => {
  expect(workerTarget("local/deep\nPRIVATE_TASK", "PRIVATE_LEVEL")).toBe(
    "executor default/unknown · effort executor-owned/unknown",
  );
  expect(workerTarget("local/deep:high", "max")).toBe("local/deep · effort max");
});

function counted() {
  const f = uiFixture();
  const counts: number[] = [];
  const visibility = new WorkerVisibility(undefined, (count) => counts.push(count));
  return { f, counts, visibility };
}

test("P12 WORKERS-1 only allowed launches count; classification and blocked calls do not", () => {
  const { f, counts, visibility } = counted();
  const deciding = visibility.start("deciding", f.ui, "worker");
  expect(counts).toEqual([]);
  visibility.finish(deciding, "selected", false, { outcome: "classified" });
  expect(counts).toEqual([1]);
  const blocked = visibility.start("blocked", f.ui, "worker");
  visibility.finish(blocked, "not launched · preflight", true);
  const refused = visibility.start("refused", f.ui, "worker");
  visibility.finish(refused, "decision error · launch unconfirmed");
  visibility.refuse(refused);
  expect(counts.at(-1)).toBe(1);
  visibility.result("deciding", { mode: "single", results: [] });
  expect(counts.at(-1)).toBe(0);
});

test("P12 WORKERS-2 async acceptance keeps counting until its completion event", () => {
  const { f, counts, visibility } = counted();
  const owner = visibility.start("call", f.ui, "worker");
  visibility.finish(owner, "selected");
  visibility.result("call", { asyncId: "run-1" });
  expect(counts.at(-1)).toBe(1);
  visibility.complete("unrelated", "complete");
  expect(counts.at(-1)).toBe(1);
  visibility.complete("run-1", "complete");
  expect(counts.at(-1)).toBe(0);
});

test("P12 WORKERS-3 running count survives history eviction and resets on clear or settle", () => {
  const { f, counts, visibility } = counted();
  visibility.finish(visibility.start("first", f.ui), "selected");
  visibility.result("first", { asyncId: "run-first" });
  for (let i = 0; i < 15; i++) visibility.finish(visibility.start(`call-${i}`, f.ui), "selected");
  expect(counts.at(-1)).toBe(16);
  visibility.complete("run-first", "failed");
  expect(counts.at(-1)).toBe(15);
  visibility.settle();
  expect(counts.at(-1)).toBe(0);
  visibility.finish(visibility.start("again", f.ui), "selected");
  expect(counts.at(-1)).toBe(1);
  visibility.clear();
  expect(counts.at(-1)).toBe(0);
});
