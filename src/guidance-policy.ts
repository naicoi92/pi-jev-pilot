// Advice policy adapted from Jev Pilot 0.12.1 model-router.policy.ts; see NOTICE.md.
export interface QualityReads {
  corrects?: number | null;
  underspecified?: number | null;
  sensitive?: number | null;
  bugfix?: number | null;
}
export const QUALITY_QUESTIONS = {
  corrects: {
    instructions:
      "The user's latest message tells the assistant that its previous answer or work was wrong, broken, incomplete, or not what was asked, and asks for it to be fixed or redone.",
    criteria: {
      true: "The message reports a problem with what the assistant just did or said: it doesn't work, it's wrong, it missed something, it's not what was asked, try again.",
      false:
        "The message approves, continues, asks something new, or gives a new task; or there was no previous answer.",
    },
  },
  underspecified: {
    instructions:
      "Before starting, the assistant would have to guess what the user wants, because the request can reasonably mean quite different things that lead to different code, and a wrong guess would waste the work. Details a capable engineer decides without asking (names, layout, sensible defaults, where to put a file) don't count.",
    criteria: {
      true: 'Vague or open-ended: what to build or how it should behave is not said, e.g. "make it better", "add caching", "add rate limiting" with no limits, keys or storage given.',
      false:
        'A concrete task an engineer could just do, filling small gaps with sensible defaults, e.g. "add a dark mode toggle to settings", "add a test for X", "rename A to B", "change the color to blue"; or a question, or an approval.',
    },
  },
  sensitive: {
    instructions:
      "The requested change is to code where a bug is costly: authentication or permissions, payments or money, stored data or migrations, security or secrets, concurrency, or an interface other code depends on.",
    criteria: {
      true: "Getting this change subtly wrong could lose data or money, let in the wrong user, leak something, or break other code.",
      false:
        "A mistake here would be visible and cheap to fix: styling, wording, a script, a test, docs, a small internal helper; or it is not a code change.",
    },
  },
  bugfix: {
    instructions:
      "The latest request asks to fix a bug: something behaves wrongly (an error, a crash, a failing test, a wrong result) and should be made to behave right.",
    criteria: {
      true: "Something works wrong and the user wants it to work right.",
      false:
        "A new feature, a change of behavior on purpose, a refactor, a question, docs, or an approval.",
    },
  },
};
export const QUALITY_BARS = { corrects: 0.7, underspecified: 0.85, sensitive: 0.8, bugfix: 0.8 };

export function qualityAdvice(decision: QualityReads): string | null {
  const lines: string[] = [];
  if ((decision.underspecified ?? 0) >= QUALITY_BARS.underspecified)
    lines.push(
      "- It leaves open what to build or how it should behave. Before writing code, ask the user one short question, or state in one line the assumption you're making and go on.",
    );
  if ((decision.bugfix ?? 0) >= QUALITY_BARS.bugfix)
    lines.push(
      "- It is likely a bug fix. If a test or command can reproduce it cheaply, use it as your check before and after the fix.",
    );
  if ((decision.sensitive ?? 0) >= QUALITY_BARS.sensitive)
    lines.push(
      "- It touches code where a bug is costly. Make sure a test covers the case you changed.",
    );
  return lines.length
    ? ["<jev_quality>", "Jev's read of this request:", ...lines, "</jev_quality>"].join("\n")
    : null;
}

export function guidanceEnabled(name: "STRATEGY" | "QUALITY" | "DESIGN"): boolean {
  const key = `JEV_${name}_ENABLED`;
  const value = process.env[key] ?? "true";
  if (value !== "true" && value !== "false")
    throw new Error(`Set ${key} to true or false (default: true).`);
  return value === "true";
}

