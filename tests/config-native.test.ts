import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { PiFixture } from "./fixtures/pi-cli.ts";

const executable = "/Users/naicoi/.bun/bin/pi-bolt";
const task = "Please review this patch carefully for failure modes";
let fixture: PiFixture | undefined;
let receiptNumber = 0;
let nativeVersion = "";

afterEach(async () => {
  if (fixture && process.env.JEV_CONFIG_EVIDENCE_DIR) {
    const directory = process.env.JEV_CONFIG_EVIDENCE_DIR;
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, `native-receipt-${++receiptNumber}.json`),
      JSON.stringify(
        {
          command: ["/bin/sh", executable, "-e", "<checkout>", "--mode", "rpc", "--offline"],
          version: nativeVersion,
          isolatedHome: true,
          defaultAgentDirectory: fixture.defaultAgentDirectory,
          classifierRequests: fixture.classifications.length,
          classifierModels: fixture.classifications.map((request) => request.model),
          providerEfforts: fixture.generations.map((request) => request.reasoning_effort),
          credentialMatched: fixture.sawClassifierBearer,
          credentialChecks: fixture.classifierHeaderChecks,
        },
        null,
        2,
      ),
    );
  }
  await fixture?.close();
  fixture = undefined;
});

function native(config: Record<string, unknown> = {}): PiFixture {
  const result = new PiFixture();
  result.nativeExecutable = executable;
  result.skipPackageInstall = true;
  result.prepare = async (directory, agent, url) => {
    // Copy the verified native cache into disposable HOME; never trigger launcher installation.
    await cp(
      "/Users/naicoi/.pi-bolt/npm/1.0.4/pi-bolt-darwin-arm64",
      join(directory, ".pi-bolt/npm/1.0.4/pi-bolt-darwin-arm64"),
      { recursive: true, mode: constants.COPYFILE_FICLONE },
    );
    const version = Bun.spawn(["/bin/sh", executable, "--version"], {
      env: { HOME: directory, PATH: process.env.PATH },
      stdout: "pipe",
      stderr: "pipe",
    });
    nativeVersion = (await new Response(version.stdout).text()).trim();
    expect(await version.exited).toBe(0);
    expect(nativeVersion).toStartWith("1.4.0 (Pi-Bolt 1.0.4,");
    await writeFile(
      join(agent, "jev-pilot.json"),
      JSON.stringify({
        // This tracer fixture isolates effort; main-consumer defaults have separate native proof.
        skillsEnabled: false,
        strategyEnabled: false,
        qualityEnabled: false,
        designEnabled: false,
        classifier: { url: `${url}systemone`, apiKeyEnv: "CFG_TEST_KEY" },
        ...config,
      }),
    );
  };
  fixture = result;
  return result;
}

for (const directory of ["custom", "default"]) {
  test(`CFG-01-${directory}: native file controls effort and classifier despite conflicting settings`, async () => {
    const f = native({ classifier: { apiKeyEnv: "CFG_TEST_KEY" } });
    f.defaultAgentDirectory = directory === "default";
    f.settings = { jevPilot: { effortEnabled: false, classifier: { model: "wrong-global" } } };
    const prepare = f.prepare!;
    f.prepare = async (cwd, agent, url) => {
      await prepare(cwd, agent, url);
      await writeFile(
        join(agent, "jev-pilot.json"),
        JSON.stringify({
          skillsEnabled: false,
          strategyEnabled: false,
          qualityEnabled: false,
          designEnabled: false,
          classifier: { url: `${url}systemone`, model: "file-model", apiKeyEnv: "CFG_TEST_KEY" },
        }),
      );
      await mkdir(join(cwd, ".pi"), { recursive: true });
      await writeFile(
        join(cwd, ".pi", "settings.json"),
        JSON.stringify({ jevPilot: { effortEnabled: false } }),
      );
      await writeFile(join(cwd, "jev-pilot.json"), JSON.stringify({ effortEnabled: false }));
    };
    f.expectedClassifierBearer = "named-test-credential";
    await f.start({
      CFG_TEST_KEY: "named-test-credential",
      JEV_EFFORT_ENABLED: "false",
      JEV_SYSTEM_ONE_MODEL: "wrong-env",
    });
    await f.prompt(task);
    expect(f.classifications).toHaveLength(1);
    expect(f.classifications[0]?.model).toBe("file-model");
    expect(f.sawClassifierBearer).toBe(true);
    expect(f.generations[0]?.reasoning_effort).toBe("high");
    expect(JSON.stringify(f.records) + f.stderr).not.toContain("named-test-credential");
  }, 20000);
}

