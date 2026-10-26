Status: ready-for-agent
Implementation: completed

# Expert tier and sparse tier configuration

## Problem Statement

The operator can configure only three worker tiers (`fast`, `balanced`, `deep`), and every tier must be mapped to a model or worker routing fails. There is no tier for rare, exceptionally difficult architectural or advisory reasoning, and the operator cannot leave a tier unconfigured so that it never appears as a choice. An expensive expert model must stay rare (zero to three consultations per project is the planning target), so it must not be an ordinary tier that the classifier picks whenever a task is hard.

## Solution

Add a fourth tier, `expert`, above `deep`. Every tier is optional: a tier with no configured model is not offered to the classifier. `expert` is additionally gated. When expert is configured, the classification request carries a separate fixed question, `expert_needed`. The classifier's choice of `expert` is executed only when that answer is strictly greater than 0.9; otherwise routing falls back to `deep`. When expert is not configured, the request contains nothing expert-related and behaves like the corresponding non-expert request.

## User Stories

1. As an operator, I want to configure an `expert` tier in Pi settings, so that rare exceptionally hard architectural or advisory work can use a stronger model.
2. As an operator, I want to leave any tier unconfigured, so that I only pay for and offer the tiers I chose.
3. As an operator, I want an absent, empty or whitespace-only tier value treated as "not configured", so that clearing a value cleanly disables the tier.
4. As an operator, I want `null`, a non-string, or a malformed model identity to fail with an actionable message naming the setting, so that typos are not silently ignored.
5. As an operator, I want unconfigured tiers excluded from the classifier's choices, so that Jev never selects a tier I cannot run.
6. As an operator with no tier configured, I want ordinary worker launches to keep the worker's own model, so that routing is simply off for tiers.
7. As an operator, I want configured tiers and configured custom slots both offered together, so that slots no longer hide the `fast` tier.
8. As an operator, I want `expert` only executed when Jev's `expert_needed` answer is above 0.9, so that expert use stays rare.
9. As an operator, I want an answer of exactly 0.9 to fail the gate, so that the threshold is unambiguous.
10. As an operator, I want a rejected expert choice to run on `deep`, so that hard work still gets a strong model.
11. As an operator, I want a high `risky` answer to never select `expert` on its own, so that production-risk and reasoning difficulty stay separate.
12. As an operator, I want `risky` to keep meaning "carrying out the task changes real systems", so that its existing behavior is unchanged.
13. As an operator without an expert model, I want the classification request to contain no expert choice, no `expert_needed` question and the unchanged `deep` rubric, so that the disabled feature cannot influence Jev.
14. As an operator without an expert model, I want the response parser to never require an expert answer, so that valid responses are not rejected.
15. As an operator with an expert model, I want the `deep` and `expert` rubrics to distinguish ordinary difficult work from exceptional architectural or advisory reasoning, so that Jev nominates expert rarely.
16. As an operator, I want an agent's name such as architect or advisor to not grant expert eligibility, so that routing follows the requested work.
17. As an operator, I want a malformed classifier response treated as a schema error exactly as today, so that bad responses are not silently converted into a deep choice.
18. As an operator, I want the visible decision row to show the model actually selected, so that I can see when expert or the deep fallback was used.
19. As an operator, I want the `expert_needed` question to be a fixed rubric with no per-invocation advice, so that the factual-input rule for Jev stays intact.
20. As a maintainer, I want one availability snapshot to drive both request building and response validation, so that they cannot disagree.
21. As a maintainer, I want the attribution notice to record `expert` as an extension of the pinned upstream design, so that provenance stays accurate.

## Implementation Decisions

