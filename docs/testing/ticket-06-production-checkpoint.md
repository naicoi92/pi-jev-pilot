# Ticket 06 — production routing checkpoint, incomplete

## Current authority and implementation

Integration `a13d38c` supersedes child-default effort preservation: a valid medium decision replaces configured max or low. The old child-first-request transport blocker is **superseded, not solved by ENV**. Historical baseline probes remain characterizations. Main-session effort policy is unchanged.

`src/worker-adapter.ts` now intercepts ordinary `subagent` tool calls through supported Pi APIs. It makes one System One decision from bounded brief/type/available caller description, no parent transcript; shared tier policy uses caller-or-physical-parent identity. Shared effort policy uses unknown current effort rather than hidden executor defaults. The worker-specific effort instructions and common rubric come from pinned Jev Pilot 0.12.1 `hooks/model-router.policy.ts:262–280,312–320`. Numeric policy, confidence and risk stay shared; final physical model clamps the selected effort. The model suffix reaches the existing executor; there is no independent launcher.

Disabled/error/timeout retain the original envelope. Cancellation blocks launch and aborts classification; actual direct children inherit Pi cancellation. Routed async run IDs retained from public tool results receive documented `subagents:rpc:v1:request` stop requests on parent abort or session transition. Cleanup is idempotent and run-scoped; completion removes ownership. Explicit/implicit fork bypass routing; junior/reviewer deterministic slots remain specialized. Workflows receive advice, not transparent inner interception.

## Child main-hook isolation

pi-subagents 0.80.0 `docs/agents.md:522` says local foreground children do not load ambient hooks, but detached children do unless extensions are explicitly overridden. Default ambient inheritance must not classify the child a second time or overwrite its selected medium.

A static `src/worker-child.ts` helper is delivered only through public `registerRequiredChildExtensions`, without `requireForAllRunners`. It emits package-owned `jev-pilot:execution-child:v1` with child session ID at public `session_start`. The ambient main extension listens on the public process-local bus and skips only its automatic user-message decision hook for that ID. It does not disable the adapter, cancellation or lifecycle handlers. Helper does not classify or change model/thinking. No cross-process numeric decision transport, ENV, private state or generated per-run module is used.

Actual packed async default-ambient execution proves listener/start ordering before `message_start`: one parent classification plus exactly one worker classification, no child main decision. The direct path also preserves selected/medium. An ordinary user fork with an exact fake `active_agent` project line still runs main classification. A marker-regex approach was investigated then discarded: source marker `child-launch.js:207–230` is not a robust identity contract and is not in production code.

## Concrete unresolved coexistence

The supported helper API permits **one immutable registration per parent session** (`docs/agents.md:451`; published implementation `src/shared/required-child-extensions.js:60–74`). The export `pi-subagents/required-child-extensions` offers register and idempotent dispose, no documented get/compose/update. Same-session repeated registration throws:

> Required child extensions are already registered for session '<id>'; dispose them first.

The adapter does not dispose or overwrite another owner, inspect its registry, or proceed without helper and risk duplicate classification. It fails before worker classification/model mutation/launch with an actionable registration error. This is defensive negative behavior, **not coexistence support or an approved scope waiver**. Parent must decide the real operator trade-off before ticket completion. This does not imply all ordinary worker routing is impossible or impose a local-only assumption.

The historical six feasibility probes now explicitly disable production worker routing and all automatic main capabilities, preserving their original fixed-suffix/gap/default meanings and mandatory machine guard. They are not changed into collision tests. A separate packed production collision case proves no worker classifier request and no child launch.

## Evidence and validation

Exact pairing remains official Pi/AI1.4.0, pi-subagents/preflight0.80.0, Bun1.4.3, Nodev26.8.1, pinned Jev0.12.1 commit `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`. Disposable HOME/agent/runtime and loopback mocks only; no real credentials, paid inference, remote/machine attempt or host/cache edits.

Packed CLI tests build a tarball with `bun pm pack --filename`, extract to an isolated directory, install through official `pi install`, and enable the executor separately. Before enabling the executor they run the packed package alone and inspect the actual provider tool catalogue: dependency presence does not register `subagent`.

Final focused run: **25 pass / 0 fail / 259 assertions across four files**,106.71s. `bun run lint`, `bun run typecheck` (24 files) pass. Full suite deliberately not rerun after supervisor required stopping at concrete coexistence evidence rather than broadening architecture; accepted340 baseline tests are unchanged.

| Production case                                       | Actual outcome                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Direct configured max/low, caller configured→selected | selected:medium, output CHILD_RECEIPT_OK, exit0, usage10/4                               |
| Async configured max/low                              | selected/medium, complete, processTerminal observed, usage10/4                           |
| Same identity                                         | selected still receives medium                                                           |
| Non-reasoning final model                             | requested medium dispatches off                                                          |
| Disabled/error/timeout                                | original envelope unchanged, configured max/low retained; disabled zero worker decisions |
| Classifier cancellation                               | HTTP abort observed, no child starts                                                     |
| Direct child cancellation                             | provider abort observed, executor error Request aborted                                  |
| Async child cancellation                              | exact run receives one stop; stopped receipt and observed processTerminal                |
| Existing required-child owner                         | actionable collision before decision/mutation/launch; not claimed supported              |
| Unit cleanup                                          | only routed async identity stopped once, unrelated identity untouched                    |
| User fork/project lookalike                           | main classification still runs                                                           |

The first production run found two fixture/cancellation issues: direct abort has error details without a results array (assert actual error, not nonexistent row); async cancel after parent already settled cannot abort that idle turn, so the real test starts an active follow-up and aborts it. This exposed need to observe public `agent_settled.aborted`; adapter now stops owned detached work on that event. Neither change bypasses executor controls.

## Remaining acceptance work

No independent review or merge approval. Exact-tree full suite, runtime-agent production/machine applicability coverage, actual coexistence resolution, retained-resume isolation, workflow production advice verification and additional original-envelope async fallback coverage remain. Do not treat 25 focused GREEN tests as all ticket acceptance. Do not merge this checkpoint as complete.
