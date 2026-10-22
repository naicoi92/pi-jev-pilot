# 04: Deliver upstream strategy and quality advice in Pi

**What to build:** User prompts and observed tool outcomes produce upstream strategy/quality advice in Pi context, with no independent worker dispatch or mid-turn effort escalation.

**Blocked by:** 01: Run the Pi package with per-prompt effort routing

**Status:** ready-for-agent
**Implementation:** in-progress

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-09, AC-15, AC-16, AC-27. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Keep original direct/delegate/parallel/graph classification and confidence/tier gates; ordinary direct work adds no unnecessary strategy block.
- [ ] Include quality reads in the shared decision call when enabled, preserving ambiguity, bugfix, sensitivity and correction thresholds.
- [ ] Observe repeated-edit/failed-command signals and attach upstream-equivalent step-back advice without increasing effort.
- [ ] Respect user/project delegation restrictions; advice does not invoke a worker or grant execution authority.
- [ ] Preserve upstream workflow model-selection guidance rather than promising transparent workflow interception.
- [ ] Exclude pet, external-review requirements, escalation and invented procedural review gates.

## Verification

Run Pi prompts and controlled tool outcomes against local fixtures; inspect actual injected model context, classifier request count, absence of dispatch receipts and unchanged effort during loop detection.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments
