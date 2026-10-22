# Ticket 03 acceptance matrix

Authority: ticket 03, parent spec AC-09/10/14, `PORT-SCOPE.md`, approved decision gating, pinned Jev Pilot `5d27135b34edf81b40c0bf1df01ae401f6b72ea7` (`hooks/skill-suggestion.policy.ts`, `hooks/jev-skill-suggestion.ts`, `tests/skill-suggestion.spec.ts`). No quality/design/worker capability is implemented by this slice.

## Reviewer P2 regression (recorded before test code)

AC-14: SK14-native-auto physical/virtual loads `/skill:debugging` through official CLI, then auto-selects the same resource. Exact visible native resource path + name + directory + body must yield one full body and a reference-only block, with one classifier call. Source: accepted reviewer P2 and parent `explicit-auto-repro.ts` capture at candidate4007a9e. SK14-native-changed requires full injection after resource body changes; SK14-native-other requires full injection for a different resource even with identical body; SK14-native-compacted requires full injection if public compaction removed the native body. Existing auto→auto coverage remains mandatory. No ownership, persisted content or catalog change.

## Approved seams

The existing installed Pi package boundary is authoritative: official Pi 1.4.0 RPC CLI, disposable real skill resources, captured local System One and provider HTTP. No extension-internal mocks. Public `getCommands()` supplies the effective resource catalog and `sourceInfo.path`; exported `parseFrontmatter` supplies eligibility. Supported `context` projects selected content into the provider transcript without mutating resources or suppressing Pi's system catalog. Branch-owned custom entries and the existing version-tested user input identity seam associate physical selections with their originating user. Virtual routing associates selections with persisted native user entries. Shared decision orchestration owns batching/transport/policy in both paths.

## Matrix (before test code)

Every new test has exactly one AC prefix. Expected values are independent source literals, not computed using production helpers.

| Criterion | Test IDs                          | Observable behavior / expected-value source                                                                                                                                                                                                                 |
| --------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-09     | SK09-physical, SK09-virtual       | One ordinary request contains `which`, three `gate::` nouls, applicable effort/risky and virtual tier. Upstream wideQuestions + shared first-batch ask.                                                                                                     |
| AC-09     | SK09-gating                       | Effort disabled or non-reasoning leaves skill-only questions; skill disabled leaves routing only; neither applicable makes zero HTTP even with invalid classifier settings. Approved gating.                                                                |
| AC-09     | SK09-batches, SK09-rerank-batches | 255 skills split into 128/127 (254 capacity with none reserve), each candidate exactly once, gate/router only in first batch; rerank off = two calls; on = three and shortlist grows to six. Upstream batchesOf(MAX_CHOICES-1), picked.shortlist=3*batches. |
| AC-10     | SK10-excerpts                     | Ordinary criteria contain description + first 300 body characters, not remainder/frontmatter/path or unrelated files. Rerank first pass metadata only; shortlisted second pass 300-character excerpt. Upstream detailOf/excerptChars=300.                   |
| AC-10     | SK10-context                      | Four recent text messages / 2,000 chars remain bounded; tool body/results, non-selected resource tails and local API key excluded. Existing context policy and spec AC-10. Worker half not applicable to this main-only slice.                              |
| AC-14     | SK14-content                      | Exact selected real body reaches provider once with resource directory for relative references; other bodies absent; resource bytes/path unchanged and Pi catalog retained. Upstream injectionBlock + approved host adaptation.                             |
| AC-14     | SK14-policy table                 | None leader => no injection; .5 sure-pick bypasses low gate; .49 with gate .29 rejects; .3 with gate .3 selects; below .3 rejects; no confidence rejects. Upstream pickSkill SURE_PICK=.5, fitsThreshold=.3, gateThreshold=.3, inverted prose_suffices.     |
| AC-14     | SK14-eligibility                  | Frontmatter `disable-model-invocation: true`, explicit slash invocation, blank/continuation not offered; duplicates follow native discovery; no eligible catalog still routes standalone. Upstream modelInvocable, prompt gates and native catalog.         |
| AC-14     | SK14-rerank                       | Optional rerank off default; on rechecks top three, all fits <.3 rejects; named winner must itself fit >=.3 and belong to shortlist; failed rerank rejects. Upstream decide/readRerank/shortlistOf.                                                         |
| AC-14     | SK14-lifecycle                    | Tool continuation/retry/continue do not reclassify or duplicate injection; queued user selections stay owned; branch/fork/reload/new session do not leak selections. Upstream main scope and approved branch/queue contract.                                |
| AC-14     | SK14-cancel                       | Parent cancellation/manual selection invalidates in-flight matching, no late injection; timeout aborts and fails open, no fallback classification. Approved cancellation distinction.                                                                       |

