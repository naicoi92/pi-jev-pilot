import { afterEach, expect, test } from "bun:test";
import { writeFile } from "node:fs/promises";
import { PiFixture, answer } from "./fixtures/pi-cli.ts";

const task = "Please review the complete patch with particular care for failure modes";
let fixture: PiFixture | undefined;

async function lastDecision(fixture: PiFixture): Promise<unknown> {
  const entries = (await fixture.command("get_entries")).data as {
    entries: { customType?: string; data?: unknown }[];
  };
  return entries.entries.filter((entry) => entry.customType === "jev-pilot:effort").at(-1)?.data;
}
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

test("CLI-26m startup and reload before eligible work do not invent effort or extension state", async () => {
  fixture = new PiFixture();
  await fixture.start({}, "high");
  await fixture.command("prompt", { message: "/fixture-reload" });
  expect((await fixture.command("get_state")).data).toMatchObject({ thinkingLevel: "high" });
  expect(fixture.classifications).toHaveLength(0);
  const entries = (await fixture.command("get_entries")).data as {
    entries: { customType?: string }[];
  };
  expect(
    entries.entries.filter((entry) => entry.customType?.startsWith("jev-pilot:")),
  ).toHaveLength(0);
}, 20000);

for (const change of ["thinking", "model"]) {
  test(`CLI-26${change === "thinking" ? "n" : "o"} manual ${change} change invalidates in-flight effort but not future prompts`, async () => {
    fixture = new PiFixture();
    fixture.classifierDelay = 300;
    await fixture.start({ JEV_TIMEOUT_MS: "5000" });
    const offset = fixture.records.length;
    await fixture.command("prompt", { message: task });
    await fixture.wait(() => fixture!.classifications.length === 1);
    if (change === "thinking") {
      await fixture.command("set_thinking_level", { level: "low" });
    } else {
      await fixture.command("set_model", { provider: "fixture", modelId: "fixture-other-model" });
    }
    await fixture.wait(() =>
      fixture!.records.slice(offset).some((entry) => entry.type === "agent_settled"),
    );
    await Bun.sleep(350);
    const selectedModel = change === "model" ? "fixture-other-model" : "fixture-model";
    const manualThinking = change === "thinking" ? "low" : "medium";
    expect(fixture.generations[0]).toMatchObject({
      model: selectedModel,
      reasoning_effort: manualThinking,
    });
    expect((await fixture.command("get_state")).data).toMatchObject({
      model: { id: selectedModel },
      thinkingLevel: manualThinking,
    });
    expect(await lastDecision(fixture)).toBeUndefined();
    const discardedEntries = (await fixture.command("get_entries")).data as {
      entries: { customType?: string }[];
    };
    expect(
      discardedEntries.entries.filter((entry) => entry.customType?.startsWith("jev-pilot:")),
    ).toHaveLength(0);
    fixture.classifierDelay = 0;
    await fixture.prompt(task);
    expect(fixture.classifications).toHaveLength(2);
    expect(fixture.generations.at(-1)).toMatchObject({
      model: selectedModel,
      reasoning_effort: "high",
    });
    expect(await lastDecision(fixture)).toMatchObject({ outcome: "classified", effective: "high" });
  }, 20000);
}

for (const fault of [
  {
    name: "HTTP error",
    response: answer("low"),
    status: 503,
    outcome: "service-error",
  },
  {
    name: "invalid JSON",
    response: "not json",
    status: 200,
    outcome: "schema-error",
  },
  {
    name: "invalid schema",
    response: {
      answers: { effort: { choice: "invented" }, risky: { noul: 0.9 } },
    },
    status: 200,
    outcome: "schema-error",
  },
  {
    name: "non-finite confidence",
    response: {
      answers: {
        effort: { choice: "low", confidence: "1" },
        risky: { noul: 0 },
      },
    },
    status: 200,
    outcome: "schema-error",
  },
]) {
  test(`CLI-11 ${fault.name} preserves the valid current route`, async () => {
    fixture = new PiFixture();
    await fixture.start();
    fixture.response = fault.response;
    fixture.status = fault.status;
    await fixture.prompt(task);
    expect(fixture.generations[0]).toMatchObject({
      model: "fixture-model",
      reasoning_effort: "medium",
    });
    expect(await lastDecision(fixture)).toMatchObject({
      outcome: fault.outcome,
      effective: "medium",
    });
  }, 20000);
}

for (const env of [
  { JEV_TIMEOUT_MS: "0" },
  { JEV_SYSTEM_ONE_URL: "not-a-url" },
  { JEV_SYSTEM_ONE_API_KEY: "" },
  { JEV_SYSTEM_ONE_MODEL: "" },
  { JEV_EFFORT_ENABLED: "invalid" },
] as Record<string, string>[]) {
  test(`CLI-13 invalid ${Object.keys(env)[0]} stops generation with an actionable error`, async () => {
    fixture = new PiFixture();
    await fixture.start(env);
    await fixture.prompt(task);
    expect(fixture.generations).toHaveLength(0);
    const output = JSON.stringify(fixture.records) + fixture.stderr;
    expect(output).toContain(Object.keys(env)[0]!);
  }, 20000);
}

