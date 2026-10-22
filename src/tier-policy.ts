// Adapted from pinned Jev Pilot model-router.policy.ts; see NOTICE.md.
export const TIER_ORDER = ["fast", "balanced", "deep"] as const;
export type Tier = (typeof TIER_ORDER)[number];
export type Tiers = Record<Tier, string>;
export interface TierDecision {
  tier: Tier;
  confidence: number | null;
  risky: number | null;
}

/** Physical identities are exact; Claude family/substring inference is not a registry contract. */
export function selectTier(decision: TierDecision, current: string, tiers: Tiers): string | null {
  const tier = (decision.risky ?? 0) > 0.7 ? "deep" : decision.tier;
  const wanted = tiers[tier];
  const from = TIER_ORDER.findIndex((name) => tiers[name] === current);
  const to = TIER_ORDER.indexOf(tier);
  if (wanted === current || from === to) return null;
  const lowering = from !== -1 && to < from;
  const allowed =
    decision.confidence === null ? !lowering : decision.confidence >= (lowering ? 0.6 : 0.3);
  return (decision.risky ?? 0) > 0.7 || allowed ? wanted : null;
}
