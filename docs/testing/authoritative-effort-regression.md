# Authoritative effort regression

## Decision and scope

The operator approved authoritative valid effort assessments on 2026-10-25 at
00:13:36 UTC (decision `b023faf1`), after the proposal at 00:11:45 UTC and
main/worker clarification at 00:13:31 UTC. This supersedes the earlier effort
confidence and short-follow-up veto requirements in AC-03 and decision-gating.
Confidence remains diagnostic, not a reason to retain baseline effort. A valid
explicit choice wins legacy quantization; legacy normalized decisions without a
choice retain their existing normalization. Same-level assessment is a successful
selection. Main effort wording must be neutral about task difficulty.

Keep main max lock, xhigh selection ceiling, risk floor/no-lowering and final
model support clamping. Worker tier/model confidence, expert admission and
highest-supported-effort fallback remain unchanged. This fix does not restore
worker-authority machinery, change continuation ownership/reuse, or fix the
unreproduced spinner incident. Historical validation records remain historical.
Stored confidence tuning fields remain compatible but cannot veto valid effort;
close-margin tuning still applies to legacy normalization.

## Pre-code acceptance matrix

Every new or changed test below maps to one criterion. Expected values come from
the approved decision and recorded numeric decisions, not recomputation of policy.
Existing risk, ceiling, expert and tier fallback fixtures remain independent controls.

| Criterion                                                                                                                    | Test seam / test IDs                                            | Expected-value source                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AE-1: recorded normalized assessments apply without confidence or short-input veto                                           | `selectEffort`, `POLICY-AE-1`                                   | Recorded first confidence .44 resolves high; fourth confidence .94 on short option resolves low. Native replay expects high, medium, medium, low.                                                                                          |
| AE-2: valid effort confidence is diagnostic, including absent/zero confidence and same-level selection                       | `selectEffort`, `POLICY-03`; `TUNE-25-effective-policy`         | Approved confidence-veto removal; same-level returns assessed effort. Stored confidence thresholds cannot override selection.                                                                                                              |
| AE-3: validated explicit choice is authoritative; malformed/inconsistent responses fail closed; legacy normalization remains | localhost HTTP `classify` → `selectEffort`, `CONTRACT-AE-3`     | Approved schema/consistency contract; previous authoritative implementation accepts ties/1e-8 float noise, rejects non-max choice and malformed supplied fields. Explicit medium with .55/.45 selects medium; without choice selects high. |
| AE-4: neutral main question, unchanged worker wording and common rubric                                                      | localhost HTTP `classify`, `CONTRACT-AE-4`                      | Approved neutral wording: rate requested work, use recent context to identify approved/continued work.                                                                                                                                     |
| AE-5: risk, main max lock/xhigh ceiling, tier/expert admission and supported fallback remain                                 | existing policy/tier/worker/expert tests; focused native replay | Existing independent boundary fixtures; main risk strictly > .7, max retained, selected max capped xhigh; expert_needed strictly > .9 plus tier confidence and configured availability; fallback highest supported effort.                 |

The recorded replay has normalized decisions only, not original classifier wire
choices. Do not invent historical choices or infer a generation/spinner cause.
Native local replay uses synthetic history and localhost responses, not hosted
inference or exact historical network timing. No installation or personal settings
changes are part of validation.

## Validation result

- Recorded regressions: both failed before implementation (`high`/`low` expected,
  `null` received), then passed. Explicit-choice regression failed with `high`
  instead of `medium`, then passed. Malformed supplied-field tests and neutral
  question contract also demonstrated RED before GREEN.
- Focused policy, HTTP contract, tuning compatibility, tier, crew, worker adapter
  and expert CLI tests: **159 passed, 0 failed** across seven files. Existing
  expert admission and highest-supported fallback controls passed unchanged.
- Native Bolt 1.0.2 local interactive replay loaded the worktree extension directly:
  four questionnaire turns rendered and settled, four classifier calls, eight
  primary requests. Provider efforts were **high/high, medium/medium,
  medium/medium, low/low**, matching recorded-assessment expectations. Synthetic
  history and localhost responses do not reproduce historical generation or prove
  a spinner cause. Harness used bounded process termination after observations;
  no graceful-shutdown acceptance claim.
- `bun check`: no type errors in 183 files. Focused lint, formatting and
  `git diff --check` passed.
- Review follow-up aligned all reviewer-listed fresh confidence-zero CLI assertions
  in CLI-26g/j/l/p/q/r/k to low. Pre-prompt branch restoration assertions remain
  unchanged; CLI-26i still expects reused high without a fresh classification.
  Tuning CLI now expects valid high at confidence .55 before and after stored .6
  confidence tuning, reload and session changes. Persistence, reset, fresh-window
  and ledger-isolation assertions remain intact. These map to AE-2; no production
  continuation or ownership implementation changed.
- Legacy `PiFixture` CLI tests were **not executed**. Inspection of
  `tests/fixtures/pi-cli.ts:294–307` confirms unconditional `pi install` during
  startup; `packageSource` only changes its input, and no supported cached/offline
  no-install path exists. Changing this seam would alter package-path coverage,
  so validation uses exact static assertion audit plus the focused 159-test suite
  and existing native 4/4 worktree replay evidence. This is an execution limitation,
  not deferred assertion alignment or a claim of legacy CLI acceptance.

No full suite, hosted inference, installation, push or personal settings changes.
Independent review remains required before integration. Spinner remains unresolved.
