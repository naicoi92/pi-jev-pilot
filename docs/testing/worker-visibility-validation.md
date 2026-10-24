# Worker model and effort visibility validation

Base: `57ba3d4d0d32462674fe6c5a38f070707b14ad23`, tree `ab189ac1772807935f2ea2df920802ab46cdf08f`. Isolated branch `worker-selection-visibility`, worktree `/Users/naicoi/Projects/pi-jev-worker-visibility`. Parent checkout untouched. No external room mapping claimed. No paid inference, push, global settings changes, executor pin changes or dependency/source-policy changes.

## Implementation and UI contract

`worker-visibility-matrix.md` preceded tests/source edits. Existing adapter classification, policy baseline, selection/clamp, input mutation, cancellation ownership and allowed-launch bookkeeping remain unchanged. New UI calls surround existing decisions only; no extra preflight or classifier HTTP calls.

Public string-array widget and compact status use `jev-pilot-workers`, separate from main `jev-pilot`. Each tool-call identity receives a stable short display label (sequence + six-character hash, not raw caller text). At most four rows visible, twelve retained. Settled rows survive successful agent settlement; no timer clears them immediately. Session shutdown/switch/fork/tree/compaction/reload/aborted settlement clears UI; stale owners cannot restore it. Model/thinking changes retain settled history and convert cancelled pending decisions to adapter-blocked cancellation, without overwriting siblings.

Rows distinguish:

- Pending: `choosing model + effort…` (pipeline state, not an HTTP-start claim).
- Planned selection/retention: `Jev plan · selected/kept <identity> · effort <level> · requested → effective · launch unconfirmed`.
- Failure: `unchanged · service-error/timeout/schema-error`, with retained preflight target/effort when known. Parent policy baseline is never substituted for an omitted executor default.
- Routing disabled: unchanged/executor-owned; zero classifier calls. Workflow inner launches and explicit/implicit fork remain executor-owned. Specialized junior/reviewer slots show deterministic model selection and executor-owned/unknown effort, without introducing classification. Existing custom-slot policy remains unchanged.
- Adapter-blocked cancellation: `not launched · cancelled` only when adapter returns block. Raw provider/configuration errors never enter widget/status.
- Generic tool success: `executor result · launch unconfirmed`. Foreground public native receipt must include exact run identity, one single result, launch digest, launch-resolved extension metadata and executed-turn usage before displaying `executor receipt · target <identity> · effort <level>`. This reports executor receipt settings, not independently verified provider identity or current running state.
- Async result: exact async ID records executor acceptance only. Correlated async-complete reports complete/failed/stopped; model/effort remains unconfirmed because that event does not guarantee native launch settings. No UI polling, worker-done timers, filesystem metadata reads or process-terminal claims.

Allowlisted model identifiers, enum effort, fixed reason labels and hashed call identity only. No task, description, history, credentials, raw error, path, session name or output text enters worker UI.

## Public API inspection

Inspected installed pinned `pi-subagents` public `preflight`, `shared-types`, and runtime event publishers before claims:

- `SubagentLaunchContract.model`/`.thinking` are preview values, not launch receipts.
- `Details`/`SingleResult` expose foreground run ID, model/thinking, launch digest, launch-resolved extension metadata and usage.
- Async tool receipt supplies async ID without authoritative launch model/effort. `subagent:async-complete` carries run ID/outcome but does not guarantee settings for every publication path. UI deliberately does not infer them.
- Pi 1.4.0 `ExtensionUIContext.setWidget(string[])` and `setStatus` are public and supported by RPC.

## Commands and raw evidence

All commands from isolated worktree unless absolute path given. Logs retained under `/tmp/worker-visibility-logs/`. New CLI traces include exact source copy, git HEAD/status/diff commands with exits, HTTP payloads, native receipts, UI protocol records, stderr and reaping outcome. `WorkerEvidence` retains sessions/source/receipts; strict async native `processTerminal.state=observed` gate remains. No failed fixture directories deleted. New fixtures use native stdin close and a bounded failure deadline, no SIGKILL shortcut. Existing packed fixtures retain their original reap semantics; all selected runs passed natively.

