# 01: Single-file effort tracer

Status: ready-for-agent
Implementation: completed

**Parent:** [Single-file Jev configuration](../spec.md)

**What to build:** Make a real isolated CLI assessment use the global single-file source, effort toggle and classifier options, with exactly the named credential. Establish the shared immutable loader contract while preserving green integration defaults.

**Blocked by:** None (can start immediately).

**Traceability:** CFG-01, CFG-02, CFG-04, CFG-05, [approved contract](../plan.md).

## Acceptance criteria

- [x] Actual custom/default agent-directory files control the outgoing localhost request; project and merged Pi settings cannot override the tracer.
- [x] Missing fields/file use approved defaults; malformed/type/null/unknown/version diagnostics are actionable and secret-free.
- [x] Named credential resolves exactly once per request, no implicit fallback; unused credential is not required.
- [x] Endpoint validation and redirect rejection are verified with two local servers; no key/body reaches redirect target.

## Verification and handoff

Before implementation, map each criterion to an observable test and record the RED command. Use the highest approved native/local-provider seam; parser tests alone are insufficient. Record GREEN commands, source SHA, artifacts and limits. Keep intermediate changes on the integration branch; do not deploy or alter personal settings. Each ticket needs independent review before completion.

## Comments

### Restart candidate

Implementation: in-progress (candidate only; independent review, reviewed merge and integration verification remain required).

Source baseline: `00e76b0814ed189bdc2ac6d08777613a8ba93c3a`; integration tip has the same SHA and is an ancestor of this branch. Fresh implementation; no source copied from the stopped attempt.

Approved observable seam: `/Users/naicoi/.bun/bin/pi-bolt`, version `1.4.0 (Pi-Bolt 1.0.4, darwin-arm64, JIT off)`, isolated disposable HOME/agent directory, real JSON files and localhost classifier/provider. Supporting loader tests supplement native proof.

| Criterion | Test IDs / observable proof | Expected-value source |
| --- | --- | --- |
| AC-1 / CFG-01 | CFG-01-custom, CFG-01-default: file toggle/model reaches local request despite conflicting project/global settings and legacy options | Plan Configuration source; version-1 defaults |
| AC-2 / CFG-02 | CFG-02-defaults, CFG-02-invalid: missing file/fields; strict types/null/unknown/version; disabled consumers still validate; secret-free path diagnostics | Plan version-1 schema and existing crew contract |
| AC-3 / CFG-04 | CFG-04-named, CFG-04-missing, CFG-04-lazy: exact named credential, no fallback, unused credential not read; captured request credentials | Plan credential and snapshot contract |
| AC-4 / CFG-05 | CFG-05-url, CFG-05-redirect: HTTP(S), no embedded credentials; two-server redirect receives no key/body | Plan URL and redirect contract |
| AC-1 / tracer preservation | CFG-01-overlay: JSON base then existing tuning overlay captured before awaits; next boundary refresh | Explicit restart instructions; Plan tuning/snapshot contract |
| AC-1 / legacy isolation | CFG-01-legacy-invalid: invalid legacy options ignored, not converted into JSON | Explicit restart instructions |

RED commands will be recorded per vertical slice before production edits. Evidence directory: `/Users/naicoi/Projects/jev-config-migration-evidence/ticket01-r2/`.

Scope decision: main effort/classifier uses an explicit captured snapshot API. No-argument legacy worker, lifecycle and status readers remain temporarily for tickets 02/03/04, not a release compatibility contract. Ticket 05 must remove all legacy source readers before release. No executor dependency or whole-main/worker/status migration in this ticket.

### Candidate verification and shared contract

- Native path RED: `bun test tests/config-native.test.ts` → 0 pass / 2 fail (`classifications` expected 1, received 0) before production edits. `red-path.log`.
- Native strict validation RED: `bun test tests/config-native.test.ts --test-name-pattern CFG-02-invalid` → schemaVersion path assertion fails before validation implementation. `red-validation.log`.
- Native redirect RED: `bun test tests/config-native.test.ts --test-name-pattern 'CFG-04|CFG-05'` → named missing/lazy cases pass after the first tracer slice; all five redirect cases fail before transport edit. 307/308 forward the synthetic request body to the second localhost server; no real prompts or credentials used. `red-redirect.log`.
- Initial harness-only errors (`ENOEXEC`, default `.pi` already exists) were fixed before meaningful native path RED. Installed command is a shell wrapper without a shebang: `/bin/sh /Users/naicoi/.bun/bin/pi-bolt` execs the native binary. Version verified in each native fixture: `1.4.0 (Pi-Bolt 1.0.4, darwin-arm64, JIT off)`.
- First native runs caused the launcher to populate only disposable HOME caches from its signed native npm artifact. Final harness copies the existing verified cache into disposable HOME, avoiding repeated launcher downloads/installation. No personal settings, paid calls, deployment or package installation.
- Final CFG GREEN: `JEV_CONFIG_EVIDENCE_DIR=/Users/naicoi/Projects/jev-config-migration-evidence/ticket01-r2 bun test tests/config-native.test.ts tests/jev-config.test.ts` → **161 pass / 0 fail**, including 17 native tests; `green-cfg.log`, `native-receipt-1.json` through `native-receipt-17.json` (counts/models/efforts/version only).
- Affected focused unit regressions: 19 files, **336 pass / 0 fail**; `green-regressions.log`. Includes the original 13-file baseline-focused set (252 pass) plus effort policy/visibility, classifier, native skill, crew policy and routing settings.
- Affected CLI regressions: `bun test tests/decision-visibility-cli.test.ts tests/ledger-cli.test.ts tests/pi-cli-fixture.test.ts` → **28 pass / 0 fail**; `green-cli-regressions.log`. Existing timeout tests now set explicit JSON classifier options, not translated environment input.
- Full affected effort CLI file (not full repository suite): `bun test tests/jev-config.test.ts tests/config-native.test.ts tests/pi-cli.test.ts` at that checkpoint → **209 pass / 5 fail**; `targeted-initial.log`. The five failures are the unchanged CLI-03 old rubric wording assertion, reproduced in baseline `baseline-rubric-repro.log`. No rubric or expected rubric assertion changed. Current CFG adds four further native tests after that run.
- `bun run typecheck`, `bun run lint`, `bun run fmt:check`, `git diff --check` pass. Logs: `typecheck.log`, `lint.log`, `format.log`.
- Supporting normalization/immutability and lifecycle/overlay tests extend an already implemented tracer slice; they are retention evidence, not claimed as separate pre-implementation RED cycles. Native RED evidence is the three commands above.

