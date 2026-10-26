---
title: Rare expert routing
summary: Primary evidence and a proposal for rare automatic expert routing using exceptional architectural/advisory task criteria and a separate Jev eligibility question.
---

## Current recommendation awaiting approval

Let Jev select `expert` for **exceptionally difficult architectural or advisory reasoning**, not routine implementation. Add a separate `expert_needed` question to the same classification request. A valid expert tier choice must also pass a strict eligibility threshold before automatic expert routing is allowed.

```text
Configured expert model
AND valid tier choice = expert
AND valid expert_needed > 0.9
AND existing applicable validation/confidence gates allow the change
→ expert

Valid expert choice with insufficient expert eligibility
→ configured valid deep, subject to applicable routing gates
```

Exactly `0.9` does not qualify. The threshold is a conservative starting policy inspired by the operator's desired strictness, **not a calibrated probability, proven optimum, or project usage guarantee**. The two classifier answers come from the same model and are correlated; they are a conservative policy check, not independent verification.

**Status:** Research proposal only. The operator wants expert for complex, difficult work, usually architecture and advice, and does not want more preference questionnaires. No runtime, settings, spec, or tickets were changed. Earlier approval-per-call, mandatory-special-role, and `expert AND risky > 0.9` proposals are superseded as recommendations by this section; none was implemented.

Target **zero to three consultations per implementation project** as a soft planning guideline. Zero is normal. A real hard quota or spending guarantee would require separate admission and executor/provider controls.

## Expert-disabled isolation invariant

Resolve and validate effective tier settings before constructing classification questions. Treat expert as an opt-in capability, not a permanently present question whose answer is later ignored.

When expert is absent or an empty/whitespace string:

- Omit expert from tier criteria and omit the entire `expert_needed` question, instructions, and placeholders.
- Preserve the existing deep rubric; do not narrow deep to make room for a disabled expert tier.
- Do not require or interpret an expert eligibility answer. Validate confidence and probability distributions against the actual offered choices.
- Use the same resolved availability snapshot for request construction and response validation. Advice reparsing and strategy-only paths must not accidentally require an expert answer.

When expert has a valid model, enable the expert candidate, the differentiated deep/expert rubrics, and the extra eligibility question together for applicable routing. Explicit null, wrong type, or malformed identity remains a configuration error rather than silently disabling expert.

The expert-disabled request should match the corresponding non-expert path, apart from the separately requested sparse-tier/custom-slot changes. This is not a byte-for-byte whole-product compatibility promise. When expert is enabled, the extra question can intentionally influence classification and requires evaluation; do not claim otherwise.

Future checks must cover absent/empty expert producing no expert-related request fields, no expert-answer requirement, preservation of the old deep rubric, and coordinated question/gate activation when expert is configured. These are proposed invariants, not tests already run.

## Use the existing questions for different purposes

The current questions are in [`src/system-one.ts`](../../src/system-one.ts).

| Signal | Current meaning | Proposed relationship to expert |
| --- | --- | --- |
| Tier choice | Cheapest tier capable of doing the task well | Add a narrow expert rubric; retain deep for ordinary difficult judgment/design/debugging. |
| Worker effort | Amount and kind of reasoning needed to carry out the brief | Keep separate. `max` includes security/data-integrity and resistant failures, so it is not by itself an expert admission. Do not infer model tier directly from effort. |
| `risky` | Whether performing the task itself changes production, moves real money, or changes irrecoverable data | Preserve its meaning. It does not measure complexity or expert necessity. High risk cannot independently authorize expert. |
| Proposed `expert_needed` | Need for exceptional architectural/advisory reasoning beyond the normal deep tier | Require a valid score strictly above 0.9 when the tier choice is expert. This is a new semantic read, not a rename of risky or tier confidence. |

Read-only planning and local coding are explicitly on the false side of the existing risky question. Using `risky > 0.9` as the expert gate would exclude many of the architectural/advisory consultations the operator wants.

## Sharpen deep and expert rubrics

Avoid overlap that makes all design work appear expert-worthy. These are proposed task criteria, not final API schemas or model-family mappings.

