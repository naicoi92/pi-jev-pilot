import { expect, test } from "bun:test";
import { selectWorkerModel } from "../src/crew-policy.ts";
const tiers = { fast: "local/fast", balanced: "local/balanced", deep: "local/deep" };
const slots = [{ name: "deep", model: "local/cheap", when: "Read files" }];
test("CREW-03 approved risk deep wins over confident custom choice", () => {
  expect(
    selectWorkerModel({ tier: "fast", slot: "deep", confidence: 0.9, risky: 0.95 }, tiers, slots),
  ).toBe("local/deep");
  expect(
    selectWorkerModel({ tier: "fast", slot: "deep", confidence: 0.9, risky: 0.7 }, tiers, slots),
  ).toBe("local/cheap");
});
test("CREW-03 custom choices follow Jev regardless of confidence", () => {
  for (const confidence of [null, 0, 0.59, 0.6])
    expect(
      selectWorkerModel({ tier: "fast", slot: "deep", confidence, risky: 0 }, tiers, slots),
    ).toBe("local/cheap");
});
test("SPARSE-01 risk override falls back to the highest configured tier, then to nothing", () => {
  const decision = { tier: "fast", slot: "deep", confidence: 0.9, risky: 0.95 } as const;
  expect(selectWorkerModel(decision, { fast: tiers.fast, balanced: tiers.balanced }, slots)).toBe(
    tiers.balanced,
  );
  expect(selectWorkerModel(decision, {}, slots)).toBeNull();
});

test("EXPERT-02 admitted expert survives the risk override and a failed gate resolves to deep", () => {
  const all = { ...tiers, expert: "local/expert" };
  const expert = { tier: "expert", confidence: 0.95, risky: 0.95 } as const;
  expect(selectWorkerModel({ ...expert, expertNeeded: 0.95 }, all, slots)).toBe(all.expert);
  expect(selectWorkerModel({ ...expert, expertNeeded: 0.9 }, all, slots)).toBe(all.deep);
  expect(
    selectWorkerModel(
      { tier: "fast", confidence: 0.9, risky: 0.95, expertNeeded: 0.99 },
      all,
      slots,
    ),
  ).toBe(all.deep);
});
