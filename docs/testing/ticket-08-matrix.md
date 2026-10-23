# Ticket 08 — custom slots and crew matrix

Baseline: integration `265e282`; pinned Jev Pilot 0.12.1 `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`, read-only checkout `/tmp/pi-jev-upstream-5d27135`. This matrix precedes tests. Public seams remain configuration, combined System One transport, ordinary adapter and packed Pi CLI; no independent worker engine.

| Criterion | Tests / scenario                                                  | Independent expected-value source                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-18     | crew config names/count/when/modes                                | pinned `hooks/crew.ts`: SLOT_NAME, RESERVED_NAMES (including excluded feature names), MAX_MODELS=8, DEFAULT_SLOT_WHEN, slotsOffered; reject malformed explicit Pi configuration rather than silently truncate |
| AC-02     | qualified slot model config                                       | PORT-SCOPE and parent registry contract; exact provider/model identities only                                                                                                                                 |
| AC-03     | custom confidence and risk boundary                               | pinned `jev-model-router.ts:1141–1148`: custom confidence >= .6, absent confidence rejects; ticket 07 correction: risk > .7 deep wins, .7 retains slot rules                                                  |
| AC-13     | invalid slot target/auth, unknown junior name                     | parent spec crew adapter: actionable errors, no probes or fallback workers                                                                                                                                    |
| AC-19     | named junior selected/first/default                               | pinned crewOf/juniorSlot and hook1069: junior-lead configured slot or first-slot; noneligible explicit junior remains balanced, including no slots; explicitly unknown junior is a configuration error        |
| AC-20     | ordinary caller overwrite slot                                    | decision-gating superseding ordinary model/effort authority; caller configured model must become eligible custom target with supported Jev medium                                                             |
| AC-18     | packed standard/budget/junior-lead candidate payload              | pinned model-router.policy.ts tierQuestion: slots replace fast, retain balanced/deep; names and when unchanged                                                                                                |
| AC-19     | packed selected and first-slot junior receipt                     | pinned crewOf ordering and juniorSlot mapping; actual child physical model, executor/default effort (fixture medium), terminal usage                                                                          |
| AC-21     | packed direct/async custom receipt, workflow model-visible advice | pinned crewNote: workflow model selection remains advice, offered custom targets replace fast for bulk work; adapter suffix transport already accepted in ticket06                                            |
| AC-15     | junior strategy eligibility and advice                            | pinned model-router.policy.ts junior criterion/STRATEGY_HOW and crewNote: easy specified coding with lead diff review; confidence .6 gate; delegation restrictions still win                                  |
| AC-27     | modes/exclusions regression                                       | PORT-SCOPE exclusions: no health check/failover, external review/new role/automatic dispatch/authority grant                                                                                                  |

Existing ticket06 tests remain controls for privacy, cancellation ownership, retained targets, profile/unknown runtime/singleton negatives. Main tiers are not custom candidates. Persistent controls are file-based crew configuration (mode, slots, junior), with no broad live command surface. No paid provider, credential or remote-machine execution is authorized. Full suite includes packed CLI; do not redundantly rerun all E2E separately.

## F3 turn-bound implementation matrix (before tests)

Authority: operator instruction to preserve the declared upstream junior `maxTurns: 40`, recorded in `.scratch/jev-pilot-port/ticket-08-turn-bound-decision.md`; pinned `hooks/crew.ts:396–424`. This is AC-19, not a tool/HTTP budget or a timeout. Pi adaptation counts an assistant agent turn when its public `turn_start` reserves a turn before generation, including failed/cancelled attempts. Multiple tools in one turn consume one turn; a synthetic abort after denial consumes none. Natural completion at turn 40 remains success. If another turn would be required, abort only that child and report the limit as an error, retaining its transcript/output. Public session custom entries retain reservations across same-session resume/reload/compaction; a different fresh child session has its own budget. No exact equivalence to unavailable upstream runtime internals is claimed.

| Criterion | Test ID / scenario                                                                        | Independent expected-value source                                                                           |
| --------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| AC-19     | BOUND-unit: reservations, errors/cancellation, synthetic abort, multi-tool turns          | Operator: assistant agent turns, not tool calls or successful responses only; declared 40                   |
| AC-19     | BOUND-unit: restore all session entries, compaction/tree, reload, fresh session isolation | Operator: retained same-run budget, no inadvertent extra 40; independent fresh run                          |
| AC-19     | BOUND-unit: exhausted compaction/cache warming and persistence failure                    | Operator: stop next provider activity; truthful errors, no fail-open reset                                  |
| AC-19     | BOUND-CLI: natural direct 39 and 40, request-41 loop with two tools per turn              | Upstream literal 40; natural completion allowed within the bound                                            |
| AC-19     | BOUND-CLI: async 41, explicit resume after cap, second fresh launch                       | Operator: truthful failed terminal, no automatic resume, persistent retained budget, independent new budget |
| AC-19     | BOUND-CLI: workflow-inner capped junior with concurrent ordinary sibling 45               | Public per-agent `subagentOnlyExtensions`; operator: no sibling/parent abort                                |
| AC-19     | BOUND-CLI: cancel in-progress turn then retained resume/reload                            | Operator: scoped persistent counter; cancelled turn is not refunded                                         |
| AC-19     | BOUND-CLI: reload the retained child session directly through public Pi CLI               | Public session persistence and reload; no private executor identity or storage                              |

Historical probe RED/failures remain at `/tmp/pi-jev-ticket-08-turn-bound-probe`. Tests use packed production source, actual Pi/executor and local deterministic provider fixtures, not paid calls. Existing WorkerEvidence reaps and records observed native terminal state before pruning only owned fixture dependencies.

## Correction evidence mapping (F1/F2/F4)

| Criterion | Correction tests                                      | Evidence / disposition                                                                                                                        |
| --------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-19     | selected/first-slot direct/async/workflow routing-off | Corrective `0867f70`; final selected direct `j4A6qJ`, async `S8ahi5`, final workflow `OS4lWO` under `/tmp/ticket08-correction-green-receipts` |
| AC-21     | offered-custom workflow advice, generic control       | `isUVxQ` / `ukrwkn`; custom replaces fast; restrictions and authority disclaimer retained                                                     |
| AC-18     | explicit null mode/slots rejected, omitted defaults   | `tests/crew-config.test.ts`; independent review closed F4                                                                                     |

`tSUQ9V` is earlier selected-direct evidence, not the final selected receipt. `myx39D` executes the correct workflow target but its command FAILED on classifier-count expectation (1 versus 2); it is not final GREEN. Original copied harness rerun still FAILED at line 668: it expects a rewritten envelope while disabled-routing authority preserves the original envelope. Child `ecEcIV` proves configured/medium; preserve both failure and corrected-target evidence.

## Additional bounded cases and host representation

- AC-13: installed executor absent/collision blocks the junior launch, not main-only startup; public registration failures and actual packed configured-agent collision must remain actionable without replacing the user definition.
- AC-19: public registration handles reuse ownership for repeat calls, dispose idempotently on shutdown, and register anew on next session. Source: pi-subagents 0.80.0 documented runtime event contract.
- AC-18: original valid names `fast`, `balanced`, `deep` stay legal. Pinned `crew.ts:56–69` permits them while `model-router.policy.ts:326–327` shares tier keys. Host representation uses reversible `slot::<name>` for all custom choices, retaining real balanced/deep candidates. No public name is newly reserved.
- AC-03: unknown custom keys cannot resolve a model; missing/.59 confidence rejects custom selection, .6 accepts, .7 risk permits ordinary slot rules, .95 forces deep even for the slot named deep.
- AC-15: eligible junior strategy requires .6 confidence, raw tier not deep and risk <= .5 (`model-router.policy.ts:895–918`). When junior advice alone is eligible, its risk question is applicable; standard guidance payload remains unchanged.