- **Deep:** Difficult but ordinary engineering judgment: multi-component design with established patterns, unknown-cause debugging, concurrency/performance analysis, substantial refactoring, careful review, or implementation requiring reasoning. A long task or a sensitive topic does not make it expert work.
- **Expert:** Rare architectural or advisory consultation to resolve a specific, exceptionally difficult technical decision. Multiple tightly interacting constraints, genuinely conflicting technical evidence, or a resistant cross-subsystem problem make a normal deep-tier approach materially insufficient. The expected result is a reusable diagnosis, decision, critique, or plan, not an autonomous implementation subtree.

Architect/advisor is **task intent**, not automatic eligibility from a role name. Do not require a new agent role or hardcode name substrings such as `architect`, `advisor`, or `oracle` as proof of complexity. Resolved role information supplies context, not spending authority. Well-evidenced exceptional work may qualify without artificially requiring failed cheaper attempts first.

## Add one explicit eligibility question

Use the existing `noul` question pattern in the same request as tier, effort, and risk. Ask it only when expert is configured and applicable tier classification is being performed; do not add a second classification round trip.

**Proposed instructions:**

> Does this task require exceptional architectural or advisory reasoning beyond the normal deep tier to resolve a specific unresolved technical decision involving tightly interacting constraints or conflicting evidence? Judge the work actually requested and the supplied evidence, not the agent's title, task length, or topic importance.

**True criteria:** A concrete, consequential technical decision remains genuinely unresolved despite adequate constraints and evidence. The consultation must reconcile strongly coupled trade-offs, conflicting cross-subsystem evidence, or a blocker that resisted distinct, evidence-based investigations. A reusable decision, diagnosis, or plan is the requested outcome. An ordinary deep-tier analysis is materially insufficient.

**False criteria:** Routine architecture explanation or design using known patterns; ordinary review; implementing a settled plan; collecting evidence; formatting or saving Markdown; a long task; a security/production label; missing requirements; or lack of evidence. Merely being an architect/advisor role, having high effort/risk, or claiming that a task is difficult is not enough. If the supplied brief does not establish an exceptional reasoning need, do not endorse expert admission.

No claim is made that a classifier can prove a cheaper model would fail. This is a task-suitability judgment to evaluate on representative briefs.

## Supply enough state to support the question

Current worker state in [`src/worker-adapter.ts`](../../src/worker-adapter.ts) contains only `prompt: input.task.slice(0, 2000)`, `agentType: input.agent.slice(0, 128)`, and optional `description.slice(0, 512)`. It does not include evidence file contents, verified failure history, or a project consultation counter. Jev cannot reliably infer those facts from a role name.

Recommend a small decision packet, with exact transport and bounds to be specified later:

1. The specific decision/question requested and expected advisory output.
2. Relevant interacting constraints, alternatives, and unresolved trade-offs.
3. A bounded evidence summary and any distinct previous investigations with their outcomes, supplied by the parent. Treat these as reported context, not independently verified history.
4. Canonical resolved agent name and bounded role description where the public preflight contract actually supplies them. Keep unavailable fields unknown; do not invent a role description from a name.

Preserve these meaningful fields under truncation rather than relying solely on the first 2,000 characters of an arbitrary task. Avoid shipping the whole repository/session to the classifier. Missing evidence should normally mean cheaper investigation or clarification, not expert escalation. If no state improvement is made, the gate can only judge the existing excerpt and its reliability must be described accordingly.

## Keep routing fallbacks and availability explicit

- Preserve the requested order `fast → balanced → deep → expert`. A missing or empty/whitespace model hides its tier; null, wrong type, or malformed physical identity remains a configuration error. Zero configured tiers keeps the executor-selected worker model; it does not guarantee that model is inexpensive.
- Offer configured tiers plus eligible custom slots as classifier candidates. Expert remains a **candidate**, but a selected expert is executable only after the extra gate passes. This separates classifier availability from automatic admission without requiring a role-only choice list.
- Valid expert selection with eligibility at or below 0.9 proposes deep fallback, only when deep is configured and valid. The existing confidence and physical-model checks still apply. Behavior with no deep mapping remains a later spec decision; do not invent a model or silently spend on expert.
- Missing or malformed expert eligibility never authorizes expert. Do not turn a schema-invalid classifier response into a valid deep selection: preserve the existing schema-error/fail-open behavior unless a separate contract is approved. Handling question-local missing values versus a malformed whole response must be specified and tested.
- A high-risk non-expert choice cannot promote to expert. The current `risky > 0.7 → deep` override must not bypass or accidentally suppress an already-admitted expert decision; its ordering with the new gate needs explicit tests. Risk remains independent from authorization for real-system actions.
- A custom slot, another tier mapping, retained default, explicit model, workflow, or fork can use the same expensive physical model. This proposal governs Jev's automatic expert-tier selection, **not a global physical-model spending guard**.

