import { afterEach, expect, test } from "bun:test";
import type { RecordData } from "./fixtures/pi-cli.ts";
import { MainConfigFixture as PiFixture } from "./fixtures/main-config.ts";

let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});
function contentText(content: unknown): string {
  return typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part: { text?: string }) => part.text ?? "").join("\n")
      : "";
}
function text(f: PiFixture, index = 0): string {
  const messages = f.generations[index]?.messages as {
    role: string;
    content: string | { text?: string }[] | null;
  }[];
  return messages
    .map((m) =>
      typeof m.content === "string"
        ? m.content
        : (m.content ?? []).map((p) => p.text ?? "").join("\n"),
    )
    .join("\n");
}
async function start(config: RecordData = {}, environment: Record<string, string> = {}) {
  fixture = new PiFixture();
  fixture.environment = environment;
  fixture.useDesignDefaults = true;

  fixture.response = {
    answers: {
      ui_design: { noul: 0.97 },
    },
  };
  return fixture.start({
    effortEnabled: false,
    skillsEnabled: false,
    ...config,
  });
}

test("D09-design-only-default asks the upstream design noul in one installed request", async () => {
  const f = await start();
  await f.prompt("Design a landing page where the visual style matters");
  expect(f.classifications).toHaveLength(1);
  expect(Object.keys(f.classifications[0]!.questions as RecordData)).toEqual(["ui_design"]);
  expect(text(f)).toContain("<jev_design>");
  expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "medium" });
}, 20000);

test("D17-resource-default references installed configured skills with active read paths", async () => {
  fixture = new PiFixture();
  fixture.useDesignDefaults = true;
  fixture.skills = [
    { name: "impeccable", body: "DESIGN_BODY_MUST_NOT_BE_INJECTED" },
    { name: "vercel:web-design-guidelines", body: "GUIDELINES_BODY_NOT_INJECTED" },
    { name: "unconfigured-design", body: "UNCONFIGURED_BODY" },
  ];
  fixture.response = { answers: { ui_design: { noul: 0.97 } } };
  const f = await fixture.start({ effortEnabled: false, skillsEnabled: false });
  await f.prompt("Restyle the dashboard with the existing project tokens");
  const pack = text(f).split("<jev_design>")[1]!.split("</jev_design>")[0]!;
  expect(pack).toContain("/impeccable");
  expect(pack).toContain("/vercel:web-design-guidelines");
  expect(pack).toContain(`${f.directory}/agent/skills/impeccable/SKILL.md`);
  expect(pack).toContain("read");
  expect(pack).not.toContain("/design-taste-frontend");
  expect(pack).not.toContain("unconfigured-design");
  expect(text(f)).not.toContain("DESIGN_BODY_MUST_NOT_BE_INJECTED");
  expect(text(f)).not.toContain("GUIDELINES_BODY_NOT_INJECTED");
  expect(pack).not.toContain("Skill tool");
  expect(f.generations).toHaveLength(1);
}, 20000);

for (const [score, expected, prompt] of [
  [0.8, true, "Build a settings screen"],
  [0.799, false, "Build a settings screen"],
  [0.09, false, "The modal close button does nothing"],
  [0, false, "Write backend data validation tests"],
  [undefined, false, "Design the onboarding flow"],
  ["0.97", false, "Design the onboarding flow"],
  [-0.1, false, "Design the onboarding flow"],
  [1.1, false, "Design the onboarding flow"],
  [NaN, false, "Design the onboarding flow"],
] as const) {
  test(`D17-boundaries-positive-negative ${String(score)}/${prompt}`, async () => {
    const f = await start();
    f.response = { answers: { ui_design: { noul: score } } };
    await f.prompt(prompt);
    expect(text(f).includes("<jev_design>")).toBe(expected);
    expect(f.classifications).toHaveLength(1);
  }, 20000);
}
test("D17-boundaries probability fallback preserves upstream .97", async () => {
  const f = await start();
  f.response = { answers: { ui_design: { probability: 0.97 } } };
  await f.prompt("Restyle this screen");
  expect(text(f)).toContain("<jev_design>");
}, 20000);

