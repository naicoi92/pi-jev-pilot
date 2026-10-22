# Ticket 03 validation evidence

This slice implements main-session skill discovery, selection and content projection only. Existing effort and optional virtual main routing remain the dispatch authority. No tracker/spec/status, quality/design, worker, crew, ledger or tuning implementation is included.

## Baseline and supported host

- Dedicated branch `ticket/03-skill-matching`, initially clean at `762d8d643fe0f0e2f681cf26a0b2bbb9ea775c68`, also the accepted `integration/jev-pilot-port` tip. The baseline is an ancestor of this candidate.
- `bun pm view @earendil-works/pi-coding-agent dist-tags --json` returned `latest: 1.4.0`. Exact official host/AI development pins remain **1.4.0**; Bun is **1.4.3**. No host/cache edits or replacement provider engine.
- Read the published official skills, packages, extensions and virtual-model documentation and exported declarations: `ExtensionAPI.getCommands`, `SlashCommandInfo.sourceInfo`, `parseFrontmatter`, `ContextEvent`, `ModelRouteRequest`, `ReadonlySessionManager` and session projection.
- Behavioral authority is read-only Jev Pilot `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`: skill policy/questions, prompt-submit orchestration and independent upstream tests. Original source defaults are preserved: skills enabled, rerank disabled, 300-character excerpts, shortlist 3 per batch, fits/gate .3, sure-pick .5, choice limit 255 and batch capacity 254.

## Acceptance results

The [matrix](ticket-03-matrix.md) was written before test code and expanded before additional source-backed cases. Every new test maps to exactly one AC by its SK09/SK10/SK14 prefix.

| Criterion | Actual installed CLI evidence                                                                                                                                                                                                                                                                                                              | Result |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC-09     | Physical/virtual ordinary combined questions; skill-only with disabled/inapplicable effort; disabled/no-eligible zero-question paths; 255 disposable resources in 128/127 batches; optional six-candidate rerank                                                                                                                           | PASS   |
| AC-10     | First-pass metadata/excerpt capture; rerank metadata-only then 300-character shortlist excerpts; bounded four-message/2,000-character history; actual tool input/result exclusion; explicit native skill expansion excluded from subsequent history; UUID/key absent from classifier payload                                               | PASS   |
| AC-14     | Real effective Pi resource catalog and selected full body visible to provider; none/confidence/gate/distribution rules; eligibility; rerank rejection/failure; resource bytes unchanged/catalog retained; branch/tree/fork/reload/resume/compaction; queued anchors; retries/continuations; cancellation and stripped identity fail-closed | PASS   |

AC-09's future quality/design consumers and AC-10's worker half are outside this ticket. Existing routing tests remain the acceptance dependency rather than a claim that those future capabilities exist.

**Full suite: 210 pass, 0 fail, 619 assertions across six files.** This preserves all **142 accepted tests / 394 assertions** and adds **68 real installed CLI tests / 225 assertions**. Explicit E2E command: **176 pass, 0 fail, 572 assertions across three CLI test files**. The remaining policy/fixture tests are not called E2E.

The fixture actually runs `pi install` against this checkout in an isolated agent directory and starts the published official CLI in RPC mode. Real skill files are discovered by Pi, not mocked internal catalog objects. Local System One and physical-provider HTTP endpoints capture requests. No paid API, real credential, global settings change or remote operation is used.

## Red → green evidence

- Initial SK14-content: RED because actual provider payload lacked the selected resource body; GREEN with supported `context` projection keyed to the originating user.
- SK14-eligibility explicit `/skill:slides`: RED one classifier call after native skill expansion; GREEN with version-tested native expansion recognition before classification. The raw body is not sent as the classifier prompt.
- SK10-explicit-history: RED because later bounded history retained native expansion paths/body; GREEN with command-name/arguments-only history representation. Permitted independent skill excerpts remain in question criteria.
- SK14-repeated-content physical and virtual: RED two identical full bodies; GREEN reference-only blocks when the identical resource body is already visible. Compaction tests verify a fresh selection reloads a body removed from context.
- Early full regression run exposed four accepted invalid-System-One-config cases continuing generation after validation moved into shared orchestration; the physical configuration-error path was restored and all 57 existing physical CLI cases passed before continuing.
- Other source-backed cases were added as narrow boundary checks after each slice; they are not represented as independent reproduced implementation defects. Test-only corrections included decoding provider text rather than searching JSON-escaped newlines, null assistant tool-call content, and using a named resource instead of assuming native filesystem discovery order.

## Exact verification commands

