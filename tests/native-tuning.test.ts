import { afterEach, expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PiFixture, root } from "./fixtures/pi-cli.ts";

const binary =
  process.env.JEV_NATIVE_BINARY ?? "/Users/naicoi/.pi-bolt/npm/1.0.4/pi-bolt-darwin-arm64/pi";
let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

async function say(f: PiFixture, message: string) {
  const before = f.records.length;
  await f.command("prompt", { message });
  const notices = f.records
    .slice(before)
    .filter((r) => r.type === "extension_ui_request" && r.method === "notify");
  expect(notices).toHaveLength(1);
  return String(notices[0]!.message);
}

test("CFG-09 native tune JSON base, apply, reset and malformed boundary", async () => {
  const f = (fixture = new PiFixture([
    binary,
    "-e",
    root,
    "--mode",
    "rpc",
    "--no-mcp",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-context-files",
    "--tools",
    "read",
    "--offline",
    "--no-approve",
    "--model",
    "fixture/fixture-model",
  ]));
  f.skipPackageInstall = true;
  f.classifierConfig = { timeoutMs: 1200 };
  await f.start({ JEV_TIMEOUT_MS: "invalid" });
  const config = join(f.directory, "agent", "jev-pilot.json");
  const state = join(f.directory, "agent", "jev-pilot");
  const ledger = join(state, "ledger.json");
  const tuning = join(state, "tuning.json");
  await mkdir(state, { recursive: true });
  const rows = Array.from({ length: 20 }, (_, i) => ({
    version: 1,
    id: `test:${i}`,
    at: 1000 + i,
    answered: true,
    ms: 100,
    effortLevel: 2,
    effortConfidence: 0.9,
    startedFrom: "medium",
    requested: "high",
    started: "high",
    toolCalls: 1,
    failures: 0,
    strategy: null,
    strategyConfidence: null,
    advised: false,
    outcome: "answer",
    durationMs: 10,
    inputTokens: 10,
    outputTokens: 4,
  }));
  await writeFile(ledger, JSON.stringify({ version: 1, entries: rows }));
  const configBefore = await readFile(config, "utf8");
  const ledgerBefore = await readFile(ledger, "utf8");
  expect(await say(f, "/jev tune")).toContain(
    "timeoutMs                base: 1200  overlay: none  effective: 1200",
  );
  expect(await say(f, "/jev tune apply")).toContain("Applied minHighConfidence 0.5 → 0.6");
  expect(await say(f, "/jev tune")).toContain(
    "minHighConfidence        base: 0.5  overlay: 0.6  effective: 0.6",
  );
  expect(await say(f, "/jev tune apply")).toContain("Nothing to apply");
  const editedConfig = JSON.parse(configBefore);
  editedConfig.classifier.timeoutMs = 1700;
  await writeFile(config, JSON.stringify(editedConfig));
  expect(await say(f, "/jev tune")).toContain(
    "timeoutMs                base: 1700  overlay: none  effective: 1700",
  );
  await writeFile(config, configBefore);
  expect(await readFile(config, "utf8")).toBe(configBefore);
  expect(await readFile(ledger, "utf8")).toBe(ledgerBefore);
  const applied = await readFile(tuning, "utf8");
  await writeFile(config, "{ broken");
  for (const action of ["/jev tune", "/jev tune apply", "/jev tune reset"]) {
    const result = await say(f, action);
    expect(result).toContain("expected valid JSON");
    expect(result).toContain("Nothing was changed");
  }
  expect(await readFile(tuning, "utf8")).toBe(applied);
  expect(await readFile(ledger, "utf8")).toBe(ledgerBefore);
  await writeFile(config, configBefore);
  expect(await say(f, "/jev tune reset")).toContain("overlay: none");
  expect(JSON.parse(await readFile(tuning, "utf8")).values).toEqual({});
  expect(await readFile(config, "utf8")).toBe(configBefore);
  expect(await readFile(ledger, "utf8")).toBe(ledgerBefore);
  await f.prompt("Please review this patch carefully for failure modes");
  expect(f.classifications).toHaveLength(1);
  expect(f.generations).toHaveLength(1);
}, 30000);
