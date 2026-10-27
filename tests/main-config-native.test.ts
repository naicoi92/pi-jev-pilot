import { afterEach, expect, test } from "bun:test";
import { access, cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants, readFileSync } from "node:fs";
import { join } from "node:path";
import { PiFixture, type RecordData } from "./fixtures/pi-cli.ts";

let fixture: PiFixture | undefined;
let receipt = 0;
function requiredNativePath(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} to the verified Pi-Bolt launcher or cache directory`);
  return value;
}
const executable = requiredNativePath("JEV_NATIVE_EXECUTABLE");
const nativeCache = requiredNativePath("JEV_NATIVE_CACHE");
afterEach(async () => {
  if (fixture && process.env.JEV_CONFIG_EVIDENCE_DIR) {
    await mkdir(process.env.JEV_CONFIG_EVIDENCE_DIR, { recursive: true });
    await writeFile(
      join(process.env.JEV_CONFIG_EVIDENCE_DIR, `main-native-${++receipt}.json`),
      JSON.stringify(
        {
          launcher: ["/bin/sh", executable],
          isolatedHome: true,
          packageInstall: false,
          classifierModels: fixture.classifications.map((r) => r.model),
          questionNames: fixture.classifications.map((r) => Object.keys(r.questions as object)),
          providerEfforts: fixture.generations.map((r) => r.reasoning_effort),
          credentialMatched: fixture.sawClassifierBearer,
        },
        null,
        2,
      ),
    );
  }
  await fixture?.close();
  fixture = undefined;
});
function native(config: RecordData = {}) {
  const f = (fixture = new PiFixture());
  f.nativeExecutable = executable;
  f.skipPackageInstall = true;
  f.prepare = async (cwd, agent, url) => {
    await cp(nativeCache, join(cwd, ".pi-bolt/npm"), {
      recursive: true,
      mode: constants.COPYFILE_FICLONE,
    });
    const platform = process.platform === "darwin" ? "darwin" : "linux";
    const variant =
      platform === "darwin" || process.arch === "arm64"
        ? "arm64"
        : /\bavx2\b/.test(readFileSync("/proc/cpuinfo", "utf8"))
          ? "x64"
          : "x64-baseline";
    const binary = join(cwd, `.pi-bolt/npm/1.0.4/pi-bolt-${platform}-${variant}/pi`);
    try {
      if (!(await stat(binary)).isFile()) throw new Error("not a regular file");
      await access(binary, constants.X_OK);
    } catch {
      throw new Error(
        "Verified native cache does not contain a regular executable launcher platform binary; refusing installation",
      );
    }
    const version = Bun.spawn(["/bin/sh", executable, "--version"], {
      env: { HOME: cwd, PATH: process.env.PATH },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect((await new Response(version.stdout).text()).trim()).toStartWith("1.4.0 (Pi-Bolt 1.0.4,");
    expect(await version.exited).toBe(0);
    await writeFile(
      join(agent, "jev-pilot.json"),
      JSON.stringify({
        effortEnabled: false,
        skillsEnabled: false,
        strategyEnabled: false,
        qualityEnabled: false,
        designEnabled: false,
        recordDecisions: false,
        ...config,
        classifier: { url: `${url}systemone`, apiKeyEnv: "CFG_TEST_KEY", timeoutMs: 5000 },
      }),
    );
  };
  return f;
}
const configPath = (f: PiFixture) => join(f.directory, "agent", "jev-pilot.json");
async function edit(f: PiFixture, change: RecordData) {
  const config = JSON.parse(await readFile(configPath(f), "utf8"));
  await writeFile(configPath(f), JSON.stringify({ ...config, ...change }));
}
function text(f: PiFixture, index = f.generations.length - 1) {
  return JSON.stringify(f.generations[index]?.messages);
}
function userText(f: PiFixture) {
  const messages = f.generations.at(-1)?.messages as { role: string; content: unknown }[];
  return JSON.stringify(messages.filter((message) => message.role === "user"));
}
function notices(f: PiFixture) {
  return f.records
    .filter((r) => r.type === "extension_ui_request" && r.method === "notify")
    .map((r) => String(r.message))
    .join("\n");
}
async function entries(f: PiFixture) {
  return ((await f.command("get_entries")).data as { entries: RecordData[] }).entries;
}
async function ledger(f: PiFixture): Promise<RecordData[]> {
  try {
    return JSON.parse(
      await readFile(join(f.directory, "agent", "jev-pilot", "ledger.json"), "utf8"),
    ).entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
const response = {
  answers: {
    tier: { choice: "deep", confidence: 0.99 },
    effort: { choice: "high", confidence: 0.99 },
    risky: { noul: 0 },
    strategy: { choice: "graph", confidence: 0.9 },
    bugfix: { noul: 0.9 },
    ui_design: { noul: 0.97 },
    which: { choice: "procedure", confidence: 0.9 },
    "gate::acts_on_user_system": { noul: 1 },
  },
};

// AC-1
test("MAIN-CFG-disabled: native JSON disables every main consumer despite legacy enables", async () => {
  const f = native();
  f.skills = [{ name: "procedure", body: "PRIVATE_SKILL_BODY" }];
  await f.start({
    CFG_TEST_KEY: "",
    TYPESAFE_API_KEY: "unused-fallback",
    JEV_SKILLS_ENABLED: "true",
    JEV_STRATEGY_ENABLED: "true",
    JEV_QUALITY_ENABLED: "true",
    JEV_DESIGN_ENABLED: "true",
    JEV_RECORD_DECISIONS: "true",
  });
  f.response = response;
  await f.prompt("Repair the specified screen");
  expect(f.classifications).toHaveLength(0);
  expect(await ledger(f)).toEqual([]);
  expect(text(f)).not.toContain("<jev_");
  expect(text(f)).not.toContain("PRIVATE_SKILL_BODY");
}, 20000);
// AC-1
test("MAIN-CFG-enabled: native JSON enables main advice despite invalid legacy flags", async () => {
  const f = native({
    effortEnabled: true,
    skillsEnabled: true,
    strategyEnabled: true,
    qualityEnabled: true,
    designEnabled: true,
    recordDecisions: true,
  });
  f.skills = [{ name: "procedure", body: "SELECTED_PROCEDURE" }];
  await f.start({
    JEV_SKILLS_ENABLED: "invalid",
    JEV_STRATEGY_ENABLED: "invalid",
    JEV_QUALITY_ENABLED: "invalid",
    JEV_DESIGN_ENABLED: "invalid",
    JEV_RECORD_DECISIONS: "invalid",
  });
  f.response = response;
  await f.prompt("Repair the specified screen");
  expect(f.classifications).toHaveLength(1);
  expect(text(f)).toContain("SELECTED_PROCEDURE");
  expect(text(f)).toContain("<execution_strategy>");
  expect(text(f)).toContain("<jev_quality>");
  expect(text(f)).toContain("<jev_design>");
  expect(f.generations[0]?.reasoning_effort).toBe("high");
  expect(await ledger(f)).toHaveLength(1);
}, 20000);
for (const empty of [false, true]) {
  // AC-1
  test(`MAIN-CFG-design-${empty ? "empty" : "default"}: native JSON list ignores legacy selection`, async () => {
    const f = native({ designEnabled: true, ...(empty ? { designSkills: [] } : {}) });
    f.skills = [
      { name: "impeccable", body: "PRIVATE_DESIGN_BODY" },
      { name: "legacy-only", body: "LEGACY_BODY" },
    ];
    await f.start({ JEV_DESIGN_ENABLED: "true", JEV_DESIGN_SKILLS: "legacy-only" });
    f.response = response;
    await f.prompt("Design the dashboard");
    expect(text(f)).toContain("<jev_design>");
    expect(userText(f).includes("/impeccable")).toBe(!empty);
    expect(userText(f)).not.toContain("/legacy-only");
    expect(text(f)).not.toContain("PRIVATE_DESIGN_BODY");
  }, 20000);
}
for (const rerank of [false, true]) {
  // AC-2
  test(`MAIN-CFG-batches-${rerank}: delayed native batches retain snapshot until next boundary`, async () => {
    const f = native({
      skillsEnabled: true,
      skillRerank: rerank,
      strategyEnabled: true,
      qualityEnabled: true,
      designEnabled: true,
      recordDecisions: true,
    });
    f.skills = Array.from({ length: 255 }, (_, i) => ({
      name: `procedure-${i}`,
      body: "RERANK_BODY",
    }));
    f.classifierDelay = 300;
    f.classifierResponse = (body) => {
      const q = body.questions as Record<string, RecordData>;
      if (!q.which) return response;
      const choice = Object.keys(q.which.criteria as object)[0]!;
      return {
        answers: {
          ...response.answers,
          which: { choice, confidence: 0.9 },
          [`fits::${choice}`]: { noul: 0.9 },
        },
      };
    };
    await f.start({
      JEV_SKILL_RERANK: "false",
      JEV_STRATEGY_ENABLED: "true",
      JEV_QUALITY_ENABLED: "true",
      JEV_DESIGN_ENABLED: "true",
    });
    const pending = f.prompt("Repair specified dashboard using matching procedure");
    await f.wait(() => f.classifications.length === 2);
    await edit(f, {
      skillsEnabled: false,
      skillRerank: false,
      strategyEnabled: false,
      qualityEnabled: false,
      designEnabled: false,
      recordDecisions: false,
      classifier: {
        url: `${f.server.url}systemone`,
        apiKeyEnv: "CFG_TEST_KEY",
        model: "next-model",
        timeoutMs: 5000,
      },
    });
    await f.command("prompt", { message: "/jev status" });
    expect(notices(f)).toContain("skills disabled");
    expect(notices(f)).toContain("active work retains its captured options");
    await pending;
    expect(f.classifications).toHaveLength(rerank ? 3 : 2);
    expect(f.classifications.map((r) => r.model)).toEqual(
      rerank ? ["jev-latest", "jev-latest", "jev-latest"] : ["jev-latest", "jev-latest"],
    );
    expect(f.classifications.filter((r) => "ui_design" in (r.questions as object))).toHaveLength(1);
    expect(text(f)).toContain("RERANK_BODY");
    expect(text(f)).toContain("<execution_strategy>");
    expect(text(f)).toContain("<jev_quality>");
    expect(await ledger(f)).toHaveLength(1);
    await f.prompt("Perform separate backend task");
    expect(f.classifications).toHaveLength(rerank ? 3 : 2);
    expect(await ledger(f)).toHaveLength(1);
    await edit(f, { qualityEnabled: true });
    await f.prompt("Inspect another specific failure");
    expect(f.classifications.at(-1)?.model).toBe("next-model");
  }, 20000);
}
for (const enabled of [true, false]) {
  // AC-2
  test(`MAIN-CFG-observation-${enabled ? "on" : "off"}: native tool loop and ledger retain owning options`, async () => {
    const f = native({ qualityEnabled: enabled, recordDecisions: enabled });
    f.tools = "write";
    f.modelDelay = 100;
    await f.start({
      JEV_QUALITY_ENABLED: String(!enabled),
      JEV_RECORD_DECISIONS: String(!enabled),
    });
    f.response = { answers: {} };
    f.toolCalls = Array.from({ length: 4 }, (_, i) => ({
      name: "write",
      input: { path: join(f.directory, "loop.txt"), content: `value ${i}` },
    }));
    const pending = f.prompt("Make specified file changes");
    await f.wait(() => f.generations.length === 1);
    await edit(f, { qualityEnabled: !enabled, recordDecisions: !enabled });
    await pending;
    expect(text(f).includes("may be going in circles")).toBe(enabled);
    expect(await ledger(f)).toHaveLength(enabled ? 1 : 0);
    f.toolCalls = Array.from({ length: 4 }, (_, i) => ({
      name: "write",
      input: { path: join(f.directory, "loop.txt"), content: `next ${i}` },
    }));
    await f.prompt("Make separate changes");
    const last = f.generations.at(-1)!.messages as { role: string; content: unknown }[];
    const notes = last.filter(
      (m) => m.role === "tool" && JSON.stringify(m.content).includes("may be going in circles"),
    );
    expect(notes).toHaveLength(1); // Exactly one enabled turn, no assistant-message reset.
    expect(await ledger(f)).toHaveLength(1);
  }, 20000);
}
// AC-3
test("MAIN-CFG-status: native status shows JSON capabilities without secret", async () => {
  const f = native({
    skillsEnabled: true,
    skillRerank: true,
    qualityEnabled: true,
    recordDecisions: true,
  });
  await f.start({
    CFG_TEST_KEY: "private-status-credential",
    JEV_SKILLS_ENABLED: "false",
    JEV_QUALITY_ENABLED: "false",
  });
  await f.command("prompt", { message: "/jev status" });
  expect(notices(f)).toContain("skills enabled");
  expect(notices(f)).toContain("quality enabled");
  expect(notices(f)).toContain("strategy disabled");
  expect(notices(f)).toContain("rerank enabled");
  expect(notices(f)).toContain("recording enabled");
  expect(JSON.stringify(f.records) + f.stderr).not.toContain("private-status-credential");
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(0);
}, 20000);
// AC-3
test("MAIN-CFG-status-invalid: native status rejects malformed file without legacy fallback", async () => {
  const f = native();
  await f.start();
  await writeFile(configPath(f), '{"qualityEnabled":');
  await f.command("prompt", { message: "/jev status" });
  expect(notices(f)).toContain("expected valid JSON");
  expect(notices(f)).not.toContain("Capabilities:");
  expect(f.classifications).toHaveLength(0);
}, 20000);
// AC-3
test("MAIN-CFG-privacy-owner: native advice stays owned through tool messages and reload", async () => {
  const f = native({
    effortEnabled: true,
    qualityEnabled: true,
    designEnabled: true,
    recordDecisions: true,
  });
  f.skills = [{ name: "impeccable", body: "PRIVATE_DESIGN_BODY_42" }];
  f.projectContext = "PRIVATE_PROJECT_TOKENS_42";
  await f.start();
  f.response = response;
  f.nextReadPath = join(f.directory, "agent", "settings.json");
  await f.prompt("PRIVATE_TASK: repair specific screen");
  expect(f.classifications).toHaveLength(1);
  expect(await ledger(f)).toHaveLength(1);
  expect(JSON.stringify(await ledger(f))).not.toContain("PRIVATE_TASK");
  expect(JSON.stringify(f.classifications)).not.toContain("PRIVATE_DESIGN_BODY_42");
  expect(JSON.stringify(f.classifications)).not.toContain("PRIVATE_PROJECT_TOKENS_42");
  expect(JSON.stringify(f.generations)).not.toContain("jevPilotInputId");
  await f.command("prompt", { message: "/fixture-reload" });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  expect(text(f).split("<jev_design>")).toHaveLength(2);
  await f.command("new_session");
  await f.prompt("continue");
  expect(text(f)).not.toContain("<jev_design>");
}, 20000);
// AC-3
test("MAIN-CFG-cancel: native cancelled assessment cannot attach stale advice", async () => {
  const f = native({ qualityEnabled: true, designEnabled: true, recordDecisions: true });
  f.classifierDelay = 500;
  f.response = response;
  await f.start();
  await f.command("prompt", { message: "Repair specified screen" });
  await f.wait(() => f.classifications.length === 1);
  await f.command("abort");
  await f.wait(() => f.records.some((r) => r.type === "agent_settled"));
  expect(f.generations).toHaveLength(0);
  expect((await entries(f)).filter((r) => r.customType === "jev-pilot:advice")).toHaveLength(0);
  await edit(f, { qualityEnabled: false, designEnabled: false, recordDecisions: false });
  await f.prompt("Perform separate work");
  expect(text(f)).not.toContain("<jev_quality>");
  expect(text(f)).not.toContain("<jev_design>");
}, 20000);

// AC-3
test("MAIN-CFG-child: native execution children never reassess or record main work", async () => {
  const f = native({ effortEnabled: true, qualityEnabled: true, recordDecisions: true });
  f.tools = "write";
  const prepare = f.prepare!;
  f.prepare = async (cwd, agent, url) => {
    await prepare(cwd, agent, url);
    const controls = join(cwd, "fixture-controls.ts");
    await writeFile(
      controls,
      (await readFile(controls, "utf8")).replace(
        "export default function (pi: ExtensionAPI) {",
        `export default function (pi: ExtensionAPI) {
        pi.registerCommand("fixture-child", { handler: async (_args, ctx) => {
          pi.events.emit("jev-pilot:execution-child:v1", { sessionId: ctx.sessionManager.getSessionId() });
        } });`,
      ),
    );
  };
  await f.start();
  await f.command("prompt", { message: "/fixture-child" });
  f.toolCalls = Array.from({ length: 4 }, (_, i) => ({
    name: "write",
    input: { path: join(f.directory, "child.txt"), content: String(i) },
  }));
  await f.prompt("Execute child work");
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(5);
  expect(text(f)).not.toContain("may be going in circles");
  expect(await ledger(f)).toEqual([]);
  expect((await entries(f)).filter((row) => row.customType === "jev-pilot:decision:v1")).toEqual(
    [],
  );
}, 20000);

// AC-1
test("MAIN-CFG-guidance-defaults: omitted JSON flags enable native main guidance", async () => {
  const f = native({
    strategyEnabled: undefined,
    qualityEnabled: undefined,
    designEnabled: undefined,
  });
  f.response = response;
  await f.start();
  await f.prompt("Repair specified screen using dependent stages");
  expect(f.classifications).toHaveLength(1);
  expect(Object.keys(f.classifications[0]!.questions as object).sort()).toEqual([
    "bugfix",
    "corrects",
    "sensitive",
    "strategy",
    "tier",
    "ui_design",
    "underspecified",
  ]);
  expect(text(f)).toContain("<execution_strategy>");
  expect(text(f)).toContain("<jev_quality>");
  expect(text(f)).toContain("<jev_design>");
  expect(f.generations[0]?.reasoning_effort).toBe("medium");
}, 20000);

// AC-3
test("MAIN-CFG-guidance-credential: default main guidance requires named key despite disabled effort", async () => {
  const f = native({
    strategyEnabled: undefined,
    qualityEnabled: undefined,
    designEnabled: undefined,
  });
  await f.start({ CFG_TEST_KEY: "", TYPESAFE_API_KEY: "unused-fallback" });
  await f.prompt("Repair specified screen");
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(0);
  expect(notices(f)).toContain("CFG_TEST_KEY");
  expect(JSON.stringify(f.records) + f.stderr).not.toContain("unused-fallback");
}, 20000);