test("CLI-10 classifier context is bounded and excludes repository contents", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await writeFile(`${fixture.directory}/vercel.json`, "repository-secret-never-sent");
  fixture.modelText = "x".repeat(5000) + " Shall I apply the proposed change?";
  for (let index = 0; index < 4; index++)
    await fixture.prompt(`Question ${index}: what is the proposed plan?`);
  await fixture.prompt("yes");
  const state = fixture.classifications.at(-1)?.state as {
    recent_context: string;
    signals: unknown;
    project_platforms: string;
    tool_names: string[];
  };
  expect(state.recent_context.length).toBeLessThanOrEqual(2000);
  expect(state.recent_context.split("\n").length).toBeLessThanOrEqual(4);
  expect(state.recent_context).toContain("Shall I apply the proposed change?");
  expect(state.recent_context).not.toContain("Question 0");
  expect(state.project_platforms).toBe("Vercel");
  expect(state.signals).toMatchObject({
    prompt_chars: 3,
    files_mentioned: 0,
    is_question: false,
  });
  expect(state.tool_names).toContain("read");
  expect(JSON.stringify(fixture.classifications)).not.toContain("repository-secret-never-sent");
}, 20000);

test("CLI-10b actual read tool inputs and outputs are absent from classifier payload", async () => {
  fixture = new PiFixture();
  await fixture.start();
  const path = `${fixture.directory}/private-tool-argument.txt`;
  await writeFile(path, "private-tool-result");
  fixture.nextReadPath = path;
  await fixture.prompt(task);
  await fixture.prompt("yes");
  const state = fixture.classifications.at(-1)?.state as {
    recent_context: string;
    signals: unknown;
  };
  expect(state.recent_context).toContain("[tools: read]");
  expect(state.signals).toMatchObject({ recent_tools: { reads: 1 } });
  expect(JSON.stringify(fixture.classifications)).not.toContain("private-tool-argument");
  expect(JSON.stringify(fixture.classifications)).not.toContain("private-tool-result");
}, 20000);

for (const example of [
  {
    name: "risk above .7 forces high despite low confidence",
    response: answer("low", 0.01, 0.71),
    effective: "high",
  },
  {
    name: "high upgrade below .5 keeps medium",
    response: answer("high", 0.49),
    effective: "medium",
  },
  {
    name: "max start is capped and adapted to high",
    response: answer("max"),
    effective: "high",
  },
  {
    name: "close medium/high tie takes high",
    response: {
      answers: {
        effort: {
          choice: "medium",
          confidence: 0.55,
          probabilities: { medium: 0.55, high: 0.45 },
        },
        risky: { noul: 0 },
      },
    },
    effective: "high",
  },
  {
    name: "very-hard share below .6 takes high",
    response: {
      answers: {
        effort: {
          choice: "xhigh",
          confidence: 0.55,
          probabilities: { high: 0.45, xhigh: 0.55 },
        },
        risky: { noul: 0 },
      },
    },
    effective: "high",
  },
]) {
  test(`CLI-03 ${example.name}`, async () => {
    fixture = new PiFixture();
    fixture.response = example.response;
    await fixture.start();
    await fixture.prompt(task);
    expect(fixture.generations[0]).toMatchObject({
      model: "fixture-model",
      reasoning_effort: example.effective,
    });
    const questions = fixture.classifications[0]?.questions as {
      effort: { instructions: string; criteria: Record<string, string> };
      risky: { type: string };
    };
    expect(Object.keys(questions)).toEqual(["effort", "risky"]);
    expect(Object.keys(questions.effort.criteria)).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
    expect(questions.effort.criteria.high).toBe(
      "A change across several files that needs working out, a bug whose cause is described but has to be traced, writing tests, or reviewing a diff with care.",
    );
    expect(questions.effort.instructions).toContain(
      "takes the size of the work it approves, from the recent conversation",
    );
    expect(questions.risky.type).toBe("noul");
  }, 20000);
}

test("CLI-01b configured classifier model and bearer auth reach the endpoint", async () => {
  fixture = new PiFixture();
  await fixture.start({ JEV_SYSTEM_ONE_MODEL: "fixture-decision-model" });
  await fixture.prompt(task);
  expect(fixture.classifications[0]?.model).toBe("fixture-decision-model");
  expect(fixture.sawClassifierBearer).toBe(true);
  expect(fixture.classifierHeaderChecks).toBe(1);
  expect(JSON.stringify(fixture.records) + fixture.stderr).not.toContain(
    "fixture-not-a-credential",
  );
}, 20000);

