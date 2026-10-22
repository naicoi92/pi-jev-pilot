# Approved decision gating

Status: operator-approved clarification; implementation pending.

This addendum takes precedence over earlier effort behavior where they conflict. It preserves the selected capability scope; it does not remove skills, guidance, crew, reporting or tuning.

## Contract

1. When the user explicitly specifies thinking, Jev must not select or overwrite effort. A default/current thinking value alone is not evidence of explicit user intent; off is a valid explicit selection.
2. Only enabled and applicable capabilities contribute classifier questions. Preserve the upstream combined call for questions that are jointly applicable, rather than issuing independent calls per capability.
3. When no classifier question remains, perform zero classifier requests. Do not run a classifier merely to produce unused diagnostics or ledger activity.
4. Strategy, quality and design guidance remain advice/context, not dispatch, enforcement or demonstrated quality improvement.
5. With model routing enabled and explicit thinking selected, do not silently replace that effort to accommodate another model. Incompatible model/effort combinations need an explicit validated contract, not an invented fallback.
6. Timeout abort, explicit cancellation, payload minimization and branch ownership remain required for decision work that actually runs.

## Evidence gate before implementation

Verify supported detection on official stable Pi for CLI thinking/model suffix, manual selection and restored sessions. Do not infer intent from non-undefined thinking, value equality, private state or extension-side argv parsing. The experimental host provenance patch is research only, not a production dependency.

If supported APIs cannot identify explicit intent completely, report that limitation and obtain operator approval for a concrete opt-in/lock mechanism before implementation. No such mechanism is approved by this addendum.

## Acceptance matrix to implement after detection is resolved

| Case | Expected observable outcome |
| --- | --- |
| Explicit thinking, effort path | No effort classifier question; no Jev effort setter or replacement |
| No enabled/applicable questions | Zero classifier HTTP requests |
| Exactly one applicable capability | Only its required questions are sent |
| Multiple jointly applicable capabilities | Ordinary combined-call behavior, no disabled capability questions |
| Explicit thinking and model routing | No silent effort adaptation; validate incompatibility explicitly |
| Applicable work times out | Abort classifier request, fail-open without a new decision |
| User cancels applicable work | Abort nested classification and stop work, no fallback generation |
| Branch/session transition | No stale pending decision applied to current work |

## Task graph implications

Ticket 01 must distinguish package/config/classifier foundation from optional auto-effort. Dependent tickets need that foundation, not unconditional effort classification. Do not restart the old candidate unchanged or use the agent-added startup-equality guarantee as the default blocker for every capability. Retain historical RED evidence without claiming the earlier implementation meets this clarification. Review the graph and test mappings before implementation; no dependency completion or merge is implied.
