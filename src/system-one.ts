// Effort and risk questions adapted from pinned Jev Pilot; see NOTICE.md.
import { EFFORT_ORDER, type EffortDecision } from "./effort-policy.ts";
import { TIER_ORDER, type Tier } from "./tier-policy.ts";

import {
  QUALITY_QUESTIONS,
  type QualityReads,
  type StrategyRead,
  STRATEGY_CRITERIA,
} from "./guidance-policy.ts";

export interface Decision extends EffortDecision, QualityReads, StrategyRead {
  tier?: Tier;
  confidence?: number | null;
}
export interface DecisionQuestions {
  tier: boolean;
  effort: boolean;
  quality?: boolean;
  strategy?: boolean;
}

export function mainRoutingEnabled(): boolean {
  const value = process.env.JEV_MAIN_ROUTING_ENABLED ?? "false";
  if (value !== "true" && value !== "false")
    throw new Error("Set JEV_MAIN_ROUTING_ENABLED to true or false (default: false).");
  return value === "true";
}

export interface SystemOneConfig {
  url: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export function effortEnabled(): boolean {
  const value = process.env.JEV_EFFORT_ENABLED ?? "true";
  if (value !== "true" && value !== "false")
    throw new Error("Set JEV_EFFORT_ENABLED to true or false (default: true).");
  return value === "true";
}

export function systemOneConfig(): SystemOneConfig {
  const url = process.env.JEV_SYSTEM_ONE_URL ?? "https://api.typesafe.ai/v1/systemone";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Set JEV_SYSTEM_ONE_URL to a valid HTTP(S) System One endpoint.");
  }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error(
      "Set JEV_SYSTEM_ONE_URL to an HTTP(S) System One endpoint without embedded credentials.",
    );
  const apiKey = process.env.JEV_SYSTEM_ONE_API_KEY ?? process.env.TYPESAFE_API_KEY ?? "";
  if (!apiKey.trim())
    throw new Error("Set JEV_SYSTEM_ONE_API_KEY (or TYPESAFE_API_KEY) for System One.");
  const model = process.env.JEV_SYSTEM_ONE_MODEL ?? "jev-latest";
  if (!model.trim())
    throw new Error("Set JEV_SYSTEM_ONE_MODEL to a decision model ID (default: jev-latest).");
  const timeoutMs = Number(process.env.JEV_TIMEOUT_MS ?? 1500);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new Error("Set JEV_TIMEOUT_MS to a positive integer in milliseconds (default: 1500).");
  return { url, apiKey, model, timeoutMs };
}

const rubric = [
  "Answered from what is already known, or mechanical work with nothing to work out: a lookup, a single command, a rename or find-and-replace (even across many files), a search that lists what it finds, formatting, a one-line change.",
  "An ordinary, well-specified change to one or a few files, or a direct question about code already in view.",
  "A change across several files that needs working out, a bug whose cause is described but has to be traced, writing tests, or reviewing a diff with care.",
  "Design across several components, a bug whose cause is unknown, a refactor with many dependents, or careful reasoning about concurrency, performance or failure modes.",
  "Novel architecture, a security or data-integrity question, a failure that resisted earlier attempts, or work where a subtle mistake is costly and hard to undo.",
];

