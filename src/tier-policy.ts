// Adapted from pinned Jev Pilot model-router.policy.ts; see NOTICE.md.
export const TIER_ORDER = ["fast", "balanced", "deep"] as const;
export type Tier = (typeof TIER_ORDER)[number];
/** Every tier is optional; a missing key means the tier is not configured. */
export type Tiers = Partial<Record<Tier, string>>;
export interface TierDecision {
  tier: Tier;
  confidence: number | null;
  risky: number | null;
}

/** High-risk work goes to deep; without deep, to the highest configured tier; without any, nowhere. */
export function riskTier(tiers: Tiers): Tier | null {
  if (tiers.deep) return "deep";
  return [...TIER_ORDER].reverse().find((name) => tiers[name]) ?? null;
}

/** Physical identities are exact; Claude family/substring inference is not a registry contract. */
export function selectTier(decision: TierDecision, current: string, tiers: Tiers): string | null {
  const risky = (decision.risky ?? 0) > 0.7;
  const tier = risky ? riskTier(tiers) : decision.tier;
  const wanted = tier && tiers[tier];
  if (!tier || !wanted) return null;
  const from = TIER_ORDER.findIndex((name) => tiers[name] === current);
  const to = TIER_ORDER.indexOf(tier);
  if (wanted === current || from === to) return null;
  const lowering = from !== -1 && to < from;
  const allowed =
    decision.confidence === null ? !lowering : decision.confidence >= (lowering ? 0.6 : 0.3);
  return risky || allowed ? wanted : null;
}
