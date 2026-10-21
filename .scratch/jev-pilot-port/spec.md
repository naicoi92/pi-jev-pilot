# Jev Pilot for Pi — Faithful Port

Status: ready-for-agent
Type: spec
Implementation readiness: main/policy seams verified in source; ordinary subagent routing has a supported tool-call mutation candidate pending Pi contract smoke. Workflow agents retain upstream advice semantics, not transparent interception.

## Problem Statement

Pi users want Jev Pilot's task-aware model and effort routing, skill selection, workflow guidance, crew modes and decision reporting without running Claude Code. Pi supports multiple providers and model-specific thinking settings, but the original plugin depends on Claude Code function hooks, agent spawning, resource discovery and plugin storage.

The user wants a port, not a new routing product. Prior proposals for automatic benchmark/cost optimization, execution profiles and additional role systems complicated the goal and are explicitly superseded.

## Solution

Publish a Pi package preserving the selected behavior of Jev Pilot 0.12.1 at commit `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`. Retain upstream questions, rubrics and deterministic policy where applicable; replace host-specific integration with supported Pi APIs and an external subagent-package adapter.

Users configure three model tiers (`fast`, `balanced`, `deep`) using qualified Pi registry identities. Custom slots retain upstream `name`, `model`, `when` semantics. Effort is a separate classifier decision, adapted only to supported settings of the chosen model. Strategy and quality/design guidance remain advice, not a separate execution engine or permission grant.

Included feature IDs are 01, 03, 04, 05, 06, 07, 08, 09, 10, 13 and 14 from the conversation's upstream capability list. Only `standard`, `budget` and `junior-lead` crew modes are included. The user approved one transport improvement: classification timeout aborts the request instead of merely stopping the wait.

## User Stories

