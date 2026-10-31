import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { crewConfig } from "../src/crew-config.ts";
import { PiFixture, answer, root, type RecordData } from "./fixtures/pi-cli.ts";

/**
 * Ticket 11 acceptance gate. Every test installs or inspects the real `bun pm pack` tarball
 * (never the checkout) and carries one parent acceptance criterion in its name. Expected values
 * come from the Pi package documentation, the ticket text, the pinned dependency commit and the
 * deterministic local fixtures, not from the code under test.
 */
const FORK_COMMIT = "72aeb5e01c03e633430b35ecec4fa81652998668";
const PI_VERSION = "1.4.0";

let work = "";
let tarball = "";
let installed = "";
let consumer = "";
let listing: string[] = [];
let fixture: PiFixture | undefined;

async function run(args: string[], cwd: string): Promise<string> {
  const child = Bun.spawn(args, { cwd, env: process.env, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`${args.join(" ")} exited ${code}: ${out}${err}`);
  return out + err;
}

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), "pi-jev-acceptance-"));
  await run([Bun.which("bun")!, "pm", "pack", "--destination", work], root);
  tarball = join(
    work,
    `pi-jev-pilot-${(await Bun.file(join(root, "package.json")).json()).version}.tgz`,
  );
  listing = (await run(["tar", "-tzf", tarball], work)).split("\n").filter(Boolean);
  consumer = join(work, "consumer");
  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ name: "consumer", private: true }),
  );
  // Host-provided Pi packages are not installed (peer dependencies omitted), as Pi's package
  // manager does for managed installs. The git dependency resolves from the Bun cache or GitHub.
  await run(
    [Bun.which("bun")!, "add", tarball, "--omit=peer", "--prefer-offline", "--ignore-scripts"],
    consumer,
  );
  installed = join(consumer, "node_modules", "pi-jev-pilot");
}, 240000);

afterAll(async () => {
  if (work) await rm(work, { recursive: true, force: true });
});

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

async function packaged(
  configure: (f: PiFixture) => void = () => {},
  env: Record<string, string> = {},
) {
  const f = (fixture = new PiFixture());
  f.packageSource = installed;
  configure(f);
  return f.start(env);
}
function notifications(f: PiFixture): string[] {
  return f.records
    .filter((row) => row.type === "extension_ui_request" && row.method === "notify")
    .map((row) => String(row.message));
}
async function say(f: PiFixture, command: string): Promise<string> {
  const before = notifications(f).length;
  await f.command("prompt", { message: command });
  const added = notifications(f).slice(before);
  expect(added).toHaveLength(1);
  return added[0]!;
}
function providerText(f: PiFixture, index = 0): string {
  const messages = f.generations[index]?.messages as
    | { content: string | { text?: string }[] | null }[]
    | undefined;
  return (messages ?? [])
    .map((message) =>
      typeof message.content === "string"
        ? message.content
        : (message.content ?? []).map((part) => part.text ?? "").join("\n"),
    )
    .join("\n");
}
const task = "Please debug this failing test and implement the fully specified repair";

// ---------------------------------------------------------------- AC-01: package installation

