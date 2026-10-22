# Ticket 02 validation evidence

This candidate adds only configurable main-model tier routing and its shared tier/effort transport integration. It retains the accepted ticket 01 physical-effort implementation and version-tested input identity dependency. It does not implement later capability tickets or edit tracker/spec/status files.

## Baseline and compatibility

- Worktree: `pi-jev-pilot-ticket-02`, branch `ticket/02-main-tier-routing`; initial clean HEAD `a007ff0`, descendant of accepted ticket 01 merge `a2d7dfc`.
- `bun pm view @earendil-works/pi-coding-agent dist-tags --json` returned `latest: 1.4.0`; `bun pm view @earendil-works/pi-coding-agent@1.4.0 version --json` returned `1.4.0`.
- Existing exact dev dependency pins remain official `@earendil-works/pi-coding-agent` / `pi-ai` **1.4.0**. No cache patches, host prototype or Pi-Bolt dependency.
- Read installed official `docs/virtual-models.md`, public `ExtensionVirtualModel`, `ModelRouteRequest`/`ModelRoute` and registry types. Native state and request reasons own routing lifecycle.
- Read-only upstream checkout verified at `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`. Questions and pure tier confidence/risk rules are adapted from `hooks/model-router.policy.ts`; existing effort policy remains shared, not duplicated. Balanced default follows approved host adaptation and upstream `balancedModel=sonnet` evidence, not the official router example's different business policy.

## AC evidence

All ticket criteria have automated package-boundary evidence; the [matrix](ticket-02-matrix.md) was created before test code and updated before additional approved edge cases.

| Criterion | Evidence                                                                                                                                           | Result |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC-02     | MAIN-02a–d, exact duplicate identities, selected virtual versus assistant physical receipts, unchanged isolated settings                           | PASS   |
| AC-03     | 11 TIER-03 independent literal fixtures, six MAIN-03 actual dispatch threshold/risk cases, all existing effort fixtures                            | PASS   |
| AC-05     | MAIN-05a–f: combined call, tier-only, non-reasoning applicability, current selected thinking, disabled effort                                      | PASS   |
| AC-06     | MAIN-06: requested xhigh, effective high native state and physical request; selected router remains separate                                       | PASS   |
| AC-07     | MAIN-07a–c: actual read tool continuation, provider automatic retry (three deterministic 503s), continuation versus approval                       | PASS   |
| AC-13     | MAIN-13a–j: qualified/unknown/virtual/auth errors, balanced default, retained valid current, malformed responses, vanished/manual previous targets | PASS   |
| AC-26     | MAIN-26a–o: reload/resume, fork/tree, compaction, new session, cancellation, deadline, queued steering/tool boundaries                             | PASS   |

The full suite passed **142 tests / 394 assertions** across five test files. New coverage comprises **51 actual installed CLI tests** and **11 pure tier-policy fixtures**; all 80 previously accepted tests remain passing. No test in the main-routing file mocks extension internals. Each fixture installs this local package with the real official Pi CLI into an isolated temporary agent directory, then drives RPC against deterministic local classifier and physical HTTP model endpoints. Distinct providers are `fixture-fast/lookup`, `fixture/fixture-model`, `fixture-deep/judgment`. Persisted assistant responses assert actual physical provider/model/thinking, not just selected model or unit return values.

## Red → green checkpoints

- `bun test tests/tier-policy.test.ts`: RED missing production tier module, then GREEN 11 literal policy cases.
- `bun test tests/main-routing.test.ts`: RED actual CLI startup `jev/auto` not found, then GREEN explicit virtual routing and one combined decision.
- MAIN-26e originally expected generation after manual change; actual CLI proved native virtual request cancellation. Supervisor approved zero-generation/zero-state expectation before GREEN; the next prompt verifies continued operation.
- MAIN-05d/e/f: RED stale `state.effective` resurrected old effort; GREEN fresh `request.thinkingLevel` input, approved before test changes.
- MAIN-26h: RED steering batch lookup→continue reused an older deep decision; GREEN request-local trailing batch anchor, without a second classifier path or hook identity queue.
- MAIN-13g: RED old Jev state shadowed latest manually selected physical response; GREEN native latest-successful baseline priority.
- MAIN-13h: RED native Pi omitted `previous` when the successful identity vanished; GREEN public transcript validation. No private host helper imports or package changes.
- Remaining cases were added as successive narrow boundary checks after each slice, not claimed as separate failing implementation bugs.

## Exact verification commands

```bash
bun install --frozen-lockfile
bun pm view @earendil-works/pi-coding-agent dist-tags --json
bun pm view @earendil-works/pi-coding-agent@1.4.0 version --json
codegraph init
codegraph status
bun test tests/tier-policy.test.ts
bun test tests/main-routing.test.ts
bun run fmt
bun run lint
bun run fmt:check
bun check
bun test tests
bun run test:e2e
git diff --check
git merge integration/jev-pilot-port
```

`oxlint --deny-warnings`, `oxfmt --check`, and Bun's checker pass. Oxfmt reports that no config exists and uses its defaults; no warnings/rules are suppressed. The full suite includes actual CLI execution; pure fixtures are never called E2E. Latest integration is merged into the candidate branch only, never the reverse.

## Limits and retained risks

- No paid APIs, credentials, global user configuration, remotes or publishing. These tests prove official local host/transport behavior, not hosted Jev availability, classifier quality or every provider's thinking conversion.
- Wildcard public peer versions are not universal compatibility evidence; only official 1.4.0 was tested. Ticket 01's arbitrary user metadata serialization remains its accepted **version-tested**, not documented, dependency.
- Native virtual state may exist before a failed/aborted physical request, by Pi's documented contract. Actual cancellation during classification creates no new state; same-work retry retains its applied physical pair.
- A native batched user request gets one decision, not one classifier call per queued message. Only the last non-continuation anchor and bounded context are sent; this does not promise processing every batch member as a separate task.
- This candidate still requires independent reviewer acceptance and parent/merger integration gates. No implementation tracker completion is implied.
