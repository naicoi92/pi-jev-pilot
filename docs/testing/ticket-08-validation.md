# Ticket 08 — validation evidence

## Worker workflow teardown correction — bounded GREEN, original full gate RED

Corrective baseline: clean `536542e9b913642c341ed37f5e8fb65084d51cc3`, tree `bb4638306f18cc8efd687bbe246d0557d1bcfce4`. Only `tests/worker-routing-cli.test.ts` and testing documentation change. The fork pin `5f8adccb235f1a45858c84b5110c105108947de2`, production, dependency lock, limiter and strict `WorkerEvidence.finish()`/`reapWorkerCli()` remain unchanged. The [worker corrective matrix](ticket-08-matrix.md#worker-workflow-teardown-correction-before-corrective-tests) preceded test edits and execution.

**The actual original full run stays RED:** 442 pass, 1 fail, 1 error, 2479 assertions, exit1, without wrapper timeout. Its exact `i6PZ3P` child `670744c2-03f4-4ba6-9e4f-a3a53c6ecfd3`, runner instance `5b016c77-5666-4530-8c85-3349bf161ad1`, remains logical complete/task exit0/`CHILD_RECEIPT_OK` but terminal pending. Original dependencies, full-run evidence and historical `LgaZSo` were not changed. The exact bounded pre-fix reproduction passed; no forced RED or claim of deterministic reproduction.

### Ordering and path coverage

The original parent RPC trace ends with `tool_execution_end` at index31, `agent_end`42 and `agent_settled`43. There is no status barrier. The fixture then reaps the parent before strict evidence validation. The pinned executor's `src/runs/background/async-execution.ts` native runner `close` listener invokes `finalizeProcessTerminal`; logical workflow output does not establish that close observation. This proves a missing fixture barrier, not the sole historical cause.

All 46 worker scenarios were inspected in source and existing full-run receipts. Only `junior-workflow-routing-off` actually executes a workflow script. `slot-workflow` and `workflow-guidance` inspect model-visible workflow advice but launch direct workers (`mode: single`). Existing async/lifecycle/resume paths already await real observed terminal receipts; error/cancellation and no-child paths remain separate.

The new barrier is selected by the result's `mode: workflow`, compares every exact result run ID with the complete public workflow inventory, and awaits public Extension RPC `status` for every child. One shared 10-second deadline bounds prompt and receipt polling; each observer RPC has a 3-second timer. Pending polls yield50ms only while pending. Unknown/missing proof fails. Parent and HTTP server remain alive until observed proof; no terminal rewrite, PID-absence substitution, runner-directory rename or dependency edit. A25-second teardown-hook budget covers the unchanged7-second reap escalation,10-second strict evidence deadline and I/O; the120-second test budget is unchanged.

### Actual focused results

Each command used `GIT_TERMINAL_PROMPT=0` and a separate owned `JEV_WORKER_EVIDENCE_DIR`; no TMPDIR override. Exact commands, binding hashes, output and actual exit files are in the durable packet below.

| Run                                                                                 | Actual result                                                                                                        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Before fix: exact `WORKER-19-junior-workflow-routing-off`                           | 1 pass,0 fail,45 filtered,16 assertions,14.96s,exit0; fixture `4ieuBZ`, child `da4a8fca-d870-4f0f-aea2-3c736e3e09d5` |
| After fix: routing-off workflow/custom workflow guidance/strategy workflow guidance | 3 pass,0 fail,43 filtered,128 assertions,37.12s,exit0                                                                |
| Allowed + denied junior lifecycle CLI files                                         | 10 pass,0 fail,161 assertions,130.93s,exit0                                                                          |
| Direct cancellation + lifecycle/reload + retained resume                            | 3 pass,0 fail,43 filtered,95 assertions,47.24s,exit0                                                                 |

The corrected workflow fixture `Go3KO5` measured **six public pending replies followed by observed** for child `47c0db92-dd78-4447-9519-c75876924ae5`, runner `5e4d5c94-0b2e-401b-80d8-60fefabe7a2e`. Logical task remained exit0 with `CHILD_RECEIPT_OK`, one configured-model child request and two parent requests. Last observed reply:1792751032407; barrier receipt:1792751032428 with parent exitCode null; actual parent native close:1792751032447,exit0/null signal. This directly demonstrates why logical completion is insufficient and that the barrier precedes parent teardown.

Allowed workflow control `QS9MAR`: junior40/task exit1 child `0857a4dc-b1c7-44a3-b263-95550508cb32`, sibling45/task exit0 child `ac800a41-ce0a-42f3-ae7c-1864c3037e87`; both public terminals observed. Denied direct/async/workflow controls retain zero junior requests; retained-denied retains40 admitted requests and zero after denial. All17 focused fixture receipts passed unchanged strict cleanup. A read-only audit found14 observed status-bearing async runs across these fixtures; this is not a count of all direct/native processes.

Durable evidence: `/Users/naicoi/.pi/agent/sessions/--Users-naicoi-Projects-pi-jev-pilot--/subagent-artifacts/outputs/e3c4c015-475d-4eee-9ea1-f5362e554f88/ticket-08/workflow-ordering-evidence/`. It contains `run-focused.sh`, per-run exact command/source-hash bindings and actual exits, raw traces, result/envelope/provider configurations, sessions, public status RPC request/replies, native terminal receipts, `parent-close.json`, `workflow-barrier.json`, cleanup receipts, and read-only audit scripts/results. Original full RED remains under artifact run `356cb287-0464-4cdf-a03b-374b1a3a2c2a`.

Supplemental gates passed with exit0: `bun run lint`, `bun run fmt:check` (57 files), `bun run typecheck` (147 files), `git diff --check`, and the protected-source comparison against the baseline. Staged files were empty before commit; only the three explicitly scoped files are included in the corrective commit.

No new full suite was run. **Fresh independent parent review must precede any new full verification.** Focused GREEN is not full-suite acceptance or merge readiness. No tracker/spec-status, integration-branch, publication or merge change.

## Workflow fixture ordering correction — focused GREEN, full gate pending

Corrective baseline: clean `e328ea71b005381db63571858783059e4c1345fb`, tree `db82d30e34673f170a0e4c2f1fcaa4c593351e02`. This change is test-fixture ordering only. The Git fork pin remains `5f8adccb235f1a45858c84b5110c105108947de2`; production, helper counter/policy, `WorkerEvidence.finish()` and `reapWorkerCli()` are unchanged. The [corrective matrix](ticket-08-matrix.md#workflow-fixture-ordering-correction-before-corrective-tests) was updated before test edits and execution.

**Missing teardown barrier:** workflow logical results can precede native child close, whose observation/finalization belongs to the still-running parent. The fixture now validates exactly two distinct child IDs and the junior/sibling lanes and task outcomes, then reads public Extension RPC `status` for both IDs until `processTerminal.state` is `observed`, before parent reap. A shared 10-second polling deadline is passed through prompt/receipt waits; each Extension RPC has a 3-second timer, with 50ms polling only while pending. No long sleep, synthetic terminal proof, weaker assertions, new worker engine or private API is used. The existing 150ms no-automatic-resume check and parent alive RPC remain after the barrier.

Three evidence sets must remain distinct:

| Evidence set                                   | Actual result / interpretation                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical final pairing, `LgaZSo`             | **9 pass, 1 fail, 1 error**; both workflow child terminal receipts remain pending; original dependencies retained. Not overwritten or reclassified.                                                                                                                                   |
| Executed diagnostic control, `UfVFZm`          | Separate owned harness: 1 pass, 49 assertions, 17.71s; both public child states transitioned pending → observed while parent/HTTP fixture remained alive. Supports ordering diagnosis, not sole-cause proof of the old failure. The file-status-only proposal was not runtime-tested. |
| Actual repository corrective fixture, `VONtgs` | Workflow41 first: **1 pass, 0 fail, 5 filtered, 35 assertions, 17.44s, exit0**. Both exact children were already observed on their first public reads; no claim that this run measured pending → observed.                                                                            |
| Actual repository allowed/denied controls      | **10 pass, 0 fail, 154 assertions, 155.55s, exit0** across the two focused CLI files; workflow fixture `qMkyD6` also passed both public observed checks. Overlaps the first run; not eleven unique tests or a full suite.                                                             |

Commands, each preceded by `TMPDIR=/tmp/pi-jev-ticket-08-ordering-fix-5c8ab3df/fixtures`, `GIT_TERMINAL_PROMPT=0` and an owned `JEV_WORKER_EVIDENCE_DIR` under the durable packet:

```bash
bun test tests/junior-turn-bound-cli.test.ts --test-name-pattern BOUND-19-workflow41
bun test tests/junior-turn-bound-cli.test.ts tests/junior-required-denied-cli.test.ts
```

| Run                     | Junior task / ID                                                            | Sibling task / ID                                                        |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Workflow-first `VONtgs` | 40 requests, cap failure/task exit1; `3bcb121a-46ea-41e8-a77d-f927d087b763` | 45 requests, complete/task exit0; `9ed509a4-f005-4ac8-b0fc-33b48a5ae779` |
| Focused `qMkyD6`        | 40 requests, cap failure/task exit1; `a9dd57bb-ad02-4e17-97eb-9f53fb30c7fa` | 45 requests, complete/task exit0; `827ec648-6034-4366-a184-b0c5e2229255` |

All four native runners have observed proof, native exit0/null signal (separate from task exit), and matching run/runner identities. Parent request count remains2 in both workflows. Denied direct/async/workflow junior requests remain0; the denied workflow's two ordinary siblings total90. Retained-denied spends40 before denial and adds zero afterward; async/cancel-resume still preserve retained budget and fresh-run independence. Unchanged strict cleanup passed for all eleven owned fixtures, saving receipts after parent reap and removing only owned disposable dependencies. No old session was revived or cleaned up.

Durable packet: `/Users/naicoi/.pi/agent/sessions/--Users-naicoi-Projects-pi-jev-pilot--/subagent-artifacts/outputs/5c8ab3df-37f9-45c8-ac41-b86f0f557317/ticket-08/workflow-ordering-evidence/`. It contains exact command/exit logs, executed source/diff, raw status RPC request/replies, trace/results/session/native terminal receipts, cleanup, identity checks and `measured-summary.json`. The prior diagnosis and full evidence remain in parent artifact run `14ce3b79-fa63-4d4e-834f-43d6da462f44`.

`bun run lint`, `bun run fmt:check` (57 files), `bun run typecheck` (147 files) and `git diff --check` all passed with exit0. Receipt verification also passed: public run IDs/native runner identities match, every real retained runner is observed, owned disposable cleanup completed, and original `LgaZSo` still has both pending receipts and retained dependencies.

No controlled unsafe RED was rerun: the preserved historical RED and executed diagnostic control are the approved starting evidence, not a fresh original-versus-fix causality experiment. **Parent fresh full-suite verification and independent integrated reviewer gate remain pending.** No tracker/spec state, dependency, integration branch, publication or merge-readiness claim changes here.

## Historical final fork pairing — bounded verification, workflow terminal gate OPEN

Current integration starts from clean `4ccc1ed6beba0ee3f417e81b0905a950db254b9f` (tree `8ff153e5019d22b87f6a126d71f48cd65a5806aa`). It consumes the user-owned public fork `naicoi92/pi-subagents@5f8adccb235f1a45858c84b5110c105108947de2`, tree `7201b00488f688479241a4e44be9b42e6a403a0e`. Bun regenerated the lock with Git locator and integrity `sha512-1KaSHfPWznMSt7ZjwNp+ZmGlJMjzTivUgt4bBBZCTludtTa6Zyp4YUYTsFzelLly4evumSNRpXeuxPqEJPzDrg==`; version 0.80.0 is a source label only. Official Pi installation uses `git:github.com/naicoi92/pi-subagents@5f8adccb235f1a45858c84b5110c105108947de2`, verified in the separate new-head Git install proof referenced by the fork checkpoint. No npm fallback, publication or dependency-repository edit.

The only production behavior delta is junior `requiredExtensions` with ID `jev-pilot-junior-turn-bound` and portable `fileURLToPath`; counter/model/effort policy remains unchanged. All executor fixtures pin the Git source; packed fixtures resolve public APIs and activate one physical executor. The feasibility fixture now installs a packed Jev copy rather than the working source, avoiding a second physical dependency owner. Runtime imports alone do not activate tools.

Fresh local deterministic results, raw logs and receipts: `/tmp/ticket08-fork-final/`:

| Gate                                                                         | Actual result                                                                                                                                  |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun install`                                                                | First attempt timed out at 120 seconds without lock delta; subsequent verbose install exit0; lock regenerated (no hand editing)                |
| Focused crew/config/helper/adapter unit tests                                | 34 pass, 0 fail, 232 assertions                                                                                                                |
| Allowed + denied packed junior CLI                                           | **9 pass, 1 fail, 1 error**, 129 assertions, outer exit1; not all GREEN                                                                        |
| Denied direct/async/workflow/retained                                        | All four PASS: initial junior requests 0/0/0; retained admitted 40 then zero additional after denial. Sibling45; workflow two siblings total90 |
| Allowed direct39/direct40/direct41                                           | PASS: junior39/40/40, natural completion at39/40; needs41 reports cap error                                                                    |
| Allowed async41/cancel-resume                                                | PASS: retained session resumes/reloads do not refund; independent fresh child gets its own budget                                              |
| Ordinary direct-max/disabled/classifier-cancel                               | 3 pass, 0 fail, 43 filtered, 50 assertions                                                                                                     |
| Packed feasibility direct                                                    | 1 pass, 0 fail, 5 filtered, 9 assertions                                                                                                       |
| Main routing/default-off controls                                            | 2 pass, 0 fail, 49 filtered, 10 assertions                                                                                                     |
| `bun run lint`, `bun run fmt:check`, `bun run typecheck`, `git diff --check` | PASS; final logs retained separately                                                                                                           |

**Workflow41 remaining gate:** `receipts/pi-jev-junior-bound-LgaZSo/trace.json` measures junior40 and sibling45, with cap failure and sibling completion. The test body passed its output/count checks, but cleanup could not prove real runner terminal observation. Both `status.json` files retain `processTerminal.state: pending`:

- Junior run `80a70302-40ee-47dd-ac41-ad513ae488a5`, PID61110, runner instance `9c6cfd6f-8e1a-407f-af69-6a55c9c19a04`: failed/exit1, helper ACK and literal40 error.
- Sibling run `9427acda-d6ad-4dd9-a00d-d5fb3edea877`, PID61111, runner instance `d5153f6f-077d-468e-a3d0-e3d2bba2ce4a`: complete/exit0, no junior requirement.

Paths are `runtime/async-subagent-runs/<runID>/status.json` under that receipt. Original owned fixture is `/var/folders/kx/1fk4553s26d5ygj1wrzbv5200000gn/T/pi-jev-junior-bound-LgaZSo`; dependencies remain intact because terminal proof is missing. No runner directory was renamed, pruned, or given synthetic terminal state. Absence in a later process listing is not observed-terminal proof.

Recorded parent RPC order: ready response index1, launch response2, workflow/tool events, `agent_settled`46, alive response47. Body awaits parent settled, verifies junior/sibling outputs, waits150ms and alive; it does **not** await workflow child process-terminal status before close. afterEach reaps parent first (actual close exit0 in commands.json), stops fixture HTTP, then WorkerEvidence waits for observed child terminal and fails. This ordering differs from explicit status waits in async/resume cases. No root cause is inferred. Historical workflow GREEN `aetzTF` below remains historical, not a fresh pass for this fork.

The denied fixture only moves exact admission-only directories containing `[run-fanout-budget.json]` after parent reap, preserving them as admission reservations; it never hides a real status-bearing runner. Full-suite verification and independent integrated review remain required; no ticket/spec status or acceptance transition is made.

## F3 mandatory-helper contract-negative checkpoint — BLOCKED

This checkpoint supersedes any implication below that optional helper delivery closes F3. Inspected candidate: clean `3e4ee41a3ba5e603947b6c42d4468135afacebbc`, tree `b484777e3b6fb57e95de15446b8554f37eef322d`. Latest independent review is `outputs/3eb72e91-36db-41e1-9438-16ece100f99f/ticket-08/turn-bound-review.md` in the parent session artifacts: F3 BLOCK, F1/F2/F4 CLOSED. Local operator authority remains preserve upstream 40 and continue; no remote-room check is claimed.

**Actual failure, not a hypothetical coverage gap:** the parent-run packed fixture `/tmp/pi-jev-ticket-08-review-3e4ee41/deny-extensions.test.ts` registers the public ceiling at lines 114–116. Its unchanged cap expectation fails in `repro.log`: expected 40 junior requests, received 41 (0 pass / 1 fail). Receipt `receipts/pi-jev-junior-bound-w0yBmD/trace.json` records actual provider ordinal 41; `results.jsonl` records `COMPLETE_junior_41`, exitCode 0, isError false, `extensionsDenied:true`, removedExtensionCount 1, no required extensions and no actionable conflict. This is a real provider request, not synthetic abort telemetry. The corrective writer inspected these existing artifacts; it did not rerun the reproduction.

### Supported-contract boundary

Installed dependency is exactly pi-subagents **0.80.0** (`node_modules/pi-subagents/package.json:4`), with Pi **1.4.0** declared in this repository. Paths below describe installed public contracts or read-only implementation evidence, not imports added to production code.

| Contract / evidence                | Exact installed path and lines                                                                                                                                                        | Consequence                                                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public runtime definition          | `node_modules/pi-subagents/src/agents/runtime-agent-registry.d.ts:6–41`, exposed by `src/api/agents.d.ts:1–4`                                                                         | `extensions` and `subagentOnlyExtensions` at lines 30–31 are optional; there is no per-agent required-helper field or launch/admission callback.                                                                                                                  |
| Runtime settings ownership         | `node_modules/pi-subagents/docs/extension-api.md:207–211`                                                                                                                             | Non-model fields remain extension-owned, but this does not override capability ceilings.                                                                                                                                                                          |
| Public required-child registration | `node_modules/pi-subagents/src/shared/required-child-extensions.d.ts:7–24`, exposed by `src/api/required-child-extensions.d.ts:1` and package exports at `package.json:98–100`        | Input has only `sessionId`, `extensions`, `requireForAllRunners`; required delivery is parent-session-wide, with no agent selector. It cannot make only junior mandatory without affecting ordinary siblings.                                                     |
| Capability semantics               | `node_modules/pi-subagents/docs/extension-api.md:372–401`; `src/runs/shared/child-tool-plan.js:170–176,283–300`                                                                       | `denyExtensions` suppresses the optional helper; only required extensions cause automatic conflict. The ceiling remains authoritative.                                                                                                                            |
| Public current policy query        | `node_modules/pi-subagents/src/api/capability-ceiling.d.ts:1`; `src/runs/shared/capability-ceiling.js:129–139`                                                                        | `resolveCurrentSubagentCapabilityCeiling(sessionId)` reads process-local registrations. `resolveSubagentCapabilityCeiling(sessionId, inherited)` needs the caller to supply an inherited snapshot. Neither supplies an observation hook for each executor launch. |
| Effective executor policy          | `node_modules/pi-subagents/src/runs/foreground/execution.js:1617–1619`; `src/runs/background/async-execution.js:1596`; `src/runs/foreground/subagent-executor.js:1996–1998,5002,6020` | The executor separately intersects current, inherited and retained authority during direct/async/recovery/workflow execution. A current-process lookup alone is not proof of the effective retained/inner policy.                                                 |
| Public preflight                   | `node_modules/pi-subagents/docs/extension-api.md:257–325`; `src/api/preflight.d.ts:20–83,178`                                                                                         | This is an explicit side-effect-free resolver, not a registered per-agent admission hook or a recovery/workflow-inner interception mechanism.                                                                                                                     |

A narrow direct `tool_call` precheck is possible using the public current-session query. It cannot fulfill the complete contract: workflow scripts expose an outer script/resource call, not every inner agent launch, and retained recovery is resolved by the executor rather than through a public per-junior observation callback. `src/crew-junior.ts:66–69` currently guards direct registration errors only. Installing a mandatory limiter for every child would either cap ordinary siblings or make their extension-denying launches conflict; it is not an approved correction.

The supervisor explicitly approved stopping implementation workarounds after this concrete gap report. No private registry, internal import, private ENV, prompt identity, new engine, timeout substitute, global mandatory limiter, host cache patch or dependency change was introduced. No production or test file changed. The [pending regression matrix](ticket-08-matrix.md#f3-mandatory-helper-regression-matrix--blocked-missing-supported-seam) requires zero junior requests plus an actionable conflict across direct/async/workflow/recovery and an admitted uncapped sibling; merely asserting at most 40 is insufficient. This is **BLOCKED: missing supported seam**, not a fixed bug or an untestable bug.

### Preserved evidence and pending gates

Original RED `repro.log` SHA-256: `cef193ecfd80748cdb742cc872acc576cd86c0ae3ec582ea164f5bed4e806b29`. Interrupted `/tmp/ticket08-turn-bound-logs/final-full.log` SHA-256: `02284c5bca84b7e7e8ddb3b46acbc657716d2e8aa4ff0c9c51e3665c2c94cbd6`. Both are preserved without overwrite. The interrupted suite has no final summary/exit and is not GREEN. No fixture was launched and no process/terminal cleanup was attempted by this writer; recorded leftovers were not killed or deleted.

Documentation-only validation passed: `bun run lint` (exit 0), `bun check` (35 files, no type errors, exit 0), `bun run fmt:check` (56 files, exit 0), and `git diff --check` (exit 0). Logs are `/tmp/ticket08-mandatory-bound-checkpoint/{lint,typecheck,fmt-check}.log`. The first format check identified only the two edited Markdown tables; `bunx oxfmt --write docs/testing/ticket-08-matrix.md docs/testing/ticket-08-validation.md` corrected them before the passing check. No new focused runtime GREEN or full-suite run is claimed. Independent review, a user-approved dependency-scope/public-seam decision, a production correction with the matrix regressions, and subsequent full-suite/integration verification remain pending. Tracker/spec/integration branches and F1/F2/F4 source are unchanged.

## F3 implementation checkpoint (historical; mandatory-helper gap above remains open)

Implementation base: clean `3b795922afe7acf33300ce35464371ed0924069a`, merging corrective `0867f708130ef832d62a81179e06a0e496b8a5ca` with doc-authority integration `2390ca6`. No remote room connector/work ID was supplied; no remote-room check is claimed. The operator requires upstream junior 40 turns, without a no-cap waiver or timeout substitution. Pinned source remains exactly `5d27135b34edf81b40c0bf1df01ae401f6b72ea7` (`hooks/crew.ts:396–424`).

`src/crew-junior.ts` adds only an agent-scoped public `subagentOnlyExtensions` path. Prompt, tool names, selected physical model, registration ownership, main and ordinary-worker policies are unchanged. `src/junior-turn-bound.ts` reserves one assistant agent turn at public `turn_start`, before provider activity, and persists the session-owned monotonic counter with `pi.appendEntry`. Errors/cancellation consume the reservation; tool count, HTTP retry count and synthetic abort events are not the budget. It restores all public session entries, not compacted model context or only the current branch. Natural completion at 40 is allowed; further work aborts the local child with an explicit error. No parent/sibling stop, fake success, automatic resume, private identity/ENV/import, executor patch or new engine is used. Exhausted sessions also reject compaction and idle cache warming.

The public `message_end` replacement changes only a synthetic abort/error's error text, preserving its content and real error status. Child output/session/transcript artifacts remain available; Pi/executor telemetry may still include a 41st synthetic error turn. Executor `resumable` metadata is not changed: explicit revival reuses the canonical child session and cannot grant another 40 turns. A genuinely fresh independent child has a new budget. No exact equivalence to unavailable upstream runtime counting or termination internals is claimed. Compaction/tree retention is covered by public-event contract tests; actual CLI covers retained cancellation, resume, process reload and extension reload.

### Observed RED and focused GREEN

Matrix additions preceded all new tests. Initial `unit-red.log` records the missing production helper. Historical probe and original corrective reproduction evidence remain unchanged. Production tracer `direct41.log` passed before expanding the matrix. First CLI matrix failed because the fixture read an async _launch_ receipt as a terminal receipt and assumed stopped runs were resumable. Second async fixture waited for a changed runner under the original ID; public resume actually returns a **new run ID using the same child session**. All failures are retained at `/tmp/ticket08-turn-bound-logs/cli-first-matrix.log` and `cli-resume-second.log`; these are not relabeled runtime failures or hidden.

Final focused command (with persisted-entry and canonical-session assertions):

```bash
JEV_WORKER_EVIDENCE_DIR=/tmp/ticket08-turn-bound-focused-receipts bun test tests/junior-turn-bound.test.ts tests/junior-turn-bound-cli.test.ts tests/crew-junior.test.ts tests/crew-config.test.ts
```

Observed **23 pass / 0 fail / 260 assertions / 44.89s**; log `/tmp/ticket08-turn-bound-logs/focused-final-with-persistence.log`. Six new contract tests plus six new actual packed CLI tests cover the F3 rows in the matrix. `bun run lint`, `bun run typecheck` (35 files), `bun run fmt:check` and `git diff --check` passed before the final checkpoint.

| Packed case     | Focused receipt suffix | Actual observation                                                                                                                                                                                    |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Natural 39      | `00NZJc`               | 39 junior requests; final output and exitCode 0                                                                                                                                                       |
| Natural 40      | `ptZ2lJ`               | 40 junior requests; final output and exitCode 0                                                                                                                                                       |
| Direct needs 41 | `8zV1z7`               | 40 requests, 80 tool mutations (two per turn), no request/tool turn 41; explicit cap error                                                                                                            |
| Async needs 41  | `dOuiJt`               | failed terminal + observed native exit; public revival retains same session, zero extra junior requests; process/extension reload still zero; fresh independent launch gets 40                        |
| Workflow        | `aetzTF`               | junior 40 failed, concurrent sibling 45 complete; outer script truthfully returns junior `ok:false`, not junior success                                                                               |
| Cancel/resume   | `LGETdj`               | cancellation in request 39; native stopped terminal; executor correctly rejects resume; public retained Pi session has only one remaining turn; reload cannot reset; independent fresh launch gets 40 |

Receipt prefix is `/tmp/ticket08-turn-bound-focused-receipts/pi-jev-junior-bound-`. WorkerEvidence reaps each CLI, requires observed native terminal receipts for detached children, saves source/session/output/trace and prunes only its owned fixture dependencies. The final full-suite artifact root is `/tmp/ticket08-turn-bound-final-receipts`; command/output/exit status and exact tested checkpoint identity are retained at `/tmp/ticket08-turn-bound-logs/final-*`. Results are reported in the external implementation handback, not inferred from historical counts. No full-suite success is claimed by this pre-gate checkpoint.

### Committed correction bookkeeping (F1/F2/F4 closed by independent review)

Corrective `0867f70` focused log: **23 pass / 0 fail / 223 assertions / 81.48s**; regression log: **105 pass / 0 fail / 362 assertions / 67.86s**, with overlap, not a full-suite total. Logs are `/tmp/ticket08-correction-logs/focused-green.log` and `regression.log`. Final selected direct receipt is **`j4A6qJ`**, first-slot async **`S8ahi5`**, final workflow **`OS4lWO`**, under `/tmp/ticket08-correction-green-receipts/pi-jev-worker-production-<suffix>`. Advice/control receipts are `isUVxQ` and `ukrwkn`; explicit-null/omitted-default tests remain in `tests/crew-config.test.ts`.

Earlier `tSUQ9V` is not final selected-direct evidence. `myx39D` has correct workflow execution but its command FAILED (classifier count expected 1, actual 2); only `OS4lWO` is final workflow GREEN. Executor-owned main classification remains, distinct from zero ordinary-worker classifications. Original copied harness rerun `/tmp/ticket08-correction-logs/original-repro-green.log` is still **0 pass / 1 fail / 13 assertions / 7.48s**, despite its filename: line 668 incorrectly requires a rewritten model envelope under disabled routing. Actual `ecEcIV` child is configured/medium, exitCode 0, output `CHILD_RECEIPT_OK`, usage 10/4. Disabled-routing authority preserves the original envelope, so do not weaken it to satisfy the historical harness. Preserve the original RED wrong-target log `/tmp/pi-jev-ticket-08-review-b5b6b44/repro.log`.

Independent fresh review and parent integration gates remain required. No tracker/spec/status edits, publishing, integration merge, paid calls, real credentials or remote machines were used.

## Historical candidate and authority

Branch `ticket/08-custom-slots-crew`, clean baseline `265e282b8f79235f5d511976eb05db58b8d06fd8`. Integration was rechecked before commit and remained at that exact baseline (no integration commits to merge). Pinned read-only source `/tmp/pi-jev-upstream-5d27135` verified at `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`. CodeGraph initialized/status verified on this new worktree before structural exploration.

Contract: ticket08, parent AC-02/03/13/15/18/19/20/21/27, decision-gating ordinary model/effort authority, ticket07 risk precedence. `ticket-08-matrix.md` was created before tests. No tracker/spec/status changes, dependency versions, host caches, independent engine, remote execution or paid providers were introduced.

## RED → GREEN

- `bun test tests/crew-config.test.ts`: RED missing crew module, log `/tmp/ticket08-config-red.log`; GREEN after minimal config implementation, 1 test / 3 assertions.
- Subsequent focused config/policy/adapter validation: 23 tests / 82 assertions GREEN (`/tmp/ticket08-focused.log`).
- First actual packed slot/junior pass: four slot scenarios GREEN, two junior RED (`/tmp/ticket08-cli-focused.log`). Installed executor rejected unsupported runtime `maxTurns`. Removed that unsupported field rather than claiming enforcement.
- Next junior execution ran real children but fixture expected an invented off thinking field. Actual provider requests proved inherited medium; specialized branch correctly issues no worker classification. Corrected the fixture to assert provider settings and real receipts without inventing receipt fields. Final focused junior: 2 tests / 32 assertions GREEN (`/tmp/ticket08-junior-green.log`).
- Packed workflow/collision: 2 tests / 37 assertions GREEN (`/tmp/ticket08-additional.log`). Junior strategy real CLI gates: 4 tests / 28 assertions GREEN; ownership/error unit tests: 2 tests / 8 assertions GREEN.
- Not every additional boundary test was independently observed RED; the initial tracer bullet and real packed integration failures above are the observed RED evidence, not a claim of universal mutation testing.

## Final gates

One final full suite (includes actual CLI/E2E, no redundant whole-E2E rerun):

```text
JEV_WORKER_EVIDENCE_DIR=/tmp/ticket08-final-receipts bun test tests
419 pass
0 fail
2103 expect() calls
Ran 419 tests across 15 files. [690.59s]
```

Baseline accepted suite was 396 tests / 1881 assertions; candidate adds 23 tests / 222 assertions. Full output `/tmp/ticket08-full.log`. `bun run lint`, `bun run typecheck` (32 files), `bun run fmt:check`, `git diff --check` all passed. Formatter is oxfmt; no Prettier.

## Packed real adapter receipts

All below live under `/tmp/ticket08-final-receipts/<directory>/trace.json`, with package source/config, commands, sessions, terminal/usage receipts and `cleanup.json` retained. Pi 1.4.0 and installed pi-subagents 0.80.0, disposable HOME, local HTTP System One/provider fixtures only.

| Scenario                    | Directory suffix | Worker classifier count | Actual child provider model / effort |
| --------------------------- | ---------------- | ----------------------- | ------------------------------------ |
| standard candidates         | `q334Cw`         | 1                       | selected / medium                    |
| budget custom direct        | `Gg5Vw6`         | 1                       | selected / medium                    |
| budget custom async         | `JGykaR`         | 1                       | selected / medium                    |
| approved risk > .7          | `9RLKdh`         | 1                       | configured deep / high               |
| configured junior direct    | `8OBKJE`         | 0                       | configured / medium                  |
| first-slot junior async     | `alG13S`         | 0                       | selected / medium                    |
| custom workflow advice      | `YPMv6W`         | 1                       | selected / medium                    |
| configured junior collision | `Mtmni4`         | 0                       | no child; actionable collision       |

Directory prefix is `pi-jev-worker-production-`. Async cases assert observed terminal process state, complete state, output and token counts. Direct cases assert exit code, output and usage. Worker payloads remain brief/type only, no parent history, exactly one ordinary worker classification and no child reclassification. Standard omits slots; budget keys replace fast and retain balanced/deep; default `when` remains read-only. Ordinary caller configured model/max or low defaults do not bypass valid slot/effort selection. Existing full-suite privacy, cancel ownership, main policy, skills/design, fallback/retained targets, profile/unknown-runtime/singleton negatives all pass.

Cleanup checks capacity before each install, reaps only owned processes, observes async terminal receipts, saves compact evidence and prunes only fixture dependencies/private cache/tarball. Final listed cleanup receipts report roughly 114 GB available. No global/project cache deletion.

## Explicit limitations

No live paid-provider, remote-machine, real quota/health or credential verification. Source-backed named junior is a specialized mapping, not an ordinary classifier call: executor defaults control its effort. Upstream `maxTurns: 40` has no supported runtime-agent-definition field and is not enforced. Name collision is an actionable negative, not coexistence support. Required-child singleton/profile/unknown-runtime constraints from ticket06 remain. File changes require reload/restart for registered crew membership; there is no live-control system. Public slot-name collision handling is a representation adaptation (`slot::<name>`), not a new reserved-name policy. Independent fresh review is still required before integration/acceptance.
