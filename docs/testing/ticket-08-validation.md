# Ticket 08 — validation evidence

## F3 implementation checkpoint (supersedes historical limitations below)

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