test("AC-01 PKG-01-contents: tarball carries the package and nothing else", () => {
  const paths = listing.map((entry) => entry.replace(/^package\//, ""));
  expect(listing.every((entry) => entry.startsWith("package/"))).toBe(true);
  for (const required of [
    "package.json",
    "LICENSE",
    "NOTICE.md",
    "README.md",
    "src/extension.ts",
    "src/worker-child.ts",
  ])
    expect(paths).toContain(required);
  const top = new Set(paths.map((path) => path.split("/")[0]));
  expect([...top].sort()).toEqual([
    "LICENSE",
    "NOTICE.md",
    "README.md",
    "docs",
    "package.json",
    "src",
  ]);
  // Tests, lockfile, tracker/scratch files, credentials and research directories stay out.
  expect(
    paths
      .filter((path) => path.startsWith("docs/"))
      .every((path) => path.startsWith("docs/testing/")),
  ).toBe(true);
  expect(
    paths.filter((path) => path.startsWith("src/")).every((path) => path.endsWith(".ts")),
  ).toBe(true);
  expect(
    paths.some((path) =>
      /(^|\/)(node_modules|tests|\.scratch|\.env[^/]*|bun\.lock)(\/|$)/.test(path),
    ),
  ).toBe(false);
});

test("AC-01 PKG-01-manifest: regular Pi package with host packages as peers and no launcher", async () => {
  const manifest = JSON.parse(
    await readFile(join(installed, "package.json"), "utf8"),
  ) as RecordData & {
    dependencies: Record<string, string>;
    peerDependencies: Record<string, string>;
    pi: { extensions: string[] };
  };
  // Pi docs (packages.md): `pi-package` keyword, `pi.extensions` paths relative to the root,
  // host packages in peerDependencies with "*" and never in dependencies.
  expect(manifest.keywords).toContain("pi-package");
  for (const path of manifest.pi.extensions)
    expect(await Bun.file(join(installed, path)).exists()).toBe(true);
  expect(manifest.peerDependencies).toEqual({
    "@earendil-works/pi-ai": "*",
    "@earendil-works/pi-coding-agent": "*",
  });
  expect(Object.keys(manifest.dependencies)).toEqual(["pi-subagents"]);
  expect(manifest.dependencies["pi-subagents"]).toEndWith(`#${FORK_COMMIT}`);
  // No Claude launcher or proxy entry point, and no install-time code, is exposed.
  for (const key of ["bin", "main", "exports", "bundleDependencies"])
    expect(manifest[key]).toBeUndefined();
  expect(
    Object.keys((manifest as { scripts?: Record<string, string> }).scripts ?? {}).filter((name) =>
      /^(pre|post)?(install|prepare|publish)$/.test(name),
    ),
  ).toEqual([]);
  // The consumer received the pinned executor, but no physical copy of the host packages.
  expect(await Bun.file(join(consumer, "node_modules/pi-subagents/package.json")).exists()).toBe(
    true,
  );
  expect(await Bun.file(join(consumer, "bun.lock")).text()).toContain(
    `pi-subagents@github:naicoi92/pi-subagents#${FORK_COMMIT.slice(0, 7)}`,
  );
  expect(
    await readdir(join(consumer, "node_modules")).then((names) =>
      names.includes("@earendil-works"),
    ),
  ).toBe(false);
});

test("AC-01 PKG-01-install: normal Pi discovery loads the installed tarball without a proxy", async () => {
  const f = await packaged();
  const settings = JSON.parse(await readFile(join(f.directory, "agent/settings.json"), "utf8")) as {
    packages: string[];
  };
  expect(settings.packages.map((entry) => resolve(join(f.directory, "agent"), entry))).toEqual([
    installed,
  ]);
  const commands = (await f.command("get_commands")).data as {
    commands: { name: string; source: string; sourceInfo?: { path?: string } }[];
  };
  const jev = commands.commands.filter((entry) => entry.name === "jev");
  expect(jev).toHaveLength(1);
  expect(jev[0]!.sourceInfo?.path).toStartWith(installed);
  const status = await say(f, "/jev status");
  expect(status).toContain("Jev loaded");
  expect(status).toContain("Main model (Pi-selected): fixture/fixture-model");
  // Loading and status create no model or classifier traffic and no extra network service.
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(0);
  const models = JSON.stringify((await f.command("get_available_models")).data);
  expect(models).not.toContain("jev/auto");
  expect(f.stderr).toBe("");
});

test("AC-01 PKG-01-user-path: one installed turn combines skill, effort, strategy and quality", async () => {
  const f = await packaged((fixture) => {
    fixture.useGuidanceDefaults = true;
    fixture.skills = [
      { name: "debugging", body: "# Debug procedure\nPACKAGED_SELECTED_BODY" },
      { name: "slides", body: "PACKAGED_UNSELECTED_BODY" },
    ];
    fixture.response = {
      answers: {
        ...(answer("high").answers as RecordData),
        tier: { choice: "deep", confidence: 0.95 },
        strategy: { choice: "delegate", confidence: 0.9 },
        which: { choice: "debugging", confidence: 0.9 },
        "gate::acts_on_user_system": { noul: 0.9 },
        "gate::would_follow_documented_procedure": { noul: 0.9 },
        "gate::prose_suffices": { noul: 0.1 },
        bugfix: { noul: 0.9 },
        sensitive: { noul: 0 },
        underspecified: { noul: 0 },
        corrects: { noul: 0 },
      },
    };
  });
  await f.prompt(task);
  expect(f.classifications).toHaveLength(1);
  expect(Object.keys(f.classifications[0]!.questions as RecordData).sort()).toEqual([
    "bugfix",
    "corrects",
    "effort",
    "gate::acts_on_user_system",
    "gate::prose_suffices",
    "gate::would_follow_documented_procedure",
    "risky",
    "sensitive",
    "strategy",
    "tier",
    "underspecified",
    "which",
  ]);
  // The physical model is unchanged; only the Pi-supported thinking level follows the answer.
  expect(f.generations).toHaveLength(1);
  expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "high" });
  const text = providerText(f);
  expect(text).toContain("PACKAGED_SELECTED_BODY");
  expect(text).not.toContain("PACKAGED_UNSELECTED_BODY");
  expect(text).toContain("<execution_strategy>");
  expect(text).toContain("<jev_quality>");
  // Strategy is advice: no worker or tool was started by the package.
  expect(f.records.filter((row) => row.type === "tool_execution_start")).toHaveLength(0);
}, 30000);

