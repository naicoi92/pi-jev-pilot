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
    name: "upgrade below .3 still follows Jev",
    current: tiers.fast,
    tier: "deep",
    confidence: 0.29,
    risky: 0,
    expected: tiers.deep,
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
    name: "downgrade below .6 still follows Jev",
    current: tiers.deep,
    tier: "fast",
    confidence: 0.59,
    risky: 0,
    expected: tiers.fast,
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
    name: "unmeasured downgrade still follows Jev",
    current: tiers.deep,
    tier: "fast",
    confidence: null,
    risky: 0,
    expected: tiers.fast,
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
    name: "risk boundary is not forced and Jev's tier wins",
    current: tiers.balanced,
    tier: "fast",
    confidence: 0.01,
    risky: 0.7,
    expected: tiers.fast,
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

test("SPARSE-01 risk override selects the highest configured tier when deep is absent", () => {
  const sparse = { fast: tiers.fast, balanced: tiers.balanced };
  expect(selectTier({ tier: "fast", confidence: 0.01, risky: 0.71 }, tiers.fast, sparse)).toBe(
    tiers.balanced,
  );
  expect(selectTier({ tier: "fast", confidence: 0.01, risky: 0.7 }, tiers.balanced, sparse)).toBe(
    tiers.fast,
  );
});
test("SPARSE-01 risk override changes nothing when no tier is configured", () => {
  expect(selectTier({ tier: "fast", confidence: 0.9, risky: 0.99 }, tiers.fast, {})).toBeNull();
});

test("EXPERT-02 expert is admitted only strictly above 0.9 and otherwise runs deep", () => {
  const all = { ...tiers, expert: "huge/expert" };
  const choice = (expertNeeded: number | null | undefined, risky = 0): TierDecision => ({
    tier: "expert",
    confidence: 0.95,
    risky,
    expertNeeded,
  });
  expect(selectTier(choice(0.91), tiers.deep, all)).toBe(all.expert);
  expect(selectTier(choice(0.9), tiers.fast, all)).toBe(all.deep);
  expect(selectTier(choice(undefined), tiers.fast, all)).toBe(all.deep);
  expect(selectTier(choice(null), tiers.fast, all)).toBe(all.deep);
  expect(selectTier(choice(0.9), tiers.fast, { ...all, deep: undefined })).toBeNull();
  expect(selectTier(choice(0.99), tiers.fast, tiers)).toBe(tiers.deep);
});

test("EXPERT-02 risk never selects expert but cannot suppress an admitted expert choice", () => {
  const all = { ...tiers, expert: "huge/expert" };
  const risky = { tier: "fast", confidence: 0.01, risky: 0.9, expertNeeded: 0.99 } as const;
  expect(selectTier(risky, tiers.fast, all)).toBe(all.deep);
  expect(selectTier(risky, tiers.fast, { expert: all.expert })).toBeNull();
  const expert = { ...risky, tier: "expert", confidence: 0.95 } as const;
  expect(selectTier(expert, tiers.fast, all)).toBe(all.expert);
  expect(selectTier(expert, all.expert, all)).toBeNull();
  expect(selectTier({ ...expert, expertNeeded: 0.9 }, tiers.fast, all)).toBe(all.deep);
  expect(selectTier({ ...expert, confidence: 0.1 }, tiers.fast, all)).toBe(all.expert);
});

test("tier presentation observer reports actual policy selection without inventing retained tier", () => {
  const tiers = {
    fast: "local/shared",
    balanced: "local/shared",
    deep: "local/deep",
    expert: "local/expert",
  };
  const observed: string[] = [];
  expect(
    selectTier({ tier: "balanced", confidence: 1, risky: 0 }, "local/deep", tiers, (tier) =>
      observed.push(tier),
    ),
  ).toBe("local/shared");
  expect(observed).toEqual(["balanced"]);
  observed.length = 0;
  expect(
    selectTier({ tier: "balanced", confidence: 1, risky: 0 }, "local/shared", tiers, (tier) =>
      observed.push(tier),
    ),
  ).toBeNull();
  expect(observed).toEqual([]);
  expect(
    selectTier({ tier: "fast", confidence: 0, risky: 1 }, "local/shared", tiers, (tier) =>
      observed.push(tier),
    ),
  ).toBe("local/deep");
  expect(observed).toEqual(["deep"]);
});
