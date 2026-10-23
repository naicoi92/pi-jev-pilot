// Crew policy adapted from Jev Pilot 0.12.1 hooks/crew.ts; see NOTICE.md.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
export interface Slot {
  name: string;
  model: string;
  when: string;
}
export interface Crew {
  mode: "standard" | "budget" | "junior-lead";
  slots: Slot[];
  offered: Slot[];
  junior?: Slot;
}
export const DEFAULT_SLOT_WHEN =
  "Choose for read-only bulk work where cost matters more than precision: searching or reading across many files and reporting what is there, summarizing logs or test output, listing. Never for writing or changing code.";
export function crewConfig(cwd: string): Crew {
  const path = process.env.JEV_CREW_CONFIG;
  if (!path) return { mode: "standard", slots: [], offered: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resolve(cwd, path), "utf8"));
  } catch (error) {
    throw new Error(
      `Cannot read JEV_CREW_CONFIG ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const fail = (message: string): never => {
    throw new Error(`Invalid JEV_CREW_CONFIG: ${message}`);
  };
  const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value);
  if (!record(raw)) return fail("expected an object");
  if (Object.keys(raw).some((key) => !["mode", "slots", "junior"].includes(key)))
    return fail("unknown field");
  const mode = raw.mode === undefined ? "standard" : raw.mode;
  if (mode !== "standard" && mode !== "budget" && mode !== "junior-lead")
    return fail("mode must be standard, budget or junior-lead");
  const entries = raw.slots === undefined ? [] : raw.slots;
  if (!Array.isArray(entries) || entries.length > 8)
    return fail("slots must be an array of at most eight active slots");
  const reserved = new Set(
    "effort raise subagents skills strategy quality design model pet all reset status mode models crew junior reviewer tune remove delete on off help list default set when".split(
      " ",
    ),
  );
  const names = new Set<string>();
  const slots: Slot[] = entries.map((entry) => {
    if (
      !record(entry) ||
      Object.keys(entry).some((key) => !["name", "model", "when"].includes(key))
    )
      return fail("slot requires name/model/optional when only");
    const { name, model, when } = entry;
    if (
      typeof name !== "string" ||
      !/^[a-z][a-z0-9-]{0,23}$/.test(name) ||
      reserved.has(name) ||
      names.has(name)
    )
      return fail("invalid, reserved or duplicate slot name");
    if (
      typeof model !== "string" ||
      !/^[^/\s]+\/\S+$/.test(model) ||
      /:(off|minimal|low|medium|high|xhigh|max)$/.test(model)
    )
      return fail("slot model must be a qualified physical provider/model without effort suffix");
    if (when !== undefined && typeof when !== "string") return fail("slot when must be text");
    names.add(name);
    return { name, model, when: (when as string | undefined)?.trim() || DEFAULT_SLOT_WHEN };
  });
  if (raw.junior !== undefined && (typeof raw.junior !== "string" || !names.has(raw.junior)))
    return fail("junior must name a configured slot");
  return {
    mode,
    slots,
    offered: mode === "standard" ? [] : slots,
    junior:
      mode === "junior-lead"
        ? (slots.find((slot) => slot.name === raw.junior) ?? slots[0])
        : undefined,
  };
}