test("CLI-09b non-reasoning model has no applicable effort questions or extension writes", async () => {
  fixture = new PiFixture();
  fixture.reasoning = false;
  await fixture.start({ JEV_SYSTEM_ONE_API_KEY: "" });
  await fixture.prompt(task);
  await fixture.prompt("continue");
  await fixture.command("prompt", { message: "/fixture-reload" });
  expect(fixture.classifications).toHaveLength(0);
  expect(fixture.generations).toHaveLength(2);
  expect(fixture.generations[0]?.reasoning_effort).toBeUndefined();
  const entries = (await fixture.command("get_entries")).data as {
    entries: { customType?: string }[];
  };
  expect(
    entries.entries.filter((entry) => entry.customType?.startsWith("jev-pilot:")),
  ).toHaveLength(0);
}, 20000);

test("CLI-09b single-supported-level reasoning model has zero applicable effort calls or writes", async () => {
  fixture = new PiFixture();
  fixture.singleThinkingLevel = true;
  await fixture.start({ JEV_SYSTEM_ONE_API_KEY: "" });
  await fixture.prompt(task);
  expect(fixture.classifications).toHaveLength(0);
  expect(fixture.generations[0]?.reasoning_effort).toBe("high");
  const entries = (await fixture.command("get_entries")).data as {
    entries: { customType?: string }[];
  };
  expect(
    entries.entries.filter((entry) => entry.customType?.startsWith("jev-pilot:")),
  ).toHaveLength(0);
}, 20000);

test("CLI-09a disabled effort has zero classifier requests and writes across owned-history reload", async () => {
  fixture = new PiFixture();
  await fixture.start({ JEV_EFFORT_ENABLED: "false", JEV_SYSTEM_ONE_API_KEY: "" });
  await fixture.prompt(task);
  await fixture.prompt("continue");
  await fixture.command("prompt", { message: "/fixture-reload" });
  expect(fixture.classifications).toHaveLength(0);
  expect(fixture.generations.map((entry) => entry.reasoning_effort)).toEqual(["medium", "medium"]);
  const entries = (await fixture.command("get_entries")).data as {
    entries: { customType?: string }[];
  };
  expect(
    entries.entries.filter((entry) => entry.customType?.startsWith("jev-pilot:")),
  ).toHaveLength(0);
}, 20000);

test("CLI-09c empty and command-like inputs have zero effort questions or writes", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt("   ");
  await fixture.prompt("/unregistered-command");
  expect(fixture.classifications).toHaveLength(0);
  expect(await lastDecision(fixture)).toBeUndefined();
}, 20000);

for (const gate of ["disabled", "non-reasoning"]) {
  test(`CLI-09${gate === "disabled" ? "a" : "b"} retained history is not replayed when effort is ${gate}`, async () => {
    fixture = new PiFixture();
    await fixture.start();
    await fixture.prompt(task);
    if (gate === "disabled") {
      await fixture.command("prompt", { message: "/fixture-effort false" });
    } else {
      await fixture.command("set_model", { provider: "fixture", modelId: "fixture-plain-model" });
    }
    const before = (await fixture.command("get_entries")).data as {
      entries: { customType?: string; type: string }[];
    };
    const writes = (entries: typeof before.entries) =>
      entries.filter(
        (entry) =>
          entry.customType?.startsWith("jev-pilot:") || entry.type === "thinking_level_change",
      ).length;
    await fixture.command("prompt", { message: "/fixture-reload" });
    await fixture.prompt("continue");
    const after = (await fixture.command("get_entries")).data as typeof before;
    expect(fixture.classifications).toHaveLength(1);
    expect(writes(after.entries)).toBe(writes(before.entries));
    expect(fixture.generations.at(-1)?.reasoning_effort).toBe(
      gate === "disabled" ? "high" : undefined,
    );
  }, 20000);
}

for (const level of ["low", "off"]) {
  test(`CLI-03b eligible named ${level} thinking is not a persistent lock`, async () => {
    fixture = new PiFixture();
    await fixture.start({}, level);
    await fixture.prompt(task);
    expect(fixture.classifications).toHaveLength(1);
    expect(fixture.generations[0]?.reasoning_effort).toBe("high");
    expect(await lastDecision(fixture)).toMatchObject({ requested: "high", effective: "high" });
  }, 20000);
}

test("CLI-13b missing model authentication never invents a route", async () => {
  fixture = new PiFixture();
  fixture.configuredModelKey = false;
  await fixture.start();
  await expect(fixture.prompt(task)).rejects.toThrow("No API key found for fixture");
  expect(fixture.generations).toHaveLength(0);
}, 20000);

