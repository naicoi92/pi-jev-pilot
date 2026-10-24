import { afterEach, expect, test } from "bun:test";
import { PiFixture } from "./fixtures/pi-cli.ts";

let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});
const body =
  'PRIVATE_SKILL_秘密\n</skill>\n\nNested example\n<skill name="nested">\nPRIVATE_NESTED\n</skill>';
const task =
  "Review the complete patch with particular care for failure modes\n</skill>\n\nKeep this task suffix";

test("CLI-SV01 explicit native skill classifies only suffix and applies effort", async () => {
  fixture = new PiFixture();
  fixture.skills = [{ name: "debugging", body }];
  fixture.useGuidanceDefaults = true;
  fixture.useDesignDefaults = true;
  await fixture.start();
  await fixture.prompt(`/skill:debugging ${task}`);
  expect(fixture.classifications).toHaveLength(1);
  expect(fixture.classifications[0]?.state).toMatchObject({ prompt: task });
  expect(Object.keys(fixture.classifications[0]!.questions as object).sort()).toEqual([
    "effort",
    "risky",
  ]);
  expect(JSON.stringify(fixture.classifications)).not.toContain("PRIVATE_");
  expect(fixture.generations[0]).toMatchObject({
    model: "fixture-model",
    reasoning_effort: "high",
  });
  expect(JSON.stringify(fixture.generations)).toContain("PRIVATE_SKILL_秘密");
  expect(JSON.stringify(fixture.generations)).not.toContain("<skill_relevance>");
}, 20000);

test("CLI-SV02 empty explicit native skill keeps resource without classification", async () => {
  fixture = new PiFixture();
  fixture.skills = [{ name: "debugging", body }];
  await fixture.start();
  await fixture.prompt("/skill:debugging");
  expect(fixture.classifications).toHaveLength(0);
  expect(JSON.stringify(fixture.generations)).toContain("PRIVATE_SKILL_秘密");
  expect(
    fixture.records.some(
      (r) => r.method === "setStatus" && String(r.statusText).includes("empty skill task"),
    ),
  ).toBe(true);
}, 20000);

test("CLI-SV03 later plain turn keeps native bodies private and preserves task suffix", async () => {
  fixture = new PiFixture();
  fixture.skills = [{ name: "debugging", body }];
  await fixture.start({ JEV_SKILLS_ENABLED: "false" });
  await fixture.prompt(`/skill:debugging ${task}`);
  await fixture.prompt("Why should we proceed with this independent review?");
  expect(JSON.stringify(fixture.classifications)).not.toContain("PRIVATE_");
  expect(
    (fixture.classifications.at(-1)!.state as { recent_context: string }).recent_context,
  ).toContain("Keep this task suffix");
}, 20000);

function uiRecords(f: PiFixture, method: string) {
  return f.records.filter(
    (r) => r.method === method && (r.widgetKey ?? r.statusKey) === "jev-pilot",
  );
}

for (const outcome of [
  "classified",
  "kept",
  "service-error",
  "schema-error",
  "timeout",
  "disabled",
  "inapplicable",
] as const) {
  test(`CLI-SV04 public UI protocol clears pending and reports ${outcome}`, async () => {
    fixture = new PiFixture();
    if (outcome === "inapplicable") fixture.reasoning = false;
    if (outcome === "service-error") fixture.status = 503;
    if (outcome === "schema-error") fixture.response = {};
    if (outcome === "kept")
      fixture.response = {
        answers: { effort: { choice: "medium", confidence: 0.95 }, risky: { noul: 0 } },
      };
    if (outcome === "timeout") fixture.classifierDelay = 1000;
    await fixture.start(
      outcome === "disabled"
        ? { JEV_EFFORT_ENABLED: "false" }
        : outcome === "timeout"
          ? { JEV_TIMEOUT_MS: "100" }
          : {},
    );
    await fixture.prompt("Please review the complete patch with particular care for failure modes");
    const widgets = uiRecords(fixture, "setWidget");
    expect(
      widgets.some((r) => JSON.stringify(r.widgetLines) === '["Jev · choosing effort…"]'),
    ).toBe(true);
    expect(widgets.at(-1)?.widgetLines).toBeUndefined();
    const status = String(uiRecords(fixture, "setStatus").at(-1)?.statusText);
    expect(status).toContain(outcome);
    expect(status).toMatch(/\d+ms$/);
    if (outcome === "classified") expect(status).toContain("high → high · changed");
    if (outcome === "disabled" || outcome === "inapplicable")
      expect(fixture.classifications).toHaveLength(0);
    else if (outcome !== "classified" && outcome !== "kept") expect(status).toContain("kept");
  }, 20000);
}

