import { afterEach, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { PiFixture } from "./fixtures/pi-cli.ts";

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
const task = "Please review complete patch with particular care for failure modes";
async function routerCount(f: PiFixture) {
  const data = (await f.command("get_available_models")).data as {
    models: { provider: string; id: string }[];
  };
  return data.models.filter((model) => model.provider === "jev" && model.id === "auto").length;
}

test("settings-json obsolete main enablement and routing env never register router across reloads", async () => {
  fixture = new PiFixture();
  fixture.settings = {
    jevPilot: { mainRoutingEnabled: true, tiers: { fast: null } },
    unrelated: { kept: true },
  };
  const f = await fixture.start({
    JEV_MAIN_ROUTING_ENABLED: "true",
    JEV_TIER_FAST: "invalid",
    JEV_TIER_BALANCED: "bad",
    JEV_TIER_DEEP: "bad",
  });
  const path = `${f.directory}/agent/settings.json`;
  const settings = JSON.parse(await readFile(path, "utf8"));
  for (const mainRoutingEnabled of [true, false, null, "invalid"]) {
    await writeFile(
      path,
      JSON.stringify({ ...settings, jevPilot: { mainRoutingEnabled, tiers: null } }),
    );
    await f.command("prompt", { message: "/fixture-reload" });
    await f.command("get_state");
    expect(await routerCount(f)).toBe(0);
    const before = await readFile(path, "utf8");
    await f.prompt(task);
    expect(f.generations.at(-1)!.model).toBe("fixture-model");
    expect((await f.command("get_state")).data).toMatchObject({
      model: { provider: "fixture", id: "fixture-model" },
    });
    expect(await readFile(path, "utf8")).toBe(before);
  }
}, 30000);

test("settings-json obsolete router startup rejected by official Pi, never restored implicitly", async () => {
  fixture = new PiFixture();
  fixture.settings = { jevPilot: { mainRoutingEnabled: true } };
  fixture.startupProvider = "jev";
  fixture.startupModel = "auto";
  await expect(fixture.start()).rejects.toThrow('Model "jev/auto" not found');
  expect(fixture.process.exitCode).toBe(1);
  expect(fixture.generations).toHaveLength(0);
  expect(fixture.classifications).toHaveLength(0);
}, 20000);

test("settings-json absent worker tiers do not affect physical effort-disabled main", async () => {
  fixture = new PiFixture();
  fixture.jevConfig = { effortEnabled: false };
  const f = await fixture.start({
    JEV_EFFORT_ENABLED: "false",
    JEV_SYSTEM_ONE_URL: "invalid",
    JEV_MAIN_ROUTING_ENABLED: "true",
  });
  expect(await routerCount(f)).toBe(0);
  await f.prompt(task);
  expect(f.classifications).toHaveLength(0);
  expect(f.generations[0]!.model).toBe("fixture-model");
}, 20000);
