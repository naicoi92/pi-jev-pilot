import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { DEFAULT_SLOT_WHEN, type Slot } from "./crew-config.ts";
import { TIER_ORDER, type Tier } from "./tier-policy.ts";

export interface JevConfig {
  readonly schemaVersion: 1;
  readonly effortEnabled: boolean;
  readonly workerRoutingEnabled: boolean;
  readonly workerToolSelectionEnabled: boolean;
  readonly workerToolThreshold: number;
  readonly skillsEnabled: boolean;
  readonly skillRerank: boolean;
  readonly strategyEnabled: boolean;
  readonly qualityEnabled: boolean;
  readonly designEnabled: boolean;
  readonly recordDecisions: boolean;
  readonly designSkills: readonly string[];
  readonly classifier: Readonly<{
    url: string;
    apiKeyEnv: string;
    model: string;
    timeoutMs: number;
  }>;
  readonly tiers: Readonly<Partial<Record<Tier, string>>>;
  readonly crew: Readonly<{
    mode: "standard" | "budget" | "junior-lead";
    slots: readonly Readonly<Slot>[];
    offered: readonly Readonly<Slot>[];
    junior?: Readonly<Slot>;
  }>;
}

const FLAGS = {
  effortEnabled: true,
  workerRoutingEnabled: true,
  workerToolSelectionEnabled: true,
  skillsEnabled: true,
  skillRerank: false,
  strategyEnabled: true,
  qualityEnabled: true,
  designEnabled: true,
  recordDecisions: true,
} as const;
const DESIGN_SKILLS = ["design-taste-frontend", "impeccable", "web-design-guidelines"];
const LEGACY_ENV = new Set([
  "JEV_EFFORT_ENABLED",
  "JEV_WORKER_ROUTING_ENABLED",
  "JEV_SKILLS_ENABLED",
  "JEV_SKILL_RERANK",
  "JEV_STRATEGY_ENABLED",
  "JEV_QUALITY_ENABLED",
  "JEV_DESIGN_ENABLED",
  "JEV_RECORD_DECISIONS",
  "JEV_DESIGN_SKILLS",
  "JEV_SYSTEM_ONE_URL",
  "JEV_SYSTEM_ONE_MODEL",
  "JEV_TIMEOUT_MS",
  "JEV_SYSTEM_ONE_API_KEY",
  "TYPESAFE_API_KEY",
  "JEV_CREW_CONFIG",
  "JEV_MAIN_ROUTING_ENABLED",
]);
const warnedLegacyNames = new Set<string>();
let warnedGlobalSettings = false;

function warnLegacyConfig(apiKeyEnv: string): void {
  for (const name of Object.keys(process.env).sort()) {
    if (name === apiKeyEnv || (!LEGACY_ENV.has(name) && !name.startsWith("JEV_TIER_"))) continue;
    // Bound both retained names and output even for arbitrary tier environment names.
    if (
      !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name) ||
      warnedLegacyNames.has(name) ||
      warnedLegacyNames.size >= 32
    )
      continue;
    warnedLegacyNames.add(name);
    console.warn(
      `Jev: ignored legacy environment variable ${name}; configure jev-pilot.json instead.`,
    );
  }
  if (warnedGlobalSettings) return;
  try {
    const settings: unknown = JSON.parse(
      readFileSync(join(getAgentDir(), "settings.json"), "utf8"),
    );
    if (settings && typeof settings === "object" && Object.hasOwn(settings, "jevPilot")) {
      warnedGlobalSettings = true;
      console.warn("Jev: ignored global settings.json jevPilot; configure jev-pilot.json instead.");
    }
  } catch {
    // Settings are not a configuration source; unreadable or malformed settings do not change validation.
  }
}
const RESERVED_NAMES = new Set(
  "effort raise subagents skills strategy quality design model pet all reset status mode models crew junior reviewer tune remove delete on off help list default set when".split(
    " ",
  ),
);

export function jevConfigPath(): string {
  return join(getAgentDir(), "jev-pilot.json");
}

