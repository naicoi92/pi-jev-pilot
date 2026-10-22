# Ticket 05 validation evidence

This slice ports only the upstream design pack into the shared classifier and owned advice context. It creates no UI, images, assets, workers, ledger, tuning or new routing policy. The [AC matrix](ticket-05-matrix.md) was recorded before test code; the bounded fault/privacy follow-up was recorded before those tests.

## Baseline and source authority

- Dedicated worktree `pi-jev-pilot-ticket-05`, branch `ticket/05-design-pack`, clean initial HEAD and integration baseline `48d1fc1b9d470b23aa0a6a1ac0cefc8df4908582`. Both baseline and integration ancestry were checked. No tracker/spec/status changes.
- CodeGraph initialized and status verified before structural navigation. Read-only upstream HEAD verified as Jev Pilot 0.12.1 commit `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`; no upstream edits.
- Pinned `hooks/skill-suggestion.policy.ts:1098–1169` supplies the original design rubric, `.8` inclusive gate, noul/probability read, exact-then-`:name` skill resolution, project-system priority, VoltAgent reference URLs and product examples. `hooks/jev-skill-suggestion.ts:214` supplies `design-taste-frontend, impeccable, web-design-guidelines`; 455–457 adds the question only in the first skill batch; 579–587 computes design independently of ordinary matching. `hooks/features.ts:33` defaults design true. `tests/design-pack.spec.ts:5–38` provides independent .97, installed/missing/plugin-name and bare-reference fixtures.
- Official published development dependencies remain exactly Pi/AI **1.4.0**; the installed CLI reports 1.4.0. The global CLI reports 1.1.0 and is **not** used by the fixture. Bun is **1.4.3**. Public `getCommands`, resource `sourceInfo.path`, `getActiveTools`, tool registration and existing lifecycle/context APIs supply the adaptation; no host/cache patches or private runtime APIs.

## Completed acceptance gates

**Final full suite: 340 pass, 0 fail, 1,102 assertions across eight files, 206.89 seconds.** This preserves the accepted **288 tests / 875 assertions** and adds **52 installed official CLI tests / 227 assertions**. Log: `/tmp/pi-jev-ticket05-logs/13-final-full-suite.log`.

The completed full suite includes the actual installed RPC CLI tests for effort, routing, skills, strategy/quality and design; it is not merely pure policy testing. Each fixture installs the local package with official `pi install` into a disposable agent directory, then captures local deterministic System One and OpenAI-compatible provider HTTP requests. No paid service or real credential is used. Prior-slice fixtures explicitly disable the newly introduced design consumer to preserve their independent question expectations; the new fixture exercises its production true default.

| Criterion               | Completed observable evidence                                                                                                                                                                                                                                                                                                                                                                                        | Result |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC-09                   | Default design-only exactly one `ui_design` noul/request; physical and virtual all-consumer paths exactly one combined request; 255 skills two first-pass requests with design only in the first, optionally a third rerank without design; disabled/ineligible paths zero HTTP with invalid unused endpoint; exact upstream captured rubric; minimized classifier input                                             | PASS   |
| AC-17                   | Inclusive .8/.97 versus .799 and .09 UI-handler/backend negatives; malformed/missing scores fail closed; configured defaults/custom names/exact-before-suffix, unreadable/disabled/unconfigured exclusions; ordinary-off/design-on; active-only resource/tool advice and existing project tokens; independent ordinary selection/none; rejected routing retains model/medium/schema-error while valid design appears | PASS   |
| AC-17 ownership/failure | Physical/virtual retries, real read continuation, plain continue, queued substantive owner/shared UUID, fork/tree/reload/resume, compaction, stripped identity, service/invalid JSON, cancellation/manual model/thinking changes and aborted deadline; no stale block on newer user, no persisted user-content mutation or UUID in provider payload                                                                  | PASS   |

`bun run test:e2e` was also started separately. Its `/tmp/pi-jev-ticket05-logs/14-final-installed-e2e.log` was **interrupted by orchestration timeout without a final summary**. It is retained as incomplete evidence and is **not claimed as a passing completed run**. The completed full-suite log above already runs those installed CLI test files against the same source/test tree; no redundant full rerun is needed for that interruption.

## Chronological RED → GREEN

Logs remain under `/tmp/pi-jev-ticket05-logs/`.

