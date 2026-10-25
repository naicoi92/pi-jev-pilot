import { expect, test } from "bun:test";
import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { EffortVisibility } from "../src/effort-visibility.ts";
import { LiveStatusLine } from "../src/live-status.ts";

function host() {
  const widgets: unknown[] = [];
  const statuses: (string | undefined)[] = [];
  let component: Component | undefined;
  const ui = {
    setWidget(_key: string, content: unknown) {
      widgets.push(content);
      component =
        typeof content === "function"
          ? (content as (tui: TUI, theme: unknown) => Component)({ requestRender() {} } as TUI, {
              fg: (_color: string, text: string) => text,
            })
          : undefined;
    },
    setStatus(_key: string, text: string | undefined) {
      statuses.push(text);
    },
  } as unknown as ExtensionUIContext;
  const line = new LiveStatusLine();
  line.attach(ui);
  const visibility = new EffortVisibility(line);
  const text = () => component!.render(80)[0]!.trim();
  return { ui, widgets, statuses, visibility, text };
}
const decided = { kind: "decided", effort: "high", requested: "high" } as const;

test("visibility AC-26 stale completion cannot clear newer pending UI", () => {
  const h = host();
  const old = h.visibility.start(h.ui);
  const latest = h.visibility.start(h.ui);
  h.visibility.finish(old, "stale result", { kind: "fallback", effort: "low", reason: "timeout" });
  expect(h.text()).toMatch(/choosing effort$/);
  expect(h.statuses.at(-1)).toBeUndefined();
  h.visibility.finish(latest, "high → high · changed · classified", decided);
  h.visibility.finish(old, "stale finally", { kind: "cancelled" });
  expect(h.text()).toBe("Jev · high");
  expect(h.statuses.at(-1)).toMatch(/changed · classified · \d+ms$/);
});

test("visibility AC-26 lifecycle clear invalidates pending and completed owners", () => {
  const h = host();
  const owner = h.visibility.start(h.ui);
  h.visibility.clear();
  h.visibility.finish(owner, "stale finally", decided);
  expect(h.text()).toBe("Jev · ready");
  expect(h.statuses.at(-1)).toBeUndefined();
});

test("visibility AC-12 cancel clears pending once without overriding result", () => {
  const h = host();
  const owner = h.visibility.start(h.ui);
  h.visibility.finish(owner, "effort cancelled", { kind: "cancelled" });
  h.visibility.finish(owner, "late service-error", {
    kind: "fallback",
    effort: "low",
    reason: "error",
  });
  expect(h.text()).toBe("Jev · ready");
  expect(h.statuses.at(-1)).toMatch(/effort cancelled · \d+ms$/);
});

test("P12 LIVE-LEGACY the transient string widget is gone; only the live line owns the widget", () => {
  const h = host();
  h.visibility.start(h.ui);
  expect(h.widgets.some((content) => Array.isArray(content))).toBe(false);
});
