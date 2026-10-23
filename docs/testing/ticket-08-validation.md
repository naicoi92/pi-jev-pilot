# Ticket 08 — validation evidence

## Candidate and authority

Branch `ticket/08-custom-slots-crew`, clean baseline `265e282b8f79235f5d511976eb05db58b8d06fd8`. Integration was rechecked before commit and remained at that exact baseline (no integration commits to merge). Pinned read-only source `/tmp/pi-jev-upstream-5d27135` verified at `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`. CodeGraph initialized/status verified on this new worktree before structural exploration.

Contract: ticket08, parent AC-02/03/13/15/18/19/20/21/27, decision-gating ordinary model/effort authority, ticket07 risk precedence. `ticket-08-matrix.md` was created before tests. No tracker/spec/status changes, dependency versions, host caches, independent engine, remote execution or paid providers were introduced.

## RED → GREEN

- `bun test tests/crew-config.test.ts`: RED missing crew module, log `/tmp/ticket08-config-red.log`; GREEN after minimal config implementation, 1 test / 3 assertions.
- Subsequent focused config/policy/adapter validation: 23 tests / 82 assertions GREEN (`/tmp/ticket08-focused.log`).
- First actual packed slot/junior pass: four slot scenarios GREEN, two junior RED (`/tmp/ticket08-cli-focused.log`). Installed executor rejected unsupported runtime `maxTurns`. Removed that unsupported field rather than claiming enforcement.
- Next junior execution ran real children but fixture expected an invented off thinking field. Actual provider requests proved inherited medium; specialized branch correctly issues no worker classification. Corrected the fixture to assert provider settings and real receipts without inventing receipt fields. Final focused junior: 2 tests / 32 assertions GREEN (`/tmp/ticket08-junior-green.log`).
- Packed workflow/collision: 2 tests / 37 assertions GREEN (`/tmp/ticket08-additional.log`). Junior strategy real CLI gates: 4 tests / 28 assertions GREEN; ownership/error unit tests: 2 tests / 8 assertions GREEN.
- Not every additional boundary test was independently observed RED; the initial tracer bullet and real packed integration failures above are the observed RED evidence, not a claim of universal mutation testing.

## Final gates

One final full suite (includes actual CLI/E2E, no redundant whole-E2E rerun):

```text
JEV_WORKER_EVIDENCE_DIR=/tmp/ticket08-final-receipts bun test tests
419 pass
0 fail
2103 expect() calls
Ran 419 tests across 15 files. [690.59s]
```

Baseline accepted suite was 396 tests / 1881 assertions; candidate adds 23 tests / 222 assertions. Full output `/tmp/ticket08-full.log`. `bun run lint`, `bun run typecheck` (32 files), `bun run fmt:check`, `git diff --check` all passed. Formatter is oxfmt; no Prettier.

## Packed real adapter receipts

All below live under `/tmp/ticket08-final-receipts/<directory>/trace.json`, with package source/config, commands, sessions, terminal/usage receipts and `cleanup.json` retained. Pi 1.4.0 and installed pi-subagents 0.80.0, disposable HOME, local HTTP System One/provider fixtures only.

| Scenario                    | Directory suffix | Worker classifier count | Actual child provider model / effort |
| --------------------------- | ---------------- | ----------------------- | ------------------------------------ |
| standard candidates         | `q334Cw`         | 1                       | selected / medium                    |
| budget custom direct        | `Gg5Vw6`         | 1                       | selected / medium                    |
| budget custom async         | `JGykaR`         | 1                       | selected / medium                    |
| approved risk > .7          | `9RLKdh`         | 1                       | configured deep / high               |
| configured junior direct    | `8OBKJE`         | 0                       | configured / medium                  |
| first-slot junior async     | `alG13S`         | 0                       | selected / medium                    |
| custom workflow advice      | `YPMv6W`         | 1                       | selected / medium                    |
| configured junior collision | `Mtmni4`         | 0                       | no child; actionable collision       |

Directory prefix is `pi-jev-worker-production-`. Async cases assert observed terminal process state, complete state, output and token counts. Direct cases assert exit code, output and usage. Worker payloads remain brief/type only, no parent history, exactly one ordinary worker classification and no child reclassification. Standard omits slots; budget keys replace fast and retain balanced/deep; default `when` remains read-only. Ordinary caller configured model/max or low defaults do not bypass valid slot/effort selection. Existing full-suite privacy, cancel ownership, main policy, skills/design, fallback/retained targets, profile/unknown-runtime/singleton negatives all pass.

Cleanup checks capacity before each install, reaps only owned processes, observes async terminal receipts, saves compact evidence and prunes only fixture dependencies/private cache/tarball. Final listed cleanup receipts report roughly 114 GB available. No global/project cache deletion.

## Explicit limitations

No live paid-provider, remote-machine, real quota/health or credential verification. Source-backed named junior is a specialized mapping, not an ordinary classifier call: executor defaults control its effort. Upstream `maxTurns: 40` has no supported runtime-agent-definition field and is not enforced. Name collision is an actionable negative, not coexistence support. Required-child singleton/profile/unknown-runtime constraints from ticket06 remain. File changes require reload/restart for registered crew membership; there is no live-control system. Public slot-name collision handling is a representation adaptation (`slot::<name>`), not a new reserved-name policy. Independent fresh review is still required before integration/acceptance.