test("CLI-11b network disconnection preserves the current effort", async () => {
  fixture = new PiFixture();
  await fixture.start({ JEV_SYSTEM_ONE_URL: "http://127.0.0.1:1/systemone" });
  await fixture.prompt(task);
  expect(fixture.generations[0]).toMatchObject({
    model: "fixture-model",
    reasoning_effort: "medium",
  });
  expect(await lastDecision(fixture)).toMatchObject({
    outcome: "service-error",
  });
}, 20000);

test("CLI-26f queued steering input is classified at its own message boundary", async () => {
  fixture = new PiFixture();
  fixture.modelDelay = 250;
  await fixture.start();
  await fixture.command("prompt", { message: task });
  await fixture.wait(() => fixture!.generations.length === 1);
  await fixture.command("steer", { message: "Why is this a simple lookup?" });
  await fixture.wait(() => fixture!.records.some((entry) => entry.type === "agent_settled"));
  expect(fixture.classifications).toHaveLength(2);
  expect(fixture.classifications[1]?.state).toMatchObject({
    prompt: "Why is this a simple lookup?",
  });
}, 20000);

test("CLI-26d tool continuation keeps the applied effort without reclassification", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await writeFile(`${fixture.directory}/readme.txt`, "fixture read content");
  fixture.nextReadPath = `${fixture.directory}/readme.txt`;
  await fixture.prompt(task);
  expect(fixture.generations).toHaveLength(2);
  expect(fixture.generations.map((request) => request.reasoning_effort)).toEqual(["high", "high"]);
  expect(fixture.classifications).toHaveLength(1);
}, 20000);

test("CLI-26b extension reload restores the active branch decision", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  await fixture.command("prompt", { message: "/fixture-reload" });
  await fixture.command("get_state");
  fixture.response = answer("low");
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(1);
  expect(await lastDecision(fixture)).toMatchObject({
    outcome: "reused",
    effective: "high",
  });
}, 20000);

test("CLI-26c resume, fork, tree and compaction respect branch ownership", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  const original = (await fixture.command("get_state")).data as {
    sessionFile: string;
  };
  const originalEntries = (await fixture.command("get_entries")).data as {
    entries: { id: string; type: string; message?: { role: string } }[];
  };
  const firstUser = originalEntries.entries.find((entry) => entry.message?.role === "user")!;
  const beforeUser = originalEntries.entries[originalEntries.entries.indexOf(firstUser) - 1]!;
  await fixture.command("new_session");
  await fixture.command("switch_session", {
    sessionPath: original.sessionFile,
  });
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(1);
  await fixture.command("fork", { entryId: firstUser.id });
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(2);
  await fixture.command("switch_session", {
    sessionPath: original.sessionFile,
  });
  await fixture.command("prompt", {
    message: `/fixture-tree ${beforeUser.id}`,
  });
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(3);
  fixture.modelText = "Repeated context for compaction. ".repeat(200);
  for (let index = 0; index < 6; index++)
    await fixture.prompt(`Question ${index}: what should we do next?`);
  const count = fixture.classifications.length;
  await fixture.command("compact");
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(count);
  await fixture.stop();
  const lifecycle = await Bun.file(`${fixture.directory}/lifecycle.jsonl`).text();
  expect(lifecycle).toContain('"reason":"fork"');
  expect(lifecycle).toContain('"reason":"resume"');
  expect(lifecycle).toContain('"reason":"quit"');
  expect(fixture.process.exitCode).toBe(0);
}, 30000);

test("CLI-26g excluded prompt effort does not survive fork or tree restoration", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  const original = (await fixture.command("get_state")).data as {
    sessionFile: string;
  };
  const entries = (
    (await fixture.command("get_entries")).data as {
      entries: { id: string; message?: { role: string } }[];
    }
  ).entries;
  const user = entries.find((entry) => entry.message?.role === "user")!;
  const beforeUser = entries[entries.indexOf(user) - 1]!;
  await fixture.command("fork", { entryId: user.id });
  expect((await fixture.command("get_state")).data).toMatchObject({
    thinkingLevel: "medium",
  });
  fixture.response = answer("low", 0);
  await fixture.prompt(
    "Please inspect this independent lengthy task and explain all relevant implementation details carefully",
  );
  expect(fixture.generations.at(-1)?.reasoning_effort).toBe("medium");
  expect(await lastDecision(fixture)).toMatchObject({ effective: "medium" });
  await fixture.command("switch_session", {
    sessionPath: original.sessionFile,
  });
  await fixture.command("prompt", {
    message: `/fixture-tree ${beforeUser.id}`,
  });
  expect((await fixture.command("get_state")).data).toMatchObject({
    thinkingLevel: "medium",
  });
  await fixture.prompt(
    "Please inspect another independent lengthy task and explain all relevant implementation details carefully",
  );
  expect(fixture.generations.at(-1)?.reasoning_effort).toBe("medium");
  expect(await lastDecision(fixture)).toMatchObject({ effective: "medium" });
}, 20000);

