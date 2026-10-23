import { TIER_ORDER, type Tiers } from "./tier-policy.ts";

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Set ${path} to an object in Pi settings.`);
  return value as Record<string, unknown>;
}

function pilot(settings: unknown): Record<string, unknown> {
  const effective = object(settings, "effective settings");
  return "jevPilot" in effective ? object(effective.jevPilot, "jevPilot") : {};
}

/** Resolve JSON tiers only for an applicable ordinary worker launch. */
export function configuredTiers(settings: unknown = {}): Tiers {
  return Object.fromEntries(
    TIER_ORDER.map((tier) => {
      const config = pilot(settings);
      const tiers = "tiers" in config ? object(config.tiers, "jevPilot.tiers") : {};
      const value = tiers[tier];
      if (typeof value !== "string" || !/^[^/\s]+\/\S+$/.test(value))
        throw new Error(
          `Set jevPilot.tiers.${tier} in Pi settings to a qualified physical provider/model identity.`,
        );
      return [tier, value];
    }),
  ) as Tiers;
}
