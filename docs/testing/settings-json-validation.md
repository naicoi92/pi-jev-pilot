# JSON routing follow-up — acceptance matrix

Scope: separate operator follow-up; ticket08 acceptance unchanged. Official Pi 1.4.0 public effective settings only; no host patch or independent settings-file reader. No personal settings or paid requests.

## Matrix (written before tests)

| Contract                                                                               | Evidence planned                                                                                                                   |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `jevPilot.mainRoutingEnabled` boolean; tiers fast/balanced/deep qualified physical IDs | Shared resolver tests: omitted defaults, unknown keys, null/wrong types, missing tiers and exact error field names                 |
| Explicit environment overrides corresponding JSON fields, including false/empty        | Resolver per-field precedence tests; actual CLI env-false override                                                                 |
| Disabled/inapplicable paths do not validate unused tiers                               | Resolver laziness and existing physical/worker-disabled/fork/error/cancel regressions                                              |
| Public effective settings, host trust/agent directory and recursive merge              | Production `getSettings` only in `session_start`; isolated CLI settings and trusted project merge; no manual production file reads |
| JSON-only physical startup then explicit `set_model jev/auto` and dispatch             | Actual official CLI deterministic localhost classifier/model, physical receipt plus requested/effective state                      |
| Reload enables/disables/changes tiers without stale owner                              | Actual CLI settings rewrite + reload, router count, explicit selection and physical dispatch; repeated session_start unit coverage |
| Existing env-enabled CLI startup remains supported                                     | Focused existing main-routing CLI regressions                                                                                      |
| Same JSON tiers used by ordinary workers                                               | Worker unit dispatch and actual CLI worker dispatch using same shared resolver                                                     |
| Startup ordering limitations documented truthfully                                     | README: JSON-only CLI `--model jev/auto` unsupported; saved default not proven; no automatic selection/default writes              |
| Quality and repository hygiene                                                         | Focused Bun tests only, lint, format check, typecheck; source/docs commit, parent-owned scratch untouched, empty staged list       |

CodeGraph unavailable in worker tool allowlist. Supplied named source/test seams and public host source inspected directly. Existing terminal/PID/deadline helpers must remain unchanged. Full suite and independent review are separate parent gates.

## Checked implementation evidence

- Shared `src/routing-settings.ts`: defaults, per-field explicit environment precedence, narrow unknown JSON inspection, lazy tier validation. Main and ordinary worker adapters snapshot only public `getSettings()` at `session_start`; factory never calls it.
- Official Pi 1.4 retains runtime virtual models across extension reload. Initial reload-disable test failed (router count 1 instead of 0); committed shutdown now explicitly unregisters this extension's router through the public API. Retest covers repeated enable, tier replacement and disable; no automatic model selection/default writes.
- `tests/routing-settings-host.test.ts` checks actual public `SettingsManager` unknown-key retention, recursive trusted-project tier override, untrusted-project exclusion and explicit SDK agent directory. Runtime mock checks factory getter exclusion, repeated starts, malformed enablement and idempotent shutdown.
- `tests/settings-json.test.ts`: actual official CLI starts physical, finds one router, explicitly selects it and dispatches deep; requested `xhigh` clamps to effective `high` in native state and assistant receipt. Reload tests enable/disable/replace tiers; environment false wins; malformed applicable tiers stop before HTTP. JSON-only explicit CLI router startup exits 1 as documented, before classification/generation. Saved-default restoration remains unverified.
- `tests/worker-routing-cli.test.ts` adds `json-only` using the same JSON shape with all four main/tier environment variables absent; packed production adapter dispatches `local/selected:medium` and physical child receipt. Existing disabled, service-error, direct-cancel, required-helper collision and retained-denied cases pass. Required helper/PID/terminal machinery unchanged.
- `tests/fixtures/pi-cli.ts` changes only two lines: optional settings object default `{}` and spread before fixture-owned thinking/retry/compaction defaults. Existing callers unchanged; terminal diagnostics and strict reap/deadline helpers unchanged.

### Validation run

Focused commands (no full suite):

```bash
bun test tests/routing-settings.test.ts tests/routing-settings-host.test.ts tests/settings-json.test.ts tests/worker-adapter.test.ts tests/pi-cli-fixture.test.ts tests/worker-main-isolation.test.ts tests/junior-turn-bound.test.ts
bun test tests/settings-json.test.ts tests/main-routing.test.ts
JEV_WORKER_EVIDENCE_DIR=/tmp/jev-json-validation/worker-evidence bun test tests/worker-routing-cli.test.ts --test-name-pattern 'WORKER-20-(json-only|disabled|error|direct-cancel|coexistence) '
JEV_WORKER_EVIDENCE_DIR=/tmp/jev-json-validation/worker-evidence bun test tests/worker-routing-cli.test.ts --test-name-pattern 'WORKER-(12-direct-cancel|13-coexistence) '
JEV_WORKER_EVIDENCE_DIR=/tmp/jev-json-validation/worker-evidence bun test tests/junior-required-denied-cli.test.ts --test-name-pattern 'REQUIRED-19-retained-denied'
bun run lint
bun run fmt:check
bun run typecheck
git diff --check
```

All passed after fixing the observed reload failure. First worker pattern selects only json-only/disabled/error (three cases); second pattern explicitly selects cancellation/collision. Final combined focused command (all eight named unit/CLI files, including existing main-routing cases) passed **114 tests, 438 assertions**, exit 0; all quality checks exit 0. First main-routing run passed 55 tests (51 existing main cases plus four JSON cases), before adding explicit negative JSON-only CLI startup and PID/terminal assertions. Final focused run includes those additions. Exact counts and process receipts retained in implementation artifact.

Official CLI package version **1.4.0**, bundled CLI SHA-256 `e79626f2dd6f94aa45d30f3fa63cd84319a6eefcd150b353cfaf274366926774`. All provider/classifier requests deterministic localhost with synthetic fixture authentication. Test-owned temp package installs only; no global/personal install or settings change. Executor pin remains `5f8adccb235f1a45858c84b5110c105108947de2`.

Independent review and separate full-suite gate remain required before installation. Later installation must use official package workflow with immutable reviewed source; never edit a managed checkout. User must choose tier mappings; no paid model or personal enablement seeded.