| Command                                                                                                                                                                                                                      | Exit/result                                                                                                                                               | Raw evidence                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `codegraph init; codegraph status`                                                                                                                                                                                           | 0; 49 files, 492 nodes                                                                                                                                    | Initial tool transcript; later `codegraph-sync.log`, `codegraph-affected.log` |
| `bun test tests/worker-visibility-cli.test.ts -t CLI-WV-direct` before source edits                                                                                                                                          | 1, expected RED: exact local/selected:medium native receipt and one classifier passed; worker widget count was 0                                          | `red.log`; retained fixture `pi-jev-worker-visibility-direct-bCQGNW`          |
| `bun test tests/worker-visibility-cli.test.ts` first attempt                                                                                                                                                                 | 1; source generation script had failed before writing adapter; same missing UI plus corrected retained receipt literal needed `:low`                      | `cli-green.log`; failed directories retained, not acceptance                  |
| `bun test tests/worker-visibility-cli.test.ts` after implementation                                                                                                                                                          | 0; 7 pass, 79 assertions                                                                                                                                  | `cli-green2.log`                                                              |
| `bun test tests/worker-visibility.test.ts tests/worker-visibility-state.test.ts tests/worker-adapter.test.ts tests/worker-main-isolation.test.ts`                                                                            | 0; 40 pass, 132 assertions                                                                                                                                | `unit.log`                                                                    |
| `bun test tests/worker-routing-cli.test.ts -t 'WORKER-(20-(direct-max\|async-low)\|06-clamp\|26-(lifecycle\|pending-model\|pending-session)\|12-classifier-cancel) packed'`                                                  | 0; 7 pass, 49 filtered, 163 assertions                                                                                                                    | `existing-cli.log`                                                            |
| `bun /tmp/worker-visibility-pty.ts` (driver invokes `uv run --offline --no-project python /tmp/worker-visibility-pty.py`)                                                                                                    | 0; actual official interactive Pi CLI, widget/selection/clamp text/executor receipt emitted; one classifier, selected/medium local request; native exit 0 | `pty.log`, `pty.raw`, `pty.txt`; drivers retained in `/tmp`                   |
| `bun test tests/worker-visibility.test.ts tests/worker-visibility-state.test.ts tests/worker-visibility-cli.test.ts tests/worker-adapter.test.ts tests/worker-main-isolation.test.ts` final                                  | 0; 49 pass, 236 assertions                                                                                                                                | `final-focused.log`                                                           |
| `bun test tests/routing-settings-host.test.ts`                                                                                                                                                                               | 0; 2 pass, 7 assertions                                                                                                                                   | `settings-regression.log`                                                     |
| `bun run lint`                                                                                                                                                                                                               | 0                                                                                                                                                         | `lint-final.log`                                                              |
| `bun run fmt:check`                                                                                                                                                                                                          | 0; all matched files formatted                                                                                                                            | `fmt-final.log`                                                               |
| `bun run typecheck`                                                                                                                                                                                                          | 0; no errors in 165 files                                                                                                                                 | `typecheck-final.log`                                                         |
| `git diff --check`                                                                                                                                                                                                           | 0                                                                                                                                                         | Tool transcript; final whitespace gate repeated before commit                 |
| `git diff --exit-code 57ba3d4 -- src/extension.ts src/native-skill.ts src/classifier-context.ts src/effort-visibility.ts src/effort-policy.ts src/tier-policy.ts src/crew-policy.ts src/system-one.ts package.json bun.lock` | 0                                                                                                                                                         | `source-policy-unchanged.log`                                                 |

Unique focused tests: **58** (30 new + 28 existing), **406 assertions** across final focused + packed controls + settings regression; repeats not counted. Full suite intentionally not run: parent owns one combined candidate suite after reviews.

### Final new CLI artifact directories

Root: `/var/folders/kx/1fk4553s26d5ygj1wrzbv5200000gn/T/pi-jev-worker-evidence/`.

- direct: `pi-jev-worker-visibility-direct-W1rl6K`
- async: `pi-jev-worker-visibility-async-q6aOrj` (complete, exact selected/medium and native terminal observed)
- clamp: `pi-jev-worker-visibility-clamp-QHIJ5r` (medium → off)
- error: `pi-jev-worker-visibility-error-3BUfwS`
- timeout: `pi-jev-worker-visibility-timeout-a2UYOL`
- schema: `pi-jev-worker-visibility-schema-HmfX3v`
- disabled: `pi-jev-worker-visibility-disabled-1nsRyc`

Direct/async/clamp classifier count exactly 1; fail-open count exactly 1; disabled exactly 0. Child helper prevents duplicate child classification. No inference left localhost.

## Matrix result and limitations

WV-01 through WV-07: 7/7 covered and passing through mapped tests. Actual interactive PTY: 140×35 `xterm-256color`, official Pi CLI with deterministic localhost provider, choosing/selected/medium → medium/executor receipt text observed in terminal bytes, Ctrl-C twice, exit 0. This is emitted-text verification, not human screenshot review or universal terminal/resize/theme/Unicode coverage.

Async launch model/effort intentionally remains unconfirmed in UI; independent test receipts prove transport, not stronger public runtime metadata availability. Bounded history can evict older decisions, including long-pending rows; late events for evicted owners are ignored without touching executor ownership. Old singleton required-child-extension conflict and unsupported profile compatibility behavior remain unchanged. Review gate and parent combined full suite remain required before integration acceptance.