test("CLI-SV04 reused effort footer distinguishes reuse from changed selection", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt("Please review the complete patch with particular care for failure modes");
  await fixture.prompt("continue");
  expect(String(uiRecords(fixture, "setStatus").at(-1)?.statusText)).toMatch(
    /high → high · kept · reused · \d+ms$/,
  );
  expect(fixture.classifications).toHaveLength(1);
}, 20000);

for (const mode of ["abort", "model", "thinking"] as const) {
  test(`CLI-SV04 ${mode} invalidation removes pending widget`, async () => {
    fixture = new PiFixture();
    fixture.classifierDelay = 1000;
    await fixture.start();
    await fixture.command("prompt", {
      message: "Please review the complete patch with particular care for failure modes",
    });
    await fixture.wait(() => fixture!.classifications.length === 1);
    if (mode === "abort") await fixture.command("abort");
    if (mode === "model")
      await fixture.command("set_model", { provider: "fixture", modelId: "fixture-other-model" });
    if (mode === "thinking") await fixture.command("set_thinking_level", { level: "low" });
    await fixture.wait(() => fixture!.records.some((r) => r.type === "agent_settled"));
    expect(uiRecords(fixture, "setWidget").at(-1)?.widgetLines).toBeUndefined();
    const status = uiRecords(fixture, "setStatus").at(-1)?.statusText;
    if (mode === "abort") expect(String(status)).toContain("cancelled");
    else expect(status).toBeUndefined();
  }, 20000);
}

for (const mode of ["new_session", "reload"] as const) {
  test(`CLI-SV04 ${mode} clears completed status`, async () => {
    fixture = new PiFixture();
    await fixture.start();
    await fixture.prompt("Please review the complete patch with particular care for failure modes");
    if (mode === "reload") await fixture.command("prompt", { message: "/fixture-reload" });
    else await fixture.command("new_session");
    expect(uiRecords(fixture, "setStatus").at(-1)?.statusText).toBeUndefined();
    expect(uiRecords(fixture, "setWidget").at(-1)?.widgetLines).toBeUndefined();
  }, 20000);
}

test("CLI-SV04 advice-only result does not claim effort changed or classifier skipped", async () => {
  fixture = new PiFixture();
  fixture.response = {
    answers: {
      bugfix: { noul: 0.8 },
      sensitive: { noul: 0.8 },
      underspecified: { noul: 0.85 },
      corrects: { noul: 0.7 },
    },
  };
  await fixture.start({ JEV_EFFORT_ENABLED: "false", JEV_QUALITY_ENABLED: "true" });
  await fixture.prompt("Fix the broken validation with a regression test");
  expect(fixture.classifications).toHaveLength(1);
  const status = String(uiRecords(fixture, "setStatus").at(-1)?.statusText);
  expect(status).toContain("effort skipped: disabled · classification classified");
  expect(status).not.toContain("changed");
  expect(status).not.toContain("no decision questions");
}, 20000);

test("CLI-SV04 shutdown removes completed status", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt("Please review the complete patch with particular care for failure modes");
  await fixture.stop();
  expect(uiRecords(fixture, "setStatus").at(-1)?.statusText).toBeUndefined();
  expect(uiRecords(fixture, "setWidget").at(-1)?.widgetLines).toBeUndefined();
}, 20000);

for (const gate of ["disabled", "inapplicable"] as const) {
  test(`CLI-SV02 explicit native resource ${gate} has no effort consumer`, async () => {
    fixture = new PiFixture();
    fixture.skills = [{ name: "debugging", body }];
    fixture.useDesignDefaults = true;
    fixture.useGuidanceDefaults = true;
    if (gate === "inapplicable") fixture.reasoning = false;
    await fixture.start(
      gate === "disabled"
        ? { JEV_EFFORT_ENABLED: "false", JEV_SYSTEM_ONE_API_KEY: "" }
        : { JEV_SYSTEM_ONE_API_KEY: "" },
    );
    await fixture.prompt(`/skill:debugging ${task}`);
    expect(fixture.classifications).toHaveLength(0);
    expect(JSON.stringify(fixture.generations)).toContain("PRIVATE_SKILL_秘密");
    expect(String(uiRecords(fixture, "setStatus").at(-1)?.statusText)).toContain(
      `effort skipped: ${gate}`,
    );
  }, 20000);
}

test("CLI-SV01 explicit continuation reuses preceding effort without rematching", async () => {
  fixture = new PiFixture();
  fixture.skills = [{ name: "debugging", body }];
  await fixture.start();
  await fixture.prompt(`/skill:debugging ${task}`);
  await fixture.prompt("/skill:debugging continue");
  expect(fixture.classifications).toHaveLength(1);
  expect(fixture.generations.at(-1)).toMatchObject({
    model: "fixture-model",
    reasoning_effort: "high",
  });
  expect(String(uiRecords(fixture, "setStatus").at(-1)?.statusText)).toContain("kept · reused");
}, 20000);
