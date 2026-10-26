// Adapted from pinned Jev Pilot model-router.policy.ts; see NOTICE.md.
export const TIER_ORDER = ["fast", "balanced", "deep", "expert"] as const;
export type Tier = (typeof TIER_ORDER)[number];
/** Tiers offered when no availability snapshot is given; expert is always an explicit opt-in. */
export const ORDINARY_TIERS: readonly Tier[] = TIER_ORDER.filter((name) => name !== "expert");
/** An expert choice runs only when the expert_needed answer is strictly above this. */
export const EXPERT_NEEDED_THRESHOLD = 0.9;
/** Every tier is optional; a missing key means the tier is not configured. */
export type Tiers = Partial<Record<Tier, string>>;
export interface TierDecision {
  tier: Tier;
  confidence: number | null;
  risky: number | null;
  /** The separate expert_needed answer; null or absent when missing or invalid. */
  expertNeeded?: number | null;
}

/** High-risk work goes to deep; without deep, to the highest configured non-expert tier; without any, nowhere. */
export function riskTier(tiers: Tiers): Tier | null {
  if (tiers.deep) return "deep";
  return [...ORDINARY_TIERS].reverse().find((name) => tiers[name]) ?? null;
}

/** A valid expert choice with expert_needed strictly above the threshold, for a configured expert tier. */
export function admitsExpert(decision: TierDecision, tiers: Tiers): boolean {
  return (
    decision.tier === "expert" &&
    !!tiers.expert &&
    (decision.expertNeeded ?? 0) > EXPERT_NEEDED_THRESHOLD
  );
}

/** Physical identities are exact; Claude family/substring inference is not a registry contract. */
export function selectTier(
  decision: TierDecision,
  current: string,
  tiers: Tiers,
  selected?: (tier: Tier) => void,
): string | null {
  const risky = (decision.risky ?? 0) > 0.7;
  const move = (tier: Tier | null, forced: boolean): string | null => {
    const wanted = tier && tiers[tier];
    if (!tier || !wanted) return null;
    const from = TIER_ORDER.findIndex((name) => tiers[name] === current);
    const to = TIER_ORDER.indexOf(tier);
    if (wanted === current || from === to) return null;
    const lowering = from !== -1 && to < from;
    const allowed =
      decision.confidence === null ? !lowering : decision.confidence >= (lowering ? 0.6 : 0.3);
    if (!forced && !allowed) return null;
    selected?.(tier);
    return wanted;
  };
  // An admitted expert choice is judged on its own confidence; risk only takes over when it fails.
  if (admitsExpert(decision, tiers)) {
    if (tiers.expert === current) return null;
    const expert = move("expert", false);
    if (expert || !risky) return expert;
  }
  // A rejected expert choice is a deep choice; without deep the baseline is kept.
  const choice = decision.tier === "expert" ? "deep" : decision.tier;
  return risky ? move(riskTier(tiers), true) : move(choice, false);
}
