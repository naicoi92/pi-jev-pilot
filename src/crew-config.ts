// Crew policy adapted from Jev Pilot 0.12.1 hooks/crew.ts; see NOTICE.md.
import { loadJevConfig } from "./jev-config.ts";
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
export function crewConfig(_cwd: string): Crew {
  const crew = loadJevConfig().crew;
  return { ...crew, slots: [...crew.slots], offered: [...crew.offered] };
}
