# 04: Next-boundary refresh and visible tuning

Status: ready-for-agent
Implementation: pending

**Parent:** [Single-file Jev configuration](../spec.md)

**What to build:** Make new boundary configuration effective without reload while active assessments stay immutable; make tuning precedence explicit.

**Blocked by:** 02 — Main consumers and effective status; 03 — Worker tiers and inline crew.

**Traceability:** CFG-06, CFG-07, CFG-09, CFG-12, [approved contract](../plan.md).

## Acceptance criteria

- [ ] Native delayed main/worker tests prove new file affects the next boundary, not in-flight assessment, preflight, batches or committed launch.
- [ ] Worker enable/disable admission and owner behavior reconcile safely; raised/lowered authority window and HTTP timeout both use the effective new value.
- [ ] A malformed/partially written new file rejects its boundary rather than using stale last-good data; active captured work remains stable.
- [ ] Tune command displays base/overlay/effective; apply/reset, evidence window and ledger independence remain correct.
- [ ] Any required executor API change gets separate isolated implementation/review and exact pin before integration; no stale timeout exception to acceptance.

## Verification and handoff

Before implementation, map each criterion to an observable test and record the RED command. Use the highest approved native/local-provider seam; parser tests alone are insufficient. Record GREEN commands, source SHA, artifacts and limits. Keep intermediate changes on the integration branch; do not deploy or alter personal settings. Each ticket needs independent review before completion.
