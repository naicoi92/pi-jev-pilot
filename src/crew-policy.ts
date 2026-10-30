// Adapted from pinned Jev Pilot crew.ts and jev-model-router.ts; see NOTICE.md.
import type { Slot } from "./crew-config.ts";
import {
  admitsExpert,
  riskTier,
  selectTier,
  type Tiers,
  type Tier,
  type TierDecision,
} from "./tier-policy.ts";
/** Encode every slot, not just collisions, so arbitrary valid public names stay distinct from tiers. */
export const slotKey = (name: string): string => `slot::${name}`;
type SlotDecision = TierDecision & { slot?: string };
const riskForcesTier = (decision: SlotDecision, tiers: Tiers): boolean =>
  (decision.risky ?? 0) > 0.7 && !admitsExpert(decision, tiers);
/** True when the selected model comes from a custom slot, which stays outside tier handling. */
export const selectsSlot = (decision: SlotDecision, tiers: Tiers): boolean =>
  Boolean(decision.slot) && !riskForcesTier(decision, tiers);
export function selectWorkerModel(
  decision: SlotDecision,
  current: string,
  tiers: Tiers,
  offered: Slot[],
  selected?: (tier: Tier) => void,
): string | null {
  if (riskForcesTier(decision, tiers)) {
    const tier = riskTier(tiers);
    if (tier && tiers[tier]) selected?.(tier);
    return tier ? (tiers[tier] ?? null) : null;
  }
  if (decision.slot) return offered.find((slot) => slot.name === decision.slot)?.model ?? null;
  return selectTier(decision, current, tiers, selected);
}
