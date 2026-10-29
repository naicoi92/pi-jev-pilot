# 11: Verify and document the distributable faithful port

**What to build:** A new user installs the packaged artifact in an isolated Pi environment and can use the included routing, guidance, crew and reporting flows with documented compatibility and honest verification limits.

**Blocked by:** 02: Route main requests through configurable model tiers; 03: Match Pi skills in the combined classification request; 04: Deliver upstream strategy and quality advice in Pi; 05: Attach the upstream design pack using available Pi resources; 08: Run custom model slots and junior-lead crew modes; 10: Apply and reset evidence-based tuning explicitly

**Status:** ready-for-agent

**Implementation:** in-progress

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-01, AC-07, AC-12, AC-21, AC-26, AC-27, AC-28. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Install the actual packaged artifact using normal Pi package discovery, with host-provided dependencies declared appropriately and no Claude launcher/proxy.
- [ ] Run cross-feature regression and actual Pi user-path smokes covering combined classification, routing, guidance, worker execution and report/tuning.
- [ ] Verify lifecycle/cancellation with the integrated package and ensure excluded escalation, external review, worker health/failover, pet and broad live statistics remain inactive.
- [ ] Document tested stable Pi/execution-package versions, qualified mappings, System One configuration, privacy, commands, workflow advice limitations and approved host differences.
- [ ] Preserve upstream MIT license/provenance and do not bundle unlicensed benchmark research datasets as product data.
- [ ] Publish a complete acceptance-to-test coverage summary, distinguishing deterministic host E2E, optional live-provider smokes and any unverified limits.
- [ ] Do not publish a release, create a remote repository or claim live-provider E2E without the required authority/evidence.

## Verification

In an isolated environment install the tarball and run the full test/typecheck/package checks plus Pi CLI and worker scenarios. Review Standards and Spec axes against the pinned baseline and all AC owners. Reuse per-ticket evidence rather than deferring all integration testing to this ticket.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

Historical acceptance is recorded in [ticket-11-validation.md](../../../docs/testing/ticket-11-validation.md). On local main `a4cd84677af593e9349a3c01a7d13613192cf51f`, frozen-checkout packed package tests passed 19/19, including discovery, combined classification/guidance, report/tuning, timeout/cancellation and reload/shutdown. A packed real foreground worker scenario passed 1/1. The user deferred further investigation of the historical async failure; it is not considered fixed. Independent Standards/Spec review found that the current-tree full-suite gate and historical coverage qualification remained incomplete. Coverage qualification was updated; one full-suite attempt on the new executor-pin candidate timed out after 2100 seconds with 753 pass lines and no final result. Focused package/pairing tests passed 20/20 after the pin correction. The host's dependency advisories remain a separate security release blocker. See [the reconciliation](../../jev-remaining-tasks-reconciliation.md). No live-provider E2E or release is claimed.
