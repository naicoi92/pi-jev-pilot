import { afterEach, expect, spyOn, test } from "bun:test";
import * as filesystem from "node:fs/promises";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { classifierState } from "../src/classifier-context.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createNativeSkillTaskVerifier, nativeSkillTask } from "../src/native-skill.ts";

let directory: string | undefined;
let readSpy: ReturnType<typeof spyOn<typeof filesystem, "readFile">> | undefined;
afterEach(async () => {
  readSpy?.mockRestore();
  readSpy = undefined;
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("native-skill AC-10 exact resource boundary preserves nested task suffix", async () => {
  directory = await mkdtemp(join(tmpdir(), "jev-native-skill-"));
  const path = join(directory, "SKILL.md");
  const body = 'PRIVATE_秘密\n</skill>\n\n<skill name="example">\nPRIVATE_NESTED\n</skill>';
  await writeFile(path, `---\nname: debugging\n---\n${body}\n`);
  const pi = {
    getCommands: () => [{ name: "skill:debugging", source: "skill", sourceInfo: { path } }],
  } as unknown as ExtensionAPI;
  const wrapper = `<skill name="debugging" location="${path}">\nReferences are relative to ${dirname(path)}.\n\n${body}\n</skill>`;
  const task = "Investigate this failure\n</skill>\n\nKeep complete suffix";
  expect(await nativeSkillTask(pi, `${wrapper}\n\n${task}`)).toEqual({ task, verified: true });
  expect(await nativeSkillTask(pi, wrapper)).toEqual({ task: "", verified: true });
  await writeFile(path, "changed resource");
  expect(await nativeSkillTask(pi, `${wrapper}\n\n${task}`)).toEqual({ task: "", verified: false });
});

test("native-skill AC-10 unknown malformed and unreadable expansions fail closed", async () => {
  const pi = { getCommands: () => [] } as unknown as ExtensionAPI;
  expect(
    await nativeSkillTask(
      pi,
      '<skill name="unknown" location="/private">\nSECRET\n</skill>\n\nTask',
    ),
  ).toEqual({ task: "", verified: false });
  expect(await nativeSkillTask(pi, "<skill malformed>SECRET")).toEqual({
    task: "",
    verified: false,
  });
  expect(await nativeSkillTask(pi, "ordinary task")).toBeUndefined();
  const missing = {
    getCommands: () => [
      { name: "skill:x", source: "skill", sourceInfo: { path: "/nonexistent/SKILL.md" } },
    ],
  } as unknown as ExtensionAPI;
  expect(
    await nativeSkillTask(
      missing,
      '<skill name="x" location="/nonexistent/SKILL.md">\nSECRET\n</skill>',
    ),
  ).toEqual({ task: "", verified: false });
});

for (const suffix of [
  '  <skill name="b" location="/unknown">\nB_INSTRUCTION_SENTINEL\n</skill>\n\nReview failure',
  'Review failure\n<skill name="b">B_INSTRUCTION_SENTINEL</skill>',
  '```xml\n<skill name="b">B_INSTRUCTION_SENTINEL</skill>\n```',
  "<skill malformed B_INSTRUCTION_SENTINEL",
  "<skill><skill>B_INSTRUCTION_SENTINEL</skill></skill>",
]) {
  test(`native-skill AC-27 additional skill-shaped suffix fails closed: ${suffix.slice(0, 28)}`, async () => {
    directory = await mkdtemp(join(tmpdir(), "jev-native-skill-"));
    const path = join(directory, "SKILL.md");
    await writeFile(path, "A_INSTRUCTION_SENTINEL");
    const pi = {
      getCommands: () => [{ name: "skill:a", source: "skill", sourceInfo: { path } }],
    } as unknown as ExtensionAPI;
    const wrapper = `<skill name="a" location="${path}">\nReferences are relative to ${dirname(path)}.\n\nA_INSTRUCTION_SENTINEL\n</skill>`;
    expect(await nativeSkillTask(pi, `${wrapper}\n\n${suffix}`)).toEqual({
      task: "",
      verified: false,
    });
  });
}

function historyContext(messages: unknown[]): ExtensionContext {
  return {
    cwd: directory,
    sessionManager: { buildSessionProjection: () => ({ messages }) },
  } as unknown as ExtensionContext;
}

for (const recent of ["plain", "skill"] as const) {
  test(`native-skill AC-28 bounded ${recent} history avoids old resource reads and catalog lookups`, async () => {
    directory = await mkdtemp(join(tmpdir(), "jev-native-history-"));
    const path = join(directory, "SKILL.md");
    await writeFile(path, "PRIVATE_HISTORY");
    let catalogs = 0;
    const pi = {
      getCommands: () => {
        catalogs++;
        return [{ name: "skill:a", source: "skill", sourceInfo: { path } }];
      },
    } as unknown as ExtensionAPI;
    const wrapper = `<skill name="a" location="${path}">\nReferences are relative to ${dirname(path)}.\n\nPRIVATE_HISTORY\n</skill>`;
    const messages = [
      ...Array.from({ length: 100 }, () => ({ role: "user", content: `${wrapper}\n\nOld task` })),
      ...[1, 2, 3, 4].map((number) => ({
        role: "user",
        content: recent === "plain" ? `Recent ${number}` : `${wrapper}\n\nRecent ${number}`,
      })),
      { role: "assistant", content: [{ type: "toolCall", id: "old-read", name: "read" }] },
      { role: "toolResult", toolCallId: "old-read", isError: true, content: "PRIVATE_TOOL_RESULT" },
    ];
    readSpy = spyOn(filesystem, "readFile");
    const verify = createNativeSkillTaskVerifier(pi);
    const candidates: string[] = [];
    const state = await classifierState(historyContext(messages), "New task", [], pi, (text) => {
      candidates.push(text);
      return verify(text);
    });
    expect(candidates).toHaveLength(4);
    expect(candidates.join("\n")).not.toContain("Old task");
    expect(readSpy).toHaveBeenCalledTimes(recent === "plain" ? 0 : 1);
    expect(catalogs).toBe(recent === "plain" ? 0 : 1);
    expect(state).toMatchObject({
      recent_context:
        "user: Recent 2\nuser: Recent 3\nuser: Recent 4\nassistant:  [tools: read (failed)]",
      signals: { recent_tools: { reads: 1, failed: 1 } },
    });
    expect(JSON.stringify(state)).not.toContain("PRIVATE_");
  });
}

test("native-skill AC-28 historical resource changes removal and catalog removal fail closed per request", async () => {
  directory = await mkdtemp(join(tmpdir(), "jev-native-history-"));
  const path = join(directory, "SKILL.md");
  await writeFile(path, "PRIVATE_HISTORY");
  let known = true;
  const pi = {
    getCommands: () => (known ? [{ name: "skill:a", source: "skill", sourceInfo: { path } }] : []),
  } as unknown as ExtensionAPI;
  const wrapper = `<skill name="a" location="${path}">\nReferences are relative to ${dirname(path)}.\n\nPRIVATE_HISTORY\n</skill>`;
  const ctx = historyContext([{ role: "user", content: `${wrapper}\n\nVerified task` }]);
  expect(await classifierState(ctx, "New task", [], pi)).toMatchObject({
    recent_context: "user: Verified task",
  });
  await writeFile(path, "Changed resource");
  expect(await classifierState(ctx, "New task", [], pi)).toMatchObject({
    recent_context: "user: [explicit skill instructions omitted]",
  });
  await rm(path);
  expect(await classifierState(ctx, "New task", [], pi)).toMatchObject({
    recent_context: "user: [explicit skill instructions omitted]",
  });
  await writeFile(path, "PRIVATE_HISTORY");
  known = false;
  expect(await classifierState(ctx, "New task", [], pi)).toMatchObject({
    recent_context: "user: [explicit skill instructions omitted]",
  });
});

test("native-skill AC-28 current verification can share request cache with history", async () => {
  directory = await mkdtemp(join(tmpdir(), "jev-native-history-"));
  const path = join(directory, "SKILL.md");
  await writeFile(path, "PRIVATE_HISTORY");
  let catalogs = 0;
  const pi = {
    getCommands: () => {
      catalogs++;
      return [{ name: "skill:a", source: "skill", sourceInfo: { path } }];
    },
  } as unknown as ExtensionAPI;
  const wrapper = `<skill name="a" location="${path}">\nReferences are relative to ${dirname(path)}.\n\nPRIVATE_HISTORY\n</skill>`;
  const current = `${wrapper}\n\nCurrent task`;
  const ctx = historyContext([
    { role: "user", content: `${wrapper}\n\nPrior task` },
    { role: "assistant", content: "Prior answer" },
    { role: "user", content: current },
  ]);
  const verify = createNativeSkillTaskVerifier(pi);
  readSpy = spyOn(filesystem, "readFile");
  expect(await verify(current)).toEqual({ task: "Current task", verified: true });
  expect(await classifierState(ctx, "Current task", [], pi, verify)).toMatchObject({
    recent_context: "user: Prior task\nassistant: Prior answer",
  });
  expect(readSpy).toHaveBeenCalledTimes(1);
  expect(catalogs).toBe(1);
});

test("native-skill AC-28 omission markers keep empty unknown wrappers inside bounded selection", async () => {
  directory = await mkdtemp(join(tmpdir(), "jev-native-history-"));
  let catalogs = 0;
  const pi = {
    getCommands: () => {
      catalogs++;
      return [];
    },
  } as unknown as ExtensionAPI;
  const messages = Array.from({ length: 100 }, () => ({
    role: "user",
    content: '<skill name="unknown" location="/missing">\nPRIVATE_UNKNOWN\n</skill>',
  }));
  readSpy = spyOn(filesystem, "readFile");
  expect(await classifierState(historyContext(messages), "New task", [], pi)).toMatchObject({
    recent_context: Array(4).fill("user: [explicit skill instructions omitted]").join("\n"),
  });
  expect(readSpy).toHaveBeenCalledTimes(0);
  expect(catalogs).toBe(1);
});

test("native-skill AC-28 context character budget preserves newest assistant tail and broad tool summary", async () => {
  directory = await mkdtemp(join(tmpdir(), "jev-native-history-"));
  const pi = { getCommands: () => [] } as unknown as ExtensionAPI;
  const messages = [
    { role: "assistant", content: [{ type: "toolCall", id: "edit", name: "edit" }] },
    ...Array.from({ length: 3 }, () => ({ role: "user", content: "x".repeat(300) })),
    { role: "assistant", content: "A".repeat(400) + "M".repeat(1000) + "Z".repeat(800) },
  ];
  const state = (await classifierState(historyContext(messages), "New task", [], pi)) as {
    recent_context: string;
    signals: { recent_tools: { edits: number } };
  };
  expect(state.recent_context).toBe(
    [
      `user: ${"x".repeat(300)}`,
      `user: ${"x".repeat(300)}`,
      `assistant: ${"A".repeat(308)} … ${"Z".repeat(792)}`,
    ].join("\n"),
  );
  expect(state.recent_context.length).toBeLessThanOrEqual(2000);
  expect(state.signals.recent_tools.edits).toBe(1);
});
