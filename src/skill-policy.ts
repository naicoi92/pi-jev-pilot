// Adapted from pinned Jev Pilot skill-suggestion.policy.ts; see NOTICE.md.
export interface SkillCandidate {
  name: string;
  description: string;
  body: string;
  filePath: string;
}
export interface Wide {
  ranked: { name: string; probability: number | null }[];
  gate: number | null;
}
/** Session entry type recording the skill selected for one user input. */
export const SKILL_ENTRY_TYPE = "jev-pilot:skill";
export const MAX_CHOICES = 255;
export const NO_SKILL = "(none)";
export const GATE_QUESTIONS = {
  acts_on_user_system:
    "Is the assistant being asked to act on the user's files, accounts, devices, or online services, rather than only to explain or advise?",
  would_follow_documented_procedure:
    "Would a careful expert answering this consult a specific documented procedure or set of commands, rather than answering from general understanding?",
  prose_suffices:
    "Could a knowledgeable generalist fully satisfy this request in prose, with no tools, no documentation, and no access to the user's files or accounts?",
};
const WHICH_INSTRUCTIONS =
  "Which of these skills, if any, is the right one to load to help with the user's latest request? Match the kind of work the request asks for (such as debugging a failure, planning, reviewing, designing, writing a document), not only a product or technology it names. A skill for one product or platform (Vercel, Supabase, AWS, Firebase, Stripe…) fits only when the request, the conversation or the project (project_platforms in the state: what its files show it uses) shows that product is the one in use here; otherwise choose a general skill or none.";
export function skillDetail(skill: SkillCandidate): string {
  const excerpt = skill.body.trim().slice(0, 300);
  return excerpt ? `${skill.description} — ${excerpt}` : skill.description;
}
export function skillBatches(skills: SkillCandidate[]): SkillCandidate[][] {
  if (!skills.length) return [];
  const size = Math.ceil(skills.length / Math.ceil(skills.length / (MAX_CHOICES - 1)));
  return Array.from({ length: Math.ceil(skills.length / size) }, (_, index) =>
    skills.slice(index * size, (index + 1) * size),
  );
}
export function skillQuestions(
  skills: SkillCandidate[],
  first: boolean,
  rerank: boolean,
): Record<string, unknown> {
  return {
    which: {
      type: "choice",
      instructions: rerank
        ? "Which of these skills, if any, is the right one to load to help with the user's latest request?"
        : WHICH_INSTRUCTIONS,
      criteria: {
        ...Object.fromEntries(
          skills.map((skill) => [skill.name, rerank ? skill.description : skillDetail(skill)]),
        ),
        ...(!rerank
          ? {
              [NO_SKILL]:
                "None of these skills fits: the request is ordinary work that no listed skill is specifically about.",
            }
          : {}),
      },
    },
    ...(first
      ? Object.fromEntries(
          Object.entries(GATE_QUESTIONS).map(([key, instructions]) => [
            `gate::${key}`,
            { type: "noul", instructions },
          ]),
        )
      : {}),
  };
}
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function probability(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : null;
}
function yesNo(value: unknown): number | null {
  const answer = object(value);
  return probability(answer?.noul ?? answer?.probability);
}
export function readWide(
  value: unknown,
  offered: SkillCandidate[],
  withNone: boolean,
): Wide | null {
  const answers = object(object(value)?.answers);
  const which = object(answers?.which);
  const known = new Set([...offered.map((skill) => skill.name), ...(withNone ? [NO_SKILL] : [])]);
  if (typeof which?.choice !== "string" || !known.has(which.choice)) return null;
  if (which.confidence !== undefined && probability(which.confidence) === null) return null;
  const ranked: Wide["ranked"] = [];
  if (which.probabilities !== undefined) {
    const distribution = object(which.probabilities);
    if (!distribution) return null;
    for (const [name, value] of Object.entries(distribution)) {
      const p = probability(value);
      if (!known.has(name) || p === null) return null;
      ranked.push({ name, probability: p });
    }
    ranked.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  }
  if (!ranked.length)
    ranked.push({ name: which.choice, probability: probability(which.confidence) });
  const gates: number[] = [];
  for (const key of Object.keys(GATE_QUESTIONS)) {
    const answer = answers?.[`gate::${key}`];
    const p = yesNo(answer);
    if (answer !== undefined && p === null) return null;
    if (p !== null) gates.push(key === "prose_suffices" ? 1 - p : p);
  }
  return {
    ranked,
    gate: gates.length ? gates.reduce((sum, p) => sum + p, 0) / gates.length : null,
  };
}
export function pickSkill(
  parts: (Wide | null)[],
  skills: SkillCandidate[],
): SkillCandidate | undefined {
  if (!parts.length || parts.some((part) => !part)) return;
  const leaders = parts
    .flatMap((part) =>
      part!.ranked[0] && part!.ranked[0].name !== NO_SKILL ? [part!.ranked[0]] : [],
    )
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  const best = leaders[0];
  if (!best) return;
  const p = best.probability ?? 0;
  const gate = parts[0]!.gate;
  if (p >= 0.5 || ((gate === null || gate >= 0.3) && p >= 0.3))
    return skills.find((skill) => skill.name === best.name);
}
export function shortlist(parts: (Wide | null)[], skills: SkillCandidate[]): SkillCandidate[] {
  if (
    !parts.length ||
    parts.some((part) => !part) ||
    (parts[0]!.gate !== null && parts[0]!.gate! < 0.3)
  )
    return [];
  const ranked: Wide["ranked"] = [];
  const depth = Math.max(...parts.map((part) => part!.ranked.length));
  for (let index = 0; index < depth; index++)
    ranked.push(
      ...parts
        .flatMap((part) => (part!.ranked[index] ? [part!.ranked[index]!] : []))
        .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0)),
    );
  return ranked
    .flatMap((entry) => {
      const skill = skills.find((skill) => skill.name === entry.name);
      return skill ? [skill] : [];
    })
    .slice(0, Math.min(MAX_CHOICES, 3 * parts.length));
}
export function rerankQuestions(skills: SkillCandidate[]): Record<string, unknown> {
  return {
    which: {
      type: "choice",
      instructions:
        "Exactly one of these skills is the right one to load for the user's latest request. Which one? Read what each actually does, not just its name.",
      criteria: Object.fromEntries(skills.map((skill) => [skill.name, skillDetail(skill)])),
    },
    ...Object.fromEntries(
      skills.map((skill) => [
        `fits::${skill.name}`,
        {
          type: "noul",
          instructions: `Does the skill '${skill.name}' do the specific thing the user's request asks for? It is described as: ${skill.description || skillDetail(skill)}`,
        },
      ]),
    ),
  };
}
export function pickReranked(value: unknown, skills: SkillCandidate[]): SkillCandidate | undefined {
  const answers = object(object(value)?.answers);
  const which = object(answers?.which);
  const skill = skills.find((skill) => skill.name === which?.choice);
  if (skill && (yesNo(answers?.[`fits::${skill.name}`]) ?? 0) >= 0.3) return skill;
}
