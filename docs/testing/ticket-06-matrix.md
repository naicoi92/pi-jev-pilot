# Ticket 06 — ordinary worker adapter test matrix

Requirements: current parent spec AC-03/06/10/12/13/20/21/26, ticket 06, decision gating at integration `576dbc7`, pinned Jev Pilot 0.12.1 (`5d27135b34edf81b40c0bf1df01ae401f6b72ea7`), and explicit supervisor baseline adjudication. This matrix precedes its tests.

## Superseding authority

Valid applicable Jev policy may overwrite ordinary caller model A with B. Caller pins are not bypasses. Model-policy baseline is pinned `call.model ?? parentModel` (`hooks/jev-model-router.ts:1133–1137`), not executor-configured agent defaults. Parent fast / no call model / agent default deep / balanced confidence .45 / risk 0 means balanced. Disabled/error/timeout preserve the ORIGINAL envelope, so the same omitted-model call retains executor deep on those paths.

Effort baseline is distinct: pinned `hooks/jev-model-router.ts:651–671` waits for the child's first request and uses engine-built effort; unset is left unset. Never substitute parent thinking. Adapt supported levels against the final selected physical model. Main physical selection and manual-change cancellation guards remain unchanged.

## Feasibility and bounded audit

| Criterion | Test ID                        | Observable behavior                                                                                                                         | Independent expected-value source                                                                                           |
| --------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| AC-21     | WORKER-21-direct               | Public `tool_call` fixed-suffix mutation reaches a real direct native child, with actual model/thinking/output/usage.                       | Pi 1.4.0 extensions contract; pi-subagents 0.80.0 model suffix contract. Historical feasibility only.                       |
| AC-21     | WORKER-21-async                | Same fixed-suffix mutation reaches detached child; terminal settings, outcome, usage and process proof are recorded.                        | Ticket 06 direct/async seam; documented execution contract. Historical feasibility only.                                    |
| AC-13     | WORKER-13-machine              | Public preflight omits configured placement; actual executor rejects at mandatory-extension guard before remote resolution.                 | pi-subagents 0.80.0 machine/required-extension docs. Characterization, not local-only product scope.                        |
| AC-13     | WORKER-13-runtime              | Documented installed-owner runtime agent executes, while public preflight reports missing_agent.                                            | pi-subagents 0.80.0 runtime-registration/preflight docs. Characterization alone is not a blanket blocker.                   |
| AC-06     | WORKER-06-runtime-max-baseline | Runtime child configured max, caller physical model without suffix, actually starts at max; medium decision confidence .45 must retain max. | Pinned first-child-request rule and shared `selectEffort` max ceiling. Baseline observation only until transport is proven. |
| AC-06     | WORKER-06-runtime-low-baseline | Same model/parent/envelope with child low starts at low; medium decision confidence .45 is eligible to become medium.                       | Pinned first-child-request rule and upgrade threshold .3. Baseline observation only until transport is proven.              |

## Production routing cases — not yet implemented

| Criterion | Test ID                          | Observable behavior                                                                                                                           | Independent expected-value source                                     |
| --------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| AC-03     | WORKER-03-policy                 | Preserve confidence/risk/tier/effort policy; risk > .7 forces deep; no custom-slot downgrade.                                                 | Pinned hook/pure policy; approved ticket 07.                          |
| AC-06     | WORKER-06-adaptation             | Requested/effective effort differences observable; first-request baseline and supported final-model levels preserved.                         | AC-06; pinned child effort hook; decision gating point 5.             |
| AC-10     | WORKER-10-minimization           | One worker classification receives bounded brief/type/available description only, no automatic parent history/tool data.                      | Pinned hook1096–1109; AC-10.                                          |
| AC-12     | WORKER-12-classifier             | Deadline aborts classifier; explicit cancellation stops launch without fallback generation.                                                   | Decision gating point 6; AC-12.                                       |
| AC-12     | WORKER-12-child                  | Correct child lifecycle stops on cancellation; no unrelated run killed, orphan or relaunch.                                                   | Ticket 06 isolated lifecycle requirement.                             |
| AC-13     | WORKER-13-config                 | Invalid route/config/runner fails actionably; no invented target. Validate applicability only where needed by contract.                       | AC-13; current ticket06.                                              |
| AC-20     | WORKER-20-authority-direct-async | A→policy B actual child B in direct/async; same identity may receive chosen effort. No unconditional overwrite when policy chooses no change. | Operator authority `576dbc7`; supervisor model-baseline adjudication. |
| AC-20     | WORKER-20-default-baseline       | Parent fast/no caller model/configured deep/.45 balanced→balanced in direct/async.                                                            | Supervisor adjudication of pinned hook1137.                           |
| AC-20     | WORKER-20-disabled               | Disabled path preserves input and executor defaults. Error/timeout similarly preserve original envelope.                                      | Current decision-gating rows; AC-20.                                  |
| AC-20     | WORKER-20-exceptions             | Characterize fork and dedicated junior/external-reviewer paths without universal interception claims.                                         | Pinned hook1035–1084.                                                 |
| AC-21     | WORKER-21-workflow               | Workflow inner launches receive upstream-equivalent advice, not transparent interception.                                                     | PORT-SCOPE gate2; pinned README.                                      |
| AC-26     | WORKER-26-lifecycle              | No stale decision after session/branch/compaction/reload/shutdown; cleanup idempotent/run-scoped.                                             | AC-26; ticket06.                                                      |

## Coverage status

Production adapter remains incomplete. Four historical feasibility/characterization tests pass; they do not test System One or new override authority. Effective-agent discovery is no longer generically required for MODEL policy. Current bounded spike investigates the separate first-child-request EFFORT seam. Existing 340 baseline tests/1,102 assertions remain unchanged. No new full-suite run is needed for reconnaissance.