export const STRATEGY_CRITERIA = {
  junior:
    "An easy coding change that is already well specified (which files, what behavior, a test or command that proves it): a cheaper junior model writes it, and the main conversation reviews the diff as the tech lead. Not for design, unclear bugs or risky changes.",
  direct:
    "The main conversation does it itself: a question, a lookup, a command, or a change to one or a few files. One job with one clear finish line. The right answer for most requests, including most follow-ups.",
  delegate:
    "One subagent on a cheaper model does a broad but mechanical part first (searching or reading across many files, a codebase sweep, bulk renames) and the main conversation acts on its short report.",
  parallel:
    "Fan out, then join: several independent pieces with no shared files or state (separate modules, services or investigations), each done by its own subagent at the same time, then combined in one place.",
  graph:
    "Work one conversation would lose track of: parts that depend on each other in waves, or distinct specialties that hand off (build, then an independent review, then fixes), with results fanning in to be checked. Only for large builds; most work, even big work, is direct or parallel.",
};
export type Strategy = keyof typeof STRATEGY_CRITERIA;
export interface StrategyRead {
  tier?: string;
  strategy?: Strategy | null;
  strategyConfidence?: number | null;
}
const STRATEGY_HOW = {
  junior:
    "Junior and lead. Hand the coding to the jev-pilot:junior subagent (a cheaper model) with a self-contained brief: the files to change, the exact behavior, and the command that proves it. Do not write the code yourself first. Then review its diff; rerun tests only if its report does not show them passing or its diff goes beyond the brief. If it falls short, send findings back once or fix small things yourself.",
  delegate:
    "Send the broad, mechanical part (searching or reading across many files) to one subagent with a self-contained brief and a request for a short report, then do the rest here. Keep small lookups here: a subagent costs a fresh context.",
  parallel:
    "Fan out, then join. Split the work into independent pieces that share no files, and start one subagent per piece in a single message, in the background, so they run at the same time. Give each a self-contained brief naming its files and how to check its piece. Then join here: read their reports, integrate, and run the tests once. Two pieces that touch the same file are one piece.",
  graph: [
    "Split the work into nodes, one subagent per independent part (a step you could do inline is not a node).",
    "Nodes with no dependency between them start together, in one message, in the background; a dependent wave starts after its inputs join here.",
    "Keep a plan file only if there are more than two waves. After the final join, one read-only reviewer checks the result against the tests; a failed node is redone alone.",
    "At most 4 subagents at a time. If it cannot be explained in one breath, work directly.",
  ].join("\n"),
};
export function strategyAdvice(
  decision: StrategyRead & { risky?: number | null },
  customWorkflowModels = false,
): string | null {
  const strategy = decision.strategy;
  if (!strategy || strategy === "direct" || decision.strategyConfidence == null) return null;
  if (decision.strategyConfidence < (strategy === "graph" ? 0.8 : 0.6)) return null;
  if (strategy === "junior" && (decision.tier === "deep" || (decision.risky ?? 0) > 0.5))
    return null;
  if (strategy === "graph" && decision.tier !== "deep") return null;
  if (strategy === "parallel" && decision.tier === "fast") return null;
  return [
    "<execution_strategy>",
    `A fast decision model read this request as best carried out as: ${strategy}.`,
    STRATEGY_HOW[strategy],
    "It saw only the request and a few recent messages, not the code. If the actual work does not fit, ignore this and work directly.",
    "This is advice, not execution authority. User and project delegation restrictions take precedence; use only permitted tools and workers.",
    ...(customWorkflowModels
      ? []
      : [
          "Workflow-script inner agents are not transparently intercepted. If a permitted workflow requires model selection, choose its configured fast model for searching, reading and reporting, balanced for ordinary well-specified work, and the workflow default for judgment-heavy work. Respect explicit user model choices.",
        ]),
    "</execution_strategy>",
  ].join("\n");
}

/** The strategy that `strategyAdvice` actually advised, for compact presentation. */
export function advisedStrategy(
  decision: StrategyRead & { risky?: number | null },
  customWorkflowModels = false,
): Strategy | undefined {
  return strategyAdvice(decision, customWorkflowModels)
    ? (decision.strategy ?? undefined)
    : undefined;
}

/** Per-request observation only; no instruction parsing, dispatch or effort writes. */
export function observeLoop(
  tool: string,
  input: Record<string, unknown>,
  failed: boolean,
  edits: Map<string, number>,
  runs: Map<string, number>,
): string | null {
  if ((tool === "edit" || tool === "write") && typeof input.path === "string") {
    const count = (edits.get(input.path) ?? 0) + 1;
    edits.set(input.path, count);
    if (count === 4)
      return `the same file (${input.path.split("/").pop()}) was edited ${count} times in this turn`;
  }
  if (tool === "bash" && typeof input.command === "string") {
    const command = input.command.trim().replace(/\s+/g, " ");
    if (!failed) {
      runs.delete(command);
      return null;
    }
    const count = (runs.get(command) ?? 0) + 1;
    runs.set(command, count);
    if (count === 3)
      return `the same command (${command.slice(0, 60)}) failed ${count} times in this turn`;
  }
  return null;
}
export function stepBackNote(circle: string): string {
  return `[jev-pilot] This turn may be going in circles: ${circle}. Reconsider the cause from the latest error already above; if the last fixes didn't work, try a different approach rather than a variant.`;
}
