import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  SettingsManager,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension from "../src/extension.ts";
import { configuredTiers, mainRoutingEnabled } from "../src/routing-settings.ts";

const saved = { ...process.env };
let directory: string | undefined;
beforeEach(() => {
  for (const key of [
    "JEV_MAIN_ROUTING_ENABLED",
    "JEV_TIER_FAST",
    "JEV_TIER_BALANCED",
    "JEV_TIER_DEEP",
    "JEV_CREW_CONFIG",
  ])
    delete process.env[key];
});
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
});
const tiers = { fast: "local/fast", balanced: "local/balanced", deep: "local/deep" };

test("routing-settings public host preserves unknown keys and recursively merges only trusted project in SDK agentDir", async () => {
  directory = await mkdtemp(join(tmpdir(), "jev-settings-host-"));
  const agentDir = join(directory, "sdk-agent");
  await mkdir(agentDir);
  await mkdir(join(directory, ".pi"));
  await writeFile(
    join(agentDir, "settings.json"),
    JSON.stringify({ packages: ["unrelated"], jevPilot: { mainRoutingEnabled: true, tiers } }),
  );
  await writeFile(
    join(directory, ".pi/settings.json"),
    JSON.stringify({ jevPilot: { tiers: { deep: "project/deep" } } }),
  );
  const host = SettingsManager.create(directory, agentDir, { projectTrusted: false });
  expect(mainRoutingEnabled(host.getSettings())).toBe(true);
  expect(configuredTiers(host.getSettings())).toEqual(tiers);
  host.setProjectTrusted(true);
  expect(configuredTiers(host.getSettings())).toEqual({ ...tiers, deep: "project/deep" });
  expect(host.getSettings().packages).toEqual(["unrelated"]);
  host.setProjectTrusted(false);
  expect(configuredTiers(host.getSettings())).toEqual(tiers);
});

test("routing-settings runtime binding only, idempotent starts and shutdown release registration", async () => {
  directory = await mkdtemp(join(tmpdir(), "jev-settings-binding-"));
  let initialized = false;
  let settings: unknown = { jevPilot: { mainRoutingEnabled: true, tiers } };
  let reads = 0;
  let registrations = 0;
  let removals = 0;
  let current: { input?: unknown } | undefined;
  const hooks = new Map<string, Function[]>();
  const notifications: string[] = [];
  const pi = {
    on(name: string, handler: Function) {
      hooks.set(name, [...(hooks.get(name) ?? []), handler]);
    },
    events: { on() {} },
    getSettings() {
      reads++;
      if (!initialized) throw new Error("factory settings unavailable");
      return settings;
    },
    registerVirtualModel(definition: { input?: unknown }) {
      current = { ...definition };
      registrations++;
    },
    unregisterVirtualModel() {
      current = undefined;
      removals++;
    },
  } as unknown as ExtensionAPI;
  extension(pi);
  expect(reads).toBe(0);
  expect(registrations).toBe(0);
  const ctx = {
    cwd: directory,
    modelRegistry: { find: () => current },
    ui: { notify: (message: string) => notifications.push(message) },
  } as unknown as ExtensionContext;
  const fire = async (name: string) => {
    for (const hook of hooks.get(name) ?? []) await hook({}, ctx);
  };
  initialized = true;
  await fire("session_start");
  await fire("session_start");
  expect(registrations).toBe(1);
  settings = { jevPilot: { mainRoutingEnabled: false, tiers: null } };
  await fire("session_start");
  expect(removals).toBe(1);
  expect(notifications).toEqual([]);
  settings = { jevPilot: { mainRoutingEnabled: true, tiers } };
  await fire("session_start");
  settings = { jevPilot: { mainRoutingEnabled: null } };
  await fire("session_start");
  expect(removals).toBe(2);
  expect(notifications.join()).toContain("jevPilot.mainRoutingEnabled");
  settings = { jevPilot: { mainRoutingEnabled: true, tiers } };
  await fire("session_start");
  await fire("session_shutdown");
  await fire("session_shutdown");
  expect(registrations).toBe(3);
  expect(removals).toBe(3);
});

test("routing-settings legacy env cannot register at factory", () => {
  process.env.JEV_MAIN_ROUTING_ENABLED = "true";
  let registrations = 0;
  extension({
    on() {},
    events: { on() {} },
    getSettings() {
      throw new Error("factory settings unavailable");
    },
    registerVirtualModel() {
      registrations++;
    },
  } as unknown as ExtensionAPI);
  expect(registrations).toBe(0);
});

for (const transition of ["session_shutdown", "disabled", "malformed"] as const) {
  for (const before of [false, true]) {
    test(`routing-settings foreign ${before ? "before" : "after"} registration survives ${transition} and next start`, async () => {
      let settings: unknown = { jevPilot: { mainRoutingEnabled: true, tiers } };
      const foreign = { input: ["text"], name: "Foreign Auto" };
      let current: unknown = before ? foreign : undefined;
      let registrations = 0;
      let removals = 0;
      const hooks = new Map<string, Function[]>();
      const notifications: string[] = [];
      extension({
        on(name: string, handler: Function) {
          hooks.set(name, [...(hooks.get(name) ?? []), handler]);
        },
        events: { on() {} },
        getSettings: () => settings,
        registerVirtualModel(definition: object) {
          registrations++;
          current = { ...definition };
        },
        unregisterVirtualModel() {
          removals++;
          current = undefined;
        },
      } as unknown as ExtensionAPI);
      const ctx = {
        modelRegistry: { find: () => current },
        ui: { notify: (message: string) => notifications.push(message) },
      } as unknown as ExtensionContext;
      const fire = async (event: string) => {
        for (const hook of hooks.get(event) ?? []) await hook({}, ctx);
      };
      await fire("session_start");
      expect(registrations).toBe(before ? 0 : 1);
      if (!before) current = foreign;
      if (transition === "disabled")
        settings = { jevPilot: { mainRoutingEnabled: false, tiers: null } };
      if (transition === "malformed") settings = { jevPilot: { mainRoutingEnabled: null } };
      await fire(transition === "session_shutdown" ? transition : "session_start");
      expect(current).toBe(foreign);
      expect(removals).toBe(0);
      settings = { jevPilot: { mainRoutingEnabled: true, tiers } };
      await fire("session_start");
      expect(current).toBe(foreign);
      expect(registrations).toBe(before ? 0 : 1);
      expect(notifications.join()).toContain("another extension owns");
    });
  }
}