test("AC-01 PKG-01-report-tuning: installed turn is reported and tuning stays explicit", async () => {
  const f = await packaged();
  await f.prompt(task);
  const ledgerFile = join(f.directory, "agent/jev-pilot/ledger.json");
  const stored = await readFile(ledgerFile, "utf8");
  expect((JSON.parse(stored) as { entries: unknown[] }).entries).toHaveLength(1);
  expect(stored).not.toContain("debug this failing test");
  expect(await say(f, "/jev report")).toContain("Decision ledger: 1 turn since");
  expect(await say(f, "/jev tune")).toContain("No suggestion yet: 1 of the 20 turns");
  expect(await say(f, "/jev tune apply")).toContain("Nothing to apply.");
  expect(await Bun.file(join(f.directory, "agent/jev-pilot/tuning.json")).exists()).toBe(false);
  expect(await say(f, "/jev report reset")).toContain("Configuration and tuning were not changed");
  expect(await Bun.file(ledgerFile).exists()).toBe(false);
  expect(f.classifications).toHaveLength(1);
  expect(f.generations).toHaveLength(1);
}, 30000);

// ------------------------------------------------- AC-07: continuations and branch ownership

test("AC-07 PKG-07-continuation: tool continuation and plain continue add no classification", async () => {
  const f = await packaged();
  await writeFile(join(f.directory, "probe.txt"), "probe\n");
  f.nextReadPath = join(f.directory, "probe.txt");
  await f.prompt(task);
  // Two provider requests (tool call, then answer) from one classification.
  expect(f.generations).toHaveLength(2);
  expect(f.classifications).toHaveLength(1);
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  expect(f.generations).toHaveLength(3);
  expect(f.generations[2]).toMatchObject({ reasoning_effort: "high" });
}, 30000);

test("AC-07 PKG-07-new-session: a new session never reuses another session's decision", async () => {
  const f = await packaged();
  await f.prompt(task);
  await f.command("new_session");
  f.response = answer("low");
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(2);
  // The first session's high decision was not carried into the new session.
  expect(f.generations[1]?.reasoning_effort).not.toBe("high");
}, 30000);

// ------------------------------------------------------ AC-12: timeout abort and cancellation

test("AC-12 PKG-12-timeout: deadline aborts the classifier HTTP request and generation continues", async () => {
  const f = await packaged((fixture) => {
    fixture.classifierDelay = 1000;
    fixture.classifierConfig.timeoutMs = 100;
  });
  await f.prompt(task);
  await f.wait(() => f.classifierAborts === 1);
  expect(f.generations).toHaveLength(1);
  // Retained valid baseline (the fixture's configured default thinking), not the unanswered high.
  expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "medium" });
}, 30000);

test("AC-12 PKG-12-cancel: explicit abort during classification starts no fallback generation", async () => {
  const f = await packaged((fixture) => {
    fixture.classifierDelay = 3000;
    fixture.classifierConfig.timeoutMs = 5000;
  });
  await f.command("prompt", { message: task });
  await f.wait(() => f.classifications.length === 1);
  await f.command("abort");
  await f.wait(() => f.records.some((row) => row.type === "agent_settled"));
  await f.wait(() => f.classifierAborts === 1);
  expect(f.generations).toHaveLength(0);
}, 30000);

// --------------------------------------------------- AC-26: reload, shutdown and cleanup

