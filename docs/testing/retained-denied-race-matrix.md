# Retained denied resume: fixture race matrix

## Source and scope

Source: authorized fixture correction request, based on integrated run at
`657ea5dee06274bfabfcab38f0ce49b2b7ef7089` (472 passed, 1 failed; 3248 assertions;
1360.20 seconds; exit 1). Failed test: `REQUIRED-19-retained-denied`.
Only this CLI fixture and these testing documents change. Production behavior,
executor dependencies, settings, notification delivery and timeouts remain unchanged.

Original receipts: `/tmp/jev-integrated-657ea5d/full-receipts/pi-jev-junior-bound-fZdR6c`.
Original disposable dependencies were already removed by teardown; no attempt is
made to rebuild that historical fixture. Its saved source and receipts remain usable.

## Acceptance criteria

- AC-1: Retained denied resume waits for the exact native child terminal receipt,
  matching completion notification (`message.details.runs[].runId`) and that
  notification's subsequent parent `agent_settled`, before denying helpers and
  submitting the explicit resume input. Source: correction request.
- AC-2: Controlled official CLI regression forces completion notification to start
  before explicit resume admission, reproduces the original busy rejection and
  notification consumption before correction, then passes after correction.
  Source: mandatory deterministic RED requirement.
- AC-3: Provider launch envelopes belong only to their expected explicit user
  input; exactly one resume of the retained ID occurs in that explicit input's
  turn, denied before additional junior provider activity (40 requests total).
  Source: correction request and original REQUIRED-19 assertions.
- AC-4: Existing direct, async and workflow denial controls retain zero junior
  provider calls; ordinary sibling remains uncapped (45 calls, or 90 including
  workflow sibling). Native cleanup proof remains mandatory.
  Source: original fixture assertions and correction request.

Each scenario maps to one acceptance criterion; additional shared assertions
protect existing invariants without adding independently scoped tests.

| Criterion | Test ID                        | Test name / scenario                        | Expected-value source                                                                                                           |
| --------- | ------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| AC-1      | RD-1                           | REQUIRED-19-retained-denied                 | Exact matching notification after launch offset, then later agent_settled; request's sequencing requirement                     |
| AC-2      | RD-2                           | REQUIRED-19-retained-denied-controlled      | Public observer notification gate and controlled HTTP response; original exact busy error and notification-owned resume receipt |
| AC-3      | RD-1, RD-2 (shared assertions) | Explicit denied-resume turn ownership       | Public user message marker, retained run ID, one tool_execution_start; original 40-request bound and literal policy error       |
| AC-4      | RD-3                           | REQUIRED-19-direct41 / async41 / workflow41 | Original zero junior requests, literal policy error, 45/90 sibling requests                                                     |

## Public seams and RED prediction

Use official RPC CLI, public extension `message_start` observer and fixture-only
control commands, local deterministic OpenAI-compatible HTTP provider, native
status receipts and public RPC events. No vendor patches or private host hooks.

Controlled variant holds junior provider request 40 until the launch parent turn
settles. A public observer holds matching `subagent-notify` message handling and
writes its checkpoint. Commands still execute while parent streams. Before fix,
arm shared resume envelope while notification is held, submit `denied-resume`,
then release notification. Prediction: RPC returns `success:false` with exact
`Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message.`;
notification parent turn consumes resume envelope, produces the policy denial,
and junior request count stays 40. Test must fail on required successful explicit
RPC admission, preserving actual exit and receipts.

After fix, release notification gate and await matching notification's later
settlement before denial/resume. Bind provider envelope to public explicit user
message marker; notification cannot consume it. No sleeps, retry, streamingBehavior,
notification suppression or timeout increases are introduced. Existing polling
only observes public events and native receipts.

## Validation boundary

Run controlled RED once, then corrected original + controlled + adjacent scenarios
(one file). Run lint, typecheck, formatter check and diff check. No full suite in
this task. Parent review precedes any full verification gate.
