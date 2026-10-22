# Approved decision gating

Status: operator-approved clarification; implementation pending.

This addendum takes precedence over earlier effort behavior where they conflict. It preserves the selected capability scope; it does not remove skills, guidance, crew, reporting or tuning.

## Contract

1. **Superseding operator decision:** installing/enabling Jev auto-effort authorizes selecting effort over the host's default/current thinking according to upstream policy. A named/current thinking value is not a persistent lock. Automatic detection of every native explicit choice is not required. Preserve upstream confidence/risk/ceiling/follow-up exceptions; this is not unconditional overwrite authority. Invalidate an outstanding classification if the user changes model/thinking while it runs; a later eligible prompt may route again.
2. Only enabled and applicable capabilities contribute classifier questions. Preserve the upstream combined call for questions that are jointly applicable, rather than issuing independent calls per capability.
3. When no classifier question remains, perform zero classifier requests. Do not run a classifier merely to produce unused diagnostics or ledger activity.
4. Strategy, quality and design guidance remain advice/context, not dispatch, enforcement or demonstrated quality improvement.
5. Adapt upstream requested effort only to supported model levels and expose requested/effective differences as approved. Do not invent a model fallback or treat existing thinking as a persistent pin. For ordinary worker calls, enabling applicable Jev routing authorizes overwriting caller-supplied model identities according to policy. A caller model is not an unconditional pin or bypass; preserve other separately approved overrides only where not conflicting with this decision.
6. Timeout abort, explicit cancellation, payload minimization and branch ownership remain required for decision work that actually runs.

## Superseding ordinary-worker authority

The operator explicitly requires Jev to overwrite models supplied in ordinary worker calls: call model A, valid policy selection B means child B. This supersedes earlier caller-pin preservation in the spec, ticket 06 and research. It does not authorize automatic replacement of the main physical model or removal of manual-change cancellation guards. Enabled/applicable gates, confidence/risk policy, supported effort adaptation and failure/cancellation contracts remain. Distinguishing caller pins from agent defaults is no longer an acceptance blocker; discovery is required only where a concrete routing/baseline/applicability contract needs it. Historical checkpoint findings remain evidence, not proof that a new API is required.

## Evidence gate before implementation

Verify ordinary official stable Pi dispatch and ownership using local fixtures. Do not infer provenance from value equality, private state or extension-side argv parsing. Automatic native-intent detection and preserving native startup-equality precedence on runtime replacement are no longer acceptance blockers. Historical RED evidence remains historical, not a claimed fix. The experimental host patch remains research only. No persistent lock, extra opt-in mode, default-off change or host dependency is approved.

## Acceptance matrix to implement after detection is resolved

| Case | Expected observable outcome |
| --- | --- |
| Ordinary direct/async call supplies model A; applicable valid Jev policy chooses B | Child receipt confirms B and supported chosen effort; caller A does not bypass routing |
| Worker routing disabled | Preserve original worker input under executor behavior |
| Default/current named thinking, eligible effort path | Classify and apply upstream policy; existing value is not a lock |
| Manual model/thinking change during classification | Discard stale result, no late overwrite |
| Initial startup before eligible prompt | No speculative effort change |
| No enabled/applicable questions | Zero classifier HTTP requests |
| Exactly one applicable capability | Only its required questions are sent |
| Multiple jointly applicable capabilities | Ordinary combined-call behavior, no disabled capability questions |
| Requested effort unsupported by resolved model | Supported dispatch and observable requested/effective values |
| Applicable work times out | Abort classifier request, fail-open without a new decision |
| User cancels applicable work | Abort nested classification and stop work, no fallback generation |
| Branch/session transition | No stale pending decision applied to current work |

## Task graph implications

Retain the approved task graph and ticket 01 effort-only vertical slice. Do not split/defer effort merely to bypass acceptance. Package/config/classifier code must support applicable question gating for subsequent capabilities. Do not restart the old candidate unchanged or retain the agent-added startup-equality guarantee as a blocker. Retain historical RED evidence, revise its authority/expectation transparently and rerun real CLI tests under this contract. No dependency completion or merge is implied.
