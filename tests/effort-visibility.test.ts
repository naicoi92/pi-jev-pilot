import { expect, test } from "bun:test";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { EffortVisibility } from "../src/effort-visibility.ts";

function host() {
  const widgets: (string[] | undefined)[] = [];
  const statuses: (string | undefined)[] = [];
  const ui = {
    setWidget(_key: string, lines: string[] | undefined) {
      widgets.push(lines);
    },
    setStatus(_key: string, text: string | undefined) {
      statuses.push(text);
    },
  } as ExtensionUIContext;
  return { ui, widgets, statuses };
}

test("visibility AC-26 stale completion cannot clear newer pending UI", () => {
  const h = host();
  const visibility = new EffortVisibility();
  const old = visibility.start(h.ui);
  const latest = visibility.start(h.ui);
  visibility.finish(old, "stale result");
  expect(h.widgets.at(-1)).toEqual(["Jev · choosing effort…"]);
  expect(h.statuses.at(-1)).toBeUndefined();
  visibility.finish(latest, "high → high · changed · classified");
  visibility.finish(old, "stale finally");
  expect(h.widgets.at(-1)).toBeUndefined();
  expect(h.statuses.at(-1)).toMatch(/changed · classified · \d+ms$/);
});

test("visibility AC-26 lifecycle clear invalidates pending and completed owners", () => {
  const h = host();
  const visibility = new EffortVisibility();
  const owner = visibility.start(h.ui);
  visibility.clear();
  visibility.finish(owner, "stale finally");
  expect(h.widgets.at(-1)).toBeUndefined();
  expect(h.statuses.at(-1)).toBeUndefined();
});

test("visibility AC-12 cancel clears pending once without overriding result", () => {
  const h = host();
  const visibility = new EffortVisibility();
  const owner = visibility.start(h.ui);
  visibility.finish(owner, "effort cancelled");
  visibility.finish(owner, "late service-error");
  expect(h.widgets.at(-1)).toBeUndefined();
  expect(h.statuses.at(-1)).toMatch(/effort cancelled · \d+ms$/);
});