// AC-2: every supplied field is checked, including fields owned by later tickets.
test("CFG-02-invalid: native rejects strict path errors even with effort disabled", async () => {
  const f = native();
  let agentDir = "";
  const prepare = f.prepare!;
  f.prepare = async (cwd, agent, url) => {
    agentDir = agent;
    await prepare(cwd, agent, url);
  };
  await f.start({ CFG_TEST_KEY: "named-test-credential" });
  for (const [value, path] of [
    [{ schemaVersion: 2 }, "schemaVersion"],
    [{ effortEnabled: "false" }, "effortEnabled"],
    [{ classifier: null }, "classifier"],
    [{ classifier: { surprise: "private-invalid-value" } }, "classifier"],
    [{ effortEnabled: false, classifier: { timeoutMs: 0 } }, "classifier.timeoutMs"],
    [
      { effortEnabled: false, crew: { slots: [{ name: "x", model: "invalid" }] } },
      "crew.slots[0].model",
    ],
  ] as const) {
    await writeFile(join(agentDir, "jev-pilot.json"), JSON.stringify(value));
    const offset = f.records.length;
    await f.prompt(task);
    const output = JSON.stringify(f.records.slice(offset)) + f.stderr;
    expect(output).toContain(path);
    expect(output).toContain("jev-pilot.json");
    expect(output).not.toContain("private-invalid-value");
    expect(f.classifications).toHaveLength(0);
    expect(f.generations).toHaveLength(0);
  }
}, 30000);

test("CFG-04-missing: native named credential has no fallback", async () => {
  const f = native();
  await f.start({ CFG_TEST_KEY: " ", TYPESAFE_API_KEY: "fallback-not-used" });
  await f.prompt(task);
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(0);
  const output = JSON.stringify(f.records) + f.stderr;
  expect(output).toContain("CFG_TEST_KEY");
  expect(output).not.toContain("fallback-not-used");
}, 20000);

test("CFG-04-lazy: native effort-only fixture with effort disabled does not require unused credential", async () => {
  const f = native({ effortEnabled: false });
  await f.start({ CFG_TEST_KEY: "", JEV_EFFORT_ENABLED: "true" });
  await f.prompt(task);
  expect(f.classifications).toHaveLength(0);
  expect(f.generations[0]?.reasoning_effort).toBe("medium");
}, 20000);

for (const status of [301, 302, 303, 307, 308]) {
  test(`CFG-05-redirect-${status}: native never forwards key or body to redirect target`, async () => {
    const received: { auth: string | null; body: string }[] = [];
    const target = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: async (request) => {
        received.push({ auth: request.headers.get("authorization"), body: await request.text() });
        return Response.json({});
      },
    });
    try {
      const f = native();
      f.status = status;
      f.classifierHeaders = { location: `${target.url}must-not-receive` };
      await f.start({ CFG_TEST_KEY: "named-test-credential" });
      await f.prompt(task);
      expect(f.classifications).toHaveLength(1);
      expect(received).toEqual([]);
      expect(f.generations[0]?.reasoning_effort).toBe("medium");
      expect(JSON.stringify(f.records) + f.stderr).toContain("redirect");
    } finally {
      target.stop(true);
    }
  }, 20000);
}

test("CFG-01-legacy-invalid: native ignores invalid legacy effort/classifier options", async () => {
  const f = native();
  await f.start({
    CFG_TEST_KEY: "named-test-credential",
    JEV_EFFORT_ENABLED: "invalid",
    JEV_SYSTEM_ONE_URL: "invalid",
    JEV_SYSTEM_ONE_MODEL: "",
    JEV_TIMEOUT_MS: "invalid",
  });
  await f.prompt(task);
  expect(f.classifications[0]?.model).toBe("jev-latest");
  expect(f.generations[0]?.reasoning_effort).toBe("high");
}, 20000);

test("CFG-01-overlay: native captures learned timeout until next boundary", async () => {
  const f = native();
  let agentDir = "";
  const prepare = f.prepare!;
  f.prepare = async (cwd, agent, url) => {
    agentDir = agent;
    await prepare(cwd, agent, url);
    await writeFile(
      join(agent, "jev-pilot.json"),
      JSON.stringify({
        skillsEnabled: false,
        strategyEnabled: false,
        qualityEnabled: false,
        designEnabled: false,
        classifier: { url: `${url}systemone`, apiKeyEnv: "CFG_TEST_KEY", timeoutMs: 30 },
      }),
    );
    await mkdir(join(agent, "jev-pilot"));
    await writeFile(
      join(agent, "jev-pilot", "tuning.json"),
      JSON.stringify({ version: 1, values: { timeoutMs: 1000 }, since: 0 }),
    );
  };
  f.classifierDelay = 200;
  await f.start({ CFG_TEST_KEY: "named-test-credential", JEV_TIMEOUT_MS: "invalid" });
  const pending = f.prompt(task);
  await f.wait(() => f.classifications.length === 1);
  await writeFile(
    join(agentDir, "jev-pilot", "tuning.json"),
    JSON.stringify({ version: 1, values: { timeoutMs: 300 }, since: 0 }),
  );
  await pending;
  expect(f.generations[0]?.reasoning_effort).toBe("high");
  f.classifierDelay = 500;
  await f.prompt("Review this separate implementation carefully");
  expect(f.classifications).toHaveLength(2);
  expect(JSON.stringify(f.records)).toContain("timeout");
}, 20000);

