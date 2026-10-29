# 09: Persist decision outcomes and report corrections

**What to build:** Completed main turns produce a privacy-minimized bounded ledger; the user can report and reset observations, and later corrections are attributed to the correct completed turn across session/branch operations.

**Blocked by:** 01: Run the Pi package with per-prompt effort routing

**Status:** ready-for-agent

**Implementation:** completed

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-22, AC-23, AC-24, AC-26. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Retain the latest 500 valid entries with decision latency/confidence, effort, tool/failure counts and observed outcome/usage; never persist prompt text in the ledger.
- [ ] Correlate completion and correction using stable turn identity rather than timestamp guesses.
- [ ] Resume/branch/compaction/reload do not assign corrections to an abandoned or unrelated turn.
- [ ] Report real observations and available usage, distinguishing requested/effective settings; no fabricated counterfactual savings or confidence-as-accuracy claims.
- [ ] Ledger reset removes ledger observations only and leaves base configuration and learned tuning intact.
- [ ] Support optional included routing/guidance decisions without requiring other feature tickets to run.

## Verification

Run completed/failing/corrected Pi turns with local fixtures, inspect persisted state and report command results, exceed retention limits and exercise resume/branch/reset cases. Add observational fields from later slices through the shared ledger contract without claiming unimplemented behaviors.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

Implementation merged at `2a399676c0699e76e269c9cc99fdfff350c23ce1` (short merge reference `2a39967`); current-tree focused ledger and CLI integration tests passed in an isolated frozen-lockfile checkout. Independent review returned OK with notes; see [the reconciliation](../../jev-remaining-tasks-reconciliation.md) for evidence and limits. The original checkboxes are retained as historical acceptance criteria.