for (const withRead of [false, true]) {
  test(`D17-reference-tools active tools only read=${withRead}`, async () => {
    fixture = new PiFixture();
    fixture.useDesignDefaults = true;
    fixture.tools = withRead ? "read" : "bash";
    fixture.referenceTools = [
      { name: "mcp__mobbin__get_screen", active: true },
      { name: "mcp__mobbin__search_flows", active: false },
      { name: "mcp__inspo__lookup", active: withRead },
    ];
    fixture.skills = [{ name: "impeccable", body: "DO_NOT_INJECT_DESIGN_BODY" }];
    fixture.projectContext = "Use the existing ORBIT_DESIGN_TOKENS for every visible component.";
    fixture.response = { answers: { ui_design: { noul: 0.97 } } };
    const f = await fixture.start({ effortEnabled: false, skillsEnabled: false });
    await f.command("prompt", { message: "/fixture-tools" });
    const catalogs = (await Bun.file(`${f.directory}/lifecycle.jsonl`).text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as RecordData);
    const catalog = catalogs.findLast((entry) => entry.fixtureTools)!;
    expect(catalog.fixtureTools).toEqual(
      expect.arrayContaining([
        "mcp__mobbin__get_screen",
        "mcp__mobbin__search_flows",
        "mcp__inspo__lookup",
      ]),
    );
    expect(catalog.active).not.toContain("mcp__mobbin__search_flows");
    await f.prompt("Restyle the settings screen using project design tokens");
    const all = text(f);
    const pack = all.split("<jev_design>")[1]!.split("</jev_design>")[0]!;
    expect(all).toContain("ORBIT_DESIGN_TOKENS");
    expect(pack.indexOf("follow the project's design system or tokens")).toBeLessThan(
      pack.indexOf("Otherwise"),
    );
    expect(pack).toContain(
      "https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<site>/DESIGN.md",
    );
    expect(pack).toContain("https://github.com/VoltAgent/awesome-design-md/tree/main/design-md");
    expect(pack).toContain(
      "linear.app, stripe, vercel, notion, apple, airbnb, spotify, raycast, cursor, supabase",
    );
    expect(pack).toContain("mcp__mobbin__get_screen");
    expect(pack.includes("mcp__inspo__lookup")).toBe(withRead);
    expect(pack).not.toContain("search_screens");
    expect(pack).not.toContain("search_flows");
    expect(pack.includes(`${f.directory}/agent/skills/impeccable/SKILL.md`)).toBe(withRead);
    expect(pack).not.toContain("Skill tool");
    expect(pack).not.toContain("DO_NOT_INJECT_DESIGN_BODY");
    expect(f.generations).toHaveLength(1);
  }, 20000);
}

test("D17-resource-custom-exact-suffix excludes unconfigured disabled and unreadable resources", async () => {
  fixture = new PiFixture();
  fixture.useDesignDefaults = true;
  fixture.skills = [
    { name: "vendor:craft", body: "SUFFIX_BODY" },
    { name: "craft", body: "EXACT_BODY" },
    { name: "vendor:polish", body: "POLISH_BODY" },
    { name: "disabled", body: "DISABLED_BODY", disabled: true },
    { name: "unreadable", body: "REMOVED_BODY" },
    { name: "impeccable", body: "UNCONFIGURED_BODY" },
  ];
  fixture.response = { answers: { ui_design: { noul: 0.97 } } };
  const f = await fixture.start({
    effortEnabled: false,
    skillsEnabled: false,
    designSkills: [" craft", "polish", "disabled", "unreadable", "missing", "craft", " "],
  });
  await Bun.file(`${f.directory}/agent/skills/unreadable/SKILL.md`).delete();
  await f.prompt("Design a dashboard");
  const pack = text(f).split("<jev_design>")[1]!.split("</jev_design>")[0]!;
  expect(pack).toContain("/craft");
  expect(pack).toContain("/vendor:polish");
  expect(pack).not.toContain("/vendor:craft");
  expect(pack).not.toContain("disabled");
  expect(pack).not.toContain("unreadable");
  expect(pack).not.toContain("missing");
  expect(pack).not.toContain("impeccable");
  expect(pack.split("/craft (read")).toHaveLength(2);
}, 20000);

