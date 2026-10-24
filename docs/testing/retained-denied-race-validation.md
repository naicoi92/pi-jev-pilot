# Retained denied resume: fixture correction validation

## Baseline and finding

Baseline HEAD: `657ea5dee06274bfabfcab38f0ce49b2b7ef7089`.
Baseline tree: `3d77a0511b420d4c53e4e92b261da23068aaedb1`; worktree initially clean.

Parent's integrated full-suite result was RED: 472 passed, 1 failed, 3248 assertions,
1360.20 seconds, exit 1. Failure: `REQUIRED-19-retained-denied`.
This task did not rerun the full suite.

Historical receipts remain at
`/tmp/jev-integrated-657ea5d/full-receipts/pi-jev-junior-bound-fZdR6c`.
Historical fixture dependencies had already been removed by teardown. They were
not reconstructed; all executions below used fresh fixture-local installs through
the existing test lifecycle.

Recorded failure is a fixture race, not evidence of a production policy failure
or a proven UI timing cause. Historical trace showed denial command success,
completion notification parent turn starting, explicit resume RPC rejected with
`Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message.`, and notification turn consuming shared resume envelope
(`parent-43`). That tool result correctly denied required extension capability.
Native child termination alone did not establish parent notification settlement.

## Deterministic RED before correction

Matrix: [retained-denied-race-matrix.md](retained-denied-race-matrix.md), written
before test edits. Public seams: official CLI RPC, extension message observer and
control command, local HTTP provider, native status receipts.

Prediction was stated before execution: holding junior request 40 until launch
settles, then holding notification message handling, allows denial command but
rejects explicit resume RPC; release lets notification consume the shared envelope.
No vendor or private host patch was used.

Command (run once):

```sh
JEV_WORKER_EVIDENCE_DIR=/tmp/jev-retained-denied-correction/red-receipts \
  bun test tests/junior-required-denied-cli.test.ts -t REQUIRED-19-retained-denied-controlled
```

Actual result: **exit 1; 0 pass, 1 fail, 4 filtered; 14 assertions; 15.70 seconds**.
Exact busy error assertion passed. Exactly one same-ID resume and literal policy
denial assertions passed; junior requests remained 40. Final successful RPC
admission assertion failed: `Expected: true`, `Received: false`.

Raw evidence was saved immediately, before audit or correction:

- `/tmp/jev-retained-denied-correction/red.log`
- `/tmp/jev-retained-denied-correction/red.exit` (`1`)
- `/tmp/jev-retained-denied-correction/red-fixture.ts` (executed pre-fix source)
- `/tmp/jev-retained-denied-correction/red-receipts/pi-jev-junior-bound-10RIku/`

RED trace indices (zero-based): launch settles 39; notification agent starts 49;
`deny` succeeds 51; `denied-resume` fails 52; release succeeds 53; notification
message starts 54; notification-owned same-ID resume executes 61; settles 75.
Run ID: `55432bc8-712d-426f-9b96-7daa428a3d6c`. Receipt `parent-43` records policy
denial. This reproduces the specific original pattern, not merely a generic busy
unit test or an isolated pass.

## Correction

- Preserve native `processTerminal.state === "observed"` wait and failed child
  state / recovery descriptor assertions.
- Match `subagent-notify` via `message.details.runs[].runId` after current launch
  event offset; await subsequent `agent_settled` before denial and resume arming.
- Bind provider envelopes to expected explicit user input marker captured by
  public `message_start`; clear marker for custom notifications and settlement.
- Require exactly one same-ID resume, within explicit input event window, with
  exactly one matching `toolCallId` error receipt and no intervening notification.
- Preserve junior request count 40, literal capability denial, uncapped sibling
  controls, original flags, native cleanup and timeouts.

Controlled regression retains notification gate and junior response gate. Fixed
path releases notification and waits for its settlement before explicit RPC.
No added sleep, RPC retry, streaming behavior, admission-error suppression,
notification suppression, dependency changes or production edits.

## Focused GREEN

```sh
JEV_WORKER_EVIDENCE_DIR=/tmp/jev-retained-denied-correction/green-receipts \
  bun test tests/junior-required-denied-cli.test.ts
```

Actual result: **exit 0; 5 pass, 0 fail; 72 assertions; 70.66 seconds**.

| Scenario                   | Saved fixture suffix | Junior requests | Sibling requests | Result |
| -------------------------- | -------------------- | --------------- | ---------------- | ------ |
| direct41                   | W514ib               | 0               | 45               | pass   |
| async41                    | wpPIQV               | 0               | 45               | pass   |
| workflow41                 | V1Pm8U               | 0               | 90               | pass   |
| retained-denied            | 1RC8cA               | 40              | 45               | pass   |
| retained-denied-controlled | 2x1bLy               | 40              | 45               | pass   |

Raw GREEN log/exit: `/tmp/jev-retained-denied-correction/green.{log,exit}`.
Each fixture is under `green-receipts/pi-jev-junior-bound-<suffix>/`, containing
trace, generated observer, commands, policy tool receipts, native status and
cleanup receipts. All four recorded subprocess commands per scenario exited 0.
All three native async status receipts (workflow and two retained scenarios)
recorded `processTerminal.state: observed`. Existing lifecycle saved evidence and
removed only disposable fixture dependencies after terminal proof.

Original retained GREEN trace: matching notification starts 51, settles 60,
denial succeeds 61, explicit resume admission succeeds 62, same-ID resume executes
77, settles 91. Controlled GREEN trace: notification starts 52, settles 61,
denial succeeds 62, explicit resume admission succeeds 63, same-ID resume executes
78, settles 92. Controlled run ID: `416c1f93-32ed-4205-8af8-af1da0ff9e1c`.
Both resumes have exactly one correlated policy-denied tool result; no junior
provider requests beyond original 40.

## Static checks and limits

- `bun run lint`: exit 0.
- `bun run typecheck`: exit 0; no type errors in 165 files.
- Initial `bun run fmt:check`: exit 1 for new matrix formatting only. Formatted
  allowed documents, then reran successfully; initial failed output retained in
  `/tmp/jev-retained-denied-correction/fmt:check.log`.
- Final `bun run fmt:check`: exit 0.
- `git diff --check`: exit 0.

AC-1 through AC-4 covered by focused executions and saved receipts. Full-suite
integration remains intentionally unverified after correction. Parent's fresh
fixture review must precede any final full-suite gate. No claim that recorded
fixture race proves a production/UI root cause. Raw `/tmp` evidence is local;
retain or archive it if longer-lived independent review is needed.
