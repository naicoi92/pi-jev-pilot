# 10: Apply and reset evidence-based tuning explicitly

**What to build:** The user sees upstream tuning proposals based on fresh ledger evidence, explicitly applies them, observes changed effective routing thresholds, and resets learned values independently of ledger data.

**Blocked by:** 09: Persist decision outcomes and report corrections

**Status:** ready-for-agent

**Implementation:** completed

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-24, AC-25, AC-26. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Use upstream tunable options, proposal conditions and clamped ranges; require at least 20 fresh turns since the last applied change.
- [ ] Repeated evidence does not repeatedly push thresholds; no automatic apply.
- [ ] Apply overlays learned values on base settings and demonstrates changed effective routing on the next eligible prompt.
- [ ] Tuning reset restores base values without deleting ledger; ledger reset does not erase learned tuning.
- [ ] Persist/reload tuning with explicit session/worker ownership and expose the difference from base configuration.

## Verification

Drive report/tuning commands and subsequent Pi decisions from independently defined upstream ledger examples; assert before/after routing and apply/reset/reload behavior. Map every fixture to the parent acceptance criteria.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

Implementation merged at `8462915f2db879d3217397511cd4216711aeb6c9`; focused tuning and CLI integration tests passed in an isolated frozen-lockfile checkout. Independent review returned OK with notes, including no dedicated Pi worker tuning test. The authoritative-effort decision in [decision-gating.md](../decision-gating.md) supersedes the original confidence-bar example: stored confidence tuning cannot veto a valid effort selection; timeout tuning still changes the effective decision timeout. See [the reconciliation](../../jev-remaining-tasks-reconciliation.md) and completed config migration ticket 04 for evidence and limits.
