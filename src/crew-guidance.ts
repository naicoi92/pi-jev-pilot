import type { Crew } from "./crew-config.ts";
/** Source-backed crew note; host model identities replace Claude router aliases. */
export function crewAdvice(crew: Crew, workflows: boolean): string | null {
  const lines: string[] = [];
  if (crew.mode !== "standard")
    lines.push(
      `The user chose ${crew.mode} mode: custom models take bulk work without judgment; the lead retains judgment.`,
    );
  if (workflows && crew.offered.length)
    lines.push(
      `Workflow-script inner agents are not transparently intercepted. For permitted bulk searching, reading and reporting, choose a configured custom physical model in the script (${crew.offered.map((slot) => `${slot.name}: ${slot.model}; ${slot.when}`).join(" | ")}) instead of fast. Keep balanced for specified implementation and the workflow default for judgment-heavy work.`,
    );
  if (crew.junior)
    lines.push(
      `jev-pilot:junior is a junior developer on ${crew.junior.model}. Give it easy, well-specified coding changes (the files, the exact behavior, the command that proves it); then read its diff. Rerun tests only if its report does not show them passing or its diff goes beyond the brief. If it falls short, send findings back once or fix small things yourself.`,
    );
  if (!lines.length) return null;
  return [
    "<jev_crew>",
    ...lines,
    "This is advice, not execution authority. User and project delegation restrictions take precedence. A slot description never grants writing permission.",
    "</jev_crew>",
  ].join("\n");
}
