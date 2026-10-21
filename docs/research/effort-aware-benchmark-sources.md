# Effort-aware benchmark data sources — research result

Research date: 2026-10-21. Read-only investigation. No paid model calls, credentials, installs, setting changes, code edits, or delegation. Existing `docs/research/model-score-cost-sources.md` and `docs/research/data/openrouter-three-models.json` were treated as context, not sufficient evidence: model catalog scores plus supported effort values do not meet the requested granularity.

## Executive finding

**Updated after parent extraction:** AA model-level public records expose six GPT-6 Luna reasoning variants plus GLM-5.3-Flash max with Intelligence Index v4.3.2 and weighted cost/task. This is the closest verified source for the requested model-effort quality/cost comparison. Coverage is still incomplete: GLM other efforts and exact DeepSeek 0423 mapping are not established. See extracted records below. The following earlier coding-agent findings concern a separate AA product, not model-level coverage.

**No single public source located currently establishes a full effort-aware matrix for all three exact requested models across the same coding task distribution.** Among coding-agent sources, Artificial Analysis (AA) Coding Agent Index (v1.5) is strongest: its live page exposes actual separate agent-variant rows, per-benchmark scores, provider identity, behavioral reasoning config in row labels, pooled token telemetry, per-task cost/time, task counts, and component benchmark versions. But the active snapshot does not cover GLM-5.3-Flash in the index; it shows DeepSeek V4 Flash **0731**, explicitly not the requested April 23 version; GPT-6 Luna does have a max-effort Codex row but is one harness/agent variant, not a Pi-harness sweep. Its public API/data access also does not clearly expose this agent index: the documented API is model-level, full evaluation endpoints need Pro, and API free tier is internal-use-only/no redistribution.

**Recommendation:** Use AA Coding Agent Index as a high-quality, independent (not vendor model-creator) external prior/shortlist where the exact model + agent variant + benchmark suite match. Do not treat it as exhaustive effort sweep or merge its scores with SWE-bench/Terminal-Bench/other harnesses. To meet the full requirement, run local per-effort sweeps in the same Pi harness, with exact pinned model/provider endpoint, same task set, same system/tool configuration, captured request/response token telemetry and actual billed provider cost (or reproducible route-specific price calculation). Terminal-Bench Harbor result archives are an excellent reproducibility/telemetry source, but current examples do not cover the target versions and cost is often null. SWE-bench validates task correctness but its official evaluation output does not capture effort/provider/cost; it must be combined with a prediction-run manifest and inference telemetry.

Never infer quality transfer from supported effort labels, and do not pool scores across benchmark harnesses.

## Additional parent verification: model-level reasoning variants