1. As a Pi user, I want to install the port as a regular Pi package, so that I do not need a Claude-specific launcher or proxy.
2. As a Pi user, I want to configure `fast`, `balanced` and `deep` mappings, so that the original tier policy can use my providers and models.
3. As a Pi user, I want qualified provider/model identities, so that similarly named models from different providers are not confused.
4. As a Pi user, I want one model to be usable in multiple mappings, so that configuration does not force unnecessary provider diversity.
5. As a Pi user, I want Jev to classify work using the original tier rubric, so that lookup, specified implementation and judgment-heavy work retain their upstream treatment.
6. As a Pi user, I want automatic main-model routing to be configurable and off by default as upstream, so that installing the package does not silently replace my chosen conversation model.
7. As a Pi user, I want per-prompt effort selection, so that reasoning demand can vary without requiring a model switch.
8. As a Pi user, I want original confidence thresholds, risk treatment, follow-up rules and effort ceilings, so that the port does not introduce a different routing policy.
9. As a Pi user, I want only thinking levels supported by the resolved model to be dispatched, so that provider incompatibility does not produce invalid requests.
10. As a Pi user, I want requested and effective thinking levels to be distinguishable, so that host clamping or unsupported upstream levels are visible rather than misreported.
11. As a Pi user, I want continuation requests and retries to preserve the applied route where supported, so that the port avoids unnecessary cache churn and repeated classification.
12. As a Pi user, I want plain continuation prompts to reuse the prior decision as upstream, so that continuing work does not incur unnecessary classification.
13. As a Pi user, I want approval prompts to be evaluated with recent context rather than treated as empty continuation, so that the approved work determines the decision.
14. As a Pi user, I want System One endpoint, authentication and model configuration, with Jev as the default decision model, so that I can use my compatible service without a hard-coded provider requirement.
15. As a Pi user, I want router, skill, quality and design questions combined on the ordinary path, so that the port preserves the original latency-saving design.
16. As a Pi user, I want large skill catalogs and optional reranking handled according to upstream limits, so that a nominal one-call path does not silently drop candidates.
17. As a Pi user, I want bounded recent context with the upstream defaults of four messages and 2,000 characters, so that classification understands follow-ups without receiving the entire session.
18. As a Pi user, I want classifier inputs limited to the applicable prompt, minimized context, derived signals, platform markers and skill metadata/excerpts, so that the port does not silently send repository files or tool inputs/results.
19. As a Pi user, I want worker classification to use its own brief, description and type without parent conversation history, so that worker routing remains brief-scoped.
20. As a Pi user, I want the default 1,500 ms classification timeout to be configurable, so that classification cannot indefinitely delay my task.
21. As a Pi user, I want classifier errors, timeouts and malformed answers to leave the current valid route unchanged or use my configured default when none exists, so that classifier failure does not unnecessarily block work.
22. As a Pi user, I want classification timeout to abort its request, so that the port does not leave unnecessary work running after the deadline.
23. As a Pi user, I want explicit cancellation to stop nested classification and agent work, so that cancellation does not trigger fallback generation.
24. As a Pi user, I want at most one ordinary selected skill attached per eligible main prompt, so that matching remains consistent with Jev Pilot rather than inventing a new multi-skill selector.
25. As a Pi user, I want skill-list handling and content injection to use Pi resource APIs without renaming or hiding files on disk, so that upstream behavior is adapted without destructive resource changes.
26. As a Pi user, I want strategy advice for direct, delegate, parallel, graph and eligible junior work, so that the agent receives the original recommendations without the plugin spawning work itself.
27. As a Pi user, I want user/project delegation restrictions to remain authoritative, so that classifier advice cannot grant execution permissions.
28. As a Pi user, I want original quality guidance for ambiguity, bugfixes, sensitive work and repeated-work loops, so that the agent receives concise checks without enforcing a new workflow engine.
29. As a Pi user, I want quality-loop advice without mid-turn effort increases, so that the selected quality feature does not reintroduce excluded escalation.
30. As a Pi user, I want the design pack to reference installed skills and available tools and prioritize the project's design system, so that UI guidance does not assume unavailable resources.
31. As a Pi user, I want up to eight custom model slots with configurable `when` descriptions, so that Jev can choose permitted custom models for suitable worker briefs.
32. As a Pi user, I want custom slots without `when` to retain upstream read-only bulk-work guidance, so that they are not silently treated as code-writing workers.
33. As a Pi user, I want slots excluded in `standard` and eligible in `budget` and `junior-lead`, so that mode semantics match upstream.
34. As a Pi user, I want offered custom slots to replace the classifier's `fast` option while retaining `balanced` and `deep`, so that custom-candidate behavior is not redesigned.
35. As a Pi user, I want a named junior bound to the configured slot or the original first-slot default, so that junior routing does not become a separate ranking system.
36. As a Pi user, I want normal worker routing to preserve an explicitly supplied model, so that Jev does not overwrite deliberate caller choices; specialized junior behavior remains explicitly characterized.
37. As a Pi user, I want the external execution package to receive the selected worker model and effort, so that routing changes actual execution rather than only adding advice.
38. As a Pi user, I want ordinary subagent tool calls routed at runtime and workflow-script agents guided through model-selection advice as upstream, so that the port does not invent stronger interception guarantees.
39. As a Pi user, I want a bounded decision ledger without prompt text, so that I can inspect decisions without persisting classifier input in the ledger.
40. As a Pi user, I want the report to show decision latency, confidence, effort, failures and outcomes, so that I can understand what the plugin did without invented savings claims.
41. As a Pi user, I want user corrections attributed to the preceding completed turn by stable identity, so that quality evidence is not assigned by timestamp guesswork.
42. As a Pi user, I want tuning proposals based on at least 20 fresh turns since the last applied change, so that the same evidence does not repeatedly push settings.
43. As a Pi user, I want explicit tuning apply/reset separate from ledger reset, so that observations do not silently change my routing settings.
44. As a Pi user, I want session resume, branching, compaction and extension reload to preserve or reset state correctly, so that decisions from another branch or session do not leak into current work.
45. As a package maintainer, I want provenance, license attribution and documented host differences, so that the public port remains traceable and maintainable.

## Implementation Decisions

### Authority and module boundaries

- The pinned upstream source is the behavioral baseline for selected capabilities. Research proposals that diverge from the user's final faithful-port direction are not requirements.
- Preserve pure decision policy and parsing where possible. Separate it from transport and host effects so policy parity is testable without live models.
- Use five responsibility boundaries: decision policy; Pi configuration/transport/main routing; skill and design guidance; crew/subagent adapter; decision history/report/tuning. This is a proposed decomposition, not a requirement for five public packages or separate routing engines.
- A single shared decision implementation supplies main and worker routing. Do not create independent rubrics per host adapter.
- Preserve upstream confidence and risk semantics, except unresolved source discrepancies must be characterized before deciding parity. Do not silently change a policy bug under the label of porting.