test("CLI-26h restoring an excluded application preserves manual user thinking", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  await fixture.command("set_thinking_level", { level: "low" });
  const entries = (
    (await fixture.command("get_entries")).data as {
      entries: { id: string; type: string; thinkingLevel?: string }[];
    }
  ).entries;
  const manual = entries.findLast(
    (entry) => entry.type === "thinking_level_change" && entry.thinkingLevel === "low",
  )!;
  await fixture.prompt(task);
  await fixture.command("prompt", { message: `/fixture-tree ${manual.id}` });
  expect((await fixture.command("get_state")).data).toMatchObject({
    thinkingLevel: "low",
  });
  fixture.response = answer("low", 0);
  await fixture.prompt(
    "Please inspect this independent lengthy task and explain all relevant implementation details carefully",
  );
  expect(fixture.generations.at(-1)?.reasoning_effort).toBe("low");
}, 20000);

test("CLI-26h tree restores a manual prefix before the first eligible application", async () => {
  fixture = new PiFixture();
  await fixture.start({}, "high");
  await fixture.command("set_thinking_level", { level: "low" });
  const before = (await fixture.command("get_entries")).data as {
    entries: { id: string; type: string; thinkingLevel?: string }[];
  };
  const manual = before.entries.findLast(
    (entry) => entry.type === "thinking_level_change" && entry.thinkingLevel === "low",
  )!;
  await fixture.prompt(task);
  await fixture.command("prompt", { message: `/fixture-tree ${manual.id}` });
  expect((await fixture.command("get_state")).data).toMatchObject({ thinkingLevel: "low" });
  fixture.response = answer("low", 0);
  await fixture.prompt(task);
  expect(fixture.generations.at(-1)?.reasoning_effort).toBe("low");
}, 20000);

test("CLI-08c steering all continuation retains the immediately preceding lookup decision", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  await fixture.command("set_steering_mode", { mode: "all" });
  fixture.modelDelay = 300;
  const prior = fixture.generations.length;
  const offset = fixture.records.length;
  await fixture.command("prompt", { message: task });
  await fixture.wait(() => fixture!.generations.length > prior);
  fixture.response = answer("low", 0.99);
  await fixture.command("steer", {
    message: "What is the ordinary low effort lookup for this exact independent question?",
  });
  await fixture.command("steer", { message: "continue" });
  await fixture.wait(() =>
    fixture!.records.slice(offset).some((entry) => entry.type === "agent_settled"),
  );
  expect(fixture.generations.map((request) => request.reasoning_effort)).toEqual([
    "high",
    "high",
    "low",
  ]);
  expect(fixture.classifications).toHaveLength(3);
  const entries = (
    (await fixture.command("get_entries")).data as {
      entries: {
        id: string;
        customType?: string;
        data?: { ownerEntryId: string };
        message?: { role: string };
      }[];
    }
  ).entries;
  const users = entries.filter((entry) => entry.message?.role === "user").slice(-2);
  const retained = entries
    .filter((entry) => entry.customType === "jev-pilot:effort")
    .slice(-2)
    .map((entry) => entry.data);
  expect(retained).toMatchObject([
    {
      ownerEntryId: users[0]!.id,
      outcome: "classified",
      effective: "low",
      decision: { effort: 0, effortConfidence: 0.99 },
    },
    {
      ownerEntryId: users[1]!.id,
      outcome: "reused",
      effective: "low",
      decision: { effort: 0, effortConfidence: 0.99 },
    },
  ]);
  expect(users[0]!.id).not.toBe(users[1]!.id);
}, 20000);

test("CLI-26i fork including the owning user retains its effort and reusable decision", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  const entries = (
    (await fixture.command("get_entries")).data as {
      entries: { id: string; message?: { role: string } }[];
    }
  ).entries;
  const user = entries.find((entry) => entry.message?.role === "user")!;
  const persisted = (await fixture.command("get_entries")).data as {
    entries: {
      customType?: string;
      data?: { inputId?: string };
      message?: { role: string; content: unknown; timestamp: number; jevPilotInputId?: string };
    }[];
  };
  const application = persisted.entries.find(
    (entry) => entry.customType === "jev-pilot:effort-application",
  )!;
  const originating = persisted.entries.find((entry) => entry.message?.role === "user")!.message!;
  expect(originating.jevPilotInputId).toBe(application.data?.inputId);
  expect(originating.content).toEqual([{ type: "text", text: task }]);
  expect(typeof originating.timestamp).toBe("number");
  expect(JSON.stringify(fixture.generations)).not.toContain("jevPilotInputId");
  expect(JSON.stringify(fixture.classifications)).not.toContain("jevPilotInputId");
  await fixture.command("prompt", { message: `/fixture-fork-at ${user.id}` });
  await fixture.command("prompt", { message: "/fixture-reload" });
  const reloaded = (await fixture.command("get_entries")).data as typeof persisted;
  expect(reloaded.entries.find((entry) => entry.message?.role === "user")?.message).toEqual(
    originating,
  );
  expect((await fixture.command("get_state")).data).toMatchObject({
    thinkingLevel: "high",
  });
  fixture.response = answer("low", 0);
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(1);
  expect(fixture.generations.at(-1)?.reasoning_effort).toBe("high");
  expect(await lastDecision(fixture)).toMatchObject({
    outcome: "reused",
    decision: { effort: 2 },
  });
}, 20000);

