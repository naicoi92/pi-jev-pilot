import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { nativeSkillTask } from "../src/native-skill.ts";

let directory: string | undefined;
afterEach(async () => {
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
