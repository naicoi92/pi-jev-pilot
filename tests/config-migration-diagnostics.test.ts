import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadJevConfig } from "../src/jev-config.ts";

test("CFG-03 migration warnings are bounded, deduplicated, name-only and global-only", async () => {
  const root = await mkdtemp(join(tmpdir(), "jev-migration-"));
  const agent = join(root, "agent");
  const project = join(root, "project");
  await mkdir(agent);
  await mkdir(join(project, ".pi"), { recursive: true });
  const previousDir = process.env.PI_CODING_AGENT_DIR;
  const previousCwd = process.cwd();
  const savedEnv = { ...process.env };
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => warnings.push(args.join(" "));
  try {
    process.env.PI_CODING_AGENT_DIR = agent;
    process.chdir(project);
    process.env.JEV_SYSTEM_ONE_API_KEY = "selected-secret-value";
    process.env.JEV_EFFORT_ENABLED = "legacy-private-value";
    process.env.JEV_TIER_EXPERIMENT = "tier-private-value";
    await writeFile(
      join(agent, "jev-pilot.json"),
      JSON.stringify({ classifier: { apiKeyEnv: "JEV_SYSTEM_ONE_API_KEY" } }),
    );
    await writeFile(
      join(project, ".pi", "settings.json"),
      JSON.stringify({ jevPilot: { marker: "project-private-value" } }),
    );
    loadJevConfig();
    loadJevConfig();
    expect(warnings.join("\n")).toContain("JEV_EFFORT_ENABLED");
    expect(warnings.join("\n")).toContain("JEV_TIER_EXPERIMENT");
    expect(warnings.join("\n")).not.toContain("JEV_SYSTEM_ONE_API_KEY");
    expect(warnings.join("\n")).not.toContain("settings.json");
    const first = warnings.length;
    for (let i = 0; i < 100; i++) loadJevConfig();
    expect(warnings.length).toBe(first);
    await writeFile(
      join(agent, "settings.json"),
      JSON.stringify({ jevPilot: { marker: "global-private-value" } }),
    );
    loadJevConfig();
    loadJevConfig();
    expect(warnings.join("\n")).toContain("settings.json jevPilot");
    expect(warnings.join("\n").match(/settings\.json jevPilot/g)).toHaveLength(1);
    expect(warnings.join("\n")).not.toMatch(
      /selected-secret-value|legacy-private-value|tier-private-value|project-private-value|global-private-value/,
    );
    expect(warnings.join("\n").match(/JEV_EFFORT_ENABLED/g)).toHaveLength(1);
    for (let i = 0; i < 100; i++) process.env[`JEV_TIER_BOUND_${i}`] = "private-value";
    loadJevConfig();
    const boundedCount = warnings.length;
    expect(boundedCount).toBeLessThanOrEqual(33);
    for (let i = 0; i < 10; i++) loadJevConfig();
    expect(warnings.length).toBe(boundedCount);
    expect(warnings.join("\n")).not.toContain("private-value");
  } finally {
    console.warn = warn;
    process.chdir(previousCwd);
    for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
    Object.assign(process.env, savedEnv);
    if (previousDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    await rm(root, { recursive: true, force: true });
  }
});
