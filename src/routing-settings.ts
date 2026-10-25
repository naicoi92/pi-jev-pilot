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

/**
 * Resolve JSON tiers only for an applicable ordinary worker launch. An absent, empty or
 * whitespace-only value leaves the tier unconfigured; any other invalid value is an error.
 */
export function configuredTiers(settings: unknown = {}): Tiers {
  const config = pilot(settings);
  const tiers = "tiers" in config ? object(config.tiers, "jevPilot.tiers") : {};
  const configured: Tiers = {};
  for (const tier of TIER_ORDER) {
    const value = tiers[tier];
    if (value === undefined || (typeof value === "string" && !value.trim())) continue;
    if (typeof value !== "string" || !/^[^/\s]+\/\S+$/.test(value))
      throw new Error(
        `Set jevPilot.tiers.${tier} in Pi settings to a qualified physical provider/model identity.`,
      );
    configured[tier] = value;
  }
  return configured;
}
