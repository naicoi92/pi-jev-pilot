# 12 — Simplified pet-style live status above the editor

Status: ready-for-agent
Implementation: in-progress
Type: task
Blocked by: none

## Scope

Replace Jev's transient choosing-effort widget with a persistent single-line status above the chat editor, right-aligned within the editor/transcript content width, inspired by upstream Jev Pilot pet speech/activity, without sprite or idle animation. Do not replace powerbar/footer or add model-facing diagnostics. Scope confirmed by user after source-backed grilling. This adds a ready backlog task, not implementation or deployment approval.

## User decisions confirmed

- Keep line visible while idle; spinner only while busy.
- Right-align in the editor/transcript content band, not absolute terminal coordinates; survive resize and side panels. Preserve sensible right padding. User explicitly requested right placement like upstream pet.
- Show observable activity + main effective effort + selected skill; add actual non-direct strategy advice when present. Confidence stays in details/status, not on the compact line.
- Prioritize main; add observed running-worker count. When main idle and workers running, show workers-running state without implying knowledge of worker internal activity.
- Replace ordinary successful Jev decision rows for BOTH main and worker; native executor tool cards remain untouched.
- Preserve durable decision data and /jev status access; suppress presentation, not evidence storage.
- Genuine error/fallback: warning on live line plus one expandable warning/error conversation row. Successful selections, including same-level, do not create ordinary Jev rows.

## Proposed examples

```text
  Jev · ready
⠋ Jev · choosing effort
⠋ Jev · reading · high · /systematic-debugging · 2 workers
⠋ Jev · 2 workers running · high · /systematic-debugging
  Jev · high · /systematic-debugging
  Jev · fallback · medium · timeout
```

Text examples are design proposals; exact ordering/truncation awaits final confirmation. Product strings remain English.

## Source references

Current feature worktree base installed d29a77c2a538eaed8d2d7413c2ff8fcc8b3ace02:
- src/effort-visibility.ts: start uses setWidget; finish removes widget and writes footer status.
- src/decision-visibility.ts: durable renderer/status integration.
- src/worker-visibility.ts and src/worker-verification.ts: bounded worker observations; audit actual observable running/completion semantics before claiming counts.

Pinned upstream Jev Pilot5d27135b34edf81b40c0bf1df01ae401f6b72ea7:
- /tmp/pi-jev-upstream-5d27135/hooks/jev-pet.tsx: AbovePrompt, turn/tool activity, background-agent state.
- /tmp/pi-jev-upstream-5d27135/hooks/pet-art.ts: turnSpeech/currentSpeech; effort/skill/advice/confidence and fallback speech.

Public Pi-Bolt docs/examples: docs/tui.md and examples/extensions/widget-placement.ts under installed Pi-Bolt0.9.7 package. Default setWidget placement aboveEditor verified by example. Use public APIs only; no footer/editor replacement.

## Proposed lifecycle and acceptance constraints — confirm before marking ready

- New session starts ready; reload restores only valid same-session durable effort/skill, never stale busy state or another session's state.
- Error/fallback remains visible until the next valid decision or explicit session reset. Busy activity may update without erasing warning. Do not mislabel assessment commitment as native execution success.
- Missing skill omitted, not stale prior-turn skill. Effort is actual effective main level; distinguish retained fallback.
- Activity labels derived from available public events; thinking shown only with observable support, otherwise working. Do not infer private reasoning from silence.
- Worker counts restricted to known running invocations; uncertain state is not silently treated as running or completed. No universal nested/deferred/recovery monitoring promise.
- Single line; terminal-width-aware truncation, theme-aware colors, no focus/key interception. No raw task/path/auth/response text.
- Keep diagnostic entries out of model context. Suppress successful renderer output without deleting historical entries/session mutation. Clarify old successful-entry rendering policy during implementation design.
- Clean up owned timers/widgets on committed shutdown/reload; cancelled navigation must not disable current line.
- Verification: state-transition/width/cleanup/persistence tests; bounded actual Pi-Bolt+powerbar visual check without hosted inference/global discovery. Do not restart full authority proof infrastructure.

## Lifecycle decisions confirmed

- Reload restores valid same-session effort/skill; no stale busy/spinner restore. New session starts ready.
- Hide BOTH old and new successful Jev rows when rendering history. Keep stored entries intact; no session-file mutation. Warnings/errors remain visible.
- Live fallback warning persists until a new valid decision or explicit session reset; activity updates must not silently clear it.

## Additional upstream reference findings

Upstream turnSpeech includes effective effort; kept/wanted distinction; selected skill or explicit no-skill when applicable; advised strategy only when actually advised; effort confidence; timeout/busy/error with retained execution state. Activity prepends thinking/reading/searching/writing/running; background workers keep pet busy. Routing can temporarily show worker role/model/effort, loop warnings and periodic stats/tuning suggestions. These are source capabilities, not all approved port scope.

Proposed minimal content hierarchy: activity + effective effort + selected skill + actual strategy advice when non-direct; optional low-priority confidence. Preserve wanted/effective discrepancy only when materially constrained and fallback reason when applicable. Do not show confidence as probability of task success. Omit periodic stats/tuning/pet mood/sprite and worker model takeover of main line; preserve main-priority worker count already chosen. Terminal narrowing drops confidence then strategy then truncates skill; activity/effort/warning preserved. User accepted this minimal hierarchy with actual strategy advice; confidence remains off the compact line. Do not expand to periodic stats/tuning or debug fields.

## Confirmation

User confirmed right-aligned placement and proposed minimal pet-derived content after source comparison. This historical confirmation did not authorize installation or deployment.

## Implementation checkpoint

Implementation `6b95850` was merged via `bcf2a5e` and is present on `main`. [Live-status validation](../../../docs/testing/live-status-validation.md) is superseded in part by [shared-status validation](../../../docs/testing/jev-shared-status.md) and subsequent worker-summary work. Independent review found that worker summary suppressed main effort and skill. An unmerged correction restores main priority; 130 focused tests and lint/format/typecheck passed. Independent correction review returned OK with no findings. A local-provider Pi-Bolt 1.0.4 foreground user-path fixture passed with main `high` and worker `low`: main effort remained in the live line while worker effort appeared in expanded details, and reload retained main effort. Skill and strategy priority are covered by focused tests, not this native fixture. An earlier async baseline failed before child start and remains recorded. See [the reconciliation](../../jev-remaining-tasks-reconciliation.md). Merge remains outstanding.
