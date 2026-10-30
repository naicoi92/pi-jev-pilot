import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jevConfigPath, loadJevConfig } from "../src/jev-config.ts";
import { captureEffortAssessment } from "../src/effort-assessment.ts";
import { systemOneConfig } from "../src/system-one.ts";

const savedAgentDir = process.env.PI_CODING_AGENT_DIR;
const savedNamed = process.env.CFG_TEST_KEY;
let directory = "";
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "jev-config-unit-"));
  process.env.PI_CODING_AGENT_DIR = directory;
});
afterEach(async () => {
  if (savedAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = savedAgentDir;
  if (savedNamed === undefined) delete process.env.CFG_TEST_KEY;
  else process.env.CFG_TEST_KEY = savedNamed;
  await rm(directory, { recursive: true, force: true });
});
async function file(value: unknown): Promise<void> {
  await writeFile(jevConfigPath(), JSON.stringify(value));
}

// AC-2: literal defaults come from the approved version-1 schema.
test("CFG-02-defaults: missing file and missing fields have identical approved defaults", async () => {
  const missing = loadJevConfig();
  expect(missing).toEqual({
    schemaVersion: 1,
    effortEnabled: true,
    workerRoutingEnabled: true,
    workerToolSelectionEnabled: true,
    workerToolThreshold: 0.65,
    skillsEnabled: true,
    skillRerank: false,
    strategyEnabled: true,
    qualityEnabled: true,
    designEnabled: true,
    recordDecisions: true,
    designSkills: ["design-taste-frontend", "impeccable", "web-design-guidelines"],
    classifier: {
      url: "https://api.typesafe.ai/v1/systemone",
      apiKeyEnv: "TYPESAFE_API_KEY",
      model: "jev-latest",
      timeoutMs: 1500,
    },
    tiers: {},
    crew: { mode: "standard", slots: [], offered: [], junior: undefined },
  });
  await file({ classifier: {}, crew: {}, tiers: {} });
  expect(loadJevConfig()).toEqual(missing);
  expect(jevConfigPath()).toBe(join(directory, "jev-pilot.json"));
});

const invalid: [unknown, string][] = [
  [null, "$root"],
  [[], "$root"],
  [false, "$root"],
  [{ "private-unknown-name": "private-value" }, "$root"],
  ...[null, "1", 0, 2, true].map((schemaVersion): [unknown, string] => [
    { schemaVersion },
    "schemaVersion",
  ]),
  ...[
    "effortEnabled",
    "workerRoutingEnabled",
    "workerToolSelectionEnabled",
    "skillsEnabled",
    "skillRerank",
    "strategyEnabled",
    "qualityEnabled",
    "designEnabled",
    "recordDecisions",
  ].flatMap((key) =>
    [null, "false", 0, {}, []].map((value): [unknown, string] => [{ [key]: value }, key]),
  ),
  [{ designSkills: null }, "designSkills"],
  [{ designSkills: "private-value" }, "designSkills"],
  [{ designSkills: ["ok", null] }, "designSkills[1]"],
  [{ classifier: null }, "classifier"],
  [{ classifier: [] }, "classifier"],
  [{ classifier: { "private-unknown-name": "private-value" } }, "classifier"],
  ...["url", "model", "apiKeyEnv"].flatMap((key) =>
    [null, "", " ", 1, false, []].map((value): [unknown, string] => [
      { classifier: { [key]: value } },
      `classifier.${key}`,
    ]),
  ),
  ...[null, "1500", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map((timeoutMs): [unknown, string] => [
    { classifier: { timeoutMs } },
    "classifier.timeoutMs",
  ]),
  ...["with-dash", "1PREFIX", " KEY", "KEY ", "private-value=secret"].map(
    (apiKeyEnv): [unknown, string] => [{ classifier: { apiKeyEnv } }, "classifier.apiKeyEnv"],
  ),
  [{ tiers: null }, "tiers"],
  [{ tiers: { main: "private-value" } }, "tiers"],
  ...["fast", "balanced", "deep", "expert"].flatMap((tier) =>
    [null, 3, false, "unqualified", "local/model:high", "local/a b"].map(
      (value): [unknown, string] => [{ tiers: { [tier]: value } }, `tiers.${tier}`],
    ),
  ),
  [{ crew: null }, "crew"],
  [{ crew: { "private-unknown-name": true } }, "crew"],
  ...[null, "private-value", false].map((mode): [unknown, string] => [
    { crew: { mode } },
    "crew.mode",
  ]),
  [{ crew: { slots: null } }, "crew.slots"],
  [{ crew: { slots: Array(9).fill({}) } }, "crew.slots"],
  [{ crew: { slots: [null] } }, "crew.slots[0]"],
  [
    { crew: { slots: [{ name: "x", model: "local/model", "private-unknown-name": true }] } },
    "crew.slots[0]",
  ],
  ...[null, "quality", "Bad", "a b", "x".repeat(25)].map((name): [unknown, string] => [
    { crew: { slots: [{ name, model: "local/model" }] } },
    "crew.slots[0].name",
  ]),
  [
    {
      crew: {
        slots: [
          { name: "x", model: "local/model" },
          { name: "x", model: "local/model" },
        ],
      },
    },
    "crew.slots[1].name",
  ],
  ...[null, "model", "local/model:high"].map((model): [unknown, string] => [
    { crew: { slots: [{ name: "x", model }] } },
    "crew.slots[0].model",
  ]),
  [{ crew: { slots: [{ name: "x", model: "local/model", when: null }] } }, "crew.slots[0].when"],
  [{ crew: { junior: null } }, "crew.junior"],
  [{ crew: { junior: "missing" } }, "crew.junior"],
];
for (const [index, [value, path]] of invalid.entries()) {
  test(`CFG-02-strict-${index}: ${path} rejects explicit invalid values`, async () => {
    await file(value);
    let message = "";
    try {
      loadJevConfig();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain(jevConfigPath());
    expect(message).toContain(`at ${path}:`);
    expect(message).not.toContain("private-value");
    expect(message).not.toContain("private-unknown-name");
  });
}

test("CFG-02-read-errors: malformed and unreadable existing files never reuse last-good config", async () => {
  await file({ effortEnabled: false });
  expect(loadJevConfig().effortEnabled).toBe(false);
  await writeFile(jevConfigPath(), '{"private-value":');
  expect(loadJevConfig).toThrow("expected valid JSON");
  await rm(jevConfigPath());
  await mkdir(jevConfigPath());
  expect(loadJevConfig).toThrow("expected a readable configuration file");
});

test("CFG-02-normalize: design names and sparse tiers preserve explicit empty semantics", async () => {
  await file({
    designSkills: [" one ", "one", "", "two"],
    tiers: { fast: "", balanced: " ", expert: "local/expert" },
  });
  expect(loadJevConfig().designSkills).toEqual(["one", "two"]);
  expect(loadJevConfig().tiers).toEqual({ expert: "local/expert" });
  await file({ designSkills: [] });
  expect(loadJevConfig().designSkills).toEqual([]);
});

test("CFG-02-crew: inline modes preserve offered slots and junior selection", async () => {
  const slots = [
    { name: "beta", model: "local/b" },
    { name: "alpha", model: "local/a", when: " custom " },
  ];
  for (const mode of ["standard", "budget", "junior-lead"]) {
    await file({ crew: { mode, slots, junior: "alpha" } });
    const crew = loadJevConfig().crew;
    expect(crew.offered.map((slot) => slot.name)).toEqual(
      mode === "standard" ? [] : ["beta", "alpha"],
    );
    expect(crew.junior?.model).toBe(mode === "junior-lead" ? "local/a" : undefined);
    expect(crew.slots[1]?.when).toBe("custom");
    expect(crew.slots[0]?.when).toContain("Never for writing or changing code.");
  }
  await file({ crew: { mode: "junior-lead", slots } });
  expect(loadJevConfig().crew.junior?.model).toBe("local/b");
});

// AC-1: immutable base/overlay snapshot; only the next boundary sees edits.
test("CFG-01-snapshot: deeply frozen options and tuning retain boundary values", async () => {
  await file({
    classifier: { timeoutMs: 40 },
    crew: { mode: "budget", slots: [{ name: "alpha", model: "local/a" }] },
  });
  await mkdir(join(directory, "jev-pilot"));
  await writeFile(
    join(directory, "jev-pilot/tuning.json"),
    JSON.stringify({ version: 1, values: { timeoutMs: 800, effortCloseMargin: 0.3 } }),
  );
  const captured = captureEffortAssessment();
  expect(captured.config.classifier.timeoutMs).toBe(40);
  expect(captured.tuning.timeoutMs).toBe(800);
  for (const value of [
    captured,
    captured.config,
    captured.config.classifier,
    captured.config.tiers,
    captured.config.designSkills,
    captured.config.crew,
    captured.config.crew.slots,
    captured.config.crew.slots[0],
    captured.config.crew.offered,
    captured.tuning,
  ])
    expect(Object.isFrozen(value)).toBe(true);
  await file({ classifier: { timeoutMs: 90 } });
  await writeFile(
    join(directory, "jev-pilot/tuning.json"),
    JSON.stringify({ version: 1, values: {} }),
  );
  expect(captured.tuning.timeoutMs).toBe(800);
  expect(captureEffortAssessment().tuning.timeoutMs).toBe(90);
});

// AC-3: no credential read by the loader; resolve once when building the request config.
test("CFG-04-capture: named secret stays in request config, not immutable file snapshot", async () => {
  await file({ classifier: { apiKeyEnv: "CFG_TEST_KEY" } });
  delete process.env.CFG_TEST_KEY;
  const captured = captureEffortAssessment();
  expect(() => systemOneConfig(captured)).toThrow("CFG_TEST_KEY");
  process.env.CFG_TEST_KEY = "first-private-key";
  const request = systemOneConfig(captured);
  process.env.CFG_TEST_KEY = "second-private-key";
  expect(request.apiKey).toBe("first-private-key");
  expect(JSON.stringify(captured)).not.toContain("private-key");
});

// AC-4: endpoint syntax is validated even when no classifier consumer is enabled.
for (const url of [
  "not-a-url",
  "ftp://localhost/test",
  "file:///secret",
  "https://user:private-value@localhost/test",
  "http://user@localhost/test",
]) {
  test(`CFG-05-url-${url.split(":")[0]}: unsafe endpoint rejects without echo`, async () => {
    await file({ effortEnabled: false, classifier: { url } });
    expect(loadJevConfig).toThrow("classifier.url");
    try {
      loadJevConfig();
    } catch (error) {
      expect((error as Error).message).not.toContain("private-value");
    }
  });
}
for (const url of ["http://127.0.0.1:1234/systemone", "https://example.com/systemone"]) {
  test(`CFG-05-valid-${url.split(":")[0]}: valid credential-free endpoint retained`, async () => {
    await file({ classifier: { url } });
    expect(loadJevConfig().classifier.url).toBe(url);
  });
}
