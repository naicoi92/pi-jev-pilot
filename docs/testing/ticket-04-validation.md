# Ticket 04 validation evidence

This slice implements strategy/quality request advice and repeated-work observation only. No worker adapter, dispatch, crew, design pack, ledger, pet, external-review engine, instruction enforcement or mid-turn effort escalation is added.

## Baseline and authority

- Dedicated worktree `pi-jev-pilot-ticket-04`, branch `ticket/04-strategy-quality-guidance`, initially clean at exact integration baseline `b333697a91765efc965341dcd76c82080cc6d32a`. Final integration sync returned `Already up to date` against that same tip. No tracker/spec/status edits.
- CodeGraph initialized and verified before structural exploration. Read-only upstream HEAD verified as Jev Pilot 0.12.1 commit `5d27135b34edf81b40c0bf1df01ae401f6b72ea7`.
- Official published Pi/AI exact development pins remain **1.4.0**; registry `latest` recheck returned **1.4.0**. Bun **1.4.3**. Public extension lifecycle, context projection, tool-result transformation, virtual routing and exported tool-result types were consulted; no host/cache patches or private imports.
- The [AC matrix](ticket-04-matrix.md) preceded tests; later source-derived cases were appended before their tests. Each new test has exactly one G09/G15/G16/G27 criterion prefix.

### Raw-tier source trace

Pinned `hooks/model-router.policy.ts:441–497` reads the classifier tier directly (`tier` at 481). `hooks/jev-model-router.ts:482–500` passes that same decision to `adviseStrategy` before route policy. `adviseStrategy:897–927` suppresses direct; requires .6 confidence, .8 for graph; rejects parallel/fast and graph/non-deep. Thus strategy-only asks **tier+strategy**, without unused effort/risky or physical tier mappings/authentication. The answer does not enable main routing. Actual virtual risky=1 fixtures force deep dispatch while raw balanced/fast still suppress graph/parallel advice. This applicability adaptation was supervisor-approved before implementation.

Pinned `QUALITY_QUESTIONS:114–146`, `QUALITY_BARS:149` and `qualityAdvice:156–174` preserve ambiguity .85, bugfix .8, sensitivity .8 and correction .7. Correction has no fourth advice line or ledger effect. Strategy confidence follows pinned `confidenceOf:515–519`: explicit confidence first, otherwise maximum supplied probability, including partial distributions; invalid individual values cannot fabricate advice.

## Final acceptance results

| Criterion | Evidence                                                                                                                                                                                                                                                                                                                                                                    | Result |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC-09     | Physical/virtual combined router+skill+guidance requests; quality-only four nouls; strategy-only tier+strategy; true production defaults; disabled/continuation zero HTTP with invalid backend; first skill batch only; captured original rubrics                                                                                                                           | PASS   |
| AC-15     | Actual provider-visible blocks; strategy and quality boundary literals; raw-tier versus risk-forced route; no physical routing from advice-tier; retry/continue/queue/fork/tree/reload/resume/compaction; cancellation/manual selection/timeout; stripped identity fail-closed; persisted user content unchanged; restrictions/workflow disclaimer and no dispatch receipts | PASS   |
| AC-16     | Real built-in write/edit results at fourth same-file modification; real failed bash command at third normalized failure, success reset, negative/different-command cases, disabled/aborted/branched work; once-per-work note; unchanged provider effort/model and classifier count                                                                                          | PASS   |
| AC-27     | Scope assertions and source review: no pet, external-review requirement, escalation, design/crew/ledger machinery or transparent workflow interception                                                                                                                                                                                                                      | PASS   |

**Final full suite: 282 pass, 0 fail, 855 assertions across seven files.** This preserves all **218 accepted tests / 641 assertions** and adds **64 installed CLI tests / 214 assertions**. **Final explicit installed E2E: 248 pass, 0 fail, 808 assertions across four files.** Pure policy/fixture tests are not called E2E.

Each CLI fixture actually installs this local package with official `pi install`, then runs its RPC CLI against local System One and physical provider HTTP fixtures. New tool sequences execute actual built-in edit/write/bash tools; no tool result is fabricated to claim E2E. Existing slice fixtures explicitly disable the two newly introduced advice consumers so their original independent question expectations remain intact; production defaults remain upstream true.

## Chronological RED → GREEN

Logs are retained under `/tmp/pi-jev-ticket04-logs/` for this local run.