### Pi integration

- Use supported stable Pi extension, registry, resource, session and storage APIs. Pi 1.3.0 was verified during research; recheck latest stable before implementation and record the tested compatibility version. Do not target unreleased APIs merely because they exist on the default branch.
- Use Pi virtual-model routing for the enabled automatic main-model path where it preserves the selected-versus-dispatched model contract. Preserve the user's explicit physical selection when auto-routing is not enabled. Effort-only operation must not require automatic model switching.
- Resolve tier and custom-slot targets against qualified physical Pi model identities and configured authentication. Configuration validation is not a live health/quota probe. Do not route to unknown identities or infer replacements from similarly named aliases.
- Configuration mappings are runtime data; absence of hard-coded product model IDs is not an implementation blocker. No automatic benchmark ranking or empirical capability score is introduced.
- Pi supported-thinking metadata is authoritative for dispatch validity. Preserve upstream reasoning-demand decisions and report requested/effective differences; cross-provider effort labels do not assert equal budget or quality.
- Fresh decision work is keyed to eligible user input rather than every tool continuation. Respect Pi request reasons, retries, branch state and compaction boundaries. Do not copy the upstream prompt-text handoff mechanism if Pi provides a safer operation identity.
- Persist plugin state using supported storage with explicit branch/session ownership. Ledger retention remains bounded to the latest 500 valid entries as upstream. Reload/shutdown cleanup is idempotent.

### System One and guidance

- Preserve typed decision questions, source thresholds and candidate constraints. Endpoint/authentication/model are configurable, with Jev as the default model family. Do not force a provider-specific built-in classifier fallback that Pi does not have.
- Preserve ordinary combined-call behavior, skill batching and optional rerank semantics without claiming an absolute one-request maximum.
- Minimize classifier payload independently of the full conversation Pi supplies to routing hooks. Tool bodies/results and repository contents are not automatically included. Prompt/history/skill text may still contain secrets; do not advertise automatic redaction.
- Distinguish classification timeout from explicit user cancellation. Deadline expiry aborts nested classification and permits fail-open behavior; parent cancellation aborts work and must not trigger a new model request. Do not silently switch classifier backends after service failure.
- If no valid current/default route exists after validation, surface an actionable configuration error rather than inventing a model. Fail-open classification is not authorization for cross-provider retries of a failed coding request.
- Skill matching uses the discovered eligible main-conversation catalog. Design-pack recommendations remain a separate upstream guidance path and can reference installed design resources in addition to the ordinary selected skill.
- Strategy, quality and design blocks are advice, not permission grants or enforced review gates. Preserve confidence gates and shortest applicable upstream guidance rather than adding procedural rituals.

### Crew adapter

- Keep three tiers, custom slots and named junior as distinct concepts. Do not reinterpret custom slot names as automatically bound agent roles.
- Use an external subagent execution package, which may run native Pi workers. This port owns decisions and routing adaptation, not an independent execution engine.
- Route applicable ordinary native subagent tool launches through supported Pi tool-call input mutation and the execution package's documented model/effort contract. Verify effective-agent resolution, explicit overrides, worker identity, cancellation and returned outcomes/usage. Workflow-script inner launches retain upstream model-selection advice; transparent workflow interception is not required.
- Do not modify installed package caches, monkey-patch private internals, or substitute prompt advice for required runtime routing. A missing supported seam is an implementation blocker requiring a specific report, not silent reduction of capability.
- Preserve named junior and ordinary-worker distinctions. Characterize upstream fork handling and dedicated agent exceptions; do not claim universal override semantics across specialized paths.
- Preserve junior slot selection without importing excluded proactive worker-health checks or Sonnet fallback. If the configured junior target cannot resolve or lacks configured authentication, return an actionable configuration error; do not substitute another worker model. Classifier fail-open is a separate decision-service behavior.
- Keep Command Code/Claude proxy mechanics out of the Pi port when Pi can reach configured models directly; this is host adaptation, not removal of custom model support.

### Reporting and tuning

