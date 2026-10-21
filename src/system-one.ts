// Effort and risk questions adapted from pinned Jev Pilot; see NOTICE.md.
import { EFFORT_ORDER, type EffortDecision } from "./effort-policy.ts";

export interface SystemOneConfig {
  url: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
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

export type Classification =
  | { outcome: "classified"; decision: EffortDecision }
  | { outcome: "timeout" | "service-error" | "schema-error" };

/** Deadline cancels transport; parent cancellation rejects and is never fail-open. */
export async function classify(
  config: SystemOneConfig,
  state: unknown,
  signal: AbortSignal,
): Promise<Classification> {
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
      body: JSON.stringify({ model: config.model, state, questions }),
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
    const decision = readDecision(value);
    return decision ? { outcome: "classified", decision } : { outcome: "schema-error" };
  } catch (error) {
    if (signal.aborted) throw error;
    return { outcome: timedOut ? "timeout" : "service-error" };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