1. `01-design-red.log` first encountered missing local dependencies, not a product failure. `bun install --frozen-lockfile` installed the exact locked dependencies without lockfile change.
2. `02-design-red.log`: actual installed eligible design-only prompt produced zero classifier requests instead of one. `03-design-green.log`: shared initial design question and bare reference block passed, one test/four assertions.
3. `04-resource-red.log`: installed configured impeccable was missing from the model-visible pack. `05-resource-green.log`: public-catalog references passed, two tests/14 assertions.
4. `06-resources-boundaries.log`: score/resource cases passed; reference-tool fixture failed because CLI `--tools` had not declared those tools active. The fixture was corrected through public registration/allowlist/loadout APIs, not production policy. `07-tool-green.log` passed. `12-registered-inactive.log` additionally proves the inactive tools are registered in the public catalog but omitted from the pack.
5. `08-combined-gates.log`: 29 tests/116 assertions passed for combined calls, independent raw consumer, first-batch/rerank, resource separation and rubric.
6. `09-lifecycle.log`: test assumptions exposed Pi's persisted user text-parts shape and the existing virtual route's tier-only classification on fresh continuation branches without reusable state. Assertions were corrected to decode text parts and distinguish tier requests from design requests; no production workaround. `10-lifecycle-green.log`: 47 tests/197 assertions passed.
7. `11-fault-privacy.log`: five bounded service/JSON/privacy cases passed, 26 assertions. Final suite includes all 52 cases; `12` adds four active-catalog assertions. `13` is the complete final acceptance run. `14` is incomplete as stated above.

## Verification commands

```bash
codegraph init
codegraph status
bun install --frozen-lockfile
bun run node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js --version
bun test tests/design-pack.test.ts
bun test tests/design-pack.test.ts -t D17-reference-tools
bun test tests/design-pack.test.ts -t 'D17-fault-stale|D09-privacy'
git merge integration/jev-pilot-port
bun run fmt
bun run lint
bun run fmt:check
bun check
git diff --check
bun test tests
```

Oxc lint/format and Bun check pass, without Prettier, suppression or unsafe autofix. Source/tests remained unchanged after the complete full-suite run; only this validation document was subsequently added. Final documentation gates and branch cleanliness are recorded with the candidate SHA in the implementation handback.

## Approved host adaptations and limits

- `JEV_DESIGN_ENABLED=true` and `JEV_DESIGN_SKILLS` retain the upstream defaults. Explicit empty/commas-only configured list is empty, not a fallback to guessed aliases. Exact configured names win, then upstream suffix matching follows catalog order; no new ambiguity ranking is introduced.
- Effective public Pi skill catalog is read independently of ordinary matching, excluding unreadable resources and `disable-model-invocation`. No parallel filesystem scan or hidden discovery. Pack references do not inject whole design bodies; ordinary matching still independently chooses at most one skill.
- The nonexistent Claude Skill tool is replaced only by an exact catalog-path `read` hint when `read` is active. Without it, installed resources can be named but no load tool is promised. Mobbin/Inspo appear only with corresponding active upstream-prefix tool names, listing exact available names. Prefix recognition does not prove a schema or search capability; missing `search_screens`/`search_flows` are never invented. Disposable custom tools prove gating, not live external MCP service behavior.
- Existing project design system/tokens stay first. Original awesome-design-md URLs/examples remain fallback guidance only: no automatic fetch, asset generation, invocation or model/settings write. The pack is advice, not tool authority, catalog suppression or exclusive enforcement.
- Design reads the same parsed response independently of routing validation, like the accepted ticket04 consumer separation. Missing/malformed/transport-failed design answers do not fabricate a block. Valid design cannot turn rejected routing into success or change its retained/default fallback.
- Context projection reuses the accepted single `jevPilotInputId` and `jev-pilot:advice` seam. Arbitrary metadata persistence is **version-tested on official Pi 1.4.0, not a documented host guarantee**. Missing/stripped metadata fails closed; host/provider upgrades and extension composition require revalidation. Persisted user content remains unchanged; advice entries store generated guidance/UUID, not captured user prompts.
- Local deterministic fixtures prove question counts, payloads, provider-visible packs and lifecycle behavior, not hosted Jev availability, general classifier accuracy, actual design quality, every provider or interactive rendering. No paid API, credential access, global settings mutation, remote/publish/merge into integration, subdelegation or future feature was used. Independent parent validation/review and merger remain required.
