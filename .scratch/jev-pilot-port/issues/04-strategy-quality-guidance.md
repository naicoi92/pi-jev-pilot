# 04: Deliver upstream strategy and quality advice in Pi

**What to build:** User prompts and observed tool outcomes produce upstream strategy/quality advice in Pi context, with no independent worker dispatch or mid-turn effort escalation.

**Blocked by:** 01: Run the Pi package with per-prompt effort routing

**Status:** ready-for-agent
**Implementation:** completed

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-09, AC-15, AC-16, AC-27. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [x] Keep original direct/delegate/parallel/graph classification and confidence/tier gates; ordinary direct work adds no unnecessary strategy block.
- [x] Include quality reads in the shared decision call when enabled, preserving ambiguity, bugfix, sensitivity and correction thresholds.
- [x] Observe repeated-edit/failed-command signals and attach upstream-equivalent step-back advice without increasing effort.
- [x] Respect user/project delegation restrictions; advice does not invoke a worker or grant execution authority.
- [x] Preserve upstream workflow model-selection guidance rather than promising transparent workflow interception.
- [x] Exclude pet, external-review requirements, escalation and invented procedural review gates.

## Verification

Run Pi prompts and controlled tool outcomes against local fixtures; inspect actual injected model context, classifier request count, absence of dispatch receipts and unchanged effort during loop detection.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

Accepted at integration merge `a79b743bf0574d11b7693f038667fc7ee193b014`, exact candidate `a84e69aed6a2c7cad13043a2ff325fc948a3d2f6`. Independent follow-up review: OK; original partial-tier advice P1 closed. Integration Oxc/Bun gates, 288 tests / 875 assertions and installed/guidance/real-tool smokes pass. Raw advice validation is separate from unchanged routing validation; invalid routing retains schema-error baseline. Fable/escalation tail omitted by approved scope. UUID/native expansion are version-tested official Pi 1.4.0 dependencies; tool observation covers top-level built-ins, not universal wrappers. Local providers do not establish hosted quality/availability. See docs/testing/ticket-04-validation.md and retained review/merge artifacts.

