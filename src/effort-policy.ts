// Adapted from Jev Pilot 0.12.1 model-router.policy.ts; see NOTICE.md and LICENSE.
export const EFFORT_ORDER = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORT_ORDER)[number];

export interface EffortDecision {
  effort: number | null;
  effortConfidence: number | null;
  effortProbabilities?: Record<string, number> | null;
  risky: number | null;
}

export function isContinuation(prompt: string): boolean {
  return /^(?:please\s+)?(?:continue|go on|keep going|carry on|resume)(?:\s+please)?[.!]*$/i.test(
    prompt.trim(),
  );
}

function isFollowUp(prompt: string): boolean {
  const text = prompt.trim();
  if (!text || /[?？]$/.test(text)) return false;
  if (/^(what|why|how|is|are|do|does|did|can|could|should|where|when|which|who)\b/i.test(text))
    return false;
  if (
    /为什么|为啥|怎么|怎样|如何|什么|是不是|能不能|可不可以|有没有|是否|[吗呢][\s。.!！~～]*$/.test(
      text,
    )
  )
    return false;
  const unspaced = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu;
  const count = text.match(unspaced)?.length ?? 0;
  const spaced = text
    .replace(unspaced, " ")
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
  return spaced + Math.ceil(count / 1.5) <= 8;
}

function effortScore(decision: EffortDecision): number | null {
  const ranked = Object.entries(decision.effortProbabilities ?? {})
    .map(([level, probability]) => ({ level: Number(level), probability }))
    .filter(
      ({ level, probability }) =>
        Number.isInteger(level) && level >= 0 && level <= 4 && Number.isFinite(probability),
    )
    .sort((a, b) => b.probability - a.probability || b.level - a.level);
  const [best, second] = ranked;
  if (best) {
    let level = best.level;
    if (
      second &&
      second.level > level &&
      second.level <= 2 &&
      best.probability - second.probability <= 0.15
    )
      level = second.level;
    const veryHard = ranked
      .filter((entry) => entry.level > 2)
      .reduce((sum, entry) => sum + entry.probability, 0);
    if (level > 2 && veryHard < 0.6) return 2;
    if (level <= 2 && veryHard >= 0.6) return 3;
    return level;
  }
  if (decision.effort === null || !Number.isFinite(decision.effort)) return null;
  const score = Math.min(4, Math.max(0, decision.effort));
  const whole = Math.floor(score);
  return Math.min(4, score - whole >= 0.5 - (whole + 1 <= 2 ? 0.15 : 0) ? whole + 1 : whole);
}

/** Upstream start-of-turn rules only; no mid-turn escalation or model selection. */
export function selectEffort(
  decision: EffortDecision,
  current: string,
  prompt: string,
): Effort | null {
  let score = effortScore(decision);
  const forced = decision.risky !== null && decision.risky > 0.7;
  if (forced) score = Math.max(score ?? 0, 2);
  if (score === null) return null;
  const index = EFFORT_ORDER.indexOf(current as Effort);
  const from = index === -1 ? null : index;
  let to = Math.min(Math.round(score), 3);
  if (forced) to = Math.max(to, from ?? 0, 2);
  if (from !== null && from > 3) return null;
  const lowering = from !== null && to < from;
  if ((isFollowUp(prompt) && lowering) || to === from) return null;
  const confidence = decision.effortConfidence;
  const allowed = confidence === null ? !lowering : confidence >= (lowering ? 0.6 : 0.3);
  const sureOfHigh = confidence === null || confidence >= 0.5;
  return forced || (allowed && (lowering || to < 2 || sureOfHigh))
    ? (EFFORT_ORDER[to] ?? null)
    : null;
}
