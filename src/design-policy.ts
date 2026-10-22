// Adapted from pinned Jev Pilot skill-suggestion.policy.ts; see NOTICE.md.
export const DESIGN_QUESTION = {
  type: "noul",
  instructions:
    "The request is to design, build or restyle something people see: a page, screen, component, layout, flow or visual style, for web or mobile, where how it looks and feels matters.",
  criteria: {
    true: "Visual or interaction design work: a landing page, a dashboard, a settings screen, a component, a redesign, a mobile screen or onboarding flow, styling, animation.",
    false:
      "No visible design involved: backend, data, tests, scripts, a bug in logic, docs, a question, or a UI change that is purely wiring (renaming a prop, fixing a handler).",
  },
};

export function readDesign(value: unknown): number | null {
  if (!value || typeof value !== "object" || !("answers" in value)) return null;
  const answers = value.answers;
  if (!answers || typeof answers !== "object" || !("ui_design" in answers)) return null;
  const answer = answers.ui_design;
  if (!answer || typeof answer !== "object") return null;
  const score =
    "noul" in answer && typeof answer.noul === "number"
      ? answer.noul
      : "probability" in answer
        ? answer.probability
        : null;
  return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1
    ? score
    : null;
}

export function designBlock(
  score: number | null | undefined,
  configured: readonly string[],
  installed: readonly { name: string; filePath: string }[],
  tools: readonly string[],
): string | null {
  if (score === null || score === undefined || score < 0.8) return null;
  const skills = configured.flatMap((want) => {
    const hit =
      installed.find((skill) => skill.name === want) ??
      installed.find((skill) => skill.name.endsWith(`:${want}`));
    return hit ? [hit] : [];
  });
  const guidelines = skills.filter((skill) => skill.name.endsWith("web-design-guidelines"));
  const craft = skills.filter((skill) => !guidelines.includes(skill));
  const reference = (skill: { name: string; filePath: string }) =>
    `/${skill.name}${tools.includes("read") ? ` (read ${JSON.stringify(skill.filePath)})` : ""}`;
  const lines = [
    "<jev_design>",
    "This is UI design work. The user wants it done with their design toolkit:",
  ];
  if (craft.length)
    lines.push(
      `- ${tools.includes("read") ? "Load" : "Installed resources:"} ${craft.map(reference).join(" and ")} for the direction and the polish.`,
    );
  if (guidelines.length)
    lines.push(
      `- Before calling it done, check it against ${reference(guidelines[0]!)} (on mobile, also the platform's own conventions).`,
    );
  const libraries = (
    [
      ["Mobbin", "mcp__mobbin__", "real app screens and flows"],
      ["Inspo", "mcp__inspo__", "real websites"],
    ] as const
  ).flatMap(([name, prefix, purpose]) => {
    const active = tools.filter((tool) => tool.startsWith(prefix));
    return active.length
      ? [
          `the ${name} MCP for ${purpose} (active tools: ${active.join(", ")}; consult their available schemas)`,
        ]
      : [];
  });
  lines.push(
    `- Direction: follow the project's design system or tokens if it has them. Otherwise take one from a real product: a DESIGN.md from awesome-design-md (https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<site>/DESIGN.md, sites such as linear.app, stripe, vercel, notion, apple, airbnb, spotify, raycast, cursor, supabase; all of them at https://github.com/VoltAgent/awesome-design-md/tree/main/design-md)${libraries.length ? `, or ${libraries.join(" and ")}` : ""}.`,
    "</jev_design>",
  );
  return lines.join("\n");
}
