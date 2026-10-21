# 07: Record the risk versus custom-slot precedence decision

**What to build:** Resolve the already-characterized upstream policy discrepancy before implementing custom-slot execution: pure routing can force deep for risk, then the custom-slot branch can replace it with a cheap model. This is a bounded decision ticket, not a new research project or authorization to change policy.

**Blocked by:** None (can start immediately)

**Status:** resolved

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-03, AC-18. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [x] Use the pinned source and existing real-policy/branch characterization as evidence; distinguish it from a full Claude hook E2E.
- [x] Present the exact behavior and consequence: preserve upstream precedence versus explicitly approve a risk-precedence correction.
- [x] Obtain and record the operator decision; agents may prepare evidence but cannot decide a safety-relevant deviation autonomously.
- [x] Record an independent expected outcome for a regression case and the implications for slot routing and documentation.
- [x] Do not change the parent spec or business policy as part of merely publishing this decision ticket.

## Verification

Review the recorded operator decision and its source-linked expected example. Completion requires explicit operator adjudication, not another repeated source inspection.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Decision

The operator explicitly selected **Risk takes precedence** during implement-spec. When `risky > 0.7` forces the deep tier, a custom slot cannot overwrite that model. Preserve ordinary explicit caller model pins; risk routing does not grant permissions or enforce action safety. This is an approved correction to the pinned upstream slot precedence, not an unrecorded redesign.

Independent regression expectation: current balanced model; chosen cheap slot; tier confidence 0.9; risk 0.95 → configured deep model, not cheap slot. Risk at or below the upstream force threshold retains ordinary confidence/slot rules. The existing source characterization plus operator adjudication resolves this ticket; implementation/regression execution belongs to ticket 08.

## Comments
