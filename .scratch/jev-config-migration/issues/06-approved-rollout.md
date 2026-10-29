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

## Comments

Operator explicitly approved candidate installation with the async visual acceptance gap still open and approved preserving the four existing tier mappings. Installed Jev `0359731171ac69fd5e000454ffff087d30e2009c` and executor `ec706c84bb26573c7d3f478b2bf6da0269caac33`; private backup and verification receipt: `/Users/naicoi/Projects/jev-config-migration-evidence/ticket05/public-final/user-install-receipt.md`. This approval does not waive acceptance or complete tickets 05/06. No active Pi restart or paid inference was performed.

### Rollout checkpoint

Ticket 05 was subsequently accepted at merge `e30983d20ade9c1540d318cbe2dfe348a2092f0d`; its tested source tree matches the installed Jev candidate. The disposable installed-config and native foreground proofs passed, as did a later async diagnostic; an earlier async timeout remains unexplained. See `ticket05/public-final/final-report.md` and the retained logs under the evidence directory above. These results do not prove the active user session has loaded the installed pair.

The installed pair, approved four-tier migration, private backup, single package entries and absence of paid inference are recorded in `user-install-receipt.md`. The executor dependency audit reported high and moderate advisories; traffic applicability is not established and no remediation is claimed.

Historical checkpoint: after existing work ends, close and reopen Pi and verify `/jev status`; worker routing and effective worker timeout require a full process restart, not `/reload`. The additional requirement for a worker launch in the operator's current session was introduced by this checkpoint, not by the original acceptance criteria; disposable local-provider worker proof and current-session status are recorded below instead.

Rollback: preserve `jev-pilot.json` and the `jev-pilot/` ledger and tuning state; use the private backup to identify previous package refs and restore them through Pi's package manager. Older versions may not read `jev-pilot.json` and can require their prior configuration sources; inspect the backup and prior version documentation before changing settings. Do not overwrite unrelated settings or expose secret values.

### Post-restart local verification checkpoint

Operator reported a Pi restart. Disposable native package-discovery smoke loaded installed Jev `0359731`, read isolated JSON configuration and produced `/jev status` using localhost services: 1 pass / 7 assertions. A separate native foreground workflow smoke explicitly loaded that Jev package and executor `ec706c8`; the localhost worker was assessed, started and completed, and the foreground result settled. Workflow expanded output bytes were not asserted; harness teardown terminates the Pi process, so its exit is not natural process-close proof. Earlier harness REDs and their limits are retained. Evidence and commands: `/Users/naicoi/Projects/jev-config-migration-evidence/ticket06-restart/checkpoint.md`.

The operator subsequently supplied current-session `/jev status` after restart: Jev loaded, configuration validated and main effort classified; no worker decision yet. This is not a current-session worker proof. Verification smokes used localhost and did not invoke paid inference; the cost of the user-session classification is not established. Historical async root cause remains unknown.

Independent read-only review initially returned BLOCKED; reconciliation corrected two findings. The original criteria require disposable installed-runtime proof, not a worker in the user session. Installation before gate completion was an explicitly operator-approved sequencing exception, not a retroactive gate pass. The remaining evidence gap is a contemporaneous manual migration preview, including effective source/base/overlay and credential variable name, and whether a pre-existing `jev-pilot.json` needed backup. Review and reconciliation: `/Users/naicoi/.pi/agent/sessions/--Users-naicoi-Projects-pi-jev-pilot--/subagent-artifacts/9c70a47b-c51b-45ea-a922-65cb527f277c_reviewer_0_output.md` and `81c7eb5c-a9c2-47e9-b97b-5764d4f2087e_reviewer_0_output.md`. Preserve audit advisories and unexplained historical async timeout as unresolved disclosures.

## Verification and handoff

Before implementation, map each criterion to an observable test and record the RED command. Use the highest approved native/local-provider seam; parser tests alone are insufficient. Record GREEN commands, source SHA, artifacts and limits. Keep intermediate changes on the integration branch; do not deploy or alter personal settings. Each ticket needs independent review before completion.
