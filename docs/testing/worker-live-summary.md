# Worker live summary

## Presentation contract

Default Jev widget is one concise live row, for example `Jev · 1 worker running · low`. Worker debug rows, local labels, raw receipts, unknown identities and unconfirmed-launch text are not default presentation. Pi's standard tool-output expansion action (`app.tools.expand`, default Ctrl+O) reveals role, actual tier when known, committed physical target, effort and lifecycle status per worker. Jev registers renderers, not a shortcut or editor/input replacement. Native expanded tool result/error content remains available; historical/unobserved tool calls keep their native renderer.

Only pending main/worker assessments animate. Acceptance is not running. The public authority request's resolved-agent role and actual Jev tier-selection metadata stay keyed by logical launch identity; `onApplied` records immutable committed target/effort. No task, description, private policy context, guessed default tier or internal ID formula enters presentation. Metadata joins a genuine tool row only after executor acceptance supplies the exact consumed receipt and originating public tool call. Acceptance itself remains logical commitment, never spawn/provider proof.

Actual child execution notifications advance accepted → running. Workflow status must explicitly identify the leaf via `childRunId`; root notifications cannot start or finish siblings. Terminal notifications may arrive without start, and terminal state cannot be revived by late starts or duplicate acceptance. Session/owner generation fences reject stale receipt callbacks; bounded recent terminal details do not evict active workers. Mixed active efforts display `mixed`, not a falsely shared level. Unknown state does not become success or cancellation. Child `stopped` only cancels when its explicit reason is `user`; a missing or arbitrary reason is not cancellation evidence.

## Regression seams

- `worker-status.test.ts`: exact receipt/session/generation joins; accepted versus actual start; terminal stickiness; overlap/mixed efforts; stale reload; bounded history; root/leaf workflow isolation.
- `worker-status-renderer.test.ts`: collapsed versus standard expanded options; narrow widths; useful failure result preserved; historical native output preserved.
- `worker-visibility.test.ts`: real public authority preparation through delayed loopback classifier, actual applied receipt, accepted/run event projection, assessment spinner cleanup and no debug rows.
- `live-status.test.ts`: one-row width budget, main versus worker effort, timer lifecycle and Unicode.
- Existing authority/comparison/tier/crew tests remain policy controls. Optional observer callbacks do not change selected target/effort, owner fences, comparison, expert admission or fallback policy.

## Recorded verification

Reviewed executor `0b9d9a82e8adb657a0d6f9f9a2740a844ceacb6b` supplies the exported acceptance type/channel and truthful child-start boundary. Manifest, canonical Bun lock and active fixture pins match. `bun install --lockfile-only --ignore-scripts` updated the lock without installation or lifecycle scripts.

Focused local union: **239 tests passed, 0 failed, 1093 assertions across 13 files**. `bun check`: **173 files, no type errors**. Lint and diff checks passed. RED evidence includes missing initial projection, absent baseline executor correlation, terminal/reordering cases, and native prerender revealing a cached ordinary tool row before `tool_call`; final renderer consults live observation at render time.

Native Pi-Bolt 1.0.3 / Pi 1.4.0, 160×40 fullscreen, deterministic loopback classifier/provider transport: **three ASYNC scenarios passed** (success, provider error, explicit cancellation). Each covers delayed assessment spinner, trusted accepted state distinct from running, actual child-start event, standard Ctrl+O expanded metadata and collapse, terminal summary and interactive reload. Final success rerun explicitly waits for a fresh post-reload render and shows `Jev · ready`. All three child status artifacts report `processTerminal.state=observed`. Driver: `tests/fixtures/worker-summary-terminal.py`; non-mutating renderer/event observer: `worker-summary-observer.ts`. Logs, ANSI captures and isolated settings reside under `/tmp/jev-worker-summary`, not the package.

## Foreground P1 corrections

`WorkerStatus.result()` now consumes workflow inventory independently of outer single-leaf `details.toolCallId`, checking the public result call ID against inventory `parentToolCallId` before existing root/key/leaf validation. Canonical Pi thrown-tool errors (`isError: true`, empty details) fail only an observed, uniquely bound non-workflow leaf; they never fan out to workflow siblings or parse error text. Source-named regressions exercise actual result shapes through `result()` and the executor's real throw conversion.

Follow-up focused checks: **226 passed, 0 failed, 1062 assertions across 9 files**; types **174 files clean**, lint/format/diff clean. New deterministic-loopback native foreground direct success, direct failure and workflow success pass, including Ctrl+O and reload. Workflow fixture explicitly sets child `async: false`.

**Known foreground workflow failure RED:** the pinned executor throws its workflow logical error at the public tool boundary, discarding the otherwise valid per-leaf inventory. Pi emits empty details and no per-leaf terminal event. Consumer intentionally leaves those workflow leaves unresolved rather than inferring sibling failures. Reproduce with scenario `foreground-workflow-error` in `worker-summary-terminal.py`; producer correlation repair required. Full evidence/report: `/tmp/jev-worker-summary/p1-report.md`.

## Limits

This change compacts **Jev's widget and current worker tool rows**. Executor-owned async/fleet widgets and native `subagent-notify` messages remain visible and unchanged; they can still show worker rows, task excerpts, paths or native receipt details. No global renderer override, content/display mutation, managed setting or extra custom message per assessment hides them. Thus a terminal-wide single-summary/no-worker-rows requirement remains incomplete pending a narrow executor-owned presentation integration.

Historical native rendering and expanded useful error/result content are preserved. New terminal metadata is session-scoped, not durable replay. Workflow sibling joins, overlap and stale notification guards have deterministic unit coverage; new native workflow proof covers one true foreground child success and exposes the failure limitation above, not simultaneous multi-worker or reload-in-flight behavior. Terminal resize, alternate themes, screen-reader behavior and human visual review were not newly exercised. Full install-heavy suite was not run. No hosted inference, managed installation or push occurred. Independent parent review remains required before installation.
