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

for (const value of ["true", "false", "", "invalid"]) {
  test(`routing-settings legacy environment ${JSON.stringify(value)} ignored; JSON authoritative`, () => {
    for (const key of keys) process.env[key] = value;
    expect(mainRoutingEnabled()).toBe(false);
    expect(() => configuredTiers()).toThrow("jevPilot.tiers.fast");
    expect(mainRoutingEnabled({ jevPilot: { mainRoutingEnabled: true } })).toBe(true);
    expect(mainRoutingEnabled({ jevPilot: { mainRoutingEnabled: false } })).toBe(false);
    expect(() => mainRoutingEnabled({ jevPilot: { mainRoutingEnabled: null } })).toThrow(
      "jevPilot.mainRoutingEnabled",
    );
    expect(configuredTiers({ jevPilot: { tiers } })).toEqual(tiers);
    expect(() => configuredTiers({ jevPilot: null })).toThrow("jevPilot");
  });
}

for (const value of [null, [], true, 1, "invalid"]) {
  test(`routing-settings malformed effective settings ${JSON.stringify(value)} fail at unknown boundary`, () => {
    expect(() => mainRoutingEnabled(value)).toThrow("effective settings");
    expect(() => configuredTiers(value)).toThrow("effective settings");
  });
}
