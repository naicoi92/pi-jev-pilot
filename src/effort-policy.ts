// Adapted from Jev Pilot 0.12.1 model-router.policy.ts; see NOTICE.md and LICENSE.
export const EFFORT_ORDER = ["low", "medium", "high", "xhigh", "max"] as const;
export type Effort = (typeof EFFORT_ORDER)[number];

export interface EffortDecision {
  effort: number | null;
  /** Validated explicit choice; absent on historical normalized decisions. */
  effortChoice?: Effort;
  effortConfidence: number | null;
  effortProbabilities?: Record<string, number> | null;
  risky: number | null;
}

/** Compatible tuning fields; confidence bars no longer veto valid effort assessments. */
export interface EffortThresholds {
  /** Legacy stored field; diagnostic only. */
  minDowngradeConfidence: number;
  /** Legacy stored field; diagnostic only. */
  minHighConfidence: number;
  /** How close two levels must be for the close call to lean to the higher one. */
  effortCloseMargin: number;
}
export const DEFAULT_EFFORT_THRESHOLDS: EffortThresholds = {
  minDowngradeConfidence: 0.6,
  minHighConfidence: 0.5,
  effortCloseMargin: 0.15,
};

export function isContinuation(prompt: string): boolean {
  return /^(?:please\s+)?(?:continue|go on|keep going|carry on|resume)(?:\s+please)?[.!]*$/i.test(
    prompt.trim(),
  );
}

/** Explicit choice, or legacy rubric level (0..4) after the close-call lean. */
export function effortScore(
  decision: EffortDecision,
  margin = DEFAULT_EFFORT_THRESHOLDS.effortCloseMargin,
): number | null {
  if (decision.effortChoice !== undefined) return EFFORT_ORDER.indexOf(decision.effortChoice);
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
      best.probability - second.probability <= margin
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
  return Math.min(4, score - whole >= 0.5 - (whole + 1 <= 2 ? margin : 0) ? whole + 1 : whole);
}

/** Valid effort is authoritative within main max lock, risk and xhigh ceiling constraints. */
export function selectEffort(
  decision: EffortDecision,
  current: string,
  _prompt: string,
  thresholds: EffortThresholds = DEFAULT_EFFORT_THRESHOLDS,
): Effort | null {
  let score = effortScore(decision, thresholds.effortCloseMargin);
  const forced = decision.risky !== null && decision.risky > 0.7;
  if (forced) score = Math.max(score ?? 0, 2);
  if (score === null) return null;
  const index = EFFORT_ORDER.indexOf(current as Effort);
  const from = index === -1 ? null : index;
  let to = Math.min(Math.round(score), 3);
  if (forced) to = Math.max(to, from ?? 0, 2);
  if (from !== null && from > 3) return null;
  return EFFORT_ORDER[to] ?? null;
}