```bash
codegraph init
codegraph status
bun install --frozen-lockfile
bun pm view @earendil-works/pi-coding-agent dist-tags --json
bun test tests/skill-matching.test.ts
bun test tests/pi-cli.test.ts
bun run fmt
bun run lint
bun run fmt:check
bun check
bun test tests
bun run test:e2e
git diff --check
git merge integration/jev-pilot-port
```

Oxc lint/format and Bun check pass without disabled rules or unsafe autofix. No Prettier was run. Frozen installation does not change the lockfile. Latest integration is merged into the candidate branch only, never the reverse.

An earlier `test:e2e` command was interrupted by the orchestration run's 1,800,000 ms lifetime limit, not a test failure. On resume, process inspection found no surviving test/Pi child; the same writer preserved all edits and reran the full E2E command successfully (93.79 seconds). The interrupted partial log is not used as passing evidence.

## Reviewer P2 correction: native explicit load before automatic selection

The accepted review of candidate `4007a9e7818c11d5806ba7a2e748ba0dde7ca6b7` found that native `/skill:debugging` followed by automatic selection inserted the same full body twice. This is duplicate context, not a classifier privacy failure or an exclusive-catalog requirement.

Before changing production code, the matrix recorded SK14-native-auto/changed/other/compacted. Parent repro `/tmp/pi-jev-ticket-03-review-4007a9e/explicit-auto-repro.ts` was run unchanged: request2 had two full bodies/two sentinels, with one classifier call. Two new actual installed CLI regressions (physical/virtual) were RED with duplicate full bodies, then GREEN after the context traversal recognized Pi 1.4.0's complete native expansion before skipping users without UUID. Matching requires exact resource name, file path, reference directory and full body with the native wrapper boundary; it is not a prompt hash, name-only or body-substring heuristic. Loaded state is rebuilt chronologically from the current visible context only. No ownership or persisted content change was made.

Eight added AC-14 CLI cases cover native→auto physical/virtual, changed resource body, identical body at another resource, and native body removed by real public compaction. Changed/different/compacted cases still inject full content. Existing auto→auto cases remain passing. The unchanged parent repro now yields request1/request2 full-body counts **1/1**, sentinel counts **1/1**, request2 relevance **1**, classifier count **1**; separate assertions verify those exact values. Captures are `explicit-auto-before-fix.json` and `explicit-auto-after-fix.json` beside the repro.

Final full suite after this correction: **218 pass, 0 fail, 641 assertions** (original 210 plus eight new CLI tests). Focused native/repeated-content suite: **10 pass, 28 assertions**. `bun run lint`, `bun run fmt:check`, `bun check`, and integration sync (`Already up to date`, tip `762d8d6`) pass. The native wrapper remains a version-tested official Pi 1.4.0 representation and must be revalidated on upgrade.

## Approved ownership adaptation and residual limits

Public route results cannot return context; `context` receives cloned messages without entry IDs. The supervisor approved expanding the existing ticket 01 **version-tested UUID seam** for skill ownership within official Pi **1.4.0**. Effort and skills share one originating identity, allocated only for an applicable consumer. Context injection does not mutate persisted user content/role/timestamp, fabricate user messages, or send UUID metadata to the provider. A branch-owned custom entry stores the selected resource snapshot and UUID. Active signal, selection revision, session and branch leaf guard asynchronous commits.

Missing/stripped identity fails closed. Actual CLI cases first establish a valid skill, then install a second-extension replacement that strips a newer user's metadata; no new-user injection or older-skill resurrection occurs. Tree prefixes excluding the owner cannot inject its orphan entry. Earlier owned content remains historical context; none/rejected selections attach nothing to the new user. This is not a documented arbitrary metadata guarantee or universal extension/provider compatibility claim. Independent review must inspect the expanded ownership blast radius, and upgrades must revalidate hook identity, metadata persistence/serialization, provider conversion and native expansion shape.

Pi's catalog is intentionally **not suppressed**. No file hiding/renaming/mutation or resource-settings rewrite is claimed. Provider-visible selected content is guidance, not exclusive skill enforcement. Pi resource-directory references replace Claude-specific path substitutions. Selected skill snapshots persist in local session custom entries; they are not a bounded ledger and do contain the selected skill body. Classifier excerpts and user/assistant text may contain secrets; no redaction guarantee is made.

Local fixtures prove host behavior, payloads and deterministic policy, not hosted Jev availability, classifier quality, every provider's context conversion or interactive visual rendering. Public wildcard peers do not broaden the tested host envelope. Independent reviewer, parent rerun and merger gates remain required.
