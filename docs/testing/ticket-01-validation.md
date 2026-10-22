# Ticket 01 validation evidence

This is an effort-only package-boundary implementation. The approved single seam remains prompt/configuration → System One → actual Pi dispatch. No tracker/spec status is changed by this implementation.

## Current candidate: approved auto-effort authority

Integration `38d02aaccf422463129c1942d7cd3f1c4bd86569` supersedes native startup-pin/provenance acceptance. Installing/enabling auto-effort authorizes upstream-policy selection over default/current thinking; it does not authorize unconditional effort changes or override confidence/risk/ceiling/follow-up exceptions. The earlier blocker and RED results remain [historical evidence](ticket-01-startup-provenance-blocker.md), not a claim that native startup provenance was implemented.

- Restoration is deterministic from the active branch. Before/at-owner fork, manual tree prefix, orphan ownership, resume/reload/compaction and queued predecessor cases remain actual CLI acceptance.
- `model_select`/`thinking_level_select` invalidate outstanding classification, abort nested HTTP and discard results before any application/receipt/setter write. Revision plus model/session/thinking snapshots guard the write; completed own writes detach the active selection first. This guard does not establish persistent native pins and does not block future prompts.
- Minimal `JEV_EFFORT_ENABLED` defaults true; false means zero effort questions/HTTP/writes. Model metadata, not current `off`, gates applicability. Non-reasoning/single-supported-level models have no useful effort consumer. Only effort+risk questions are sent together in one request here; future independent consumers are not implemented by this ticket.
- Initial startup/reload before eligible application leaves native thinking and extension history untouched. Retained-history disabled/non-reasoning reload also makes no effort writes.

**Superseded tests:** old CLI-26l/high-preservation became branch-baseline medium acceptance; old CLI-26j/startup-low priority became included-owner high acceptance. Old CLI-06b/high→off diagnostics became CLI-09b/non-reasoning zero-call/no-write acceptance. No old RED is relabelled fixed. AC-06 still verifies real requested xhigh→effective high adaptation.

## Tested stable Pi 1.4.0 contract