const questions = {
  effort: {
    type: "choice",
    instructions:
      'How much step-by-step reasoning does the work this request asks for need? Rate the work, not how important the topic sounds: a question or advice answered in words, even about architecture or security, is low or medium, and reviewing a small diff is medium. A short reply that approves, continues or picks an option ("go ahead", "fix all and continue", "1") takes the size of the work it approves, from the recent conversation.',
    criteria: Object.fromEntries(EFFORT_ORDER.map((level, index) => [level, rubric[index]])),
  },
  risky: {
    type: "noul",
    instructions:
      "Carrying out this task would itself change production, move real money, or alter data that cannot be restored. Writing or testing code that deals with such things, without running it against the real system, does not count.",
    criteria: {
      true: "Doing the task runs something against a real system with lasting effect: deploying or releasing, changing production data or configuration, moving money, deleting or overwriting data with no backup, or rewriting shared history (force-push).",
      false:
        "Reading, explaining, planning, or writing and testing code locally, even code that deals with production, payments or data, without running it against the real system.",
    },
  },
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function probability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Reject malformed values before they can change the current effort. */
function readDecision(value: unknown): EffortDecision | null {
  const answers = object(object(value)?.answers);
  const effort = object(answers?.effort);
  const risk = object(answers?.risky);
  if (!answers || !effort || !risk) return null;
  const risky = risk.noul ?? risk.probability;
  if (!probability(risky)) return null;
  if (effort.confidence !== undefined && !probability(effort.confidence)) return null;
  const raw = effort.probabilities;
  let probabilities: Record<string, number> | null = null;
  if (raw !== undefined) {
    const distribution = object(raw);
    if (
      !distribution ||
      !Object.keys(distribution).length ||
      Object.values(distribution).some((value) => !probability(value))
    )
      return null;
    const named = EFFORT_ORDER.some((level) => level in distribution);
    const keys = named ? [...EFFORT_ORDER] : ["0", "1", "2", "3", "4"];
    if (Object.keys(distribution).some((key) => !keys.includes(key))) return null;
    probabilities = Object.fromEntries(
      keys.map((key, index) => [String(index), distribution[key] ?? 0]),
    ) as Record<string, number>;
    const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > 0.02) return null;
  }
  const choice = EFFORT_ORDER.indexOf(effort.choice as (typeof EFFORT_ORDER)[number]);
  const score = effort.score;
  if (
    !probabilities &&
    choice === -1 &&
    !(typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 4)
  )
    return null;
  const confidence = effort.confidence as number | undefined;
  return {
    effort: probabilities
      ? Object.entries(probabilities).reduce(
          (sum, [level, value]) => sum + Number(level) * value,
          0,
        )
      : choice !== -1
        ? choice
        : (score as number),
    effortConfidence:
      confidence ?? (probabilities ? Math.max(...Object.values(probabilities)) : null),
    effortProbabilities: probabilities,
    risky,
  };
}

const tierQuestion = {
  type: "choice",
  instructions: "Which is the cheapest tier that can complete this coding task well?",
  criteria: {
    fast: "Haiku. Choose for read-only lookups where a mistake is cheap to spot: search or list files, find where something is defined, read files, logs or test output and report what is there, run a command and report the result. Nothing is written or changed.",
    balanced:
      "Sonnet. Choose for read-only work that needs some understanding (summarize or explain code, research across many files, review a diff and report the findings), and for code changes with a clear spec and a way to check the result: the brief says what to change and a test, build or type check shows it works, such as a bug fix whose cause is known, a feature to a written spec, tests for existing code, or a scoped refactor.",
    deep: "Opus. Choose for work that needs careful judgment or runs long: design, a change whose spec is open or that nothing can check, a bug whose cause is unknown, long multi-step work across many components, security, data migrations, production or money.",
  },
};

