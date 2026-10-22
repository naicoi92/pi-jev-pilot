import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseFrontmatter, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isContinuation } from "./effort-policy.ts";
import { designBlock } from "./design-policy.ts";
import { guidanceEnabled, qualityAdvice, strategyAdvice } from "./guidance-policy.ts";
import {
  classify,
  systemOneConfig,
  type DecisionQuestions,
  type Classification,
} from "./system-one.ts";
import {
  pickReranked,
  pickSkill,
  readWide,
  rerankQuestions,
  shortlist,
  skillBatches,
  skillQuestions,
  type SkillCandidate,
} from "./skill-policy.ts";

function flag(name: string, fallback: string): boolean {
  const value = process.env[name] ?? fallback;
  if (value !== "true" && value !== "false")
    throw new Error(`Set ${name} to true or false (default: ${fallback}).`);
  return value === "true";
}

/** The effective Pi resource catalog, never a parallel filesystem discovery. */
export async function eligibleSkills(pi: ExtensionAPI, prompt: string): Promise<SkillCandidate[]> {
  if (!flag("JEV_SKILLS_ENABLED", "true") || isContinuation(prompt)) return [];
  return resourceSkills(pi);
}

async function resourceSkills(pi: ExtensionAPI): Promise<SkillCandidate[]> {
  const skills: SkillCandidate[] = [];
  for (const command of pi.getCommands()) {
    if (command.source !== "skill" || !command.name.startsWith("skill:")) continue;
    try {
      const { frontmatter, body } = parseFrontmatter(
        await readFile(command.sourceInfo.path, "utf8"),
      );
      if (frontmatter["disable-model-invocation"] === true) continue;
      skills.push({
        name: command.name.slice(6),
        description: command.description ?? "",
        body: body.trim(),
        filePath: command.sourceInfo.path,
      });
    } catch {
      // A missing/unreadable resource is not eligible for content injection.
    }
  }
  return skills;
}

/** Both physical and virtual paths use this one orchestration, including batching. */
export async function decideMain(
  pi: ExtensionAPI,
  prompt: string,
  state: () => Promise<unknown>,
  signal: AbortSignal,
  enabled: DecisionQuestions,
): Promise<{ result: Classification | null; skill?: SkillCandidate; advice?: string }> {
  const quality = !isContinuation(prompt) && guidanceEnabled("QUALITY");
  const strategy = !isContinuation(prompt) && guidanceEnabled("STRATEGY");
  const design = !isContinuation(prompt) && guidanceEnabled("DESIGN");
  const resources = design ? await resourceSkills(pi) : await eligibleSkills(pi, prompt);
  const skills = design && !flag("JEV_SKILLS_ENABLED", "true") ? [] : resources;
  const designNames = [
    ...new Set(
      (process.env.JEV_DESIGN_SKILLS ?? "design-taste-frontend, impeccable, web-design-guidelines")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  const finish = (result: Classification | null, skill?: SkillCandidate) => {
    const adviceDecision = result?.adviceDecision;
    return {
      result,
      skill,
      advice:
        [
          adviceDecision && strategy ? strategyAdvice(adviceDecision) : null,
          adviceDecision && quality ? qualityAdvice(adviceDecision) : null,
          design
            ? designBlock(result?.designScore, designNames, resources, pi.getActiveTools())
            : null,
        ]
          .filter(Boolean)
          .join("\n\n") || undefined,
    };
  };
  if (!enabled.tier && !enabled.effort && !skills.length && !quality && !strategy && !design)
    return { result: null };
  const config = systemOneConfig();
  const context = await state();
  if (!skills.length)
    return finish(
      await classify(config, context, signal, { ...enabled, quality, strategy, design }),
    );
  const rerank = flag("JEV_SKILL_RERANK", "false");
  const batches = skillBatches(skills);
  const answers = await Promise.all(
    batches.map((batch, index) =>
      classify(
        config,
        context,
        signal,
        index === 0 ? { ...enabled, quality, strategy, design } : { tier: false, effort: false },
        skillQuestions(batch, index === 0, rerank),
      ),
    ),
  );
  const parts = answers.map((answer, index) =>
    answer.outcome === "classified" ? readWide(answer.value, batches[index]!, !rerank) : null,
  );
  let skill: SkillCandidate | undefined;
  if (rerank) {
    const candidates = shortlist(parts, skills);
    if (candidates.length) {
      const answer = await classify(
        config,
        context,
        signal,
        { tier: false, effort: false },
        rerankQuestions(candidates),
      );
      if (answer.outcome === "classified") skill = pickReranked(answer.value, candidates);
    }
  } else skill = pickSkill(parts, skills);
  return finish(answers[0]!, skill);
}

export function skillBlock(skill: SkillCandidate, alreadyLoaded = false): string {
  if (alreadyLoaded)
    return `<skill_relevance>\nRelevant to the current request: ${skill.name}. Ignore this if it does not fit what the user actually asked for.\nSkill /${skill.name} is already loaded above; instructions unchanged.\n</skill_relevance>`;
  return `<skill_relevance>\nRelevant to the current request: ${skill.name}. Ignore this if it does not fit what the user actually asked for.\nIts instructions follow: follow them now, including any setup steps. Do not load it again; it is already loaded here. Resolve relative references against ${dirname(skill.filePath)}.\n<skill name=${JSON.stringify(skill.name)} dir=${JSON.stringify(dirname(skill.filePath))}>\n${skill.body}\n</skill>\n</skill_relevance>`;
}