- **Tier order** becomes `fast → balanced → deep → expert`. Tier names are the single shared vocabulary for settings, rubrics and decisions.
- **Sparse configuration.** Each tier is optional in the `jevPilot.tiers` settings object. Absent key, empty string or whitespace-only string means not configured. `null`, non-string, or a value that is not a qualified `provider/model` identity is a configuration error that names the setting. Only applicable launches resolve tiers, as today. Existing physical-identity validation still applies to every configured model.
- **Availability snapshot.** Tier resolution produces the set of configured tiers once per classification. The same snapshot builds the request (tier choices and criteria) and validates the response (allowed choices, probability distributions). Advice and strategy-only response reads must use the snapshot and must not demand an expert answer.
- **Classifier choices.** Offered choices are every configured tier plus every offered custom slot. This replaces the current behavior in which custom slots displace `fast`. When no tier and no slot is configured, no tier question is sent and tier routing is skipped. Other questions (effort) are unaffected.
- **No tier configured.** Ordinary worker launches keep the retained baseline model; effort handling is unchanged. This matches the existing retained-baseline rule when policy withholds a change.
- **Expert rubric and deep rubric.** When expert is configured, the `expert` criterion describes rare, exceptionally difficult architectural or advisory reasoning to resolve a specific unresolved technical decision with tightly interacting constraints or conflicting evidence, expected to return a reusable diagnosis, decision or plan; the `deep` criterion is narrowed to ordinary difficult engineering judgment. When expert is not configured the existing `deep` criterion is sent unchanged. Role names are not mentioned as eligibility.
- **`expert_needed` question.** A fixed `noul` question sent in the same request only when expert is configured. Its true criteria describe a consequential decision that remains unresolved despite adequate constraints and evidence and that a normal deep-tier approach would materially fail to settle; its false criteria cover routine architecture, ordinary review, implementing a settled plan, formatting or saving Markdown, long tasks, security or production labels, and missing requirements or evidence. Wording is a fixed rubric with no per-invocation hints, consistent with the existing factual-input invariant.
- **Admission gate.** When the classifier's valid tier choice is `expert`, the expert model is used only if a valid `expert_needed` answer is strictly greater than 0.9 and existing applicable confidence and validation gates allow the change. The threshold is a conservative starting policy and not a calibrated value. Otherwise the decision proceeds as a `deep` choice.
- **Missing or invalid `expert_needed`.** Treated as not passing the gate (expert is not used). A structurally malformed overall response remains a schema error, unchanged.
- **Fallback when `deep` is not configured** *(operator-approved)*: after a failed gate, if there is no configured `deep` model, retain the baseline model. Expert is never used silently as a fallback.
- **Runtime fallback on unusable tier** *(operator-approved, pre-launch only)*: when the selected tier cannot be launched — invalid model identity, unresolvable physical model, missing auth, or preflight rejection — report the failure naming the tier and setting, then cascade to the next lower configured tier until one launches. Each fallback tier uses the highest effort level its model supports (via `clampThinkingLevel`, never hardcoded `max`, since support varies per model). Invalid settings values are still reported, not silently ignored. If no configured tier launches, retain the baseline model. Errors during the child run (rate limit, timeout, provider error) stay executor-surfaced and are NOT cascaded, because the adapter has no idempotent relaunch mechanism; this is an explicit limitation, not silent behavior.
- **Risk override** *(operator-approved)*: the existing high-risk override (risky above 0.7) continues to move work to `deep`; when `deep` is not configured it moves to the highest configured non-expert tier, and when none is configured it makes no change. The override never produces `expert`. It must not bypass or accidentally suppress the expert gate, so its ordering relative to the gate is covered by tests.
- **Custom slots** continue to be reported by the classifier as low-tier choices with the existing confidence rule; they are not covered by the expert gate and are not a spending guard.
- **Scope of protection.** The gate governs only Jev's automatic tier choice. Custom slots, explicit models, the retained default, workflows and forks may still reach the same physical model; this spec makes no global spending, token or quota guarantee.
- **Attribution.** The notice states that `expert` and its gate are extensions of the pinned upstream design.

## Testing Decisions

- A good test drives external behavior only: a subagent tool call against the worker adapter with a fake classification service, asserting the request sent to the service and the resulting selected model or configuration error. Tests do not assert internal function calls.
- **Single seam:** the existing worker-adapter test fixture (fake System One server, injected settings, tool-call hook). All behavior below is checked through it.
- Cases: all tiers absent keeps the baseline and sends no tier question; each tier individually absent, empty and whitespace is hidden; `null`, wrong type and malformed identity error with the setting named; slots plus tiers offered together; expert absent produces a request with no expert choice, no `expert_needed` and the unchanged deep rubric, and a response without an expert answer is accepted; expert present adds the choice, the question and the differentiated rubrics; `expert_needed` at 0.91 admits expert, at 0.9 falls back to deep, missing or invalid does not admit expert; high risk alone never selects expert; risk override ordering with the gate; malformed response stays a schema error; deep absent after a failed gate retains the baseline.
- Pure policy unit tests (tier selection, risk override) may be added where the adapter seam is awkward, following the existing tier and crew policy tests.
- Prior art: the worker-adapter, routing-settings, tier-policy and crew-policy tests.
- Real Pi behavior, if verified end to end, uses the existing deterministic CLI fixtures with no paid hosted requests.

## Out of Scope

- A decision packet or other new classifier state (evidence summary, investigation history); the classifier continues to see the existing task excerpt and agent fields.
- A new `expert-consultant` role or role-name based eligibility.
- Hard per-project quota, durable counters, global physical-model protection, alias canonicalization, or workflow and fork coverage.
- Token caps, tool or write restrictions, and Markdown artifact enforcement for the expert; these depend on executor and provider capabilities and need a separate spec.
- Choosing the expert model or its pricing.
- Changing the meaning of `risky`, main-model routing, or effort selection.
- Calibrating the 0.9 threshold.

## Further Notes

- Research and rationale: the rare expert routing research note in the research docs.
- Expert use frequency depends on classifier behavior. Before relying on rarity, evaluate representative briefs, including false-positive expert admissions, and consider recording how often expert is chosen and admitted.
