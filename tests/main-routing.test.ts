import { afterEach, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { answer, type RecordData } from "./fixtures/pi-cli.ts";
import { MainConfigFixture as PiFixture } from "./fixtures/main-config.ts";

const task = "Please review the complete patch with particular care for failure modes";
let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});
async function start() {
  fixture = new PiFixture();
  fixture.settings = { jevPilot: { mainRoutingEnabled: true, tiers: { fast: "invalid" } } };
  fixture.environment = { JEV_MAIN_ROUTING_ENABLED: "true", JEV_TIER_DEEP: "invalid" };
  return fixture.start();
}
async function fixed(f: PiFixture) {
  expect((await f.command("get_state")).data).toMatchObject({
    model: { provider: "fixture", id: "fixture-model" },
  });
  const available = JSON.stringify((await f.command("get_available_models")).data);
  expect(available).not.toContain('"provider":"jev"');
  expect(new Set(f.generations.map((request) => request.model))).toEqual(
    new Set(["fixture-model"]),
  );
  const { entries } = (await f.command("get_entries")).data as { entries: RecordData[] };
  expect(entries.filter((entry) => entry.customType === "pi.virtual-model-state")).toHaveLength(0);
  expect(entries.filter((entry) => entry.type === "model_change")).toHaveLength(1);
}

test("MAIN-REMOVAL physical main stays fixed across prompts, tool and continuation with auto-effort", async () => {
  const f = await start();
  const settings = await Bun.file(`${f.directory}/agent/settings.json`).text();
  const path = `${f.directory}/read-me.txt`;
  await writeFile(path, "tool fixture");
  f.nextReadPath = path;
  await f.prompt(task);
  expect(f.generations).toHaveLength(2);
  expect(f.classifications).toHaveLength(1);
  expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "high" });
  f.response = answer("low");
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  await f.prompt("Please look up the named symbol and report its exact location");
  expect(f.classifications).toHaveLength(2);
  expect(Object.keys(f.classifications[1]!.questions as object).sort()).toEqual([
    "effort",
    "risky",
  ]);
  await fixed(f);
  expect(await Bun.file(`${f.directory}/agent/settings.json`).text()).toBe(settings);
}, 20000);

test("MAIN-REMOVAL physical lifecycle keeps selection and branch-owned effort without router state", async () => {
  const f = await start();
  await f.prompt(task);
  const original = (await f.command("get_state")).data as { sessionFile: string };
  await f.command("prompt", { message: "/fixture-reload" });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  await f.command("new_session");
  await f.command("switch_session", { sessionPath: original.sessionFile });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  const { entries } = (await f.command("get_entries")).data as {
    entries: { id: string; message?: { role: string } }[];
  };
  const response = entries.findLast((entry) => entry.message?.role === "assistant")!;
  await f.command("prompt", { message: `/fixture-fork-at ${response.id}` });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  f.modelText = "Context for compaction. ".repeat(200);
  for (let i = 0; i < 4; i++) await f.prompt(`${task} number ${i}`);
  const count = f.classifications.length;
  await f.command("compact");
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(count);
  await fixed(f);
}, 30000);

for (const mode of ["abort", "thinking", "model"] as const) {
  test(`MAIN-REMOVAL physical ${mode} invalidates pending decision without automatic model writes`, async () => {
    const f = await start();
    f.classifierDelay = 2000;
    const offset = f.records.length;
    await f.command("prompt", { message: task });
    await f.wait(() => f.classifications.length === 1);
    if (mode === "abort") await f.command("abort");
    else if (mode === "thinking") await f.command("set_thinking_level", { level: "low" });
    else await f.command("set_model", { provider: "fixture", modelId: "fixture-other-model" });
    await f.wait(() => f.records.slice(offset).some((entry) => entry.type === "agent_settled"));
    await f.wait(() => f.classifierAborts === 1);
    const { entries } = (await f.command("get_entries")).data as { entries: RecordData[] };
    expect(
      entries.filter((entry) => entry.customType === "jev-pilot:effort-application"),
    ).toHaveLength(0);
    expect(entries.filter((entry) => entry.type === "model_change")).toHaveLength(
      mode === "model" ? 2 : 1,
    );
    if (mode === "abort") expect(f.generations).toHaveLength(0);
    expect((await f.command("get_state")).data).toMatchObject({
      model: {
        provider: "fixture",
        id: mode === "model" ? "fixture-other-model" : "fixture-model",
      },
    });
  }, 20000);
}
