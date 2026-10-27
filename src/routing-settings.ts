import { loadJevConfig } from "./jev-config.ts";
import type { Tiers } from "./tier-policy.ts";

/** Legacy settings argument is ignored; only global configuration supplies worker tiers. */
export function configuredTiers(_settings?: unknown): Tiers {
  return loadJevConfig().tiers;
}
