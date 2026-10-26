import { expect, test } from "bun:test";
import { selectEffort, type EffortDecision, type Effort } from "../src/effort-policy.ts";

// AE-1: recorded normalized incident decisions; raw choices were not captured.
// Expected outcomes follow the approved authoritative-effort contract, not confidence gates.
test("POLICY-AE-1 recorded .44 confidence assessment selects high", () => {
  expect(
    selectEffort(
      {
        effort: 2.4800000000000004,
        effortConfidence: 0.44,
        effortProbabilities: { "0": 0.02, "1": 0.05, "2": 0.37, "3": 0.55, "4": 0.01 },
        risky: 0.37,
      },
      "medium",
      "Review the complete change and verify the requested behavior before reporting results",
    ),
  ).toBe("high");
});

test("POLICY-AE-1 recorded short option assessment selects low", () => {
  expect(
    selectEffort(
      {
        effort: 0.06,
        effortConfidence: 0.94,
        effortProbabilities: { "0": 0.95, "1": 0.04, "2": 0.01, "3": 0, "4": 0 },
        risky: 0.12,
      },
      "medium",
      "option 1",
    ),
  ).toBe("low");
});

// AC-03 / POLICY-03: historical upstream example, also valid under AE-2.
test("POLICY-03 raises medium to high at the upstream high-confidence bar", () => {
  expect(
    selectEffort(
      { effort: 2, effortConfidence: 0.5, risky: 0 },
      "medium",
      "Please review the complete patch with particular care for failure modes",
    ),
  ).toBe("high");
});

// AE-2 confidence/short-input cases supersede old AC-03 vetoes; AE-5 retains risk/ceiling.
// Normalization literals remain pinned route()/effortScoreOf() examples.
const cases: {
  name: string;
  decision: EffortDecision;
  current: string;
  prompt?: string;
  expected: Effort | null;
}[] = [
  {
    name: "accepts a high upgrade below the old confidence bar",
    decision: { effort: 2, effortConfidence: 0.49, risky: 0 },
    current: "medium",
    expected: "high",
  },
  {
    name: "upgrades low to medium at .3",
    decision: { effort: 1, effortConfidence: 0.3, risky: 0 },
    current: "low",
    expected: "medium",
  },
  {
    name: "accepts a medium upgrade below the old confidence bar",
    decision: { effort: 1, effortConfidence: 0.29, risky: 0 },
    current: "low",
    expected: "medium",
  },
  {
    name: "accepts a downgrade below the old confidence bar",
    decision: { effort: 0, effortConfidence: 0.59, risky: 0 },
    current: "high",
    expected: "low",
  },
  {
    name: "allows a downgrade at .6",
    decision: { effort: 0, effortConfidence: 0.6, risky: 0 },
    current: "high",
    expected: "low",
  },
  {
    name: "applies a fresh low assessment to a short approval",
    decision: { effort: 0, effortConfidence: 0.99, risky: 0 },
    current: "high",
    prompt: "yes",
    expected: "low",
  },
  {
    name: "allows lowering a short question",
    decision: { effort: 0, effortConfidence: 0.99, risky: 0 },
    current: "high",
    prompt: "what is this?",
    expected: "low",
  },
  {
    name: "allows lowering a Chinese question",
    decision: { effort: 0, effortConfidence: 0.99, risky: 0 },
    current: "high",
    prompt: "这是什么",
    expected: "low",
  },
  {
    name: "risk above .7 bypasses confidence",
    decision: { effort: 0, effortConfidence: 0.01, risky: 0.71 },
    current: "low",
    expected: "high",
  },
  {
    name: "risk at .7 does not force high",
    decision: { effort: 0, effortConfidence: 0.01, risky: 0.7 },
    current: "low",
    expected: "low",
  },
  {
    name: "risk preserves an existing xhigh as successful selection",
    decision: { effort: 0, effortConfidence: 0.99, risky: 0.99 },
    current: "xhigh",
    expected: "xhigh",
  },
  {
    name: "does not cut a manually selected max above ceiling",
    decision: { effort: 0, effortConfidence: 0.99, risky: 0 },
    current: "max",
    expected: null,
  },
  {
    name: "caps max starts at xhigh",
    decision: { effort: 4, effortConfidence: 0.99, risky: 0 },
    current: "medium",
    expected: "xhigh",
  },
  {
    name: "missing confidence permits upgrades",
    decision: { effort: 2, effortConfidence: null, risky: 0 },
    current: "medium",
    expected: "high",
  },
  {
    name: "missing confidence permits downgrades",
    decision: { effort: 0, effortConfidence: null, risky: 0 },
    current: "high",
    expected: "low",
  },
  {
    name: "near tie leans from medium to high",
    decision: {
      effort: 1.4,
      effortConfidence: 0.55,
      risky: 0,
      effortProbabilities: { "1": 0.55, "2": 0.45 },
    },
    current: "medium",
    expected: "high",
  },
  {
    name: "very hard requires combined .6",
    decision: {
      effort: 3,
      effortConfidence: 0.55,
      risky: 0,
      effortProbabilities: { "2": 0.45, "3": 0.55 },
    },
    current: "medium",
    expected: "high",
  },
  {
    name: "combined .6 promotes high to xhigh",
    decision: {
      effort: 2,
      effortConfidence: 0.7,
      risky: 0,
      effortProbabilities: { "2": 0.4, "3": 0.3, "4": 0.3 },
    },
    current: "high",
    expected: "xhigh",
  },
  {
    name: "same-level zero-confidence assessment succeeds",
    decision: { effort: 1, effortConfidence: 0, risky: 0 },
    current: "medium",
    expected: "medium",
  },
  {
    name: "absent effort keeps current",
    decision: { effort: null, effortConfidence: null, risky: 0 },
    current: "medium",
    expected: null,
  },
];
for (const example of cases) {
  test(`POLICY-03 ${example.name}`, () => {
    expect(
      selectEffort(
        example.decision,
        example.current,
        example.prompt ??
          "Please carry out the complete task described with all the required verification steps",
      ),
    ).toBe(example.expected);
  });
}
