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

/**
 * Jev's tier choice is authoritative for workers: classifier confidence never vetoes it, and the
 * model that would otherwise run (parent, caller or agent default) never decides it either.
 * Physical identities are exact; Claude family/substring inference is not a registry contract.
 * Returns null only when no usable tier is configured for the choice.
 */
export function selectTier(
  decision: TierDecision,
  tiers: Tiers,
  selected?: (tier: Tier) => void,
): string | null {
  const risky = (decision.risky ?? 0) > 0.7;
  const pick = (tier: Tier | null): string | null => {
    const wanted = tier && tiers[tier];
    if (!tier || !wanted) return null;
    selected?.(tier);
    return wanted;
  };
  // An admitted expert choice stands on the expert_needed gate; risk only takes over when it fails.
  if (admitsExpert(decision, tiers)) {
    const expert = pick("expert");
    if (expert || !risky) return expert;
  }
  // A rejected expert choice is a deep choice; without deep the baseline is kept.
  const choice = decision.tier === "expert" ? "deep" : decision.tier;
  return risky ? pick(riskTier(tiers)) : pick(choice);
}