function readAnswers(value: unknown, enabled: DecisionQuestions): Decision | null {
  const answers = object(object(value)?.answers);
  const risk = object(answers?.risky);
  const risky = enabled.tier || enabled.effort ? (risk?.noul ?? risk?.probability) : null;
  if ((enabled.tier || enabled.effort) && !probability(risky)) return null;
  const decision: Decision | null = enabled.effort
    ? readDecision(value)
    : { effort: null, effortConfidence: null, risky: risky as number | null };
  if (!decision) return null;
  if (enabled.tier || enabled.strategy) {
    const tier = object(answers?.tier);
    if (!tier || !TIER_ORDER.includes(tier.choice as Tier)) return null;
    if (tier.confidence !== undefined && !probability(tier.confidence)) return null;
    const distribution = tier.probabilities === undefined ? null : object(tier.probabilities);
    if (
      tier.probabilities !== undefined &&
      (!distribution ||
        !Object.keys(distribution).length ||
        Object.entries(distribution).some(
          ([key, value]) => !TIER_ORDER.includes(key as Tier) || !probability(value),
        ) ||
        Math.abs(
          Object.values(distribution).reduce<number>((sum, value) => sum + (value as number), 0) -
            1,
        ) > 0.02)
    )
      return null;
    decision.tier = tier.choice as Tier;
    decision.confidence =
      (tier.confidence as number | undefined) ??
      (distribution ? Math.max(...(Object.values(distribution) as number[])) : null);
  }
  if (enabled.strategy) {
    const strategy = object(answers?.strategy);
    if (
      strategy &&
      typeof strategy.choice === "string" &&
      Object.hasOwn(STRATEGY_CRITERIA, strategy.choice)
    ) {
      const raw = strategy.probabilities;
      const distribution = raw === undefined ? null : object(raw);
      const valid = strategy.confidence === undefined || probability(strategy.confidence);
      const validDistribution =
        raw === undefined ||
        (distribution &&
          Object.keys(distribution).length > 0 &&
          Object.entries(distribution).every(
            ([key, value]) => Object.hasOwn(STRATEGY_CRITERIA, key) && probability(value),
          ));
      if (valid && validDistribution) {
        decision.strategy = strategy.choice as NonNullable<StrategyRead["strategy"]>;
        decision.strategyConfidence =
          (strategy.confidence as number | undefined) ??
          (distribution ? Math.max(...(Object.values(distribution) as number[])) : null);
      }
    }
  }
  if (enabled.quality) {
    for (const name of Object.keys(QUALITY_QUESTIONS) as (keyof QualityReads)[]) {
      const answer = object(answers?.[name]);
      const value = answer?.noul ?? answer?.probability;
      if (probability(value)) decision[name] = value;
    }
  }
  return decision;
}

export type Classification =
  | { outcome: "classified"; decision: Decision; value?: unknown }
  | { outcome: "timeout" | "service-error" | "schema-error" };

/** Deadline cancels transport; parent cancellation rejects and is never fail-open. */
export async function classify(
  config: SystemOneConfig,
  state: unknown,
  signal: AbortSignal,
  enabled: DecisionQuestions = { tier: false, effort: true },
  additionalQuestions: Record<string, unknown> = {},
): Promise<Classification> {
  if (
    !enabled.tier &&
    !enabled.effort &&
    !enabled.strategy &&
    !enabled.quality &&
    !Object.keys(additionalQuestions).length
  )
    throw new Error("No applicable Jev questions.");
  const asked = {
    ...(enabled.tier || enabled.strategy ? { tier: tierQuestion } : {}),
    ...(enabled.strategy
      ? {
          strategy: {
            type: "choice",
            instructions:
              "How should a coding assistant carry out the latest request, given the recent conversation? Prefer the simplest way that does it well.",
            criteria: STRATEGY_CRITERIA,
          },
        }
      : {}),
    ...(enabled.quality
      ? Object.fromEntries(
          Object.entries(QUALITY_QUESTIONS).map(([name, question]) => [
            name,
            { type: "noul", ...question },
          ]),
        )
      : {}),
    ...(enabled.effort ? { effort: questions.effort } : {}),
    ...(enabled.tier || enabled.effort ? { risky: questions.risky } : {}),
    ...additionalQuestions,
  };
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeoutMs);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, state, questions: asked }),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      return { outcome: "service-error" };
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      return { outcome: "schema-error" };
    }
    const decision = readAnswers(value, enabled);
    return decision ? { outcome: "classified", decision, value } : { outcome: "schema-error" };
  } catch (error) {
    if (signal.aborted) throw error;
    return { outcome: timedOut ? "timeout" : "service-error" };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
