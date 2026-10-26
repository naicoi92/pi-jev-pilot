# 05: Legacy cutover and packaged acceptance

Status: ready-for-agent
Implementation: pending

**Parent:** [Single-file Jev configuration](../spec.md)

**What to build:** Complete removal of all legacy options sources, demonstrate the migration in native and packaged profiles and publish accurate operator guidance.

**Blocked by:** 04 — Next-boundary refresh and visible tuning.

**Traceability:** CFG-01–CFG-12, [approved contract](../plan.md).

## Acceptance criteria

- [ ] Audit every production config/status reader: only official directory env and explicitly named credential env remain permitted inputs.
- [ ] Conflicting legacy option env and global/project Pi settings never change new-file behavior; bounded deduplicated diagnostics contain names only.
- [ ] Manual mapping/default examples cover every inventory row, including tiers and inline crew; no automatic settings rewrite or paid model seeding.
- [ ] Native Pi-Bolt acceptance and real disposable packaged install exercise the same schema/path, ordinary/specialized dispatch, cancellation, status/Ctrl+O and spinner.
- [ ] Lint/type/format and focused/full relevant gates reported honestly; independent Standards + Spec/security review completed; no unexplained failing gate waived.

## Verification and handoff

Before implementation, map each criterion to an observable test and record the RED command. Use the highest approved native/local-provider seam; parser tests alone are insufficient. Record GREEN commands, source SHA, artifacts and limits. Keep intermediate changes on the integration branch; do not deploy or alter personal settings. Each ticket needs independent review before completion.
