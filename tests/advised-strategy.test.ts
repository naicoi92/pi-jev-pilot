import { expect, test } from "bun:test";
import { advisedStrategy } from "../src/guidance-policy.ts";

test("P12 STRATEGY-1 only actually advised non-direct strategies are reported", () => {
  expect(advisedStrategy({ strategy: "parallel", strategyConfidence: 0.9, tier: "balanced" })).toBe(
    "parallel",
  );
  expect(advisedStrategy({ strategy: "direct", strategyConfidence: 1 })).toBeUndefined();
  expect(advisedStrategy({ strategy: "parallel", strategyConfidence: 0.5 })).toBeUndefined();
  expect(
    advisedStrategy({ strategy: "parallel", strategyConfidence: 0.9, tier: "fast" }),
  ).toBeUndefined();
  expect(
    advisedStrategy({ strategy: "graph", strategyConfidence: 0.9, tier: "balanced" }),
  ).toBeUndefined();
  expect(advisedStrategy({ strategy: null, strategyConfidence: 1 })).toBeUndefined();
});
