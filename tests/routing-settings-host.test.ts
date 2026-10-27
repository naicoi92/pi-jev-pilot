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
import { configuredTiers } from "../src/routing-settings.ts";

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

test("routing-settings ignores public merged settings and consumes only global JSON", async () => {
  directory = await mkdtemp(join(tmpdir(), "jev-settings-host-"));
  const agentDir = join(directory, "sdk-agent");
  await mkdir(agentDir);
  process.env.PI_CODING_AGENT_DIR = agentDir;
  await writeFile(join(agentDir, "jev-pilot.json"), JSON.stringify({ tiers }));
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
  expect(configuredTiers(host.getSettings())).toEqual(tiers);
  host.setProjectTrusted(true);
  expect(configuredTiers(host.getSettings())).toEqual(tiers);
  expect(host.getSettings().packages).toEqual(["unrelated"]);
  host.setProjectTrusted(false);
  expect(configuredTiers(host.getSettings())).toEqual(tiers);
});

test("routing-settings main lifecycle never registers, removes or selects any model", async () => {
  directory = await mkdtemp(join(tmpdir(), "jev-settings-binding-"));
  process.env.PI_CODING_AGENT_DIR = directory;
  let settings: unknown = { jevPilot: { mainRoutingEnabled: true, tiers } };
  let registrations = 0;
  let removals = 0;
  let selections = 0;
  const foreign = { name: "Foreign Auto" };
  const hooks = new Map<string, Function[]>();
  extension({
    on(name: string, handler: Function) {
      hooks.set(name, [...(hooks.get(name) ?? []), handler]);
    },
    events: { on() {} },
    registerEntryRenderer() {},
    registerToolRenderer() {},
    registerCommand() {},
    getSettings: () => settings,
    registerVirtualModel() {
      registrations++;
    },
    unregisterVirtualModel() {
      removals++;
    },
    setModel() {
      selections++;
    },
  } as unknown as ExtensionAPI);
  const ctx = {
    cwd: directory,
    modelRegistry: { find: () => foreign },
    sessionManager: {
      getBranch: () => [],
      getSessionId: () => "settings-binding",
      getSessionFile: () => undefined,
      getLeafId: () => null,
    },
    ui: { notify() {}, setWidget() {}, setStatus() {} },
  } as unknown as ExtensionContext;
  process.env.JEV_MAIN_ROUTING_ENABLED = "true";
  for (const mainRoutingEnabled of [true, false, null, "invalid"]) {
    settings = { jevPilot: { mainRoutingEnabled, tiers: null } };
    for (const event of ["session_start", "session_start", "session_shutdown", "session_shutdown"])
      for (const hook of hooks.get(event) ?? []) await hook({}, ctx);
  }
  expect(registrations).toBe(0);
  expect(removals).toBe(0);
  expect(selections).toBe(0);
});
