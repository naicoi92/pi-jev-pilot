import { expect, test } from "bun:test";
import { selectWorkerModel } from "../src/crew-policy.ts";
const tiers = { fast: "local/fast", balanced: "local/balanced", deep: "local/deep" };
const slots = [{ name: "deep", model: "local/cheap", when: "Read files" }];
test("CREW-03 approved risk deep wins over confident custom choice", () => {
  expect(
    selectWorkerModel(
      { tier: "fast", slot: "deep", confidence: 0.9, risky: 0.95 },
      tiers.balanced,
      tiers,
      slots,
    ),
  ).toBe("local/deep");
  expect(
    selectWorkerModel(
      { tier: "fast", slot: "deep", confidence: 0.9, risky: 0.7 },
      tiers.balanced,
      tiers,
      slots,
    ),
  ).toBe("local/cheap");
});
test("CREW-03 forced deep remains authoritative when parent baseline is already deep", () => {
  expect(
    selectWorkerModel(
      { tier: "fast", slot: "deep", confidence: 0.9, risky: 0.95 },
      tiers.deep,
      tiers,
      slots,
    ),
  ).toBe("local/deep");
  expect(
    selectWorkerModel(
      { tier: "fast", slot: "deep", confidence: 0.9, risky: 0.7 },
      tiers.deep,
      tiers,
      slots,
    ),
  ).toBe("local/cheap");
});
test("CREW-03 custom choices require original downgrade confidence", () => {
  for (const confidence of [null, 0.59])
    expect(
      selectWorkerModel(
        { tier: "fast", slot: "deep", confidence, risky: 0 },
        tiers.balanced,
        tiers,
        slots,
      ),
    ).toBeNull();
  expect(
    selectWorkerModel(
      { tier: "fast", slot: "deep", confidence: 0.6, risky: 0 },
      tiers.balanced,
      tiers,
      slots,
    ),
  ).toBe("local/cheap");
});
test("SPARSE-01 risk override falls back to the highest configured tier, then to nothing", () => {
  const decision = { tier: "fast", slot: "deep", confidence: 0.9, risky: 0.95 } as const;
  expect(
    selectWorkerModel(decision, tiers.fast, { fast: tiers.fast, balanced: tiers.balanced }, slots),
  ).toBe(tiers.balanced);
  expect(selectWorkerModel(decision, tiers.fast, {}, slots)).toBeNull();
});