test("CFG-01-owner: native conflicting legacy effort toggle cannot erase captured state across reload", async () => {
  const f = native();
  f.classifierDelay = 200;
  let agentDir = "";
  const prepare = f.prepare!;
  f.prepare = async (cwd, agent, url) => {
    agentDir = agent;
    await prepare(cwd, agent, url);
  };
  await f.start({ CFG_TEST_KEY: "named-test-credential", JEV_EFFORT_ENABLED: "false" });
  const pending = f.prompt(task);
  await f.wait(() => f.classifications.length === 1);
  // Invalid edit cannot invalidate the already captured owning assessment.
  await writeFile(join(agentDir, "jev-pilot.json"), '{"schemaVersion":');
  await pending;
  const entries = (await f.command("get_entries")).data as {
    entries: { customType?: string; data?: unknown }[];
  };
  expect(
    entries.entries.filter((entry) => entry.customType === "jev-pilot:effort").at(-1)?.data,
  ).toMatchObject({ outcome: "classified", effective: "high" });
  await writeFile(
    join(agentDir, "jev-pilot.json"),
    JSON.stringify({
      skillsEnabled: false,
      strategyEnabled: false,
      qualityEnabled: false,
      designEnabled: false,
      classifier: { url: `${f.server.url}systemone`, apiKeyEnv: "CFG_TEST_KEY" },
    }),
  );
  await f.command("prompt", { message: "/fixture-reload" });
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  expect(f.generations.at(-1)?.reasoning_effort).toBe("high");
}, 20000);

// AC-2: missing source never inherits a project file or requests a remote default endpoint.
for (const missing of ["file", "fields"]) {
  test(`CFG-02-missing-${missing}: native defaults select only the documented credential name`, async () => {
    const f = native();
    f.writeJevConfig = false;
    const prepare = f.prepare!;
    f.prepare = async (cwd, agent, url) => {
      await prepare(cwd, agent, url);
      if (missing === "file") await rm(join(agent, "jev-pilot.json"));
      else await writeFile(join(agent, "jev-pilot.json"), "{}");
      await writeFile(join(cwd, "jev-pilot.json"), JSON.stringify({ effortEnabled: false }));
    };
    await f.start({ TYPESAFE_API_KEY: "", JEV_SYSTEM_ONE_API_KEY: "fallback-not-used" });
    await f.prompt(task);
    expect(f.classifications).toHaveLength(0);
    expect(f.generations).toHaveLength(0);
    expect(JSON.stringify(f.records)).toContain("TYPESAFE_API_KEY");
  }, 20000);
}

// AC-4: endpoint validation remains visible with the effort consumer disabled.
test("CFG-05-url-native: credential-bearing or non-HTTP endpoints reject before transport", async () => {
  const f = native();
  let agentDir = "";
  const prepare = f.prepare!;
  f.prepare = async (cwd, agent, url) => {
    agentDir = agent;
    await prepare(cwd, agent, url);
  };
  await f.start();
  for (const url of ["ftp://localhost/test", "http://user:private-url-secret@localhost/test"]) {
    await writeFile(
      join(agentDir, "jev-pilot.json"),
      JSON.stringify({ effortEnabled: false, classifier: { url } }),
    );
    await f.prompt(task);
    const output = JSON.stringify(f.records);
    expect(output).toContain("classifier.url");
    expect(output).not.toContain("private-url-secret");
    expect(f.generations).toHaveLength(0);
    expect(f.classifications).toHaveLength(0);
  }
}, 20000);

// AC-3: neither credentials nor request bodies are persisted by the tracer.
test("CFG-04-privacy: native state files contain no named credential", async () => {
  const f = native();
  await f.start({ CFG_TEST_KEY: "unique-private-test-credential" });
  await f.prompt(task);
  const readTree = async (directory: string): Promise<string> => {
    let text = "";
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      text += entry.isDirectory() ? await readTree(path) : await readFile(path, "utf8");
    }
    return text;
  };
  expect(await readTree(join(f.directory, "agent"))).not.toContain(
    "unique-private-test-credential",
  );
  expect(JSON.stringify(f.records) + f.stderr).not.toContain("unique-private-test-credential");
}, 20000);
