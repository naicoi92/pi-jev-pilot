# 06: Explicitly approved rollout and rollback receipt

Status: ready-for-agent
Implementation: pending

**Parent:** [Single-file Jev configuration](../spec.md)

**What to build:** After separate operator deployment approval, install the reviewed immutable package pair and verify the installed configuration path without silently migrating user values.

**Blocked by:** 05 — Legacy cutover and packaged acceptance.

**Traceability:** CFG-11, CFG-12, [approved contract](../plan.md).

## Acceptance criteria

- [ ] Do not deploy without explicit rollout approval and completed verification/review gates.
- [ ] Private backup and manual migration preview preserve unrelated settings, secret values and operator-selected model mappings.
- [ ] Official immutable installs, exact paired pins if needed, duplicate-entry checks and disposable installed-runtime proof are recorded.
- [ ] No paid inference without separate budget; reload requirements and current-session verification limits are explicit.
- [ ] Rollback instructions preserve config/runtime state and identify old versions that cannot read the new file.

## Verification and handoff

Before implementation, map each criterion to an observable test and record the RED command. Use the highest approved native/local-provider seam; parser tests alone are insufficient. Record GREEN commands, source SHA, artifacts and limits. Keep intermediate changes on the integration branch; do not deploy or alter personal settings. Each ticket needs independent review before completion.
