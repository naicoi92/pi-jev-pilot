/** Counts only: tool identities and paths never cross into presentation. */
export interface WorkerToolReasons {
  /** Scored at or above the reject threshold. */
  readonly danger: number;
  /** Classifier returned no usable score, so the tool was withheld. */
  readonly invalid: number;
  /** Never offered to the classifier: no file-backed identity, caller-supplied, MCP, codemode or models. */
  readonly ineligible: number;
}

export interface WorkerToolCounts {
  readonly selected: number;
  readonly rejected: number;
  readonly reasons: WorkerToolReasons;
}

const REASON_ORDER = ["danger", "invalid", "ineligible"] as const;

export function isWorkerToolCounts(value: unknown): value is WorkerToolCounts {
  const count = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (!value || typeof value !== "object") return false;
  const { selected, rejected, reasons } = value as Record<string, unknown>;
  if (!count(selected) || !count(rejected) || !reasons || typeof reasons !== "object") return false;
  return REASON_ORDER.every((key) => count((reasons as Record<string, unknown>)[key]));
}

/** `+3 −5 (danger 2, ineligible 3)`: zero reasons are omitted. */
export function formatWorkerToolCounts(counts: WorkerToolCounts): string {
  const why = REASON_ORDER.filter((key) => counts.reasons[key] > 0).map(
    (key) => `${key} ${counts.reasons[key]}`,
  );
  return `tools +${counts.selected} −${counts.rejected}${why.length ? ` (${why.join(", ")})` : ""}`;
}

export function addWorkerToolCounts(items: readonly WorkerToolCounts[]): WorkerToolCounts {
  const sum = (pick: (item: WorkerToolCounts) => number) =>
    items.reduce((total, item) => total + pick(item), 0);
  return {
    selected: sum((item) => item.selected),
    rejected: sum((item) => item.rejected),
    reasons: {
      danger: sum((item) => item.reasons.danger),
      invalid: sum((item) => item.reasons.invalid),
      ineligible: sum((item) => item.reasons.ineligible),
    },
  };
}
