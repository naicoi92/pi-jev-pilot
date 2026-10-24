import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { stripFrontmatter, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Pi 1.4.0's parser accepts embedded closing tags as boundaries. Compare the
 * complete native wrapper against its public resource instead; never guess a
 * suffix when a resource is missing, changed, or not in the effective catalog. */
export async function nativeSkillTask(
  pi: ExtensionAPI,
  text: string,
): Promise<{ task: string; verified: boolean } | undefined> {
  if (!/^<skill\b/.test(text)) return undefined;
  const header = /^<skill name="([^"]+)" location="([^"]+)">\n/.exec(text);
  if (!header) return { task: "", verified: false };
  const command = pi
    .getCommands()
    .find(
      (candidate) =>
        candidate.source === "skill" &&
        candidate.name === `skill:${header[1]}` &&
        candidate.sourceInfo.path === header[2],
    );
  if (!command) return { task: "", verified: false };
  try {
    const body = stripFrontmatter(await readFile(command.sourceInfo.path, "utf8")).trim();
    const wrapper = `<skill name="${header[1]}" location="${header[2]}">\nReferences are relative to ${dirname(header[2]!)}.\n\n${body}\n</skill>`;
    if (text === wrapper) return { task: "", verified: true };
    if (text.startsWith(`${wrapper}\n\n`))
      return { task: text.slice(wrapper.length + 2).trim(), verified: true };
  } catch {
    // Native instructions remain available to Pi; classification fails closed.
  }
  return { task: "", verified: false };
}
