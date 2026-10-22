# Explicit thinking intent on Pi 1.3.0

Status: source/declaration research, not runtime E2E. No production changes or new mode/command semantics approved.

## Finding

Official Pi 1.3.0 does not expose complete explicit-thinking provenance to ordinary extensions. `ThinkingLevelSelectEvent` has `level` and `previousLevel`, but no actor/source. The setter clamps and emits only when effective value changes, so an explicit same-value selection is invisible. `SessionStartEvent` identifies startup/reload/new/resume/fork but does not identify explicit startup thinking options. Current values or restored history cannot establish intent.

Sources: [official extension types](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/src/core/extensions/types.ts), [thinking setter](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/src/core/agent-session.ts#L2642-L2664), [SDK startup precedence](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/src/core/sdk.ts#L253-L278). Installed exact 1.3.0 declarations were checked; experimental local provenance additions were excluded.

Model selection source metadata does not certify explicit thinking suffix intent. pi-auto's event guards invalidate stale selections, but do not establish startup or same-value user intent. The host provenance prototype addresses creation inputs only, not every manual intent case.

## Consequence

The approved rule that explicit user thinking must not be overwritten cannot be fully implemented by automatically detecting native intent with the reviewed stable APIs. Do not infer intent from non-undefined thinking, off, value equality, private state or argv parsing.

An explicit Jev ownership mode could avoid this ambiguity, but it would be an operator-approved contract adaptation, not automatic native-intent detection. Safe default would leave effort with Pi/user; opting in would explicitly delegate effort selection to Jev. Native selection cannot be promised to automatically disable that delegation in every case.

## Proposed task boundary (not yet approved)

Separate ticket 01's concrete package/config/shared classifier foundation from optional effort automation. Keep enabled/applicable question gating, zero calls when no questions, bounded payloads and timeout/cancellation guarantees. Foundation must have a real applicable consumer fixture, not a speculative generic dispatch framework. Existing dependent capability tickets would depend on foundation readiness, not unconditional effort selection. Preserve historical effort regression evidence without relabelling it passing acceptance.

Operator decision is required before adding opt-in controls, deferring effort capability, or changing ticket boundaries. Host patch remains research only.