- Preserve ledger fields and attribution behavior needed by included features. Excluded escalation fields may remain compatible data fields but no excluded escalation behavior is activated.
- Report observed decisions/outcomes and supplied usage. Do not label confidence as accuracy or claim counterfactual savings from models that did not run.
- Tuning adjusts only upstream tunable thresholds with original evidence requirements and ranges. Learned values apply only after explicit user consent and remain distinguishable from base configuration.
- Minimal configuration, mode/slot, report and tuning interfaces are permitted where necessary for included capabilities. This does not authorize the excluded broad live-control, pet or session-statistics feature set.

## Testing Decisions

### User-approved seams

1. **Pi package boundary:** run the extension through Pi and exercise prompt/configuration → System One request → dispatched model/effort, injected guidance, ledger and command outcomes.
2. **Subagent adapter boundary:** exercise brief/override → effective worker model/effort → actual worker execution and returned result, including cancellation.
3. Pure-policy parity fixtures support these seams but do not replace host integration or user-path E2E.

Test externally visible behavior, not private helper structure. Use captured upstream questions and independent expected examples as regression evidence. The upstream Bun specs for routing, shared calls, skills, quality/design, crew and tuning are prior art; they do not prove Pi integration.

### Acceptance criteria

| ID | Verifiable acceptance criterion | Evidence / seam |
|---|---|---|
| AC-01 | A normal Pi package installation loads the extension without a Claude launcher or local model proxy. | Pi CLI package boundary |
| AC-02 | Configured qualified identities resolve the three tiers and permitted custom slots without changing global defaults implicitly. | Pi config/registry integration |
| AC-03 | Pinned routing fixtures preserve tier, confidence, follow-up, risk and ceiling outcomes except documented approved host differences. | Upstream parity fixtures plus host dispatch |
| AC-04 | With main-model routing disabled, eligible effort decisions do not replace the selected physical model. | Pi package boundary |
| AC-05 | With automatic main routing enabled, eligible decisions dispatch the configured physical model and supported thinking setting. | Pi virtual-model integration |
| AC-06 | Requested versus effective thinking is observable when unsupported upstream levels are adapted. | Dispatch and ledger evidence |
| AC-07 | Tool continuations/retries do not unintentionally rerun classification or leak another branch's pending decision. | Pi lifecycle integration |
| AC-08 | Plain continuation and approval prompts follow their distinct upstream decision paths. | Prompt-flow contract |
| AC-09 | Ordinary unbatched eligible prompts combine router/skill/quality/design questions; large catalogs and rerank preserve documented additional calls. | Fake System One request capture |
| AC-10 | Main context uses bounded upstream defaults and excludes tool inputs/outputs; worker payload excludes parent conversation history. | Captured classifier payload |
| AC-11 | Service error, malformed answer or timeout applies no new classifier decision and preserves a valid current/default route. | Pi boundary with deterministic fault responses |
| AC-12 | Timeout aborts the classifier request; explicit parent cancellation stops work without fallback generation. | Delayed HTTP fixture and actual abort propagation |
| AC-13 | No configured valid route produces a clear config error rather than an arbitrary model selection. | Pi registry/config boundary |
| AC-14 | Skill matching selects at most one ordinary skill, preserves none/gating/batching behavior and attaches intended content without filesystem hiding. | Pi resources and classifier fixtures |
| AC-15 | Strategy and quality advice follow original gates and do not independently dispatch workers or grant permissions. | Observable guidance plus dispatch receipts |
| AC-16 | Loop-related quality advice never increases effort mid-turn. | Tool-event flow and unchanged effective effort |
| AC-17 | Design guidance references only available configured skills/tools and prioritizes an existing project design system. | Resource/tool fixtures and injected context |
| AC-18 | Custom slots enforce upstream name/count/when behavior and mode eligibility; offered slots replace fast, retaining balanced/deep. | Config, question capture and adapter boundary |
| AC-19 | Named junior uses the selected/first-slot upstream mapping rather than a fresh model-pool ranking. | Actual worker dispatch |
| AC-20 | Ordinary worker explicit model overrides survive routing; specialized agent/fork exceptions are characterized explicitly. | Adapter contract and worker receipts |
| AC-21 | Ordinary direct/async native subagent calls receive supported runtime model/effort injection; workflow scripts receive upstream-equivalent model-selection advice and are not advertised as transparently intercepted. | External-package integration/E2E and guidance capture |
| AC-22 | Completed turns create bounded ledger entries without prompt text, with correct usage/outcome identity. | Persisted observable state |
| AC-23 | A classified correction updates the preceding completed turn by stable identity, including resume/branch cases. | Prompt-to-ledger integration |
| AC-24 | Report summarizes actual observations and ledger reset does not reset learned tuning. | Command boundary |
| AC-25 | Tuning proposals require upstream fresh-evidence counts/ranges; apply/reset is explicit and separate from ledger reset. | Command boundary plus upstream examples |
| AC-26 | Resume, branching, compaction, reload and shutdown preserve state ownership and clean up active resources. | Pi lifecycle integration |
| AC-27 | Excluded features do not activate through imports, modes or advice, and no benchmark optimizer or invented reviewer role is introduced. | Scope regression tests and review |
| AC-28 | Public distribution preserves MIT attribution, documents tested Pi/adapter compatibility, configuration/privacy and unavoidable host differences. | Package/documentation review |

