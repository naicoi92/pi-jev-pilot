import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { stripFrontmatter, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface NativeSkillTask {
  task: string;
  verified: boolean;
}

export type NativeSkillTaskVerifier = (text: string) => Promise<NativeSkillTask | undefined>;

/** Pi 1.4.0's parser accepts embedded closing tags as boundaries. Compare the
 * complete native wrapper against its public resource instead; never guess a
 * suffix when a resource is missing, changed, or not in the effective catalog. */
export async function nativeSkillTask(
  pi: ExtensionAPI,
  text: string,
): Promise<NativeSkillTask | undefined> {
  return createNativeSkillTaskVerifier(pi)(text);
}

/** One classification snapshot only: never reuse resource contents across requests. */
export function createNativeSkillTaskVerifier(pi: ExtensionAPI): NativeSkillTaskVerifier {
  let catalog: Set<string> | undefined;
  const bodies = new Map<string, Promise<string | undefined>>();
  return async (text) => {
    if (!/^<skill\b/.test(text)) return undefined;
    const header = /^<skill name="([^"]+)" location="([^"]+)">\n/.exec(text);
    if (!header) return { task: "", verified: false };
    catalog ??= new Set(
      pi
        .getCommands()
        .filter((command) => command.source === "skill")
        .map((command) => JSON.stringify([command.name, command.sourceInfo.path])),
    );
    const path = header[2]!;
    if (!catalog.has(JSON.stringify([`skill:${header[1]}`, path])))
      return { task: "", verified: false };
    let body = bodies.get(path);
    if (!body) {
      body = readFile(path, "utf8")
        .then((content) => stripFrontmatter(content).trim())
        .catch(() => undefined);
      bodies.set(path, body);
    }
    const content = await body;
    if (content !== undefined) {
      const wrapper = `<skill name="${header[1]}" location="${path}">\nReferences are relative to ${dirname(path)}.\n\n${content}\n</skill>`;
      if (text === wrapper) return { task: "", verified: true };
      if (text.startsWith(`${wrapper}\n\n`)) {
        const task = text.slice(wrapper.length + 2).trim();
        // A second opening block has no trusted task boundary, even in prose/code.
        // Keep the original message for Pi, but omit the entire classifier suffix.
        if (!/<skill\b/i.test(task)) return { task, verified: true };
      }
    }
    // Native instructions remain available to Pi; classification fails closed.
    return { task: "", verified: false };
  };
}
