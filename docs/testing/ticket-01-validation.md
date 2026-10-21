# Ticket 01 validation evidence

This is an effort-only package-boundary implementation. The approved single seam remains prompt/configuration → System One → actual Pi dispatch. No tracker/spec status is changed by this implementation.

## Compatibility and official contracts

Verified stable target: **official Pi 1.3.0**, published as `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai`. The npm `latest` metadata and [official v1.3.0 release](https://github.com/earendil-works/pi/releases/tag/v1.3.0) agree. The installed CLI prints `1.3.0`. The legacy `@mariozechner` namespace and Pi-Bolt are not the target.

Complete official documents read before implementation:

- [Extensions](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/extensions.md): lifecycle, cancellation, session-local controls and state ownership.
- [Packages](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/packages.md): manifest discovery, local installation and host peer dependencies (`*`, no bundled host copies).
- [Models](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/models.md), [Custom Providers](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/custom-provider.md) and [Virtual Models](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/virtual-models.md): supported thinking metadata, physical dispatch and fixture provider protocol.
- [RPC](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/rpc.md) and [RPC Commands](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/rpc-commands.md): prompt/abort/session commands and settled completion.

Exact released declarations checked: `ExtensionAPI`, `ExtensionContext`, `MessageStartEvent`, `SessionStartEvent`, `SessionShutdownEvent`, `ModelRegistry`, `ReadonlySessionManager`, `SessionProjection`, `SessionEntry`, and Pi's session-local `setThinkingLevel()` contract. TypeScript checks against the pinned published packages, not inferred Pi-Bolt types.

**Important host adaptation:** `before_agent_start` runs before Pi creates its agent abort signal. An initial real CLI cancellation test failed there: classifier work finished instead of aborting promptly. Classification now runs on the supported, awaited user `message_start` event. It has the active `ctx.signal`, covers queued steering messages, and completes before request preparation reads session thinking. No private API, monkey patch, virtual-model selection, or provider wrapper is required. State is committed at `context` after Pi persists the owning user message, so forks before that message do not inherit its decision.

## Commands and results

Environment: Bun `1.4.3`; official Pi `1.3.0`. Commands run from the dedicated `ticket/01-pi-effort-routing` worktree:

| Command                                                                                                                       | Result                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `codegraph init && codegraph status`                                                                                          | Initialized new worktree before structural exploration; initially zero source files                               |
| `bun install`                                                                                                                 | Installed pinned dev tooling/host declarations and wrote `bun.lock`                                               |
| `bun install --frozen-lockfile`                                                                                               | Passed; 121 installs / 122 packages checked, no dependency changes                                                |
| `bun run node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js --version`                                           | `1.3.0`                                                                                                           |
| `bun run typecheck`                                                                                                           | Passed (`tsc --noEmit`)                                                                                           |
| `bun test`                                                                                                                    | **54 pass, 0 fail, 131 assertions across 2 files**                                                                |
| `bun test tests/effort-policy.test.ts`                                                                                        | 20 independent policy examples; part of the full suite, not E2E                                                   |
| `bun run test:e2e`                                                                                                            | Actual CLI suite: 34 cases, local package installation and HTTP services; part of the full suite                  |
| `bunx --bun prettier@3.6.2 --write src tests package.json tsconfig.json README.md NOTICE.md docs/testing/ticket-01-matrix.md` | Formatted authored files                                                                                          |
| `git merge integration/jev-pilot-port`                                                                                        | Fast-forwarded checkpoint `6a03539aa02f34b98bc8c8e44e50768387b335c7`, preserving partial untracked implementation |

The initial red cases are preserved in the implementation session history: missing policy module, effort thresholds, missing extension, missing requested/effective state, missing approval context, parent cancellation at the wrong hook, and invalid configuration continuing generation. Each was followed by a focused green change. Pure-policy threshold cases form one table-driven policy slice; CLI cases exercise actual public behavior. The matrix existed before the first test file and was extended before new cases.

## Acceptance coverage

All **10 ticket-selected parent ACs** have executable evidence: AC-01, AC-03, AC-04, AC-06, AC-08, AC-10, AC-11, AC-12, AC-13, AC-26, plus the ticket's additional compatibility/attribution checklist requirement. See the [matrix](ticket-01-matrix.md) for exact test names and independent expected-value sources.

- Policy fixtures preserve upgrade/downgrade/high bars, missing confidence, close ties, very-hard mass, ceiling, short approvals/questions, CJK questions and strict risk boundary. Five additional CLI parity cases verify actual effort dispatch and captured upstream questions.
- CLI receipts verify the same physical provider/model, session-only thinking, xhigh→high and high→off visibility, and unchanged default thinking.
- Actual `read` execution followed by tool continuation verifies that tool arguments/results are absent from classifier payloads, and no new classification or mid-turn escalation occurs.
- Local delayed HTTP requests verify server-observed classifier disconnect at both the configured deadline and default 1,500 ms; parent abort produces **zero generation requests**. Parent abort during generation disconnects provider transport.
- Real RPC lifecycle exercises startup, reload, new session, resume, fork before the owning prompt, tree navigation before that prompt, compaction, provider retry, queued steering, and orderly shutdown with exit code zero.

## Limits and deliberate differences

- No hosted Jev call, paid model call, real credentials, remote publication or global settings changes were performed. HTTP fixtures validate the host path, not model quality or remote-service availability.
- This slice sends effort/risk questions only; combined skill/quality/design questions and all tier/worker features belong to later tickets. No automatic benchmark/profile selector is present.
- Pi clamping is authoritative; provider effort labels are not equivalent budgets. Global defaults are never persisted by the extension.
- State uses Pi session custom entries, not the later bounded decision ledger/report. Prompt text is not stored in extension state.
- The CLI is the published stable JavaScript CLI executed under Bun in RPC mode. Interactive terminal rendering is not screenshot-tested; requested/effective state is verified through actual session entries and provider requests.
- Bun blocked dependency lifecycle scripts for `@google/genai` and `protobufjs`; they were not enabled. They are not needed by this fixture path, which passed without them. No package cache was modified.
- Fresh independent reviewer acceptance is still required; passing implementation tests is not a substitute for that review gate.
