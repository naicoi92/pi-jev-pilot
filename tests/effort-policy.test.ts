import { expect, test } from "bun:test";
import {
  selectEffort,
  type EffortDecision,
  type Effort,
} from "../src/effort-policy.ts";

// AC-03 / POLICY-03: pinned route(): upgrade .3 and high confidence .5.
test("POLICY-03 raises medium to high at the upstream high-confidence bar", () => {
  expect(
    selectEffort(
      { effort: 2, effortConfidence: 0.5, risky: 0 },
      "medium",
      "Please review the complete patch with particular care for failure modes",
    ),
  ).toBe("high");
});

// All cases belong to AC-03; independent literals from pinned route()/effortScoreOf().
const cases: {
  name: string;
  decision: EffortDecision;
  current: string;
  prompt?: string;
  expected: Effort | null;
}[] = [
  {
    name: "rejects a high upgrade below .5",
    decision: { effort: 2, effortConfidence: 0.49, risky: 0 },
    current: "medium",
    expected: null,
  },
  {
    name: "upgrades low to medium at .3",
    decision: { effort: 1, effortConfidence: 0.3, risky: 0 },
    current: "low",
    expected: "medium",
  },
  {
    name: "rejects a medium upgrade below .3",
    decision: { effort: 1, effortConfidence: 0.29, risky: 0 },
    current: "low",
    expected: null,
  },
  {
    name: "rejects a downgrade below .6",
    decision: { effort: 0, effortConfidence: 0.59, risky: 0 },
    current: "high",
    expected: null,
  },
  {
    name: "allows a downgrade at .6",
    decision: { effort: 0, effortConfidence: 0.6, risky: 0 },
    current: "high",
    expected: "low",
  },
  {
    name: "does not lower a short approval",
    decision: { effort: 0, effortConfidence: 0.99, risky: 0 },
    current: "high",
    prompt: "yes",
    expected: null,
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
    name: "risk at .7 is not forced",
    decision: { effort: 0, effortConfidence: 0.01, risky: 0.7 },
    current: "low",
    expected: null,
  },
  {
    name: "risk never lowers an existing xhigh",
    decision: { effort: 0, effortConfidence: 0.99, risky: 0.99 },
    current: "xhigh",
    expected: null,
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
    name: "missing confidence forbids downgrades",
    decision: { effort: 0, effortConfidence: null, risky: 0 },
    current: "high",
    expected: null,
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