test("D17-resource-empty configured list stays empty without fallback aliases", async () => {
  const f = await start({ designSkills: [] });
  await f.prompt("Design a landing page");
  expect(text(f)).toContain("awesome-design-md");
  expect(text(f)).not.toContain("Load /");
  expect(text(f)).not.toContain("Mobbin");
  expect(text(f)).not.toContain("Inspo");
}, 20000);

{
  test(`D09-combined-physical adds design to the one initial call`, async () => {
    fixture = new PiFixture();
    fixture.useDesignDefaults = true;
    fixture.skills = [
      { name: "procedure", body: "ORDINARY_SELECTED_BODY" },
      { name: "impeccable", body: "DESIGN_NOT_AN_ORDINARY_SELECTION" },
    ];

    const f = await fixture.start({
      effortEnabled: true,
      strategyEnabled: true,
      qualityEnabled: true,
    });
    f.response = {
      answers: {
        tier: { choice: "deep", confidence: 0.99 },
        effort: { choice: "high", confidence: 0.99 },
        risky: { noul: 0 },
        strategy: { choice: "delegate", confidence: 0.6 },
        bugfix: { noul: 0.8 },
        ui_design: { noul: 0.8 },
        which: { choice: "procedure", confidence: 0.9 },
      },
    };
    await f.prompt("Restyle the specified dashboard component");
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
      "ui_design",
      "underspecified",
      "which",
    ]);
    expect(text(f)).toContain("<jev_design>");
    expect(text(f)).toContain("<jev_quality>");
    expect(text(f)).toContain("<execution_strategy>");
    expect(f.generations[0]).toMatchObject({
      model: "fixture-model",
      reasoning_effort: "high",
    });
  }, 20000);
  test(`D17-raw-consumer-physical design is independent of routing rejection`, async () => {
    const f = await start({ effortEnabled: true });
    f.response = {
      answers: {
        ui_design: { noul: 0.97 },
        tier: { choice: "deep", probabilities: { deep: 0.6 } },
        effort: { choice: "high", confidence: 0.99 },
      },
    };
    await f.prompt("Design a dashboard without changing the selected effort on invalid routing");
    expect(f.classifications).toHaveLength(1);
    expect(text(f)).toContain("<jev_design>");
    expect(f.generations[0]).toMatchObject({ model: "fixture-model", reasoning_effort: "medium" });
    const entries = ((await f.command("get_entries")).data as { entries: RecordData[] }).entries;
    const state = entries.findLast((e) => e.customType === "jev-pilot:effort");
    expect(JSON.stringify(state)).toContain("schema-error");
  }, 20000);
}
for (const choice of ["procedure", "(none)"]) {
  test(`D17-ordinary-separation ordinary ${choice} does not suppress design`, async () => {
    fixture = new PiFixture();
    fixture.useDesignDefaults = true;
    fixture.skills = [
      { name: "procedure", body: "ORDINARY_BODY_MARKER" },
      { name: "impeccable", body: "DESIGN_BODY_MARKER" },
    ];
    fixture.response = {
      answers: { which: { choice, confidence: 0.9 }, ui_design: { noul: 0.97 } },
    };
    const f = await fixture.start({ effortEnabled: false });
    await f.prompt("Design the component with a specified procedure");
    expect(text(f).includes("ORDINARY_BODY_MARKER")).toBe(choice === "procedure");
    expect(text(f)).not.toContain("DESIGN_BODY_MARKER");
    expect(text(f)).toContain("/impeccable");
    expect(text(f).split("<skill_relevance>")).toHaveLength(choice === "procedure" ? 2 : 1);
    expect(f.classifications).toHaveLength(1);
  }, 20000);
}
test("D09-disabled-empty-continuation no questions ignores unused invalid configuration", async () => {
  const f = await start(
    { designEnabled: false },
    { JEV_SYSTEM_ONE_URL: "invalid", CFG_TEST_KEY: "" },
  );
  await f.prompt("Design a landing page");
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(1);
}, 20000);
for (const prompt of ["", "/skill:missing", "continue"]) {
  test(`D09-disabled-empty-continuation ineligible ${JSON.stringify(prompt)}`, async () => {
    const f = await start({}, { JEV_SYSTEM_ONE_URL: "invalid", CFG_TEST_KEY: "" });
    if (!prompt || prompt.startsWith("/")) await f.command("prompt", { message: prompt });
    else await f.prompt(prompt);
    expect(f.classifications).toHaveLength(0);
  }, 20000);
}
test("D09-rubric retains exact upstream design question without project content payload", async () => {
  const f = await start();
  await f.prompt("Build a mobile onboarding flow");
  expect((f.classifications[0]!.questions as RecordData).ui_design).toEqual({
    type: "noul",
    instructions:
      "The request is to design, build or restyle something people see: a page, screen, component, layout, flow or visual style, for web or mobile, where how it looks and feels matters.",
    criteria: {
      true: "Visual or interaction design work: a landing page, a dashboard, a settings screen, a component, a redesign, a mobile screen or onboarding flow, styling, animation.",
      false:
        "No visible design involved: backend, data, tests, scripts, a bug in logic, docs, a question, or a UI change that is purely wiring (renaming a prop, fixing a handler).",
    },
  });
  expect(JSON.stringify(f.classifications)).not.toContain("<jev_design>");
}, 20000);
for (const rerank of [false, true]) {
  test(`D09-batches-rerank design appears only in first batch rerank=${rerank}`, async () => {
    fixture = new PiFixture();
    fixture.useDesignDefaults = true;
    fixture.skills = Array.from({ length: 255 }, (_, i) => ({
      name: `skill-${String(i).padStart(3, "0")}`,
      body: "Bounded excerpt",
    }));
    fixture.classifierResponse = (body) => {
      const questions = body.questions as RecordData;
      const which = questions.which as { criteria: RecordData };
      return {
        answers: {
          which: { choice: Object.keys(which.criteria)[0], confidence: 0.9 },
          ui_design: { noul: 0.97 },
          "gate::acts_on_user_system": { noul: 1 },
        },
      };
    };
    const f = await fixture.start({
      effortEnabled: false,
      skillRerank: rerank,
    });
    await f.prompt("Design a screen using the matching procedure");
    expect(f.classifications).toHaveLength(rerank ? 3 : 2);
    expect(
      f.classifications.filter((c) => "ui_design" in (c.questions as RecordData)),
    ).toHaveLength(1);
    expect(
      Object.keys((f.classifications[0]!.questions as RecordData).which as RecordData),
    ).toContain("criteria");
    expect(text(f).split("<jev_design>")).toHaveLength(2);
  }, 20000);
}