### Additional source-derived cases (before their tests)

- SK14-rerank-gate: a first gate below .3 does not attempt rerank even with a high first choice; pinned passesGate.
- SK14-batch-failure: one failed/malformed batch rejects the entire skill pick, while valid first-batch routing can still act; pinned pickSkill/mergeWide.

### Approved ownership expansion

The supervisor approved reusing ticket 01's UUID seam for skills within tested official Pi 1.4.0 only. This is not a documented arbitrary metadata guarantee. One identity is shared by effort/skills, allocated only for an applicable consumer, never a second identity per capability. Context-only injection preserves persisted user content/role/timestamp. Missing/stripped identity fails closed; no old selection is attached to a new user. Independent review must inspect the expanded ownership dependency.

- SK14-stripped-identity: a second extension strips a newer user's identity after a prior valid skill. The new selection is not injected and no old selection is resurrected on that user; none/rejected boundaries remain empty. Supervisor-approved ownership contract.
- SK14-no-ownership: no eligible skill/disabled matching on the virtual path adds no UUID for the skill consumer; physical both-disabled adds no UUID/custom entries. Approved no-question/no-write gating.
- SK14-owned-user: actual queued native user anchors, not a guessed next user, receive the selected content; persisted raw user content remains unchanged and provider payload omits the UUID value. Approved ownership contract.
- SK14-distribution: a supplied probability ranking, not the choice/confidence label, determines selection; a `(none)` distribution leader rejects. Pinned readWide ranking precedence.
- SK14-batch-none: a batch led by none contributes no candidate but another batch's qualifying leader can win. Pinned pickSkill.
- SK14-rerank-cancel: parent abort in the second request stops generation and leaves no selected entry. Approved cancellation applies to all nested calls.
- SK14-malformed: unknown choices and non-finite/out-of-range confidence/gates are fail-open, never inject a fabricated resource; parent spec malformed-answer contract.
- SK10-explicit-history: Pi expands explicit `/skill:name` before message_start. The matching gate recognizes that native expansion and subsequent classifier history must not forward its unbounded body. Parent spec AC-10 minimized applicable skill text; native expansion shape is version-tested on 1.4.0.
- SK14-repeated-content: repeated selection of an unchanged skill references its already-visible body once, but injects the body again if compaction removed the owning user. Pinned injectionBlock(alreadyLoaded) adapted to visible branch context, not a global session set.
- SK14-compaction: removed skill bodies are not spuriously restored on continuation; a fresh selected request loads full content. Approved context/branch ownership, pinned loaded-skill reference semantics.
- SK14-branch-prefix: physical skill entries preceding the owning user must not inject when tree/fork excludes that user; virtual entries after a user must not leak to earlier forks. Approved branch ownership.
- SK14-no-questions-continuation: continuation skips matching even when no saved effort exists; zero remaining questions means zero HTTP. Upstream prompt-submit gate plus decision gating.

Existing ticket 01/02 tests remain unchanged acceptance dependencies (142 tests / 394 assertions baseline). Later edge cases must be recorded here before test code.