test("AC-26 PKG-26-lifecycle: reload keeps the decision, shutdown exits cleanly", async () => {
  const f = await packaged();
  await f.prompt(task);
  await f.command("prompt", { message: "/fixture-reload" });
  await f.prompt("continue");
  // The owned decision survived the reload: continue reused it with no second request.
  expect(f.classifications).toHaveLength(1);
  expect(f.generations[1]).toMatchObject({ reasoning_effort: "high" });
  const process = f.process;
  await f.stop();
  expect(process.exitCode).toBe(0);
  expect(process.signalCode).toBeNull();
  const events = (await readFile(join(f.directory, "lifecycle.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { type: string; reason?: string });
  // session_start/shutdown pairs: initial start, reload (shutdown+start), final shutdown.
  expect(events.filter((event) => event.type === "session_start")).toHaveLength(2);
  expect(events.filter((event) => event.type === "session_shutdown")).toHaveLength(2);
  expect(events.at(-1)?.type).toBe("session_shutdown");
}, 30000);

// ---------------------------------------------- AC-27: excluded features stay inactive

test("AC-27 PKG-27-surface: installed package exposes only /jev and no excluded commands", async () => {
  const f = await packaged();
  const commands = (await f.command("get_commands")).data as {
    commands: { name: string; sourceInfo?: { path?: string } }[];
  };
  const owned = commands.commands
    .filter((entry) => entry.sourceInfo?.path?.startsWith(installed))
    .map((entry) => entry.name);
  expect(owned).toEqual(["jev"]);
  await f.command("prompt", { message: "/fixture-tools" });
  const lifecycle = (await readFile(join(f.directory, "lifecycle.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { fixtureTools?: string[] });
  const tools = lifecycle.find((entry) => entry.fixtureTools)?.fixtureTools ?? [];
  expect(tools.filter((name) => /jev|pet|review|health|escalat/i.test(name))).toEqual([]);
  expect(JSON.stringify((await f.command("get_available_models")).data)).not.toMatch(
    /"provider":"jev"/,
  );
});

test("AC-27 PKG-27-commands: excluded upstream commands only print usage and make no request", async () => {
  const f = await packaged();
  for (const excluded of [
    "pet",
    "raise",
    "models",
    "subagents",
    "reviewer",
    "health",
    "stats",
    "mode quality",
  ])
    expect(await say(f, `/jev ${excluded}`)).toBe(
      "Usage: /jev status | report | report reset | tune | tune apply | tune reset",
    );
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(0);
});

test("AC-27 PKG-27-crew-modes: only standard, budget and junior-lead modes exist", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "jev-acceptance-crew-"));
  const saved = process.env.PI_CODING_AGENT_DIR;
  try {
    process.env.PI_CODING_AGENT_DIR = cwd;
    for (const mode of ["quality", "second-opinion", "review", "codex"]) {
      await writeFile(join(cwd, "jev-pilot.json"), JSON.stringify({ crew: { mode, slots: [] } }));
      expect(() => crewConfig(cwd)).toThrow("crew.mode");
    }
    for (const mode of ["standard", "budget", "junior-lead"]) {
      await writeFile(join(cwd, "jev-pilot.json"), JSON.stringify({ crew: { mode, slots: [] } }));
      expect(String(crewConfig(cwd).mode)).toBe(mode);
    }
  } finally {
    if (saved === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = saved;
    await rm(cwd, { recursive: true, force: true });
  }
});

test("AC-27 PKG-27-source: shipped code spawns no processes and reaches only the configured services", async () => {
  const sources = new Map<string, string>();
  for (const name of await readdir(join(installed, "src")))
    sources.set(name, await readFile(join(installed, "src", name), "utf8"));
  const code = (name: string) => sources.get(name)!.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
  for (const [name] of sources) {
    expect(code(name)).not.toMatch(
      /child_process|Bun\.spawn|execFile|execSync|spawnSync|new WebSocket|XMLHttpRequest/,
    );
    // Only the System One transport performs HTTP.
    if (name !== "system-one.ts") expect(code(name)).not.toMatch(/\bfetch\(/);
    // Excluded upstream state is never read or written.
    expect(code(name)).not.toMatch(/raisedTo|mid-turn|healthCheck|failover|petState|sessionStats/i);
  }
  expect(code("system-one.ts")).toMatch(/\bfetch\(/);
});

test("AC-27 PKG-27-no-datasets: no benchmark or research dataset ships in the tarball", () => {
  const paths = listing.map((entry) => entry.replace(/^package\//, ""));
  expect(paths.filter((path) => path.startsWith("docs/research"))).toEqual([]);
  expect(
    paths.filter((path) => /\.(csv|tsv|jsonl|parquet|sqlite|db|xlsx|zip|tgz)$/.test(path)),
  ).toEqual([]);
  // The few JSON files are small visibility-evidence captures, not benchmark data.
  expect(
    paths
      .filter((path) => path.endsWith(".json") && path !== "package.json")
      .every((path) => path.startsWith("docs/testing/pi-auto-visibility-evidence/")),
  ).toBe(true);
});

// ------------------------------------------------------ AC-28: provenance and documentation

test("AC-28 PKG-28-license: MIT license and pinned upstream provenance ship in the tarball", async () => {
  expect(await readFile(join(installed, "LICENSE"), "utf8")).toBe(
    await readFile(join(root, "LICENSE"), "utf8"),
  );
  const license = await readFile(join(installed, "LICENSE"), "utf8");
  expect(license).toStartWith("MIT License");
  expect(license).toContain("Ahmed Akram");
  const notice = await readFile(join(installed, "NOTICE.md"), "utf8");
  expect(notice).toContain("5d27135b34edf81b40c0bf1df01ae401f6b72ea7");
  expect(notice).toContain("Jev Pilot 0.12.1");
  expect(JSON.parse(await readFile(join(installed, "package.json"), "utf8")).license).toBe("MIT");
});

test("AC-28 PKG-28-compatibility: documented versions equal the tested ones", async () => {
  const readme = await readFile(join(installed, "README.md"), "utf8");
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
    devDependencies: Record<string, string>;
    engines: { bun: string };
  };
  // Tested Pi is the exact pinned development host.
  expect(manifest.devDependencies["@earendil-works/pi-coding-agent"]).toBe(PI_VERSION);
  expect(manifest.devDependencies["@earendil-works/pi-ai"]).toBe(PI_VERSION);
  expect(readme).toContain(`\`@earendil-works/pi-coding-agent\` ${PI_VERSION}`);
  expect(readme).toContain(FORK_COMMIT);
  // The fork manifest label must be the label of the executor that was actually installed.
  const executor = JSON.parse(
    await readFile(join(consumer, "node_modules/pi-subagents/package.json"), "utf8"),
  ) as { version: string };
  expect(readme).toContain(`manifest version \`${executor.version}\``);
  expect(readme).not.toContain("manifest version `0.80.0`");
  expect(readme).toContain(`Bun >=${manifest.engines.bun.replace(">=", "")}`);
});

test("AC-28 PKG-28-docs: README documents configuration, privacy, commands and host differences", async () => {
  const readme = await readFile(join(installed, "README.md"), "utf8");
  for (const heading of [
    "## Install and configure",
    "## Configure worker model tiers",
    "## Match installed skills",
    "## Receive strategy and quality advice",
    "## Receive the upstream design pack",
    "## Understand effort decisions",
    "## Review decisions: ledger, report and corrections",
    "## Tuning: explicit apply and reset",
    "## Know what leaves the device",
    "## Configure custom slots and junior-lead",
    "## Compatibility and approved host differences",
    "## Acceptance coverage and verification limits",
  ])
    expect(readme).toContain(heading);
  for (const term of [
    "JEV_SYSTEM_ONE_URL",
    "JEV_SYSTEM_ONE_API_KEY",
    "JEV_SYSTEM_ONE_MODEL",
    "/jev status",
    "/jev report",
    "/jev tune",
    "no automatic secret-redaction guarantee",
    "not exclusive enforcement",
    "Pi-Bolt",
  ])
    expect(readme).toContain(term);
  // Every documented excluded capability is called out as absent.
  for (const excluded of ["mid-turn escalation", "external reviewer", "health", "pet"])
    expect(readme.toLowerCase()).toContain(excluded);
});

test("AC-28 PKG-28-links: every relative link in the shipped README resolves inside the tarball", async () => {
  const readme = await readFile(join(installed, "README.md"), "utf8");
  const links = [...readme.matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+)(?:#[^)]*)?\)/g)].map(
    (match) => match[1]!,
  );
  expect(links.length).toBeGreaterThan(5);
  const missing: string[] = [];
  for (const link of links)
    if (!(await Bun.file(join(installed, link)).exists())) missing.push(link);
  expect(missing).toEqual([]);
});
