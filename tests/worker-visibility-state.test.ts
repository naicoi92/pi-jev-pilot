import { expect, test } from "bun:test";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { WorkerVisibility, workerTarget } from "../src/worker-visibility.ts";

function uiFixture() {
  let lines: string[] | undefined;
  let status: string | undefined;
  const ui = {
    setWidget(_key: string, value: string[] | undefined) {
      lines = value;
    },
    setStatus(_key: string, value: string | undefined) {
      status = value;
    },
  } as ExtensionUIContext;
  return { ui, lines: () => lines, status: () => status };
}

test("UNIT-WV-bounds WV-05 visible rows and retained owners remain bounded", () => {
  const f = uiFixture();
  const visibility = new WorkerVisibility();
  const oldest = visibility.start("oldest", f.ui);
  for (let i = 1; i <= 20; i++)
    visibility.finish(visibility.start(`call-${i}`, f.ui), `decision ${i}`);
  expect(f.lines()).toHaveLength(4);
  expect(f.status()).toBe("jev workers · 12 recent · showing 4");
  const before = f.lines();
  visibility.finish(oldest, "stale");
  visibility.result("oldest", { asyncId: "old-run" });
  visibility.complete("old-run", "complete");
  expect(f.lines()).toEqual(before);
});

test("UNIT-WV-stale WV-05 old completion cannot overwrite replacement owner", () => {
  const f = uiFixture();
  const visibility = new WorkerVisibility();
  const old = visibility.start("same-id", f.ui);
  visibility.start("same-id", f.ui);
  visibility.finish(old, "stale");
  expect(f.lines()?.join()).toContain("choosing model + effort");
  visibility.clear();
  visibility.finish(old, "stale");
  visibility.result("same-id", { asyncId: "run" });
  expect(f.lines()).toBeUndefined();
  expect(f.status()).toBeUndefined();
});

test("UNIT-WV-privacy-target WV-07 only identifiers and enumerated effort enter UI", () => {
  expect(workerTarget("local/deep\nPRIVATE_TASK", "PRIVATE_LEVEL")).toBe(
    "executor default/unknown · effort executor-owned/unknown",
  );
  expect(workerTarget("local/deep:high", "max")).toBe("local/deep · effort max");
});
