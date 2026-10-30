import { expect, test } from "bun:test";
import { selectTier, type TierDecision } from "../src/tier-policy.ts";

// Jev's tier choice is authoritative: neither classifier confidence nor the model that would
// otherwise run (parent, caller or agent default) can veto it.
const tiers = { fast: "small/lookup", balanced: "middle/build", deep: "large/judgment" };
for (const fixture of [
  { name: "upgrade at .3", tier: "deep", confidence: 0.3, risky: 0, expected: tiers.deep },
  {
    name: "upgrade below .3 follows Jev",
    tier: "deep",
    confidence: 0.29,
    risky: 0,
    expected: tiers.deep,
  },
  { name: "downgrade at .6", tier: "fast", confidence: 0.6, risky: 0, expected: tiers.fast },
  {
    name: "downgrade below .6 follows Jev",
    tier: "fast",
    confidence: 0.59,
    risky: 0,
    expected: tiers.fast,
  },
  {
    name: "unmeasured confidence follows Jev",
    tier: "balanced",
    confidence: null,
    risky: 0,
    expected: tiers.balanced,
  },
  {
    name: "zero confidence follows Jev",
    tier: "fast",
    confidence: 0,
    risky: 0,
    expected: tiers.fast,
  },
  { name: "risk forces deep", tier: "fast", confidence: 0.01, risky: 0.71, expected: tiers.deep },
  {
    name: "risk boundary is not forced",
    tier: "fast",
    confidence: 0.01,
    risky: 0.7,
    expected: tiers.fast,
  },
  {
    name: "risk on the deep tier stays deep",
    tier: "deep",
    confidence: 0.99,
    risky: 0.99,
    expected: tiers.deep,
  },
] as const) {
  test(`TIER-03 ${fixture.name}`, () => {
    expect(selectTier(fixture as TierDecision, tiers)).toBe(fixture.expected);
  });
}

test("TIER-03 the chosen tier is returned even when the same model is already running", () => {
  // A null here would let the agent's configured default run instead of Jev's choice.
  expect(selectTier({ tier: "balanced", confidence: 1, risky: 0 }, tiers)).toBe(tiers.balanced);
});

test("TIER-03 duplicate mappings still select the chosen tier", () => {
  const shared = { fast: tiers.fast, balanced: tiers.fast, deep: tiers.fast };
  expect(selectTier({ tier: "deep", confidence: 0.99, risky: 0.99 }, shared)).toBe(tiers.fast);
});

test("SPARSE-01 risk override selects the highest configured tier when deep is absent", () => {
  const sparse = { fast: tiers.fast, balanced: tiers.balanced };
  expect(selectTier({ tier: "fast", confidence: 0.01, risky: 0.71 }, sparse)).toBe(tiers.balanced);
  expect(selectTier({ tier: "fast", confidence: 0.01, risky: 0.7 }, sparse)).toBe(tiers.fast);
});
test("SPARSE-01 risk override changes nothing when no tier is configured", () => {
  expect(selectTier({ tier: "fast", confidence: 0.9, risky: 0.99 }, {})).toBeNull();
});

test("EXPERT-02 expert is admitted only strictly above 0.9 and otherwise runs deep", () => {
  const all = { ...tiers, expert: "huge/expert" };
  const choice = (expertNeeded: number | null | undefined, risky = 0): TierDecision => ({
    tier: "expert",
    confidence: 0.95,
    risky,
    expertNeeded,
  });
  expect(selectTier(choice(0.91), all)).toBe(all.expert);
  expect(selectTier(choice(0.9), all)).toBe(all.deep);
  expect(selectTier(choice(undefined), all)).toBe(all.deep);
  expect(selectTier(choice(null), all)).toBe(all.deep);
  expect(selectTier(choice(0.9), { ...all, deep: undefined })).toBeNull();
  expect(selectTier(choice(0.99), tiers)).toBe(tiers.deep);
});

test("EXPERT-02 risk never selects expert but cannot suppress an admitted expert choice", () => {
  const all = { ...tiers, expert: "huge/expert" };
  const risky = { tier: "fast", confidence: 0.01, risky: 0.9, expertNeeded: 0.99 } as const;
  expect(selectTier(risky, all)).toBe(all.deep);
  expect(selectTier(risky, { expert: all.expert })).toBeNull();
  const expert = { ...risky, tier: "expert", confidence: 0.95 } as const;
  expect(selectTier(expert, all)).toBe(all.expert);
  expect(selectTier({ ...expert, expertNeeded: 0.9 }, all)).toBe(all.deep);
  expect(selectTier({ ...expert, confidence: 0.1 }, all)).toBe(all.expert);
});

test("tier presentation observer reports the tier Jev actually selected", () => {
  const shared = {
    fast: "local/shared",
    balanced: "local/shared",
    deep: "local/deep",
    expert: "local/expert",
  };
  const observed: string[] = [];
  expect(
    selectTier({ tier: "balanced", confidence: 1, risky: 0 }, shared, (tier) =>
      observed.push(tier),
    ),
  ).toBe("local/shared");
  expect(observed).toEqual(["balanced"]);
  observed.length = 0;
  expect(
    selectTier({ tier: "fast", confidence: 0, risky: 1 }, shared, (tier) => observed.push(tier)),
  ).toBe("local/deep");
  expect(observed).toEqual(["deep"]);
});
