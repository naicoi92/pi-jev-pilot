import { readFile } from "node:fs/promises";
import type { EffortAssessment } from "./effort-assessment.ts";
import { crewAdvice } from "./crew-guidance.ts";
import { dirname } from "node:path";
import { parseFrontmatter, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isContinuation } from "./effort-policy.ts";
import { designBlock } from "./design-policy.ts";
import {
  advisedStrategy,
  guidanceEnabled,
  qualityAdvice,
  strategyAdvice,
  type Strategy,
} from "./guidance-policy.ts";
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

/** The effective Pi resource catalog, never a parallel filesystem discovery. */
export async function eligibleSkills(
  pi: ExtensionAPI,
  prompt: string,
  skillsEnabled: boolean,
): Promise<SkillCandidate[]> {
  if (!skillsEnabled || isContinuation(prompt)) return [];
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

/** Physical main effort, skill and advice questions share one orchestration. */
export async function decideMain(
  pi: ExtensionAPI,
  prompt: string,
  state: () => Promise<unknown>,
  signal: AbortSignal,
  withEffort: boolean,
  assessment: EffortAssessment,
): Promise<{
  result: Classification | null;
  skill?: SkillCandidate;
  advice?: string;
  strategy?: Strategy;
}> {
  const crew = assessment.config.crew;
  const enabled: DecisionQuestions = { tier: false, effort: withEffort, junior: !!crew.junior };
  const quality = !isContinuation(prompt) && guidanceEnabled("QUALITY", assessment.config);
  const strategy = !isContinuation(prompt) && guidanceEnabled("STRATEGY", assessment.config);
  const design = !isContinuation(prompt) && guidanceEnabled("DESIGN", assessment.config);
  const resources = design
    ? await resourceSkills(pi)
    : await eligibleSkills(pi, prompt, assessment.config.skillsEnabled);
  const skills = design && !assessment.config.skillsEnabled ? [] : resources;
  const designNames = assessment.config.designSkills;
  const finish = (result: Classification | null, skill?: SkillCandidate) => {
    const adviceDecision = result?.adviceDecision;
    return {
      result,
      skill,
      strategy:
        adviceDecision && strategy
          ? advisedStrategy(adviceDecision, crew.offered.length > 0)
          : undefined,
      advice:
        [
          strategy ? crewAdvice(crew, true) : null,
          adviceDecision && strategy
            ? strategyAdvice(adviceDecision, crew.offered.length > 0)
            : null,
          adviceDecision && quality ? qualityAdvice(adviceDecision) : null,
          design
            ? designBlock(result?.designScore, designNames, resources, pi.getActiveTools())
            : null,
        ]
          .filter(Boolean)
          .join("\n\n") || undefined,
    };
  };
  if (!withEffort && !skills.length && !quality && !strategy && !design) return { result: null };
  const config = systemOneConfig(assessment);
  const context = await state();
  if (!skills.length)
    return finish(
      await classify(config, context, signal, { ...enabled, quality, strategy, design }),
    );
  const rerank = assessment.config.skillRerank;
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