{
  test(`D17-retry-tool-continue physical reuses owned design without another classifier call`, async () => {
    const f = await start({});
    f.modelFailures = 2;
    await f.command("set_auto_retry", { enabled: true });
    f.nextReadPath = `${f.directory}/agent/settings.json`;
    await f.prompt("Design a settings screen with the existing project system");
    await f.prompt("continue");
    expect(f.classifications).toHaveLength(1);
    expect(f.generations.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < f.generations.length; i++)
      expect(text(f, i).split("<jev_design>")).toHaveLength(2);
    expect(
      f.records.filter((r) => r.type === "tool_execution_start").map((r) => r.toolName),
    ).toEqual(["read"]);
  }, 20000);

  test(`D17-queue physical shares UUID and keeps design on substantive owner`, async () => {
    const f = await start({ effortEnabled: true });
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        effort: { choice: "high", confidence: 0.99 },
        risky: { noul: 0 },
        ui_design: { noul: 0.97 },
      },
    };
    f.modelDelay = 200;
    await f.command("set_steering_mode", { mode: "all" });
    await f.command("prompt", { message: "Design first screen" });
    await f.wait(() => f.generations.length === 1);
    await f.command("prompt", {
      message: "Design the second settings screen",
      streamingBehavior: "steer",
    });
    await f.command("prompt", { message: "continue", streamingBehavior: "steer" });
    await f.wait(() => f.generations.length === 2);
    await f.wait(() => f.records.some((r) => r.type === "agent_settled"));
    expect(f.classifications).toHaveLength(2);
    const messages = f.generations[1]!.messages as {
      role: string;
      content: string | { text?: string }[];
    }[];
    const contents = messages.map((m) =>
      typeof m.content === "string" ? m.content : m.content.map((p) => p.text ?? "").join("\n"),
    );
    expect(contents.find((m) => m.startsWith("Design the second"))).toContain("<jev_design>");
    expect(contents.find((m) => m === "continue")).toBe("continue");
    const entries = (
      (await f.command("get_entries")).data as {
        entries: { type: string; customType?: string; data?: RecordData; message?: RecordData }[];
      }
    ).entries;
    const users = entries.filter((e) => e.message?.role === "user");
    expect(users.map((e) => contentText(e.message!.content))).toEqual([
      "Design first screen",
      "Design the second settings screen",
      "continue",
    ]);
    const advice = entries.filter((e) => e.customType === "jev-pilot:advice");
    expect(advice).toHaveLength(2);
    expect(advice[0]!.data!.inputId).toBe(users[0]!.message!.jevPilotInputId);
    expect(advice[1]!.data!.inputId).toBe(users[1]!.message!.jevPilotInputId);
    {
      const applications = entries.filter((e) => e.customType === "jev-pilot:effort-application");
      expect(applications[1]!.data!.inputId).toBe(advice[1]!.data!.inputId);
    }
    expect(JSON.stringify(advice)).not.toContain("Design the second settings screen");
    expect(JSON.stringify(f.generations)).not.toContain("jevPilotInputId");
  }, 20000);

  test(`D17-fork-tree-reload-resume physical retains only included design owners`, async () => {
    const f = await start({});
    await f.prompt("Restyle the initial dashboard");
    const state = (await f.command("get_state")).data as { sessionFile: string };
    let entries = (
      (await f.command("get_entries")).data as {
        entries: { id: string; type: string; message?: RecordData }[];
      }
    ).entries;
    const assistant = entries.findLast((e) => e.message?.role === "assistant")!;
    await f.command("prompt", { message: `/fixture-fork-at ${assistant.id}` });
    await f.prompt("continue");
    expect(text(f, 1).split("<jev_design>")).toHaveLength(2);
    await f.command("prompt", { message: "/fixture-reload" });
    await f.prompt("continue");
    expect(text(f, 2).split("<jev_design>")).toHaveLength(2);
    await f.command("new_session");
    await f.prompt("continue");
    expect(text(f, 3)).not.toContain("<jev_design>");
    await f.command("switch_session", { sessionPath: state.sessionFile });
    entries = (
      (await f.command("get_entries")).data as {
        entries: { id: string; type: string; message?: RecordData }[];
      }
    ).entries;
    const userIndex = entries.findIndex((e) => e.message?.role === "user");
    await f.command("prompt", { message: `/fixture-tree ${entries[userIndex - 1]!.id}` });
    await f.prompt("continue");
    expect(text(f, 4)).not.toContain("<jev_design>");
    // Fresh branches without reusable route state still ask tier, never design on continue.
    expect(f.classifications).toHaveLength(1);
    expect(
      f.classifications.filter((c) => "ui_design" in (c.questions as RecordData)),
    ).toHaveLength(1);
  }, 20000);

  test(`D17-compaction physical removed design does not resurrect`, async () => {
    const f = await start({});
    await f.prompt("Restyle initial dashboard");
    f.response = {
      answers: {
        tier: { choice: "balanced", confidence: 0.99 },
        risky: { noul: 0 },
        ui_design: { noul: 0.09 },
      },
    };
    f.modelText = "Compaction context. ".repeat(200);
    for (let i = 0; i < 6; i++) await f.prompt(`Report specified backend issue ${i}`);
    const calls = f.classifications.length;
    await f.command("compact");
    await f.prompt("continue");
    expect(f.classifications).toHaveLength(calls);
    expect(text(f, f.generations.length - 1)).not.toContain("<jev_design>");
  }, 20000);

  test(`D17-stripped physical missing new identity never receives old or new design`, async () => {
    const f = await start({});
    await f.prompt("Design first page");
    await f.command("prompt", { message: "/fixture-drop-input-identity" });
    await f.prompt("Design second page");
    const messages = f.generations[1]!.messages as { content: string | { text?: string }[] }[];
    const contents = messages.map((m) =>
      typeof m.content === "string" ? m.content : m.content.map((p) => p.text ?? "").join("\n"),
    );
    expect(contents.find((m) => m.startsWith("Design second page"))).toBe("Design second page");
    expect(text(f, 1).split("<jev_design>")).toHaveLength(2);
    const entries = (
      (await f.command("get_entries")).data as { entries: { message?: RecordData }[] }
    ).entries;
    expect(
      entries.filter((e) => e.message?.role === "user").map((e) => contentText(e.message!.content)),
    ).toEqual(["Design first page", "Design second page"]);
  }, 20000);

  for (const mode of ["abort", "thinking", "model", "timeout"] as const) {
    test(`D17-abort-timeout-manual physical/${mode} discards pending design`, async () => {
      const f = await start({ classifier: { timeoutMs: mode === "timeout" ? 80 : 5000 } });
      f.classifierDelay = 500;
      const offset = f.records.length;
      await f.command("prompt", { message: "Restyle the dashboard" });
      await f.wait(() => f.classifications.length === 1);
      if (mode === "abort") await f.command("abort");
      if (mode === "thinking") await f.command("set_thinking_level", { level: "low" });
      if (mode === "model")
        await f.command("set_model", { provider: "fixture", modelId: "fixture-other-model" });
      await f.wait(() => f.records.slice(offset).some((r) => r.type === "agent_settled"));
      await f.wait(() => f.classifierAborts === 1);
      expect(f.classifications).toHaveLength(1);
      if (f.generations.length) expect(text(f)).not.toContain("<jev_design>");
      if (mode === "abort") expect(f.generations).toHaveLength(0);
      const entries = (
        (await f.command("get_entries")).data as { entries: { customType?: string }[] }
      ).entries;
      expect(entries.filter((e) => e.customType === "jev-pilot:advice")).toHaveLength(0);
    }, 20000);
  }
}