test("CLI-26j included branch decision overrides a re-applied unequal startup value", async () => {
  fixture = new PiFixture();
  await fixture.start({}, "low");
  await fixture.prompt(task);
  const entries = (
    (await fixture.command("get_entries")).data as {
      entries: { id: string; message?: { role: string } }[];
    }
  ).entries;
  const user = entries.find((entry) => entry.message?.role === "user")!;
  await fixture.command("prompt", { message: `/fixture-fork-at ${user.id}` });
  expect((await fixture.command("get_state")).data).toMatchObject({
    thinkingLevel: "high",
  });
  fixture.response = answer("low", 0);
  await fixture.prompt(
    "Please inspect this independent lengthy task and explain all relevant implementation details carefully",
  );
  expect(fixture.generations.at(-1)?.reasoning_effort).toBe("high");
}, 20000);

test("CLI-26l excluded owner restores branch baseline despite equal startup thinking", async () => {
  fixture = new PiFixture();
  await fixture.start({}, "high");
  expect((await fixture.command("get_state")).data).toMatchObject({
    thinkingLevel: "high",
  });
  await fixture.command("set_thinking_level", { level: "medium" });
  expect((await fixture.command("get_state")).data).toMatchObject({
    thinkingLevel: "medium",
  });
  await fixture.prompt(task);
  const entries = (
    (await fixture.command("get_entries")).data as {
      entries: { id: string; message?: { role: string } }[];
    }
  ).entries;
  const user = entries.find((entry) => entry.message?.role === "user")!;
  await fixture.command("fork", { entryId: user.id });
  const restored = (await fixture.command("get_state")).data;
  fixture.response = answer("low", 0);
  await fixture.prompt(
    "Please inspect this independent lengthy task and explain all relevant implementation details carefully",
  );
  expect({
    restored,
    providerEffort: fixture.generations.at(-1)?.reasoning_effort,
    retained: await lastDecision(fixture),
  }).toMatchObject({
    restored: { thinkingLevel: "medium" },
    providerEffort: "medium",
    retained: { effective: "medium", decision: { effort: 0, effortConfidence: 0 } },
  });
}, 20000);

for (const gate of ["disabled", "inapplicable"]) {
  test(`CLI-26${gate === "disabled" ? "p" : "q"} ${gate} user cannot acquire an excluded application's ownership`, async () => {
    fixture = new PiFixture();
    fixture.startupModel = gate === "inapplicable" ? "fixture-plain-model" : "fixture-model";
    await fixture.start();
    if (gate === "inapplicable")
      await fixture.command("set_model", { provider: "fixture", modelId: "fixture-model" });
    await fixture.prompt(task);
    const original = (await fixture.command("get_entries")).data as {
      entries: {
        id: string;
        type: string;
        customType?: string;
        data?: { inputId?: string };
        message?: { role: string; jevPilotInputId?: string };
      }[];
    };
    const owner = original.entries.find((entry) => entry.message?.role === "user")!;
    if (gate === "disabled") await fixture.command("prompt", { message: "/fixture-effort false" });
    else
      await fixture.command("set_model", { provider: "fixture", modelId: "fixture-plain-model" });
    await fixture.command("fork", { entryId: owner.id });
    if (gate === "inapplicable")
      expect((await fixture.command("get_state")).data).toMatchObject({
        model: { id: "fixture-plain-model" },
      });
    const before = (await fixture.command("get_entries")).data as typeof original;
    const writes = (entries: typeof before.entries) =>
      entries.filter(
        (entry) =>
          entry.customType?.startsWith("jev-pilot:") || entry.type === "thinking_level_change",
      ).length;
    await fixture.prompt(
      "Please inspect this independent gated task and describe its implementation in detail",
    );
    const gated = (await fixture.command("get_entries")).data as typeof original;
    expect(fixture.classifications).toHaveLength(1);
    expect(writes(gated.entries)).toBe(writes(before.entries));
    expect(
      gated.entries.findLast((entry) => entry.message?.role === "user")?.message?.jevPilotInputId,
    ).toBeUndefined();
    if (gate === "inapplicable")
      expect(fixture.generations.at(-1)?.model).toBe("fixture-plain-model");
    if (gate === "disabled") await fixture.command("prompt", { message: "/fixture-effort true" });
    else await fixture.command("set_model", { provider: "fixture", modelId: "fixture-model" });
    await fixture.command("prompt", { message: "/fixture-reload" });
    if (gate === "inapplicable")
      await fixture.command("set_model", { provider: "fixture", modelId: "fixture-model" });
    fixture.response = answer("low", 0);
    await fixture.prompt("continue");
    const final = (await fixture.command("get_entries")).data as typeof original;
    const currentOwner = final.entries.findLast((entry) => entry.message?.role === "user")!;
    expect(fixture.classifications).toHaveLength(2);
    expect(fixture.generations.at(-1)?.reasoning_effort).toBe("medium");
    expect(await lastDecision(fixture)).toMatchObject({
      ownerEntryId: currentOwner.id,
      outcome: "classified",
      effective: "medium",
      decision: { effort: 0, effortConfidence: 0 },
    });
    expect(currentOwner.id).not.toBe(owner.id);
    expect(currentOwner.message?.jevPilotInputId).toBe(
      final.entries.findLast((entry) => entry.customType === "jev-pilot:effort-application")?.data
        ?.inputId,
    );
    expect(JSON.stringify(fixture.classifications)).not.toContain("jevPilotInputId");
    expect(JSON.stringify(fixture.generations)).not.toContain("jevPilotInputId");
  }, 20000);
}

