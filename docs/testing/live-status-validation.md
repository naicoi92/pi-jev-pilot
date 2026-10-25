# Ticket 12 live status line validation

## Scope

Persistent single-line Jev status above the editor, replacing the transient "choosing effort" text widget. Footer/powerbar, the independent worker widget, `/jev status` and durable evidence storage are unchanged. Only successful Jev decision rows stop rendering in the conversation; timeout, error and blocked rows stay expandable. Stored entries are never rewritten.

## Design decisions made during implementation

- Component widget (`setWidget` factory, default `aboveEditor`), public API only. It right-aligns inside the container width with one column of right padding and reserves a two-column spinner gutter so the text does not move when busy toggles.
- Spinner and its timer exist only while busy (choosing effort or agent running); the timer is cleared on idle, widget disposal, session shutdown, `session_start` and `session_tree`. Cancelled navigation emits no such event, so the current line is untouched.
- Narrowing order: strategy, then worker suffix, then skill truncation with an ellipsis, then whole-line ellipsis. Activity, effort and warning survive longest.
- Warning (`fallback`/`error`) is cleared only by the next valid decision or a session reset. Skipped and cancelled turns, and activity updates, leave it. Missing skill/strategy are omitted, never carried from an earlier turn.
- Activity comes from public events only: `agent_start/end`, `tool_execution_*` (nested codemode calls ignored), `message_update` thinking events. Unknown tools and silence show `working`.
- Worker count is launch-allowed calls (decision made, not blocked or refused) awaiting a result, plus executor-accepted async runs until `subagent:async-complete`. State is kept outside the 12-row history so eviction cannot lose a running worker. Sync calls are dropped at `agent_settled`. Uncertain state is never counted.
- Hidden outcomes: classified, reused, kept, skipped, cancelled, specialized, executor-owned, receipt, unconfirmed. Visible: timeout, error, blocked.
- Restore on `session_start`/`session_tree` uses the latest valid main decision row (effective effort) and the skill recorded for the latest user message only. No busy state or warning is restored.
- The footer `setStatus` elapsed-time record is kept as before.
- RPC mode ignores component widgets, so RPC clients no longer receive a text widget; the CLI tests assert that no string widget remains.

## Evidence

Unit/integration (bun): `tests/live-status.test.ts` (render, states, truncation, wide characters, timers, cleanup, restore, events), `tests/effort-visibility.test.ts`, `tests/decision-visibility.test.ts` (renderer hiding), `tests/worker-visibility-state.test.ts` and `tests/worker-visibility.test.ts` (running count), `tests/advised-strategy.test.ts`.

Actual official Pi 1.4.0 PTY (180×70) with the installed powerbar extension, local deterministic provider/classifier/worker, isolated HOME, no hosted inference:

```sh
POWERBAR_EXTENSION=/Users/naicoi/.pi/agent/npm/node_modules/@juanibiapina/pi-powerbar/src/powerbar/index.ts \
EVIDENCE=/tmp/p12/ev/run4 bun tests/fixtures/durable-visibility/pty.ts
```

All driver checks true, exit 0: pending `Jev · choosing effort`; `Jev · working · medium`; `Jev · working · medium · 1 worker` during the worker; `Jev · medium` right-aligned after the turn and restored after public `/reload`; no successful main or worker-plan conversation row; native receipt widget and `/jev status` details intact.

## Limits

Interactive resize, side panels and light themes were not exercised in the PTY (width logic is unit-tested). Pi-Bolt was not run. The independent worker widget still renders its own rows. Pre-existing failures on the base commit, unchanged here: `tests/pi-cli.test.ts` CLI-09a/09b/26p/26q (7), `tests/worker-adapter.test.ts` WORKER-26 (2), `tests/routing-settings-host.test.ts` (1), and environment-dependent `tests/worker-adapter-feasibility.test.ts`.