1. `01-red.log`: quality-only installed prompt made zero classifier calls; `02-green.log`: one request, exactly four quality nouls and visible advice, unchanged medium effort.
2. `03-strategy-red.log`: strategy-only had no classifier request; `04-strategy-green.log`: raw tier+strategy produced eligible graph advice without changing physical model/effort.
3. `05-loop-red.log`: fourth real write lacked step-back note; `06-loop-green.log`: note appeared on fourth outcome, once, no new classifier call or effort change.
4. Boundary/lifecycle additions exposed test-side provider-content shape assumptions (string versus text parts); assertions were corrected to decode both, then focused ownership tests passed. The failed-command test initially used an eight-word prompt, whose accepted upstream follow-up rule correctly prevented a low downgrade; a substantive task prompt corrected the fixture, not production policy.
5. `16-partial-red.log`: complete-sum validation incorrectly rejected upstream partial strategy distribution `{delegate:.6}`; `17-partial-green.log`: removing only that extra sum requirement restored pinned confidence semantics. Individual probability/name validation remains.
6. `18-loop-branch.log`: source-derived branch observation test passed. Loop reset already existed for user/session/branch boundaries; this case did not require a separate production reset fix.
7. Earlier `14-full-suite.log` (280/852) and `15-installed-e2e.log` (246/805) predate the partial-distribution change and final branch test. They are historical, **not final candidate evidence**.
8. An orchestration lifetime timeout interrupted the writer after focused work, not a test failure. The same retained writer resumed without reset/replacement; final exact source tree was rerun: `19-final-full-suite.log` **282/855** and `20-final-installed-e2e.log` **248/808**.

## Verification commands

```bash
codegraph init
codegraph status
bun install --frozen-lockfile
bun pm view @earendil-works/pi-coding-agent dist-tags --json
bun test tests/guidance.test.ts
bun test tests/guidance.test.ts -t partial-distribution
bun test tests/guidance.test.ts -t G16-branch
git merge integration/jev-pilot-port
bun run fmt
bun run lint
bun run fmt:check
bun check
bun test tests
bun run test:e2e
git diff --check
```

Oxc lint/format and Bun check pass, without suppressed rules, unsafe autofix or Prettier. Frozen installation did not change the lockfile. Integration sync affects only this candidate, never the integration checkout.

## Approved adaptations and limits

- Advice shares the existing UUID seam only where ownership is needed. Official Pi **1.4.0** preserves that property in tested message replacement, persistence/fork and provider conversion; arbitrary metadata is **not a documented guarantee**. Missing/stripped metadata fails closed without stale-advice fallback. Revalidate on host/provider upgrades and extension composition changes. Context projection never changes persisted user content/role/timestamp; local custom advice entries contain generated guidance, not a captured prompt.
- Public `tool_result` observes top-level built-in edit/write paths and failed bash commands; nested tools/custom wrappers are not universally monitored. Annotation preserves the outcome and structured content and persists with that tool result. This is observation and advice, not parsing/enforcing every user/project restriction.
- The common upstream step-back note is retained. Supervisor approved dropping only the Claude-specific high-effort/Fable tail; no replacement model, extra classifier call or escalation is invented.
- Graph's upstream read-only check remains conditional advice, not an independently enforced mandatory/external review. User/project restrictions retain authority. Workflow inner agents receive honest model-selection guidance only; ordinary worker routing is not implemented here.
- Local fixtures prove host behavior, payloads and deterministic gates, not hosted Jev availability, advice quality/improvement, every provider or interactive visual rendering. No paid API, real credential, remote operation, publish or subdelegation occurred.
- Independent reviewer acceptance, parent rerun and merger remain required. No tracker completion or integration acceptance is implied by this candidate.

## Independent review P1 correction: partial raw-tier advice

Independent review blocked candidate `3d0dc63ca7e0c11e947b4fedd104222e2e53217a`: its strategy path reused routing's complete-distribution requirement. Pinned `readDecision:454–483` accepts a known raw tier and `confidenceOf:515–519` takes maximum supplied probabilities without a sum requirement; `adviseStrategy` has no tier-confidence gate. No approved adaptation justified rejecting partial raw-tier advice.

The matrix was extended before six new actual CLI tests. `21-p1-red.log` reproduces missing delegate advice in both physical strategy-only and combined virtual paths. The minimal correction retains valid known choices/individual probabilities, but applies the complete-sum gate only to routing. One internal optional `adviceDecision` reads the same parsed response independently; `finish` uses it for advice, never for model/effort selection or routing status. Transport/timeout/cancel/invalid JSON cannot create it. Combined rejected routing remains `schema-error` and returns its existing fallback physical model/thinking; independently valid advice does not convert rejection into a routing success. This consumer separation was approved by the supervisor before implementation.

`23-p1-green.log`: six tests pass / 20 assertions, covering physical partial raw tier, virtual partial deep tier with rejected high-effort selection retaining balanced/medium, unknown tiers and invalid individual values in both paths. Existing complete-response, cancellation and timeout tests remain unchanged. The parent's `/tmp/pi-jev-ticket-04-review-3d0dc63/partial-tier-repro.ts` was run **unchanged** before/after; captures `22-parent-before.json` / `24-parent-after.json`. Independent literal assertions on the latter confirm exactly one classifier request, delegate advice, `fixture-model` and medium effort.

**Superseding final evidence after P1:** full suite **288 pass / 0 fail / 875 assertions**, preserving all prior **282 tests / 855 assertions**; explicit installed E2E **254 pass / 0 fail / 828 assertions**. Logs: `/tmp/pi-jev-ticket04-logs/25-p1-final-full.log` and `26-p1-final-e2e.log`. Oxc lint/format, Bun check and diff whitespace pass. Integration sync remains `Already up to date` at `b333697a91765efc965341dcd76c82080cc6d32a`. Earlier final counts above apply only to the pre-review candidate. No other feature or tracker change is included; targeted independent review remains required.
