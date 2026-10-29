import { TIER_ORDER, type Tier, type Tiers } from "./tier-policy.ts";

export interface TierFailure {
  tier: Tier;
  /** Pi settings path of the tier's model, so the operator knows what to fix. */
  setting: string;
  reason: string;
}
export interface TierCascade {
  /** The model that can run, or null when no configured tier from the selected one downward can. */
  model: string | null;
  /** The lower tier that replaced the selected one; absent when the selected model can run. */
  fallbackTier?: Tier;
  /** Unusable tiers in the order they were tried, highest first. */
  failures: TierFailure[];
}

/**
 * Pre-launch only: `unusable` returns a reason when a model cannot be launched according to signals
 * known before launch (registry resolution, authentication, launch preflight). Errors raised while a
 * child runs, such as rate limits, timeouts or provider errors, stay executor-surfaced and never
 * reach this cascade, because a relaunch cannot be made idempotent.
 */
export async function cascadeTiers(
  tiers: Tiers,
  selected: string,
  unusable: (model: string) => Promise<string | undefined>,
): Promise<TierCascade> {
  const judged = new Map<string, string | undefined>();
  const judge = async (model: string) => {
    if (!judged.has(model)) judged.set(model, await unusable(model));
    return judged.get(model);
  };
  const failures: TierFailure[] = [];
  const fail = (tier: Tier, reason: string) =>
    failures.push({ tier, setting: `jev-pilot.json tiers.${tier}`, reason });
  const running = TIER_ORDER.filter((tier) => tiers[tier] === selected);
  // A model no tier runs (a custom slot) was already validated and is not judged here.
  if (running.length === 0) return { model: selected, failures };
  const reason = await judge(selected);
  if (reason === undefined) return { model: selected, failures };
  for (const tier of [...running].reverse()) fail(tier, reason);
  // Only tiers below every tier that runs the failed model are candidates; expert is never a fallback.
  const lowest = TIER_ORDER.indexOf(running[0]!);
  for (const tier of TIER_ORDER.slice(0, lowest).reverse()) {
    const model = tiers[tier];
    if (!model) continue;
    const failed = await judge(model);
    if (failed === undefined) return { model, fallbackTier: tier, failures };
    fail(tier, failed);
  }
  return { model: null, failures };
}
