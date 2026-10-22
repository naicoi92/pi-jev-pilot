# Ticket 04 acceptance matrix

This slice implements strategy/quality context advice only. No worker adapter, crew, design pack, ledger, review engine or escalation is included. Tests use pure policy boundaries and the installed official Pi 1.4.0 RPC CLI with local System One/provider HTTP endpoints.

## Authority and independent expected values

- Parent spec AC-09: combine jointly applicable questions, zero requests without questions (approved decision-gating addendum).
- AC-15: original strategy/quality gates, advice only, no independent dispatch or authority grant.
- AC-16: repeated-work advice without mid-turn effort changes.
- AC-27: excluded features remain absent.
- Read-only Jev 0.12.1 commit `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`, `hooks/model-router.policy.ts`: strategy criteria 82–93, quality questions/bars/advice 114–174, questions 355–367, strategy advice 870–927, loop detection 1187–1233; `hooks/features.ts` defaults strategy/quality true; `hooks/crew.ts` 657–665 workflow model-selection advice.
- Raw tier source trace: `readDecision` returns classified tier at 481; `jev-model-router.ts` prompt finish 482–500 passes that decision directly to `adviseStrategy`, before routing. Strategy-only therefore asks tier+strategy, not risky/effort. This tier does not select a physical model, require mappings/auth, or write route state. Supervisor approved this applicability adaptation.
- Supervisor-approved ownership adaptation: advice reuses the existing version-tested UUID seam on Pi 1.4.0, never allocates a competing ID. Context-only projection, owner required, missing metadata fails closed. Not a documented arbitrary metadata guarantee.
- Supervisor-approved host difference: retain the common step-back note, omit only upstream Fable/high-effort-specific tail; no replacement model suggestion or escalation.

## Matrix (written before tests)

Each test has exactly one AC prefix. Expected values below are source literals, not generated with implementation helpers.

| Criterion | Test IDs                                              | Observable expectation / source                                                                                                                                                                            |
| --------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-09     | G09-combined-physical/virtual                         | One request combines applicable effort+risky, tier+strategy, four quality nouls and skill questions. Upstream questions + first-batch orchestration.                                                       |
| AC-09     | G09-quality-only/strategy-only/none/continuation      | Quality-only exactly corrects/underspecified/sensitive/bugfix; strategy-only exactly tier/strategy; disabled/ineligible zero HTTP even invalid backend. Approved gating.                                   |
| AC-09     | G09-batches                                           | Advice questions only first skill batch, no duplicate classification. Upstream shared first-batch ask.                                                                                                     |
| AC-15     | G15-strategy-boundaries                               | direct adds nothing; delegate >=.6; parallel >=.6 and tier not fast; graph >=.8 and tier deep; missing confidence/unknown answer adds nothing. Upstream adviseStrategy.                                    |
| AC-15     | G15-quality-boundaries                                | underspecified >=.85, bugfix >=.8, sensitive >=.8 exact concise lines; corrects >=.7 is read but does not invent advice or ledger. Upstream QUALITY_BARS/qualityAdvice.                                    |
| AC-15     | G15-guidance-only-physical/virtual                    | Selected advice visible once on owning user; physical strategy tier never changes model/thinking or requires mappings. Shared orchestration.                                                               |
| AC-15     | G15-distribution/malformed                            | Strategy confidence uses upstream explicit confidence or maximum reported probability; unknown/non-finite/out-of-range values do not fabricate advice. Pinned confidenceOf + fail-open malformed contract. |
| AC-15     | G15-retry/continue/queued/fork/tree/reload/compaction | No repeated calls/duplicate blocks on retry/tool continuation; owned user anchors stay correct across lifecycle; no orphan/stale advice. Approved branch contract, existing skill seam.                    |
| AC-15     | G15-cancel/timeout/manual-selection/stripped-identity | Abort nested work; no late context; missing identity does not use previous advice; persisted raw user content unchanged. Approved cancellation/UUID contract.                                              |
| AC-15     | G15-restrictions/workflow                             | Advice explicitly defers to user/project restrictions, starts no workers, workflow model-selection guidance does not claim interception. Pinned advice semantics + crewNote host adaptation.               |
| AC-16     | G16-edits                                             | Fourth edit/write of same file in one turn attaches common note once, not on first three; next prompt resets. Upstream SPIN_EDITS=4.                                                                       |
| AC-16     | G16-failed-commands                                   | Third same normalized failed command attaches note; success resets that command counter; no note on successful repeated commands/different commands. Upstream SPIN_RUNS=3/spinOf.                          |
| AC-16     | G16-disabled/cancelled                                | Disabled quality observes no advice; aborted/branched work cannot leak loop note. Public tool outcomes and current context only.                                                                           |
| AC-16     | G16-no-escalation                                     | Actual edits/failed commands preserve provider reasoning effort, classifier count, selected model and absence of dispatch receipts. Scope exclusion overrides upstream raise/Fable tail.                   |
| AC-27     | G27-exclusions                                        | Provider context contains no pet, external-review requirement, escalation, invented mandatory review gates, crew/design/ledger claims or transparent workflow interception. Source/scope review.           |

### P1 review regression (recorded before test code)

- G15-partial-tier-physical: tier `{choice:balanced, probabilities:{balanced:.6}}` and delegate confidence .8 produce advice with exactly one request and unchanged physical model/medium thinking. Pinned readDecision 454–483 and confidenceOf 515–519 impose no complete distribution on raw advice tier.
- G15-partial-tier-virtual: the same raw-tier rule independently produces advice on a combined request, while rejected routing retains configured balanced/medium baseline, schema-error routing status and no application of selected deep/high from malformed routing. Supervisor approved internal adviceDecision separation, same response/no extra call.
- G15-invalid-tier-values: unknown tier names and invalid individual tier probabilities do not produce advice; combined routing keeps its existing fail-open baseline. Transport failure/cancel remains covered by existing G15-cancel cases and cannot create adviceDecision.

### Additional source-derived cases (recorded before their tests)

- G09-defaults: without either new environment switch, production sends tier/strategy plus four quality nouls (upstream features.ts true defaults), while effort/skills disabled remain absent.
- G15-raw-tier-risk: virtual routing risky=1 can force a deep physical route, but raw balanced tier still blocks graph advice; raw fast still blocks parallel. Upstream finish passes raw decision before route policy.
- G15-compaction: actual public compaction removes the owning user; continuation must not resurrect prior advice; a new eligible request may obtain new advice. Existing UUID/context projection contract.
- G15-partial-distribution: upstream confidenceOf L515–519 takes the maximum supplied probability without requiring a complete distribution. A partial `{delegate:.6}` with no explicit confidence therefore qualifies; explicit confidence remains first. Invalid individual probabilities still fail open.
- G15-quality-malformed: missing, out-of-range, string and non-finite serialized values do not create quality advice. Upstream nounOf plus parent fail-open validation.
- G16-negative: different failed commands and successful repeated commands do not reach same-command failure threshold. Disabled, aborted or branched work does not carry counters into new work. Pinned spinOf and branch ownership contract.
- G16-branch: fork before an abandoned user's repeated failures cannot carry counters into a new user's two-failure run; no step-back on the new branch. Approved ownership and pinned turn-local counters.
- G09-rubric: captured strategy/quality questions retain pinned wording and noun criteria; corrects is read but has no advice/ledger effect in this slice.

Existing 218 tests / 641 assertions remain regression dependencies. Their fixture explicitly disables newly introduced advice consumers, preserving each earlier slice's independent expectations; production defaults remain upstream true. Additional cases must be recorded here before test code.