{
  for (const fault of ["service", "json"] as const) {
    test(`D17-fault-stale physical/${fault} never attaches previous pack to new work`, async () => {
      const f = await start({});
      await f.prompt("Design the initial page");
      if (fault === "service") f.status = 503;
      else f.response = "not json";
      await f.prompt("Design a separate second page");
      const messages = f.generations[1]!.messages as { content: unknown }[];
      expect(
        messages.map((m) => contentText(m.content)).find((m) => m.startsWith("Design a separate")),
      ).toBe("Design a separate second page");
      expect(text(f, 1).split("<jev_design>")).toHaveLength(2);
      const entries = (
        (await f.command("get_entries")).data as { entries: { customType?: string }[] }
      ).entries;
      expect(entries.filter((e) => e.customType === "jev-pilot:advice")).toHaveLength(1);
      expect(f.classifications).toHaveLength(2);
      expect(f.generations[1]).toMatchObject({
        model: "fixture-model",
        reasoning_effort: "medium",
      });
    }, 20000);
  }
}
test("D09-privacy does not expand project design bodies or projected guidance into classifier input", async () => {
  fixture = new PiFixture();
  fixture.useDesignDefaults = true;
  fixture.skills = [{ name: "impeccable", body: "PRIVATE_DESIGN_BODY_42" }];
  fixture.projectContext = "PRIVATE_PROJECT_TOKENS_42 are authoritative.";
  fixture.response = { answers: { ui_design: { noul: 0.97 } } };
  const f = await fixture.start({ effortEnabled: false, skillsEnabled: false });
  await f.prompt("Restyle the dashboard");
  f.nextReadPath = `${f.directory}/agent/settings.json`;
  await f.prompt("Restyle a separate settings screen");
  const payload = JSON.stringify(f.classifications);
  expect(payload).not.toContain("PRIVATE_DESIGN_BODY_42");
  expect(payload).not.toContain("PRIVATE_PROJECT_TOKENS_42");
  expect(payload).not.toContain("awesome-design-md");
  expect(payload).not.toContain("jevPilotInputId");
  expect(text(f, 1)).toContain("PRIVATE_PROJECT_TOKENS_42");
  expect(f.classifications).toHaveLength(2);
}, 20000);
