# Design reconciliation

Status: historical reconciliation with a superseding operator decision below. No new controls, changed defaults, deferred capabilities or host modifications approved.

## Superseding operator decision

The operator clarified that installing/enabling Jev auto-effort authorizes overwriting default/current thinking under upstream policy. The earlier automatic explicit-intent guarantee and agent-added startup-equality requirement no longer block implementation. Keep original capability scope/defaults/task graph, real branch ownership/queue regressions, applicable-question/zero-call gating and stale-result guards for manual changes during classification. No foundation/effort split or opt-in lock is selected. The older recommendations below are retained as history where they conflict; current authority is decision-gating.md.

## Primary-source recheck

Pinned Jev source: commit `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`.

- `hooks/features.ts:26–35`: effort enabled and main-model routing disabled by default.
- `hooks/jev-model-router.ts:753–778`: the first request is routed from its current model/effort; effort changes are applied to the request passed to the next handler. This is not a Pi session-thinking setter.
- `hooks/model-router.policy.ts:765–835`: policy can raise or lower named current effort under confidence/follow-up rules. Numeric caller effort is preserved; a manually selected level above the router ceiling is preserved. There is no general rule here identifying every named effort value as a user pin.
- Consequently, an existing low/medium/high value is neither automatic intent detection nor an upstream blanket lock. Preserving every explicit Pi thinking choice is the operator's approved port clarification, not a property already supplied by this policy.

## Authority mapping

| Behavior | Authority | Consequence |
| --- | --- | --- |
| Upstream effort policy/rubric and continuation distinction | Original faithful-port scope | Preserve pure policy; no new selector rubric |
| Physical model retained with auto-model disabled | Approved spec AC-04 | Do not silently require virtual selection for effort-only |
| Branch-owned decisions and cleanup | Approved AC-26 | Retain independently reproduced ownership/queue regression fixes |
| Explicit user thinking not overwritten | Approved decision-gating clarification | Requires supported intent evidence or a deliberately conservative refusal to mutate; cannot be inferred from default/current value |
| Enabled/applicable questions only; zero questions means zero calls | Approved clarification | Shared classifier must not run unused effort/guidance questions |
| Native startup precedence on equal-value runtime replacement | Agent-added compatibility interpretation | Record separately; not grounds alone to demand a host patch |
| Optional lock commands, effort opt-in/default changes, v1 removal | Not approved | Do not implement or treat as selected |

## Verified host constraints

Official Pi 1.3.0 session setter persists changes before the owning user message; existing adapter repairs ownership with metadata/replay. Stable extension APIs do not identify all explicit thinking intent: startup options lack exposed provenance; same-value manual selection can emit no event. pi-auto confirms a useful event/setter/guard pattern, not a source of missing intent metadata. Virtual routing supplies request-scoped thinking, but changes selected-model semantics. Durable is a separate harness. The experimental host field is not a production dependency.

## Concrete recommendation

Keep the ordinary Pi package and existing capability scope. Separate the independently useful package/configuration/shared-classification boundary from the physical-model effort writer in the proposed task revision below. Continue a real skill-matching vertical slice as the first consumer of combined applicability, privacy and abort-aware classification; do not build a speculative generic framework or call unused questions. Retain upstream effort policy as tested code, but do not enable a writer that cannot honor the approved explicit-thinking rule.

The remaining effort conflict must be described precisely: automatic effort mutation in situations with unknown intent cannot simultaneously guarantee that explicit user thinking is never overwritten. Removing the equality test or replaying history does not solve that conflict. Conservatively declining an ambiguous effort write is safe but does not constitute completion of automatic effort acceptance. No new command/mode/default or host patch is selected here.

### Proposed ticket edits (not applied)

- Ticket 01: package/configuration/shared classifier foundation with a real skill-matching consumer fixture; bounded context, abort/deadline, schema handling, applicable combined questions and zero-call gates. Physical effort writer acceptance remains separate and unresolved; it is not relabelled complete.
- Ticket 03: integrate skill catalog/content at the same package boundary; coordinate with ticket 01 as a vertical slice rather than independent speculative transport work.
- Tickets 02/04/06/09: depend on accepted shared foundation, not on unconditional effort mutation. Preserve their independent actual-dispatch/guidance/report acceptance.
- Final package ticket still requires an explicit recorded disposition of auto-effort; foundation completion cannot silently defer it from v1.

No implementation/DAG change follows automatically from this note. Existing candidate and historical RED evidence remain intact and unmerged.