## Allow Markdown output without an implementation loop

Expert may read relevant evidence and produce the designated Markdown report. Prefer saving the final response through the executor's managed output artifact. That does not require arbitrary repository write tools.

Direct writing, if necessary, needs an executor-enforced exact artifact-path allowance before claiming write isolation. `.md` alone is not a safe permission boundary: AGENTS.md, skills, and specs can control behavior. Do not infer arbitrary Markdown editing permissions from the requirement to produce a report.

Return concise findings, recommendation, alternatives, risks, and verification steps. Cheaper tiers perform implementation, routine verification, formatting, publishing, and integration into official documents. No automatic expert retry, reconsultation loop, child delegation, or token-cap increase. Read tools can require multiple provider requests; one consultation is not necessarily one API call.

## Primary-source evidence

The parent fetched these sources and checked relevant passages after reviewing the researcher's artifact. No paid experiment, pricing survey, comparative policy evaluation, or calibration study was performed. Search-provider failures affected the child search workflow; direct original-page fetches succeeded. Automated semantic source assessment was unavailable, so evidence was manually reviewed.

| Finding | Primary evidence | Limits |
| --- | --- | --- |
| Separate difficult planning from cheaper execution. | [OpenAI, Reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices), **Reasoning models vs. GPT models**: reasoning models can plan a strategy while GPT models execute specific tasks. | Architectural guidance; historical model-family examples do not choose today's expert model. |
| Routing needs accurate classification. | [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), **Workflow: Routing**. | Classification is not a frequency or spending quota; that conclusion is our policy inference. |
| Reduce requests and token volume together. | [OpenAI, Cost optimization](https://developers.openai.com/api/docs/guides/cost-optimization), **Cost and latency**. | Counting consultations alone does not bound cost. |
| A short visible answer does not cap reasoning spend. | [OpenAI, Reasoning models](https://developers.openai.com/api/docs/guides/reasoning), **Controlling costs** and **Allocating space for reasoning**: `max_output_tokens` includes reasoning, visible output, and non-visible formatting; exhaustion can precede visible output. | Provider-specific total-generation limit; too small a limit can yield no usable answer despite billing. |
| Thinking controls are not interchangeable across providers. | [Anthropic, Extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking), **Budget rules and tuning**: thinking budget is a target, while `max_tokens` is the total-output ceiling. | Recheck supported controls for the selected model; no generic hard reasoning-budget field is assumed. |
| Loops need explicit stop conditions and compact context/output. | [Anthropic, Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), **Agents**; [OpenAI, Latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization), **Generate fewer tokens**, **Use fewer input tokens**, **Make fewer requests**. | Does not establish optimal retry count, threshold, or project consultation allowance. |

## Enforcement boundaries and later specification

Inspected checkout: `51dfe53de0981342e17fe9947cee7d3fcb0a258a`. This is a launch-routing inspection, not a complete executor/provider audit.

[`src/tier-policy.ts`](../../src/tier-policy.ts) and [`src/crew-policy.ts`](../../src/crew-policy.ts) currently contain the three-tier order and deep risk overrides. [`src/routing-settings.ts`](../../src/routing-settings.ts) requires all current tier models. [`src/system-one.ts`](../../src/system-one.ts) constructs questions and validates their answers. These seams need coordinated changes in a later approved implementation.

The inspected worker adapter selects model/effort but does not own the entire provider request loop, total-output limits, or retry accounting. It leaves workflow/fork launches executor-owned. Therefore this recommendation does not enforce token caps, advisory tool restrictions, hard project quotas, or coverage of every expensive-model route.

A later spec must define the expert answer schema, bounds and provenance of the decision packet, canonical role context, fallback when deep is absent, confidence/risk ordering, and executor support for report/tool restrictions. Evaluate representative normal and exceptional architect/advisor briefs, including missing evidence, Markdown-only work, exact threshold boundaries, malformed answers, and configurations without expert/deep. Measure actual usage and false-positive expert admissions before claiming rarity or selecting a calibrated threshold. Hard project identity/counters, atomic reservations, resets, manual/alias coverage, and provider-specific token budgets remain separate scope unless explicitly requested.
