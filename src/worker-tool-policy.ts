import type { WorkerToolMetadata } from "pi-subagents/worker-decision-authority";

/** `*` is the only wildcard, matching the executor's `excludeTools` and `tools` semantics. */
export function toolNameMatcher(
  patterns: readonly string[] | undefined,
): (name: string) => boolean {
  const cleaned = [...new Set((patterns ?? []).map((pattern) => pattern.trim()).filter(Boolean))];
  const expressions = cleaned.map(
    (pattern) =>
      new RegExp(
        `^${pattern
          .split("*")
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join(".*")}$`,
      ),
  );
  return (name) => expressions.some((expression) => expression.test(name));
}

export interface WorkerToolPolicyResult<T extends WorkerToolMetadata> {
  /** Declared by the agent in `tools`: always granted, never put to the classifier. */
  readonly declared: readonly T[];
  /** Declared in `excludeTools`: always withheld, never put to the classifier. */
  readonly excluded: readonly T[];
  /** Everything else: default-allow unless the classifier flags it. */
  readonly open: readonly T[];
}

/**
 * The agent file is the contract. `excludeTools` always wins; `tools` always grants; only what the
 * agent says nothing about is left to assessment.
 */
export function applyAgentToolPolicy<T extends WorkerToolMetadata>(
  tools: readonly T[],
  agent:
    | { readonly tools?: readonly string[]; readonly excludeTools?: readonly string[] }
    | undefined,
): WorkerToolPolicyResult<T> {
  const isExcluded = toolNameMatcher(agent?.excludeTools);
  const isDeclared = toolNameMatcher(agent?.tools);
  const declared: T[] = [];
  const excluded: T[] = [];
  const open: T[] = [];
  for (const tool of tools) {
    if (isExcluded(tool.name)) excluded.push(tool);
    else if (isDeclared(tool.name)) declared.push(tool);
    else open.push(tool);
  }
  return { declared, excluded, open };
}