/** One boundary read; errors contain paths and requirements, never supplied values. */
export function loadJevConfig(): JevConfig {
  const file = jevConfigPath();
  let raw: unknown = {};
  let text: string | undefined;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error(`Cannot read ${file}: expected a readable configuration file.`);
  }
  if (text !== undefined) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error(
        `Invalid ${file}: expected valid JSON. Use atomic file replacement when editing.`,
      );
    }
  }
  const fail = (path: string, requirement: string): never => {
    throw new Error(`Invalid ${file} at ${path}: ${requirement}.`);
  };
  const object = (value: unknown, path: string): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return fail(path, "expected an object");
    return value as Record<string, unknown>;
  };
  const known = (value: Record<string, unknown>, keys: readonly string[], path: string) => {
    // Unknown names may themselves contain secrets; report their parent path only.
    if (Object.keys(value).some((key) => !keys.includes(key)))
      fail(path, "unknown field; remove unsupported fields");
  };
  const textField = (value: unknown, path: string): string => {
    if (typeof value !== "string" || !value.trim()) return fail(path, "expected nonblank text");
    return value;
  };
  const physical = (value: unknown, path: string): string => {
    const model = textField(value, path);
    if (!/^[^/\s]+\/\S+$/.test(model) || /:(off|minimal|low|medium|high|xhigh|max)$/.test(model))
      fail(path, "expected a qualified physical provider/model without effort suffix");
    return model;
  };
  const root = object(raw, "$root");
  known(
    root,
    [
      "schemaVersion",
      ...Object.keys(FLAGS),
      "workerToolThreshold",
      "designSkills",
      "classifier",
      "tiers",
      "crew",
    ],
    "$root",
  );
  if ("schemaVersion" in root && root.schemaVersion !== 1)
    fail("schemaVersion", "expected supported version 1");
  const flags = { ...FLAGS } as { -readonly [K in keyof typeof FLAGS]: boolean };
  for (const key of Object.keys(FLAGS) as (keyof typeof FLAGS)[]) {
    if (key in root) {
      if (typeof root[key] !== "boolean") fail(key, "expected a JSON boolean");
      flags[key] = root[key] as boolean;
    }
  }
  const workerToolThreshold = "workerToolThreshold" in root ? root.workerToolThreshold : 0.65;
  if (
    typeof workerToolThreshold !== "number" ||
    !Number.isFinite(workerToolThreshold) ||
    workerToolThreshold < 0 ||
    workerToolThreshold > 1
  )
    fail("workerToolThreshold", "expected a number between 0 and 1");
  const design = "designSkills" in root ? root.designSkills : DESIGN_SKILLS;
  if (!Array.isArray(design)) fail("designSkills", "expected an array of strings");
  const designSkills = [
    ...new Set(
      (design as unknown[])
        .map((name, index) => {
          if (typeof name !== "string") return fail(`designSkills[${index}]`, "expected text");
          return name.trim();
        })
        .filter(Boolean),
    ),
  ];
  const classifier = "classifier" in root ? object(root.classifier, "classifier") : {};
  known(classifier, ["url", "apiKeyEnv", "model", "timeoutMs"], "classifier");
  const url =
    "url" in classifier
      ? textField(classifier.url, "classifier.url")
      : "https://api.typesafe.ai/v1/systemone";
  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    return fail("classifier.url", "expected a valid HTTP(S) endpoint without embedded credentials");
  }
  if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password)
    fail("classifier.url", "expected a valid HTTP(S) endpoint without embedded credentials");
  const apiKeyEnv =
    "apiKeyEnv" in classifier
      ? textField(classifier.apiKeyEnv, "classifier.apiKeyEnv")
      : "TYPESAFE_API_KEY";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(apiKeyEnv))
    fail("classifier.apiKeyEnv", "expected a portable environment identifier");
  const model =
    "model" in classifier ? textField(classifier.model, "classifier.model") : "jev-latest";
  const timeoutMs = "timeoutMs" in classifier ? classifier.timeoutMs : 1500;
  if (typeof timeoutMs !== "number" || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    fail("classifier.timeoutMs", "expected a positive safe integer in milliseconds");
  const tierValues = "tiers" in root ? object(root.tiers, "tiers") : {};
  known(tierValues, TIER_ORDER, "tiers");
  const tiers: Partial<Record<Tier, string>> = {};
  for (const tier of TIER_ORDER) {
    if (!(tier in tierValues)) continue;
    const value = tierValues[tier];
    if (typeof value === "string" && !value.trim()) continue;
    tiers[tier] = physical(value, `tiers.${tier}`);
  }
  const crew = "crew" in root ? object(root.crew, "crew") : {};
  known(crew, ["mode", "slots", "junior"], "crew");
  const mode = "mode" in crew ? crew.mode : "standard";
  if (mode !== "standard" && mode !== "budget" && mode !== "junior-lead")
    fail("crew.mode", "expected standard, budget or junior-lead");
  const entries = "slots" in crew ? crew.slots : [];
  if (!Array.isArray(entries) || entries.length > 8)
    fail("crew.slots", "expected an array of at most eight active slots");
  const names = new Set<string>();
  const slots = (entries as unknown[]).map((entry, index) => {
    const path = `crew.slots[${index}]`;
    const slot = object(entry, path);
    known(slot, ["name", "model", "when"], path);
    const name = textField(slot.name, `${path}.name`);
    if (!/^[a-z][a-z0-9-]{0,23}$/.test(name) || RESERVED_NAMES.has(name) || names.has(name))
      fail(`${path}.name`, "expected a unique nonreserved lowercase slot name");
    names.add(name);
    const model = physical(slot.model, `${path}.model`);
    if ("when" in slot && typeof slot.when !== "string") fail(`${path}.when`, "expected text");
    return Object.freeze({
      name,
      model,
      when: (slot.when as string | undefined)?.trim() || DEFAULT_SLOT_WHEN,
    });
  });
  if ("junior" in crew && (typeof crew.junior !== "string" || !names.has(crew.junior)))
    fail("crew.junior", "expected the name of a configured slot");
  const frozenSlots = Object.freeze(slots);
  warnLegacyConfig(apiKeyEnv);
  return Object.freeze({
    schemaVersion: 1,
    ...flags,
    workerToolThreshold: workerToolThreshold as number,
    designSkills: Object.freeze(designSkills),
    classifier: Object.freeze({ url, apiKeyEnv, model, timeoutMs: timeoutMs as number }),
    tiers: Object.freeze(tiers),
    crew: Object.freeze({
      mode: mode as JevConfig["crew"]["mode"],
      slots: frozenSlots,
      offered: mode === "standard" ? Object.freeze([]) : frozenSlots,
      junior:
        mode === "junior-lead"
          ? (slots.find((slot) => slot.name === crew.junior) ?? slots[0])
          : undefined,
    }),
  });
}
