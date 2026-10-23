import { afterEach, beforeEach, expect, test } from "bun:test";
import { configuredTiers, mainRoutingEnabled } from "../src/routing-settings.ts";

const keys = ["JEV_MAIN_ROUTING_ENABLED", "JEV_TIER_FAST", "JEV_TIER_BALANCED", "JEV_TIER_DEEP"];
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
beforeEach(() => {
  for (const key of keys) delete process.env[key];
});
afterEach(() => {
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});
const tiers = { fast: "local/fast", balanced: "local/balanced", deep: "local/deep/model" };

test("routing-settings omitted enablement is false; tiers remain unconfigured", () => {
  expect(mainRoutingEnabled()).toBe(false);
  expect(() => configuredTiers()).toThrow("jevPilot.tiers.fast");
  expect(mainRoutingEnabled({ jevPilot: { tiers: null } })).toBe(false);
});

test("routing-settings narrow unknown public settings, preserve unrelated keys", () => {
  expect(
    mainRoutingEnabled({ packages: ["kept"], jevPilot: { mainRoutingEnabled: true, extra: 7 } }),
  ).toBe(true);
  expect(configuredTiers({ jevPilot: { tiers } })).toEqual(tiers);
});

for (const value of [null, [], true, 1, "true"]) {
  test(`routing-settings malformed container ${JSON.stringify(value)} actionable`, () => {
    expect(() => mainRoutingEnabled({ jevPilot: value })).toThrow("jevPilot");
    expect(() => configuredTiers({ jevPilot: { tiers: value } })).toThrow("jevPilot.tiers");
  });
}
for (const value of [null, "true", 1, {}, []]) {
  test(`routing-settings malformed enablement ${JSON.stringify(value)} actionable`, () => {
    expect(() => mainRoutingEnabled({ jevPilot: { mainRoutingEnabled: value } })).toThrow(
      "jevPilot.mainRoutingEnabled",
    );
  });
}
for (const value of [null, true, 1, {}, [], "", "unqualified", "local/white space"]) {
  test(`routing-settings malformed tier ${JSON.stringify(value)} actionable`, () => {
    expect(() => configuredTiers({ jevPilot: { tiers: { ...tiers, balanced: value } } })).toThrow(
      "jevPilot.tiers.balanced",
    );
  });
}

test("routing-settings explicit environment wins per field including false and invalid empty", () => {
  process.env.JEV_MAIN_ROUTING_ENABLED = "false";
  expect(mainRoutingEnabled({ jevPilot: { mainRoutingEnabled: true } })).toBe(false);
  expect(mainRoutingEnabled({ jevPilot: null })).toBe(false);
  process.env.JEV_MAIN_ROUTING_ENABLED = "true";
  expect(mainRoutingEnabled({ jevPilot: { mainRoutingEnabled: null } })).toBe(true);
  process.env.JEV_MAIN_ROUTING_ENABLED = "";
  expect(() => mainRoutingEnabled()).toThrow("JEV_MAIN_ROUTING_ENABLED");
  process.env.JEV_TIER_FAST = "override/fast";
  expect(configuredTiers({ jevPilot: { tiers: { ...tiers, fast: null } } })).toEqual({
    ...tiers,
    fast: "override/fast",
  });
  process.env.JEV_TIER_FAST = "";
  expect(() => configuredTiers({ jevPilot: { tiers } })).toThrow("JEV_TIER_FAST");
});

test("routing-settings all explicit tiers bypass unused malformed JSON", () => {
  for (const tier of ["fast", "balanced", "deep"] as const)
    process.env[`JEV_TIER_${tier.toUpperCase()}`] = tiers[tier];
  expect(configuredTiers({ jevPilot: null })).toEqual(tiers);
});

for (const value of [null, [], true, 1, "invalid"]) {
  test(`routing-settings malformed effective settings ${JSON.stringify(value)} fail at unknown boundary`, () => {
    expect(() => mainRoutingEnabled(value)).toThrow("effective settings");
    expect(() => configuredTiers(value)).toThrow("effective settings");
  });
}