API contract: `loadJevConfig(): JevConfig` strictly validates the entire approved schema and returns a deeply frozen, secret-free snapshot. `captureEffortAssessment(): EffortAssessment` captures file base + learned tuning before awaits. Main `systemOneConfig(assessment)` resolves exactly the named credential lazily once into a request-local config, reused for batches/rerank. Main callers cannot omit `decideMain`'s assessment argument. Pending effort state commits use owning captured eligibility, not a reread; restore boundaries read current file and report invalid edits. Malformed next boundaries never reuse last-good options. Detailed contract and remaining reader ownership: `docs/testing/jev-config-tracer.md`.

Limits: ticket 01 does not claim full CFG-03/06–12 or release/package acceptance. Main skills/guidance/design/crew/status/recording readers belong to 02; worker env/settings/crew and no-argument classifier readers to 03; no-argument tuning base/commands to 04. Their remaining legacy-env fixture cases are not represented as green. Ticket 05 must delete all legacy readers, migrate remaining fixtures and verify installed packed artifacts. Executor pin unchanged. Independent reviewer and reviewed integration merge/verification still required; Implementation remains in-progress.


Source/evidence receipt: implementation source `4b8eb56` (the follow-up commit changes only this ticket receipt). `bun test tests/pi-cli.test.ts --test-name-pattern '^(?!CLI-03 )'` explicitly excludes the five already-reproduced rubric failures and passes **52 / 52**, 5 filtered; `green-effort-cli.log`. This is a focused clean gate, not a replacement for the failing full-file result above. Native binary/launcher hashes: `native-source.sha256`. CodeGraph impact selection: `affected.txt`.

Integration pre-handoff check: `git merge integration/jev-config-migration` reports `Already up to date.`; integration remains at `00e76b0814ed189bdc2ac6d08777613a8ba93c3a`. No integration worktree writes/merge or completion claim. Candidate requires independent review before integration acceptance.

### Reviewed integration acceptance

Candidate `ca1ada691905add859e36ca2f9b5fc1f248f5316` received independent review: **OK with notes**, no P0/P1 within ticket 01. Review artifact: `/Users/naicoi/.pi/agent/sessions/--Users-naicoi-Projects-pi-jev-pilot--/subagent-artifacts/outputs/eb7b78af-c480-4fe1-94f6-868bc577b28d/ticket01-r2/review.md`. Parent inspected the production diff and proof seam. Deferred legacy readers remain explicitly assigned to tickets 02–04, not waived for release.

Merger landed exact candidate as `93745779ed1fbe6b0e4e4f1fe3cb445026cddbb5`, with baseline and candidate parents. Parent verified this integration SHA:

- `JEV_CONFIG_EVIDENCE_DIR=/Users/naicoi/Projects/jev-config-migration-evidence/integration-01 bun test tests/config-native.test.ts tests/jev-config.test.ts`: **161 pass, 0 fail, 699 assertions**, including 17 real native Pi-Bolt cases.
- Focused 19-file unit regression union listed above: **336 pass, 0 fail, 1320 assertions**.
- `bun test tests/decision-visibility-cli.test.ts tests/ledger-cli.test.ts tests/pi-cli-fixture.test.ts tests/pi-cli.test.ts --test-name-pattern '^(?!CLI-03 )'`: **80 pass, 0 fail, 5 explicitly filtered baseline rubric cases, 296 assertions**.
- `bun run lint`, `bun run typecheck`, `bun run fmt:check`, `git diff --check`: PASS.

Integration logs, source SHA and native receipts: `/Users/naicoi/Projects/jev-config-migration-evidence/integration-01/`. These close ticket 01 only; no full-suite, whole-spec, installed packed-artifact or rollout acceptance is claimed. Five known baseline rubric failures still require explicit disposition at combined gate 05.