test("CLI-26r later replacement dropping originating identity fails closed across fork and reload", async () => {
  fixture = new PiFixture();
  fixture.dropInputIdentity = true;
  fixture.jevBeforeControls = true;
  await fixture.start();
  await fixture.prompt(task);
  const original = (await fixture.command("get_entries")).data as {
    entries: {
      id: string;
      message?: { role: string; content: unknown; timestamp: number; jevPilotInputId?: string };
    }[];
  };
  const owner = original.entries.find((entry) => entry.message?.role === "user")!;
  expect(owner.message?.jevPilotInputId).toBeUndefined();
  expect(owner.message?.content).toEqual([{ type: "text", text: task }]);
  await fixture.command("prompt", { message: `/fixture-fork-at ${owner.id}` });
  await fixture.command("prompt", { message: "/fixture-reload" });
  fixture.response = answer("low", 0);
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(2);
  expect(fixture.generations.at(-1)?.reasoning_effort).toBe("medium");
  expect(await lastDecision(fixture)).toBeUndefined();
  expect(JSON.stringify(fixture.classifications)).not.toContain("jevPilotInputId");
  expect(JSON.stringify(fixture.generations)).not.toContain("jevPilotInputId");
}, 20000);

test("CLI-26r stripped new identity cannot fall back to an older valid owned decision", async () => {
  fixture = new PiFixture();
  fixture.jevBeforeControls = true;
  await fixture.start();
  await fixture.prompt(task);
  const previous = await lastDecision(fixture);
  expect(previous).toMatchObject({ outcome: "classified", effective: "high" });
  await fixture.command("prompt", { message: "/fixture-drop-input-identity" });
  fixture.response = answer("low");
  await fixture.prompt(
    "Investigate this separate low-effort task without reusing the earlier decision",
  );
  fixture.response = answer("medium");
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(3);
  expect(fixture.generations.at(-1)?.reasoning_effort).toBe("medium");
  expect(await lastDecision(fixture)).toEqual(previous);
}, 20000);

test("CLI-26k excluded applications are not reassigned to an ineligible later user", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  const original = (await fixture.command("get_state")).data as {
    sessionFile: string;
  };
  const entries = (
    (await fixture.command("get_entries")).data as {
      entries: { id: string; message?: { role: string } }[];
    }
  ).entries;
  const user = entries.find((entry) => entry.message?.role === "user")!;
  await fixture.command("fork", { entryId: user.id });
  await fixture.prompt("/unregistered-command");
  const current = (await fixture.command("get_state")).data as {
    sessionFile: string;
  };
  await fixture.command("switch_session", {
    sessionPath: original.sessionFile,
  });
  await fixture.command("switch_session", { sessionPath: current.sessionFile });
  fixture.response = answer("low", 0);
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(2);
  expect(fixture.generations.at(-1)?.reasoning_effort).toBe("medium");
}, 20000);

test("CLI-26e provider retries preserve effort without new classification", async () => {
  fixture = new PiFixture();
  fixture.modelFailures = 3;
  await fixture.start();
  await fixture.command("set_auto_retry", { enabled: true });
  await fixture.prompt(task);
  expect(fixture.generations.length).toBeGreaterThan(3);
  expect(new Set(fixture.generations.map((request) => request.reasoning_effort))).toEqual(
    new Set(["high"]),
  );
  expect(fixture.classifications).toHaveLength(1);
}, 30000);

