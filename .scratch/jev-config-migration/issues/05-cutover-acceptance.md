# 05: Legacy cutover and packaged acceptance

Status: ready-for-agent
Implementation: completed

**Parent:** [Single-file Jev configuration](../spec.md)

**What to build:** Complete removal of all legacy options sources, demonstrate the migration in native and packaged profiles and publish accurate operator guidance.

**Blocked by:** 04 — Next-boundary refresh and visible tuning.

**Traceability:** CFG-01–CFG-12, [approved contract](../plan.md).

## Acceptance criteria

- [x] Audit every production config/status reader: only official directory env and explicitly named credential env remain permitted inputs.
- [x] Conflicting legacy option env and global/project Pi settings never change new-file behavior; bounded deduplicated diagnostics contain names only.
- [x] Manual mapping/default examples cover every inventory row, including tiers and inline crew; no automatic settings rewrite or paid model seeding.
- [x] Native Pi-Bolt acceptance and real disposable packaged install exercise the same schema/path, ordinary/specialized dispatch, cancellation, status/Ctrl+O and spinner.
- [x] Lint/type/format and focused/full relevant gates reported honestly; independent Standards + Spec/security review completed; no unexplained failing gate waived.

## Comments

Merged as `e30983d20ade9c1540d318cbe2dfe348a2092f0d`; source and test tree matches `0359731171ac69fd5e000454ffff087d30e2009c`, which passed 980/980 tests. Exact merge checkout passed isolated install, lint, typecheck, formatting and focused smoke 11/11. Final installed config and native foreground visual proof passed; async visual diagnostic passed after an earlier failed attempt whose cause remains unresolved, not claimed fixed. Evidence: `/Users/naicoi/Projects/jev-config-migration-evidence/ticket05/public-final/`.

## Operator amendment: verified profile context

Enabled `profile` launches verified and resolved to `fresh` by the pinned executor use ordinary routing. Unknown or unverified context or target remains fail-closed. Verify the actual profile dispatch and relevant negative controls; retain the historical AC-13 failure receipt. This is not a waiver of full or packaged acceptance.

## Verification and handoff

Before implementation, map each criterion to an observable test and record the RED command. Use the highest approved native/local-provider seam; parser tests alone are insufficient. Record GREEN commands, source SHA, artifacts and limits. Keep intermediate changes on the integration branch; do not deploy or alter personal settings. Each ticket needs independent review before completion.
