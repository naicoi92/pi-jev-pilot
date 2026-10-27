import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { configuredTiers } from "../src/routing-settings.ts";

let directory = "";
const keys = [
  "PI_CODING_AGENT_DIR",
  "JEV_MAIN_ROUTING_ENABLED",
  "JEV_TIER_FAST",
  "JEV_TIER_BALANCED",
  "JEV_TIER_DEEP",
];
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "jev-routing-json-"));
  for (const key of keys) delete process.env[key];
  process.env.PI_CODING_AGENT_DIR = directory;
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});
const configure = (tiers: unknown) =>
  writeFileSync(join(directory, "jev-pilot.json"), JSON.stringify({ tiers }));
const tiers = { fast: "local/fast", balanced: "local/balanced", deep: "local/deep/model" };

test("routing-settings worker tiers unconfigured until supplied; obsolete main flag ignored", () => {
  expect(configuredTiers()).toEqual({});
  configure(tiers);
  for (const mainRoutingEnabled of [true, false, null, "invalid"])
    expect(
      configuredTiers({
        packages: ["kept"],
        jevPilot: { mainRoutingEnabled, tiers: { fast: "ignored/model" } },
      }),
    ).toEqual(tiers);
});

for (const value of [null, [], true, 1, "true"]) {
  test(`routing-settings malformed container ${JSON.stringify(value)} actionable`, () => {
    configure(value);
    expect(() => configuredTiers()).toThrow("tiers");
  });
}
for (const value of [null, true, 1, {}, [], "unqualified", "local/white space"]) {
  test(`routing-settings malformed tier ${JSON.stringify(value)} actionable`, () => {
    configure({ ...tiers, balanced: value });
    expect(() => configuredTiers()).toThrow("tiers.balanced");
  });
}

for (const value of [undefined, "", " ", "\t\n"]) {
  test(`routing-settings tier value ${JSON.stringify(value)} is not configured`, () => {
    for (const tier of Object.keys(tiers) as (keyof typeof tiers)[]) {
      const { [tier]: _omitted, ...others } = tiers;
      configure({ ...tiers, [tier]: value });
      expect(configuredTiers()).toEqual(others);
    }
  });
}

for (const value of ["true", "false", "", "invalid"]) {
  test(`routing-settings legacy environment ${JSON.stringify(value)} ignored; JSON authoritative`, () => {
    for (const key of keys.filter((key) => key !== "PI_CODING_AGENT_DIR")) process.env[key] = value;
    expect(configuredTiers()).toEqual({});
    configure(tiers);
    expect(configuredTiers({ jevPilot: { tiers: null } })).toEqual(tiers);
  });
}

for (const value of [null, [], true, 1, "invalid"]) {
  test(`routing-settings malformed ignored settings ${JSON.stringify(value)} cannot supply tiers`, () => {
    expect(configuredTiers(value)).toEqual({});
  });
}
