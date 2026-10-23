import { afterEach, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { PiFixture, type RecordData } from "./fixtures/pi-cli.ts";

let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  if (fixture?.process) {
    console.log(
      "settings-json CLI terminal",
      JSON.stringify({
        pid: fixture.process.pid,
        exitCode: fixture.process.exitCode,
        signal: fixture.process.signalCode,
      }),
    );
    expect(fixture.process.exitCode).not.toBeNull();
    expect(fixture.process.signalCode).toBeNull();
  }
  fixture = undefined;
});
const tiers = {
  fast: "fixture-fast/lookup",
  balanced: "fixture/fixture-model",
  deep: "fixture-deep/judgment",
};
const task = "Please review complete patch with particular care for failure modes";
const response = {
  answers: {
    tier: { choice: "deep", confidence: 0.99 },
    effort: { choice: "xhigh", confidence: 0.99 },
    risky: { noul: 0 },
  },
};
async function start(enabled: unknown = true, env: Record<string, string> = {}) {
  fixture = new PiFixture();
  fixture.settings = {
    jevPilot: { mainRoutingEnabled: enabled, tiers },
    unrelated: { kept: true },
  };
  fixture.response = response;
  return fixture.start(env);
}
async function routerCount(f: PiFixture) {
  const data = (await f.command("get_available_models")).data as {
    models: { provider: string; id: string }[];
  };
  return data.models.filter((model) => model.provider === "jev" && model.id === "auto").length;
}
async function reload(f: PiFixture, config: unknown) {
  const path = `${f.directory}/agent/settings.json`;
  const settings = JSON.parse(await readFile(path, "utf8"));
  await writeFile(path, JSON.stringify({ ...settings, jevPilot: config }));
  await f.command("prompt", { message: "/fixture-reload" });
  await f.command("get_state");
}

test("settings-json official CLI physical startup then explicit router dispatch records requested/effective", async () => {
  const f = await start();
  expect((await f.command("get_state")).data).toMatchObject({
    model: { provider: "fixture", id: "fixture-model" },
  });
  expect(await routerCount(f)).toBe(1);
  const before = await readFile(`${f.directory}/agent/settings.json`, "utf8");
  await f.command("set_model", { provider: "jev", modelId: "auto" });
  await f.prompt(task);
  expect(f.classifications).toHaveLength(1);
  expect(f.generations).toHaveLength(1);
  expect(f.generations[0]).toMatchObject({ model: "judgment", reasoning_effort: "high" });
  const { entries } = (await f.command("get_entries")).data as {
    entries: { customType?: string; data?: RecordData; message?: RecordData }[];
  };
  expect(
    entries.findLast((entry) => entry.customType === "pi.virtual-model-state")?.data,
  ).toMatchObject({ state: { physical: tiers.deep, requested: "xhigh", effective: "high" } });
  expect(entries.findLast((entry) => entry.message?.role === "assistant")?.message).toMatchObject({
    provider: "fixture-deep",
    model: "judgment",
    thinkingLevel: "high",
  });
  expect(await readFile(`${f.directory}/agent/settings.json`, "utf8")).toBe(before);
}, 20000);

test("settings-json reload enables disables and replaces tiers without stale registration", async () => {
  const f = await start(false);
  expect(await routerCount(f)).toBe(0);
  await reload(f, { mainRoutingEnabled: true, tiers });
  expect(await routerCount(f)).toBe(1);
  await reload(f, { mainRoutingEnabled: true, tiers });
  expect(await routerCount(f)).toBe(1);
  await f.command("set_model", { provider: "jev", modelId: "auto" });
  await f.prompt(task);
  expect(f.generations.at(-1)!.model).toBe("judgment");
  await reload(f, { mainRoutingEnabled: true, tiers: { ...tiers, deep: tiers.fast } });
  expect(await routerCount(f)).toBe(1);
  await f.prompt("Please investigate this new and separate failure mode carefully");
  expect(f.generations.at(-1)!.model).toBe("lookup");
  await f.command("set_model", { provider: "fixture", modelId: "fixture-model" });
  await reload(f, { mainRoutingEnabled: false, tiers: null });
  expect(await routerCount(f)).toBe(0);
  await f.prompt(task);
  expect(f.generations.at(-1)!.model).toBe("fixture-model");
}, 30000);

test("settings-json explicit env false overrides true JSON without unused tier validation", async () => {
  const f = await start(true, { JEV_MAIN_ROUTING_ENABLED: "false", JEV_TIER_FAST: "invalid" });
  expect(await routerCount(f)).toBe(0);
  await f.prompt(task);
  expect(f.generations[0]!.model).toBe("fixture-model");
}, 20000);

test("settings-json malformed applicable JSON tier stops dispatch actionably", async () => {
  const f = await start();
  await reload(f, { mainRoutingEnabled: true, tiers: { ...tiers, fast: null } });
  await f.command("set_model", { provider: "jev", modelId: "auto" });
  await f.prompt(task);
  expect(f.generations).toHaveLength(0);
  expect(f.classifications).toHaveLength(0);
  expect(JSON.stringify(f.records)).toContain("jevPilot.tiers.fast");
}, 20000);

test("settings-json official CLI rejects JSON-only router startup before session_start", async () => {
  fixture = new PiFixture();
  fixture.settings = { jevPilot: { mainRoutingEnabled: true, tiers } };
  fixture.startupProvider = "jev";
  fixture.startupModel = "auto";
  await expect(fixture.start()).rejects.toThrow('Model "jev/auto" not found');
  expect(fixture.process.exitCode).toBe(1);
  expect(fixture.process.signalCode).toBeNull();
  expect(fixture.generations).toHaveLength(0);
  expect(fixture.classifications).toHaveLength(0);
}, 20000);
