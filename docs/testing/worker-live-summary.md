# Worker live summary

## Presentation contract

Default Jev widget is one concise live row, for example `Jev · 1 worker running · low`. Pi's standard tool-output expansion action (`app.tools.expand`, default Ctrl+O) reveals selected worker role, tier when known, committed reason, physical target, effort and lifecycle status in the Jev widget. Native calls, results, notifications and Fleet remain executor-owned; Jev does not suppress or replace them.

Only pending main/worker assessments animate. Acceptance is not running. The public authority request's resolved-agent role and actual Jev tier-selection metadata stay keyed by logical launch identity; `onApplied` records immutable committed target/effort. No task, description, private policy context, guessed default tier or internal ID formula enters presentation. Metadata joins a genuine tool row only after executor acceptance supplies the exact consumed receipt and originating public tool call. Acceptance itself remains logical commitment, never spawn/provider proof.

Actual child execution notifications advance accepted → running. Workflow status must explicitly identify the leaf via `childRunId`; root notifications cannot start or finish siblings. Terminal notifications may arrive without start, and terminal state cannot be revived by late starts or duplicate acceptance. Session/owner generation fences reject stale receipt callbacks; bounded recent terminal details do not evict active workers. Mixed active efforts display `mixed`, not a falsely shared level. Unknown state does not become success or cancellation. Child `stopped` only cancels when its explicit reason is `user`; a missing or arbitrary reason is not cancellation evidence.

## Regression seams

- `worker-status.test.ts`: exact receipt/session/generation joins; accepted versus actual start; terminal stickiness; overlap/mixed efforts; stale reload; bounded history; root/leaf workflow isolation.
- `worker-summary-terminal.py`: native call/result visibility and widget expansion in the exercised terminal scenarios.
- `worker-visibility.test.ts`: real public authority preparation through delayed loopback classifier, actual applied receipt, accepted/run event projection, assessment spinner cleanup and no debug rows.
- `live-status.test.ts`: one-row width budget, main versus worker effort, timer lifecycle and Unicode.
- Existing authority/comparison/tier/crew tests remain policy controls. Optional observer callbacks do not change selected target/effort, owner fences, comparison, expert admission or fallback policy.

## Historical verification

The following records describe earlier presentation versions; claims about renderer ownership or suppression are historical, not the current contract.

Reviewed executor `9f0dcee736e64db6ecc1cfcd87bb0eecac5fbf51` supplies the exported acceptance type/channel, truthful child-start boundary, exact-event presentation delegation and typed attached foreground leaf terminals. Manifest, canonical Bun lock and active fixture pins match. `bun install --lockfile-only --ignore-scripts` updated the lock without installation or lifecycle scripts.

Focused local union: **239 tests passed, 0 failed, 1093 assertions across 13 files**. `bun check`: **173 files, no type errors**. Lint and diff checks passed. RED evidence includes missing initial projection, absent baseline executor correlation, terminal/reordering cases, and native prerender revealing a cached ordinary tool row before `tool_call`; final renderer consults live observation at render time.

Native Pi-Bolt 1.0.3 / Pi 1.4.0, 160×40 fullscreen, deterministic loopback classifier/provider transport: **three ASYNC scenarios passed** (success, provider error, explicit cancellation). Each covers delayed assessment spinner, trusted accepted state distinct from running, actual child-start event, standard Ctrl+O expanded metadata and collapse, terminal summary and interactive reload. Final success rerun explicitly waits for a fresh post-reload render and shows `Jev · ready`. All three child status artifacts report `processTerminal.state=observed`. Driver: `tests/fixtures/worker-summary-terminal.py`; non-mutating renderer/event observer: `worker-summary-observer.ts`. Logs, ANSI captures and isolated settings reside under `/tmp/jev-worker-summary`, not the package.

## Foreground P1 corrections

`WorkerStatus.result()` now consumes workflow inventory independently of outer single-leaf `details.toolCallId`, checking the public result call ID against inventory `parentToolCallId` before existing root/key/leaf validation. Canonical Pi thrown-tool errors (`isError: true`, empty details) fail only an observed, uniquely bound non-workflow leaf; they never fan out to workflow siblings or parse error text. Source-named regressions exercise actual result shapes through `result()` and the executor's real throw conversion.

Follow-up focused checks: **226 passed, 0 failed, 1062 assertions across 9 files**; types **174 files clean**, lint/format/diff clean. New deterministic-loopback native foreground direct success, direct failure and workflow success pass, including Ctrl+O and reload. Workflow fixture explicitly sets child `async: false`.

Original foreground workflow failure RED remains recorded in `/tmp/jev-worker-summary/p1-report.md`. Reviewed executor now emits typed attached foreground leaf terminal evidence before the canonical throw discards inventory. Consumer validates session/call/root/key/leaf and updates that leaf only. Native `foreground-workflow-error` now passes without sibling inference or extra notifications.

## Final integration verification

Bounded source union: **249 tests passed, 0 failed, 1130 assertions across 13 files**. Native deterministic loopback proof uses the genuine Jev checkout and exact reviewed executor archive: ASYNC success, provider failure, explicit cancellation, foreground workflow failure, and running-child reload/disposal fallback. Default direct-leaf widget/render checks plus captured default terminal byte slices contain no acknowledged leaf debug/error/path rows; standard Ctrl+O reveals decision reason/metadata and useful failure/cancel output. Observer renders genuine native notification components with genuine message details identity, without replacing their registration. Reload restores native unacknowledged running rows and fresh Jev ready state. Logs and limitations: `/tmp/jev-worker-summary/final-integration-report.md`.

## Current limits

Jev does not register presentation ownership or hide native async/Fleet rows and collapsed completion notices. Native silent success (`display:false`) remains silent. The current port's native evidence is recorded separately in the ticket 05 evidence; earlier suppression claims above are historical.

Historical native rendering and expanded useful error/result content are preserved. New terminal metadata is session-scoped, not durable replay. Workflow sibling joins, overlap and stale notification guards have deterministic unit coverage; new native workflow proof covers one true foreground child success and exposes the failure limitation above, not simultaneous multi-worker or reload-in-flight behavior. Terminal resize, alternate themes, screen-reader behavior and human visual review were not newly exercised. Full install-heavy suite was not run. No hosted inference, managed installation or push occurred. Independent parent review remains required before installation.