test("CLI-12d default deadline aborts after 1500ms", async () => {
  fixture = new PiFixture();
  fixture.classifierDelay = 3000;
  await fixture.start();
  const started = Date.now();
  await fixture.prompt(task);
  expect(Date.now() - started).toBeGreaterThanOrEqual(1400);
  expect(Date.now() - started).toBeLessThan(2800);
  expect(await lastDecision(fixture)).toMatchObject({ outcome: "timeout" });
  await fixture.wait(() => fixture!.classifierAborts === 1);
}, 20000);

test("CLI-26a new session does not reuse another session's decision", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  await fixture.command("new_session");
  fixture.response = answer("low");
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(2);
  expect(await lastDecision(fixture)).toMatchObject({ outcome: "classified" });
}, 20000);

test("CLI-12a a configurable deadline aborts HTTP and fails open", async () => {
  fixture = new PiFixture();
  fixture.classifierDelay = 1000;
  await fixture.start({ JEV_TIMEOUT_MS: "100" });
  await fixture.prompt(task);
  expect(fixture.generations[0]).toMatchObject({
    model: "fixture-model",
    reasoning_effort: "medium",
  });
  expect(await lastDecision(fixture)).toMatchObject({
    outcome: "timeout",
    effective: "medium",
  });
  await fixture.wait(() => fixture!.classifierAborts === 1);
}, 20000);

test("CLI-12b explicit abort during classification never generates fallback", async () => {
  fixture = new PiFixture();
  fixture.classifierDelay = 3000;
  await fixture.start({ JEV_TIMEOUT_MS: "5000" });
  await fixture.command("prompt", { message: task });
  await fixture.wait(() => fixture!.classifications.length === 1);
  await fixture.command("abort");
  await fixture.wait(() => fixture!.records.some((entry) => entry.type === "agent_settled"));
  await fixture.wait(() => fixture!.classifierAborts === 1);
  expect(fixture.generations).toHaveLength(0);
  expect(await lastDecision(fixture)).toBeUndefined();
}, 20000);

test("CLI-12c explicit abort during model work cancels provider transport", async () => {
  fixture = new PiFixture();
  fixture.modelDelay = 3000;
  await fixture.start();
  await fixture.command("prompt", { message: task });
  await fixture.wait(() => fixture!.generations.length === 1);
  await fixture.command("abort");
  await fixture.wait(() => fixture!.records.some((entry) => entry.type === "agent_settled"));
  await fixture.wait(() => fixture!.modelAborts === 1);
  expect(fixture.generations).toHaveLength(1);
}, 20000);

test("CLI-04 effort selection preserves the physical model and configured defaults", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt("Please review the complete patch with particular care for failure modes");
  expect(fixture.generations[0]?.model).toBe("fixture-model");
  expect(fixture.generations[0]?.reasoning_effort).toBe("high");
  const settings = await Bun.file(`${fixture.directory}/agent/settings.json`).json();
  expect(settings.defaultThinkingLevel).toBe("medium");
  const state = (await fixture.command("get_state")).data as {
    model: { provider: string; id: string };
  };
  expect(state.model.provider).toBe("fixture");
  expect(state.model.id).toBe("fixture-model");
}, 20000);

test("CLI-01 ordinary installed local package loads in official Pi", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  expect(fixture.classifications).toHaveLength(1);
  expect(fixture.classifications[0]?.model).toBe("jev-latest");
  expect(fixture.generations).toHaveLength(1);
  expect(fixture.generations[0]).toMatchObject({
    model: "fixture-model",
    reasoning_effort: "high",
  });
  expect((await fixture.command("get_state")).data).toMatchObject({
    model: { provider: "fixture", id: "fixture-model" },
    thinkingLevel: "high",
  });
  expect(fixture.stderr).not.toContain("Failed to load extension");
}, 20000);

test("CLI-06 reports unsupported requested xhigh as effective high", async () => {
  fixture = new PiFixture();
  fixture.response = answer("xhigh");
  await fixture.start();
  await fixture.prompt(
    "Please design the proposed change across several components with careful failure analysis",
  );
  expect(fixture.generations[0]?.reasoning_effort).toBe("high");
  expect(await lastDecision(fixture)).toMatchObject({
    requested: "xhigh",
    effective: "high",
    outcome: "classified",
  });
}, 20000);

test("CLI-08a plain continuation reuses the preceding decision", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  fixture.response = answer("low");
  await fixture.prompt("continue");
  expect(fixture.classifications).toHaveLength(1);
  expect(fixture.generations[1]?.reasoning_effort).toBe("high");
}, 20000);

test("CLI-08b approval is classified with the proposed work in recent context", async () => {
  fixture = new PiFixture();
  await fixture.start();
  await fixture.prompt(task);
  fixture.response = answer("low");
  await fixture.prompt("yes");
  expect(fixture.classifications).toHaveLength(2);
  const state = fixture.classifications[1]?.state as { recent_context: string };
  expect(state.recent_context).toContain("Shall I implement the proposed multi-file change?");
  expect(fixture.generations[1]?.reasoning_effort).toBe("high");
}, 20000);