Rechecked npm `latest` for both official host packages: **1.4.0**, matching the published installed CLI and [official v1.4.0 release](https://github.com/earendil-works/pi/releases/tag/v1.4.0) (not draft/prerelease). Exact devDependencies and lockfile now pin **1.4.0**. Peer dependencies remain `"*"` as the released package documentation prescribes. Historical Pi 1.3.0 results below are not a current compatibility claim.

Read the complete installed 1.4.0 relevant extension/package/model/custom-provider/virtual-model/RPC/compaction documentation and linked configuration/settings contracts; rechecked released session start/shutdown/tree, message, model/thinking-selection declarations, session-local setter and supported-thinking helpers. The 1.4.0 release changes classifier image support and compaction output limits but does not require changing this text-only System One backend or approved session ownership design. No experimental host prototype is used.

New RED→GREEN slices at the same actual CLI seam:

- Deterministic restoration/initial-state tests: 2 RED (included-owner unequal startup, speculative startup state), 1 already passing revised collision case; then 3 GREEN.
- Applicability: disabled and non-reasoning RED because configuration validation still blocked generation, then zero-call/no-write GREEN without requiring unused classifier credentials.
- Stale manual thinking/model: 2 RED (late high write), then GREEN with guards; each checks no extension decision metadata and next-prompt routing.
- Manual tree prefix before the first application: RED high instead of manual low, then GREEN; initial startup non-mutation remains separately covered.

Current full-suite result: **73 pass / 0 fail / 197 assertions**, comprising **53 actual CLI cases + 20 policy examples**. oxlint, oxfmt and bun check remain the only current tooling gates. The original branch and queue repros still produce medium/medium and `[high, high, low]`. The unchanged startup-equality script now produces medium/medium, matching the newly authorized branch baseline; that script only prints observations. Its former high-priority assertion would test a superseded contract and is not represented as fixed. Final candidate SHA and rerun captures are recorded in the implementation artifact; independent acceptance is still required.

## Historical Pi 1.3.0 compatibility and official contracts

Verified stable target: **official Pi 1.3.0**, published as `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai`. The npm `latest` metadata and [official v1.3.0 release](https://github.com/earendil-works/pi/releases/tag/v1.3.0) agree. The installed CLI prints `1.3.0`. The legacy `@mariozechner` namespace and Pi-Bolt are not the target.

Complete official documents read before implementation:

- [Extensions](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/extensions.md): lifecycle, cancellation, session-local controls and state ownership.
- [Packages](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/packages.md): manifest discovery, local installation and host peer dependencies (`*`, no bundled host copies).
- [Models](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/models.md), [Custom Providers](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/custom-provider.md) and [Virtual Models](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/virtual-models.md): supported thinking metadata, physical dispatch and fixture provider protocol.
- [RPC](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/rpc.md) and [RPC Commands](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/rpc-commands.md): prompt/abort/session commands and settled completion.

Exact released declarations checked: `ExtensionAPI`, `ExtensionContext`, `MessageStartEvent`, `SessionStartEvent`, `SessionShutdownEvent`, `ModelRegistry`, `ReadonlySessionManager`, `SessionProjection`, `SessionEntry`, and Pi's session-local `setThinkingLevel()` contract. TypeScript checks against the pinned published packages, not inferred Pi-Bolt types.

**Important host adaptation:** `before_agent_start` runs before Pi creates its agent abort signal. An initial real CLI cancellation test failed there: classifier work finished instead of aborting promptly. Classification now runs on the supported, awaited user `message_start` event. It has the active `ctx.signal`, covers queued steering messages, and completes before request preparation reads session thinking. No private API, monkey patch, virtual-model selection, or provider wrapper is required. The original candidate deferred only the custom state until `context`, which did not prevent Pi's earlier physical thinking entry from leaking into an excluded prompt prefix. The corrected adapter records a baseline/decision application marker before `setThinkingLevel`, recognizes ownership only when the corresponding following user is present, and reconciles physical thinking at `session_start`/`session_tree` through supported APIs. At that historical checkpoint, manual thinking entries were replayed and explicit startup priority was claimed; the equality-collision review below superseded that claim, then the operator changed the acceptance contract as recorded above. A restore marker closes excluded applications so a later unrelated user cannot claim them. Each queued predecessor receipt is committed after its user is persisted and before the following user is classified; the last receipt is committed at `context`.

## Historical commands and results

Environment: Bun `1.4.3`; official Pi `1.3.0`. Commands run from the dedicated `ticket/01-pi-effort-routing` worktree:

| Command                                                                                                                       | Result                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `codegraph init && codegraph status`                                                                                          | Initialized new worktree before structural exploration; initially zero source files                               |
| `bun install`                                                                                                                 | Installed pinned dev tooling/host declarations and wrote `bun.lock`                                               |
| `bun install --frozen-lockfile`                                                                                               | Passed; 121 installs / 122 packages checked, no dependency changes                                                |
| `bun run node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js --version`                                           | `1.3.0`                                                                                                           |
| `bun run typecheck`                                                                                                           | Passed (`tsc --noEmit`)                                                                                           |
| `bun test`                                                                                                                    | **60 pass, 0 fail, 151 assertions across 2 files**                                                                |
| `bun test tests/effort-policy.test.ts`                                                                                        | 20 independent policy examples; part of the full suite, not E2E                                                   |
| `bun run test:e2e`                                                                                                            | Actual CLI suite: 40 cases, local package installation and HTTP services; part of the full suite                  |
| `bunx --bun prettier@3.6.2 --write src tests package.json tsconfig.json README.md NOTICE.md docs/testing/ticket-01-matrix.md` | Formatted authored files                                                                                          |
| `git merge integration/jev-pilot-port`                                                                                        | Fast-forwarded checkpoint `6a03539aa02f34b98bc8c8e44e50768387b335c7`, preserving partial untracked implementation |

The initial red cases are preserved in the implementation session history: missing policy module, effort thresholds, missing extension, missing requested/effective state, missing approval context, parent cancellation at the wrong hook, and invalid configuration continuing generation. Each was followed by a focused green change. Pure-policy threshold cases form one table-driven policy slice; CLI cases exercise actual public behavior. The matrix existed before the first test file and was extended before new cases.

## Current tooling (operator-approved switch)

After the ownership fix was committed separately, the operator required **oxlint + oxfmt**, then approved replacing `tsc --noEmit` with **`bun check`**. Earlier Prettier/tsc commands above are historical evidence, not current project instructions. No Prettier dependency/config was present; no further Prettier runs were used after this decision.

- Installed via `bun add --dev oxlint oxfmt`: oxlint **1.89.0**, oxfmt **0.74.0**, lockfile updated. Read their current `--help`; scripts are `lint`, `fmt`, `fmt:check`. Lint uses `--deny-warnings`, without autofix or rule suppressions.
- Verified `bun check --help` and the [official Bun typechecking documentation](https://bun.com/docs/runtime/check). Bun **1.4.3+c6da4a4d3** is the tested minimum recorded in `engines.bun`; older versions are not claimed.
- Ran `bun check` and the existing `tsc --noEmit` once against the same project: both passed, no discrepancy. The permanent `typecheck` script is now `bun check`, not two duplicate gates.
- A temporary `/tmp/pi-jev-ticket01-check` project with no node_modules/typescript verified TS2322 exits **1**, `strict` from tsconfig is enforced, the excluded erroneous file is ignored, `--strictNullChecks false` overrides the config, and no JavaScript is emitted even with `noEmit:false` in the fixture config.
- Bun docs explicitly state the TypeScript package is unnecessary and library declarations are built in. Removed the direct `typescript` devDependency only after that evidence, then reran project checking successfully without `node_modules/typescript`.
- Current validation: `bun run lint`, `bun run fmt:check`, `bun run typecheck`, full `bun test`, and both parent-provided CLI repros. Formatting changes are isolated from logic fixes in the tooling commit.

## Fresh review corrections

The fresh review of `71b7862541450134d2ae92b566d6de9ff413b2db` correctly blocked two reproduced P1 regressions. The original 54 passing tests were insufficient: the shared fixture's explicit `--thinking medium` masked restoration, and the queue test used only one message.

Before writing regression tests, matrix rows were added for the accepted findings. On the original code, actual CLI regressions produced **3 fail / 0 pass**: fork-before restored high instead of medium, tree navigation ignored manual low, and batched lookup+continue dispatched `[high, high, high]` rather than `[high, high, low]`. The fixture now omits the explicit thinking override by default while retaining settings default medium. Additional ownership cases cover fork-at (user included but receipt not yet included), explicit CLI overrides on replacement, and an ineligible later user not claiming an excluded application's decision. All six new cases now pass.

Parent-provided repro scripts were rerun unchanged against the corrected source, using their existing fixture copy with no thinking override:

- `bun /tmp/pi-jev-ticket-01-review-71b7862/branch-repro-no-thinking.ts`: fork state, tree state and both next provider requests are **medium**. Captures: `worker-branch-before.json` (high failure) and `worker-branch-after.json` (medium success) in that directory.
- `bun /tmp/pi-jev-ticket-01-review-71b7862/queue-repro.ts`: efforts are **[high, high, low]**, three classifications, with separate low/.99 classified and reused receipts and distinct `ownerEntryId` values. Captures: `worker-queue-before.json` and `worker-queue-after.json`.

The correction changes only effort ownership at the existing Pi package seam. Policy/transport/payload behavior is unchanged, and the entire privacy, timeout, parent cancellation, fail-open and lifecycle suite is rerun. The earlier candidate is superseded; independent re-review remains required.

## Acceptance coverage

All **10 ticket-selected parent ACs** have executable evidence: AC-01, AC-03, AC-04, AC-06, AC-08, AC-10, AC-11, AC-12, AC-13, AC-26, plus the ticket's additional compatibility/attribution checklist requirement. See the [matrix](ticket-01-matrix.md) for exact test names and independent expected-value sources.

- Policy fixtures preserve upgrade/downgrade/high bars, missing confidence, close ties, very-hard mass, ceiling, short approvals/questions, CJK questions and strict risk boundary. Five additional CLI parity cases verify actual effort dispatch and captured upstream questions.
- Current CLI receipts verify the same physical provider/model, session-only thinking, xhigh→high visibility and unchanged default thinking. Historical high→off diagnostics are superseded by non-reasoning zero-call/no-write gating.
- Actual `read` execution followed by tool continuation verifies that tool arguments/results are absent from classifier payloads, and no new classification or mid-turn escalation occurs.
- Local delayed HTTP requests verify server-observed classifier disconnect at both the configured deadline and default 1,500 ms; parent abort produces **zero generation requests**. Parent abort during generation disconnects provider transport.
- Real RPC lifecycle exercises startup, reload, new session, resume, fork before the owning prompt, tree navigation before that prompt, compaction, provider retry, queued steering, and orderly shutdown with exit code zero.

## Limits and deliberate differences

- No hosted Jev call, paid model call, real credentials, remote publication or global settings changes were performed. HTTP fixtures validate the host path, not model quality or remote-service availability.
- This slice sends effort/risk questions only; combined skill/quality/design questions and all tier/worker features belong to later tickets. No automatic benchmark/profile selector is present.
- Pi clamping is authoritative; provider effort labels are not equivalent budgets. Global defaults are never persisted by the extension.
- State uses Pi session custom application/receipt/restore entries, not the later bounded decision ledger/report. Prompt text is not stored in extension state. These are append-only ownership metadata, not permission to rewrite Pi history or global settings.
- The CLI is the published stable JavaScript CLI executed under Bun in RPC mode. Interactive terminal rendering is not screenshot-tested; requested/effective state is verified through actual session entries and provider requests.
- Bun blocked dependency lifecycle scripts for `@google/genai` and `protobufjs`; they were not enabled. They are not needed by this fixture path, which passed without them. No package cache was modified.
- Fresh independent reviewer acceptance is still required; passing implementation tests is not a substitute for that review gate.