Before writing tests, map every test to one acceptance criterion and an independent expected-value source. Record untestable criteria, environment limitations and fallback checks explicitly.

Verification proceeds through policy parity, fake-service contracts, real Pi CLI integration and the actual subagent execution path. Offline deterministic service/model fixtures should prove failure and cancellation paths without paid calls. Live-provider smoke tests require configured credentials and explicit cost boundaries; absent credentials do not justify claiming live E2E from unit results.

## Out of Scope

- Mid-turn effort escalation, including escalation embedded in quality/circle-detection paths. Step-back advice remains included without effort changes.
- External Codex/OpenCode CLI reviewers, `second-opinion` and `quality` crew modes.
- Proactive worker health checks, provider failover and automatic cross-provider retries. Normal validation, error reporting and classifier fail-open remain required.
- Animated pet, broad live switches and session-statistics UI. Minimal interfaces required to configure selected capabilities and use report/tuning remain included.
- Automatic benchmark feeds, model score/cost optimization, execution profiles, expert tier, automatically inferred capability rankings and new coder/reviewer role systems.
- A new subagent execution engine, Claude-specific gateway/proxy, or mutation of installed dependency caches.
- Automatic secrets redaction guarantees, guaranteed review gates, guaranteed quality improvements or counterfactual cost-savings claims.
- Porting every upstream command/installer or unselected behavior merely because it exists in the source.

## Further Notes

### Decisions and evidence

- This spec synthesizes the conversation's selected feature list, subsequent configuration/privacy/failure decisions and final instruction to port Jev Pilot rather than redesign it.
- Source baseline: [Jev Pilot pinned commit](https://github.com/Akramovic1/jev-pilot/tree/5d27135b34edf81b40c0bf1df01ae401f6b72ea7).
- Pi integration reference: [Pi virtual-model contract at verified release](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/virtual-models.md).
- Scope summary: [PORT-SCOPE.md](../../PORT-SCOPE.md).
- Behavioral research: [upstream behavior report](../../docs/research/jev-pilot-current-behavior.md).
- Host research: [Pi routing options](../../docs/research/pi-multi-provider-routing-options.md); proposed execution-profile and automatic benchmark-ranking portions are superseded, not requirements.

### Verification gates, not new product interviews

1. **Subagent seam — concrete candidate identified:** Pi 1.3.0 supports tool-call input mutation; pi-subagents 0.80.0 accepts qualified model IDs with thinking suffixes, with suffix precedence confirmed by an offline resolver check. Use these for ordinary native tool launches, preserving explicit pins. Effective-agent resolution, direct/async execution, cancellation and actual settings still require a Pi contract smoke. Workflow inner launches use advice as pinned Jev Pilot does; an all-workflow before-spawn hook is not a requirement. See [feasibility report](../../docs/research/subagent-adapter-feasibility.md).
2. **Upstream risk/custom-slot discrepancy — source-characterized:** an offline check using the real pinned pure policy returned a risk-forced deep model, then the subsequent custom-slot branch selected the cheap slot at sufficient confidence. This is source/branch-composition evidence, not Claude hook E2E. A correction to that precedence needs explicit approval; do not silently change parity or advertise a universal risk floor.
3. **Host incompatibilities:** enumerate nonrepresentable effort levels, resource-list handling and session/worker lifecycle differences with the smallest supported adaptation. Escalate a true missing capability rather than inventing a new product mechanism.

`ready-for-agent` permits the next planning/investigation stage under these gates. It does not assert that dependency integration, host E2E or live System One behavior has already been verified, and it is not authorization to skip the user's spec/ticket review process.
