import { afterEach, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crewConfig, DEFAULT_SLOT_WHEN } from "../src/crew-config.ts";
const saved = process.env.JEV_CREW_CONFIG;
afterEach(() => {
  if (saved === undefined) delete process.env.JEV_CREW_CONFIG;
  else process.env.JEV_CREW_CONFIG = saved;
});
async function config(value: unknown) {
  const cwd = await mkdtemp(join(tmpdir(), "jev-crew-config-"));
  await writeFile(join(cwd, "crew.json"), JSON.stringify(value));
  process.env.JEV_CREW_CONFIG = "crew.json";
  return () => crewConfig(cwd);
}
test("CREW-18 default when remains read-only and standard excludes slots", async () => {
  const read = await config({ mode: "standard", slots: [{ name: "alpha", model: "local/cheap" }] });
  const crew = read();
  expect(crew.slots[0]?.when).toBe(DEFAULT_SLOT_WHEN);
  expect(crew.slots[0]?.when).toContain("Never for writing or changing code.");
  expect(crew.offered).toEqual([]);
});
test("CREW-18 validates original names, count and field types", async () => {
  for (const name of ["fast", "balanced", "deep", "alpha-2"]) {
    const read = await config({ mode: "budget", slots: [{ name, model: "local/cheap" }] });
    expect(read().offered[0]?.name).toBe(name);
  }
  for (const value of [
    { slots: [{ name: "quality", model: "local/cheap" }] },
    { slots: [{ name: "Alpha", model: "local/cheap" }] },
    { slots: [{ name: "a", model: "local/cheap", when: 4 }] },
    { slots: Array.from({ length: 9 }, (_, i) => ({ name: `a${i}`, model: "local/cheap" })) },
    { mode: "quality" },
    { mode: "budget", extra: true },
    {
      slots: [
        { name: "a", model: "local/cheap" },
        { name: "a", model: "local/deep" },
      ],
    },
  ])
    expect(await config(value)).toThrow("Invalid JEV_CREW_CONFIG");
});
test("CREW-02 slot target requires qualified identity without effort", async () => {
  for (const model of ["cheap", "local/cheap:high", "local/a b", ""])
    expect(await config({ slots: [{ name: "alpha", model }] })).toThrow("qualified");
});
test("CREW-19 named junior uses configured slot then first slot by order", async () => {
  const slots = [
    { name: "beta", model: "local/b" },
    { name: "alpha", model: "local/a" },
  ];
  expect((await config({ mode: "junior-lead", slots, junior: "alpha" }))().junior?.model).toBe(
    "local/a",
  );
  expect((await config({ mode: "junior-lead", slots }))().junior?.model).toBe("local/b");
  expect((await config({ mode: "junior-lead", slots: [] }))().junior).toBeUndefined();
  expect(await config({ mode: "junior-lead", slots, junior: "unknown" })).toThrow("junior");
});
