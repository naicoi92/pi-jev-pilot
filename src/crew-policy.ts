// Adapted from pinned Jev Pilot crew.ts and jev-model-router.ts; see NOTICE.md.
import type { Slot } from "./crew-config.ts";
import {
  admitsExpert,
  riskTier,
  selectTier,
  type Tiers,
  type TierDecision,
} from "./tier-policy.ts";
/** Encode every slot, not just collisions, so arbitrary valid public names stay distinct from tiers. */
export const slotKey = (name: string): string => `slot::${name}`;
export function selectWorkerModel(
  decision: TierDecision & { slot?: string },
  current: string,
  tiers: Tiers,
  offered: Slot[],
): string | null {
  if ((decision.risky ?? 0) > 0.7 && !admitsExpert(decision, tiers)) {
    const tier = riskTier(tiers);
    return tier ? (tiers[tier] ?? null) : null;
  }
  if (decision.slot)
    return (decision.confidence ?? 0) >= 0.6
      ? (offered.find((slot) => slot.name === decision.slot)?.model ?? null)
      : null;
  return selectTier(decision, current, tiers);
}