AA also provides a distinct model-level product: [GPT-6 Luna max](https://artificialanalysis.ai/models/gpt-6-luna), [GPT-6 Luna medium](https://artificialanalysis.ai/models/gpt-6-luna-medium), and the [release comparison](https://artificialanalysis.ai/models/releases/gpt-6-luna). Parent fetched these official pages. They expose Intelligence Index v4.3.2 and a quality-versus-cost-per-task comparison. Cost is computed from actual evaluation token usage and input/cache-write/cache-hit/reasoning/answer rates, weighted across evaluations. This is closer to model/effort quality-cost comparison than a catalog's per-token price. Separate medium/max pages establish variant-specific reporting, but exact numeric scores, run request configurations, API export coverage and all three target-model effort sweeps were not independently extracted in this parent check. Page titles alone must not be promoted into complete request-configuration evidence. This model-level product is distinct from Coding Agent Index v1.5; do not merge their metrics or imply only coding-agent variants exist.

Parent also verified the embedded Codex/GPT-6 Luna max row with explicit reasoning_effort label, provider, benchmark revisions and per-evaluation rewards; AA API terms and the Harbor job config with explicit high effort were checked directly. Public HTML is not a guaranteed stable API/export or redistribution license.

## Extracted model-level variant records (parent follow-up)

Live public HTML records were decoded and exact variant objects inspected. Selected local research excerpts: `data/aa-effort-variants-selected.json` (not approved for redistribution). Intelligence Index v4.3.2, USD per weighted index task, from the same model-level reporting product:

| Variant | Index | Cost/task USD |
|---|---:|---:|
| GPT-6 Luna non-reasoning | 18.46785 | 0.01134506 |
| GPT-6 Luna low | 21.52620 | 0.00451661 |
| GPT-6 Luna medium | 29.92518 | 0.01747691 |
| GPT-6 Luna high | 32.92821 | 0.02903158 |
| GPT-6 Luna xhigh | 34.55873 | 0.04218355 |
| GPT-6 Luna max | 38.12452 | 0.06782296 |
| GLM-5.3-Flash, explicit effort max in currentModel record | 41.80747 | 0.28359482 |
| DeepSeek V4 Flash **0420**, high — NOT mapped to requested 0423 | 24.38396 | 0.10256688 |
| DeepSeek V4 Flash **0420**, max — NOT mapped to requested 0423 | 24.16731 | 0.08953613 |

These are evaluation token usage priced under AA's rates, not actual Pi billing or OpenRouter catalog estimates. Higher effort is not monotonically higher quality or cost in all observed records. Exact provider request settings and per-effort API coverage still require verification. DeepSeek 0420 figures must not be used as requested 0423's scores; the separate rows here demonstrate available granularity only. GLM other effort measurements have not been established.

## Evidence and source ranking

### 1. Artificial Analysis Coding Agent Index v1.5 — best extant effort-aware aggregate, partial model coverage

Primary artifacts:
- Public live leaderboard: <https://artificialanalysis.ai/agents/coding-agents>
- First-party methodology: <https://artificialanalysis.ai/methodology/coding-agents-benchmarking>
- First-party Data API overview/tier terms: <https://artificialanalysis.ai/data-api>
- First-party API docs: <https://artificialanalysis.ai/data-api/docs>

The actual page was fetched and its embedded live data inspected, not just marketing text. Example row currently present:
- `id=ac8276cd5d15ac2daacb9956ad44c132`; `agentName=Codex`; `provider=openai`; model display `GPT-6 Luna (max)`; label `Codex - GPT-6 Luna (max) ({'reasoning_effort': 'max'})`; `isRouter=false`.
- Per-eval fields: `datasetIndexName`, `evaluationDatasetSlug`, `refDatasetName`, `weight`, `mean.reward`, `mean.inputTokens`, `mean.outputTokens`, `safety.attemptCount`.
- In this sample, `DeepSWE v1.1` `datacurve/deep-swe-1-1@1` had reward 0.6372 / 338 attempts; `SWE-Atlas-QnA` reward 0.4435 / 372 attempts; `Terminal-Bench v4` reference dataset includes an immutable SHA-256 and reward 0.1515 / 198 attempts. Row aggregate contains `indexScore`, `mean.costUsd` ($0.1759), `agentWallTimeSec`, `steps`, input/output/cache/total token means, cost/token percentiles, plus per-dataset agent version ranges. These are live observed snapshot values, given as schema/granularity proof only—not benchmark conclusions or estimates for Pi.
- The on-page release catalog identifies GPT-6 Luna as `gpt-6-luna`, OpenAI, release date 2026-09-22. An included Codex row establishes the AA display-name mapping to the target family/date, although it does not expose a formal mapping to OpenRouter's canonical slug `openai/gpt-6-luna-20260922`.

Methodology expressly says each row is an **agent variant**, not model; behavior-changing settings including reasoning are separate rows. It says pass@1 is scored separately on each three component benchmarks, then averaged into the index; same runs produce pooled token/cost/time metrics. Efficiency cost is per-token API cost, not subscription cost; token usage fields include input/cache/cache-write/reasoning/output; missing telemetry is omitted rather than treated as zero. Current v1.5 suite comprises 303 tasks: DeepSWE v1.1 (113), SWE-Atlas-QnA (124), Terminal-Bench 4.0 (66), equally weighted; method version history states September 2026 and upgrades to TB 4.0 / DeepSWE 1.1.

**Coverage reality:** page's release catalog includes GLM-5.3-Flash as `glm-5-3-flash`, publisher `zai`, release date 2026-08-26, but live benchmark rows search had no variant for it. Page data showed a Codex variant for DeepSeek V4 Flash **0731**, while the release catalog explicitly identifies it as deprecated `deepseek-v4-flash` / “DeepSeek V4 Flash 0731” release date July 31; another older entry is `deepseek-v4-flash-0420` / “DeepSeek V4 Flash 0420” dated April 24. Neither can be substituted for requested April 23 canonical version `deepseek/deepseek-v4-flash-20260423` / 0423. Do not use the 0731/0420 rows as target scores. GPT-6 Luna current row reported only max in inspected live data; the global variant name catalog includes Luna low/medium/high/xhigh/non-reasoning option names, but an option name list is not evidence of a measured row. The existence of separate measured GPT high/low rows was not established; query page data before assuming more than max.

**Data access, pricing, rights:** public HTML leaderboard is accessible without API key; it contains rich embedded data and is suitable for manual inspection. I found no documented API endpoint/export for these coding-agent rows; the AA Data API describes language/media model data. Its docs say Free = headline indices, median, input/output price; Pro = full model-level endpoint/evaluations; Commercial = Pro + provider-level/time-series/raw measurements. Overview states free-key use is “Internal use only; no redistribution”; Pro has restricted external use; commercial redistribution requires a package/attribution. Do not mirror API data into a redistributed product without checking terms. The website's live leaderboard as a public source is not automatically an open-data license; link/attribute and confirm permission before republishing raw rows.

**Trust judgement:** Strongest evidence of real task-level evaluation and effort separation. AA owns the benchmark reporting, but rows are run by named third-party agents/providers, not necessarily direct first-party model-provider reports; methodology/benchmark/task provenance is explicit. Still one set of custom coding harnesses and its cost metric applies to its API execution not user's endpoint. Good external validation; not a replacement for local Pi measurements.

### 2. Harbor / Terminal-Bench 2 leaderboard submissions — primary record-level reproducibility and effort config, sparse/closed submissions

Primary artifacts:
- Submission repository and exact layout/terms: <https://huggingface.co/datasets/harborframework/terminal-bench-2-leaderboard>
- Dataset README: <https://huggingface.co/datasets/harborframework/terminal-bench-2-leaderboard/resolve/main/README.md>
- Live public dataset tree: <https://huggingface.co/api/datasets/harborframework/terminal-bench-2-leaderboard/tree/main/submissions?recursive=true&expand=false>
- Example accepted commit: <https://huggingface.co/datasets/harborframework/terminal-bench-2-leaderboard/commit/d3cf53f7d900943b95049155aafb7bc7c311c0c8>
- Example direct record: <https://huggingface.co/datasets/harborframework/terminal-bench-2-leaderboard/resolve/main/submissions/terminal-bench/2.0/Terminus2__GLM-4.7/2026-01-27__12-34-00/adaptive-rejection-sampler__NbtvU89/result.json>
- Corresponding run config: <https://huggingface.co/datasets/harborframework/terminal-bench-2-leaderboard/resolve/main/submissions/terminal-bench/2.0/Terminus2__GLM-4.7/2026-01-27__12-34-00/config.json>

README explicitly specifies `metadata.yaml` model_name, model_provider, display names, agent URL; job contains `config.json`, trial `result.json`, and other artifacts; minimum five trials/task; validation restricts timeout/resource overrides. Repository tree contained actual per-task runs with `result.json`, agent `trajectory.json`, recording, config, verifier output. Example `config.json` includes dataset name/version (`terminal-bench`, `2.0`), agent framework, model route, endpoint/base URL, `reasoning_effort`, timeout and environment settings. Example GLM-4.7: `model_name: openai/glm-4.7:cloud`, `api_base: https://ollama.com/v1`, `reasoning_effort: high` (note model provider reporting here is route-specific and different from creator). `result.json` carries pinned task Git commit and checksum, config/agent model/provider, `n_input_tokens`, `n_cache_tokens`, `n_output_tokens`, per-request timing telemetry, `cost_usd`, verifier reward and exception outcome. Actual accessible example had `cost_usd: null`, and task timed out; therefore token telemetry permits recomputation only if correct exact endpoint rates (including caching, output/reasoning billing, route terms) are known. It is not measured billed cost in this record. The dataset release README says submissions closed during policy/process transition; that reduces completeness and fresh model coverage. License frontmatter is Apache-2.0 for submission dataset repo, but each submitted trajectory/task artifact and upstream dataset may have separate licensing; verify before redistribution.

**Strength:** best source for concrete config/benchmark/harness/version and record-per-task evidence; configurations can meet effort-specificity. **Weakness:** leaderboard/archive is model/agent submitter-driven, partial/nonuniform, not a complete benchmark provider matrix. Current located records are TB 2.0 and older families; direct check did not locate the three target versions. Records can include null cost, failure and endpoint routing differences, and aggregate scores may need computation from trials. Do not conflate TB 2.0/2.1 archive with AA's Terminal-Bench 4.0 component or TB 4.0.

### 3. SWE-bench official harness — excellent reproducible correctness but effort/cost missing

Primary sources:
- Official repository: <https://github.com/SWE-bench/SWE-bench>
- Evaluation guide: <https://github.com/SWE-bench/SWE-bench/blob/main/docs/guides/evaluation.md>
- Report writer: <https://github.com/SWE-bench/SWE-bench/blob/main/swebench/harness/reporting.py>
- Inference API reference: <https://github.com/SWE-bench/SWE-bench/blob/main/docs/reference/inference.md>

Official guide requires prediction JSONL with `instance_id`, `model_name_or_path`, `model_patch`, and evaluates patches inside Docker; writes `results.json`, per-instance `report.json`, test logs, eval scripts and patches. `run_id` + instance caching semantics are documented. Reporting implementation shows output fields for submitted/completed/resolved/unresolved/error/infrastructure-failure IDs and schema version 2. That provides exact dataset/run outcome coverage, not model provider endpoint, reasoning effort, inference prompt, tokens, or bill. Those absent inference fields must be joined to an evaluation run manifest + call-level usage records before it can feed cost-quality routing.

No public, officially owned artifact with the exact target model versions, endpoint and per-effort configs was established in this inspection. SWE-bench papers/leaderboards often have heterogeneous agent settings; treat a percentage there as model-and-agent system result only when config is published. Since model predictions can be submitted from arbitrary inference routes, dataset evaluation is independent test verification but not evidence that route executed a stated effort.

### 4. Vendor technical reports — useful hypothesis/context, not the independent router evidence required

- OpenAI first-party launch material: <https://openai.com/index/introducing-gpt-6-sol-and-luna/>. Provider-authored. No matched three-model/endpoint/task-telemetry matrix identified. Treat any results as vendor-reported, preserving exact release/effort/config if documented.
- Z.ai first-party GLM-5.3-Flash blog/model card: <https://z.ai/blog/glm-5.3-flash>, <https://huggingface.co/zai-org/GLM-5.3-Flash>. It is useful for checking provider's own exact version/config / effort support and official reported results; it cannot establish an independent effort-sweep with cost/task unless raw run records show all required fields. The Z.ai blog page could not be extracted by this read-only fetch, so I do not quote benchmark values.
- DeepSeek model identifiers remain the largest blocker: AA page catalog and current records that were visible refer to later/deprecated 0731 or 0420, not requested canonical April 23/0423. No first-party report artifact found in the accessible search that identifies exact API route + effort + scored task/cost for the requested target version. Keep it “unknown,” not alias-resolved.

## Other requested sources checked

- OpenRouter `/api/v1/models` catalog sample in existing context confirms exact canonical slugs and supported efforts, but scores lack per-effort configs: explicitly insufficient under user’s rejection. Not a quality measurement.
- OpenRouter benchmark/Data APIs provide useful aggregations and some run config for selected tasks (existing note describes search benchmarks with `include_run_config=true`), but AA/Design Arena model-level index records expose no effort. Public endpoint is source-dependent and benchmark records are not a comprehensive coding-agent effort sweep. Do not promote a catalog metric to effort-aware.
- LiveBench public CSV URLs found in search could not be fetched (404 in this inspection); published model leaderboard scoring is not generally coding-agent repository completion; no per-effort coding config found. Not suitable evidence here.
- HELM schemas/reproduction docs expose reproducible scenario/request/instance statistics, but search of accessible schemas did not establish per-request reasoning effort field or coding-agent cost/task records for target models. Could be useful harness infra, not qualifying data without explicit runtime configuration and telemetry.

## Target-model coverage matrix (exact versions only)

| Requested canonical model | AA owner/family check | Accessible effort-aware coding row with model version/provider endpoint/config + score + cost/tokens? | Finding |
|---|---|---|---|
| `openai/gpt-6-luna-20260922` | AA page family `gpt-6-luna`, OpenAI, release 2026-09-22; AA Codex row provider `openai`, max effort | **Partial yes**: exact family/date and max effort row; per-benchmark reward + token/cost/task aggregates. Endpoint is shown as provider field, not exact provider URL; agent is Codex, not Pi. Other efforts not confirmed as measured rows. | Only candidate model currently with useful effort-specific external row; valid evidence for AA's Codex-max config, not transfer to Pi or lower efforts. |
| `z-ai/glm-5.3-flash-20260826` | AA release catalog `glm-5-3-flash`, Z AI, 2026-08-26; HF owner `zai-org/GLM-5.3-Flash` | **No matching row observed** in AA leaderboard; Harbor records found do not target it. Model-card/vendor reports not tied to qualifying independent per-effort cost/task record in examined evidence. | Exact ID identity confirmed to provider org; performance at requested effort unknown. |
| `deepseek/deepseek-v4-flash-20260423` / 0423 | OpenRouter context provides expected slug, but AA catalog entries inspected show “DeepSeek V4 Flash 0420” (release 2026-04-24) and “0731” (release 2026-07-31). Cannot prove 0423 identity from those. | **No** exact row. AA has 0731 Codex max result; reject as a different version. No located Harbor/SWE-bench exact target run. | Exact target source identity not verified. Must not substitute 0420, 0731, or V4.1. Owner confirmation would need DeepSeek release/model docs/API response pinned to 0423. |

## Decision and practical data contract

For any benchmark row to be admissible as effort-aware ranking evidence, require: exact immutable model/revision or canonical version ID; provider route/endpoint; actual explicit reasoning effort or numeric token budget (including config source); named agent/harness version; benchmark dataset and revision; task count and outcome metric; per-run cost or enough input/cache/cache-write/reasoning/output telemetry plus route-specific dated price schedule; timestamp; failures/missingness; attribution/redistribution rights. Keep per-task family separate; store multiple benchmark results, not pooled cross-harness scalar. If any required key absent, label the row accordingly and exclude from the effort-specific eligible set.

For local verification, run same Pi agent version/system prompt/tools/worktree/task corpus on all three model endpoints and each supported explicit effort. Capture resolved endpoint/model/version and actual request params on every call, provider usage breakdown, exact price effective date and billed cost; pin benchmark/harness/task revisions; record score by effort/task plus measured cost/latency distributions. Separate inference provider cost from harness/environment cost and subscription. At minimum perform paired runs on representative Pi coding tasks, with repeated trials where stochastic, to calibrate any desired quality/cost frontier. Local Pi sweeps can supplement missing configurations and calibrate harness transfer; external benchmark evidence remains useful without rerunning every configuration.

## Exact artifacts for parent verification

1. AA live HTML data: `https://artificialanalysis.ai/agents/coding-agents` — inspect embedded `benchmarkRows` row ID `ac8276cd5d15ac2daacb9956ad44c132` and the DeepSeek row ID prefix `28ef65135f08f035dc93a97d324fea73`; record exact live snapshot if reusing values.
2. AA methodology: `https://artificialanalysis.ai/methodology/coding-agents-benchmarking` — the “What The Index Aggregates,” “Efficiency Metrics,” “Agent Settings,” and “Version History” sections.
3. Harbor ground-truth file: `https://huggingface.co/datasets/harborframework/terminal-bench-2-leaderboard/resolve/main/submissions/terminal-bench/2.0/Terminus2__GLM-4.7/2026-01-27__12-34-00/adaptive-rejection-sampler__NbtvU89/result.json` plus sibling `config.json`; confirms task IDs, effort, token list, actual null cost case.
4. Harbor repository requirements/license: dataset README above; require five trials and configs/artifacts; Apache-2.0 front matter, subject to per-artifact/upstream rights.
5. AA exact release catalog identities are embedded in current AA leaderboard page; alternatively model pages `https://artificialanalysis.ai/models/glm-5-3-flash` and `https://artificialanalysis.ai/models/deepseek-v4-flash-0420` show why version disambiguation matters. Do not infer canonical 0423 from 0420.
6. SWE-bench guide + reporter links above prove task outcome artifact fields, and missing inference effort/cost dimensions.

## Residual risks and limitations

- AA HTML is a live snapshot; embedded records may change, and no stable public export/API for coding-agent rows was established. Model mapping via family/date is stronger than fuzzy alias but still not a formal provider endpoint mapping.
- AA aggregate cost is model-provider token pricing applied to the AA agent workload, not a directly observed billed invoice for Pi/OpenRouter. Route and task-set mismatch prevent exact user-task cost prediction.
- Harbor examples are historical, user-submitted, and incompletely validated through this review; one exact sample timed out and cost was null. The archived run shows config and task revision but does not necessarily provide accurate provider billing. Current submission process says closed.
- The research snapshot date is 2026-10-21; later snapshot changes must be rechecked before implementation. Specifically version dates look close and can be misleading: 0420/0423 and 0731/4.1 are not interchangeable.
- Search provider had rate limits/errors for some queries; findings are based on directly fetched primary artifacts listed above, and “not found” means not observed in accessible source artifacts/search, not proof that no private/unindexed record exists.
- API/benchmark redistribution licensing is not uniform. Do not embed raw AA/API data, benchmark task content, or trajectories into a distributed product without confirming rights separately.
