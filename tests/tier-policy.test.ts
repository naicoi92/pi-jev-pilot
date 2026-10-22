import { expect, test } from "bun:test";
import { selectTier, type TierDecision } from "../src/tier-policy.ts";

// AC-03 / TIER-03: literal results from pinned route()/allowed()/TIER_ORDER.
const tiers = { fast: "small/lookup", balanced: "middle/build", deep: "large/judgment" };
for (const fixture of [
  {
    name: "upgrade at .3",
    current: tiers.fast,
    tier: "deep",
    confidence: 0.3,
    risky: 0,
    expected: tiers.deep,
  },
  {
    name: "upgrade below .3",
    current: tiers.fast,
    tier: "deep",
    confidence: 0.29,
    risky: 0,
    expected: null,
  },
  {
    name: "downgrade at .6",
    current: tiers.deep,
    tier: "fast",
    confidence: 0.6,
    risky: 0,
    expected: tiers.fast,
  },
  {
    name: "downgrade below .6",
    current: tiers.deep,
    tier: "fast",
    confidence: 0.59,
    risky: 0,
    expected: null,
  },
  {
    name: "unmeasured upgrade",
    current: tiers.fast,
    tier: "balanced",
    confidence: null,
    risky: 0,
    expected: tiers.balanced,
  },
  {
    name: "unmeasured downgrade",
    current: tiers.deep,
    tier: "fast",
    confidence: null,
    risky: 0,
    expected: null,
  },
  {
    name: "risk forces deep",
    current: tiers.balanced,
    tier: "fast",
    confidence: 0.01,
    risky: 0.71,
    expected: tiers.deep,
  },
  {
    name: "risk boundary is not forced",
    current: tiers.balanced,
    tier: "fast",
    confidence: 0.01,
    risky: 0.7,
    expected: null,
  },
  {
    name: "same tier keeps model",
    current: tiers.deep,
    tier: "deep",
    confidence: 0.99,
    risky: 0.99,
    expected: null,
  },
  {
    name: "no fuzzy family match",
    current: "other/large/judgment-opus",
    tier: "fast",
    confidence: 0.3,
    risky: 0,
    expected: tiers.fast,
  },
] as const) {
  test(`TIER-03 ${fixture.name}`, () => {
    expect(selectTier(fixture as TierDecision, fixture.current, tiers)).toBe(fixture.expected);
  });
}
test("TIER-03 duplicate mappings retain the exact current identity", () => {
  expect(
    selectTier({ tier: "deep", confidence: 0.99, risky: 0.99 }, tiers.fast, {
      fast: tiers.fast,
      balanced: tiers.fast,
      deep: tiers.fast,
    }),
  ).toBeNull();
});
