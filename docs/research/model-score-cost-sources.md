# Model Score and Cost Sources

Research date: 2026-10-21. Documentation research only; no authenticated benchmark API calls or paid model calls. Responses shown in documentation are schema examples, not observed model results.

## Finding

OpenRouter is a suitable primary integration point for benchmark aggregation and OpenRouter pricing. It is not a universal source of quality scores for every model/effort combination. Preserve upstream provenance, benchmark identity/version, evaluation configuration and timestamp. Do not interpret indices or Elo as task success probabilities.

## Verified sources

| Source | Metric/data | Effort coverage | Integration and limits |
|---|---|---|---|
| [OpenRouter benchmark API](https://openrouter.ai/docs/api/api-reference/benchmarks/list-benchmarks) | Aggregates Artificial Analysis indices, Design Arena ratings, OpenRouter evaluations | Source-dependent | GET /api/v1/benchmarks; valid API key; documented 30 requests/min/key, 500/day/account |
| [OpenRouter Data API](https://openrouter.ai/docs/cookbook/administration/data-api) | AA coding/intelligence/agentic indices; Design Arena Elo/win rate/categories; OpenRouter accuracy/F1 and per-task costs | AA/DA documented response shapes do not expose dedicated effort configuration; search supports include_run_config=true | Source/task/category filters; source-specific shapes; snapshot meta/version |
| [OpenRouter benchmark directory](https://openrouter.ai/benchmarks) | Public benchmark pages and evaluation families | Some displayed lanes include effort | Useful discovery, not a guarantee of exhaustive effort sweeps |
| [OpenRouter model API](https://openrouter.ai/docs/api/api-reference/models/get-models) | Prompt/completion/cache/reasoning pricing, conditional overrides, supported reasoning efforts, modalities and benchmark entries | Supported efforts are capability metadata, not quality measurements | Prices are USD/token for the specified pricing fields; catalog filtering examples use USD/million tokens, so do not confuse units |
| [Artificial Analysis Coding Agent Index methodology](https://artificialanalysis.ai/methodology/coding-agents-benchmarking) | Agent end-to-end tasks, per-evaluation pass@1, aggregate index, pooled cost/tokens/time | Behavior-changing settings including reasoning are separate agent-variant rows | Agent variants are not model-only scores; cannot automatically transfer scores from another harness to Pi |

## Source-specific interpretation

- Artificial Analysis data via OpenRouter provides separate coding, intelligence and agentic indices. They are composite indices, not interchangeable scales or percentage probabilities. The documented aggregation shape alone does not establish exact benchmark suite versions or effort per row; trace to upstream methodology/configuration before making those claims.
- Design Arena provides category-specific Elo and win rates from battles. Elo is relative within its comparison population/category, not an absolute probability of coding success. A UI-related category can be a useful design signal, but does not establish repository debugging quality.
- OpenRouter GPQA measures science reasoning, not direct repository patch success. Airline tau benchmark measures policy-constrained service tool agents, not Pi terminal coding. Treat these as domain-specific evidence.
- Search benchmark API returns each model's highest-scoring eligible evaluation configuration, not all effort levels. Same-configuration runs are combined by task-weighted mean, with at least 100 evaluated tasks. `include_run_config=true` exposes max_agent_turns, reasoning_effort and temperature for search only. WideSearch uses item F1; other documented search benchmarks use accuracy. Search-engine/surface configuration is part of the result and must not be erased.
- Artificial Analysis Coding Agent Index v1.5 comprises DeepSWE v1.1, Terminal-Bench 4.0 and SWE-Atlas-QnA, equal-weighted per benchmark; reported 303 tasks and three attempts/task. The methodology explicitly says public rows are agent variants, not models, and settings including reasoning are separate rows. API-token cost does not represent consumer subscriptions. Availability of that full per-agent/per-effort data through OpenRouter's model-level API has not been established.

## Proposed use

1. Fetch and cache OpenRouter benchmark data out of the prompt hot path. Retain source, metric/domain, exact model mapping, timestamp, configuration, sample information when available, and data/schema version.
2. Use task-specific benchmark evidence to shortlist user-approved Pi models; preserve separate score families, never naively average Elo and indices.
3. Map versioned OpenRouter identities to Pi provider/model identities explicitly. Missing mapping is unknown, not a fuzzy match to a newer family alias.
4. For effort-aware selection, require a measured configuration. A model-level score with unknown effort cannot be copied to all effort levels. Store unknowns honestly; use a declared default/manual policy until evidence exists.
5. Use actual execution-provider pricing/usage for cost. OpenRouter pricing applies to the corresponding OpenRouter route; direct-provider pricing and subscription accounting need separate treatment. Benchmark average cost is an observation for that harness/task distribution, not an exact prediction for a user's task.
6. Select the least estimated-cost eligible configuration meeting a benchmark-policy requirement, but do not translate a score threshold into guaranteed task success. Calibrate thresholds on representative Pi tasks before making quality guarantees.

## Three-model public API sample — catalog metadata, insufficient for effort-aware ranking

A public, unauthenticated `/api/v1/models` response was sampled on 2026-10-21; selected records were saved in `data/openrouter-three-models.json` with retrieval timestamp. This is real catalog data, unlike documentation examples. No authenticated `/benchmarks` request or inference was made.

| Field | GPT-6 Luna | GLM 5.3 Flash | DeepSeek V4 Flash |
|---|---|---|---|
| Canonical version suffix | 20260922 | 20260826 | 20260423 (0423) |
| AA intelligence | 38.1 | 41.8 | 24.4 |
| AA coding | null | 71.5 | 52 |
| AA agentic | null | 50.9 | 26.3 |
| DA models/uicomponent Elo | absent | 1316 | 1165 |
| DA models/website Elo | absent | 1272 | 1208 |
| USD / million input tokens | 0.10 | 0.041191 | 0.091 |
| USD / million output tokens | 0.50 | 0.12 | 0.182 |
| USD / million cache-read tokens | 0.01 | 0.00375 | 0.0182 |
| Efforts | max,xhigh,high,medium,low,none | max,high,low | xhigh,high,none |
| Default effort | medium | max | high |
| Mandatory reasoning | false | true | false |
| Context tokens | 1050000 | 1048576 | 1048576 |
| Input | text,image,file | text,image,video | text |

All three advertise `tools` in supported_parameters; this is protocol support, not proven tool-use quality. Scores have no effort configuration in these records. Missing GPT coding/agentic scores are unknown, not zero. GLM's max_completion_tokens=943718 and DeepSeek's=943717 are large catalog-advertised top_provider limits, not independently validated runtime guarantees. GPT input above 272000 tokens has conditional rates of USD 0.20/M input and 0.75/M output (plus changed cache rates). OpenRouter catalog prices are not guaranteed for every endpoint, region, direct provider or subscription.

For an assumed 10000 uncached input and 2000 billed completion tokens under default rates: GPT USD 0.002; GLM USD 0.00065191; DeepSeek USD 0.001274. This is arithmetic for a fixed token workload, not predicted whole-task cost. Extra reasoning tokens, cache operations, tools, retries and provider overrides can change cost.

## Remaining checks

- No authenticated API payload has been sampled; effort coverage and stable configuration identifiers need verification on real records, beyond documentation schemas.
- AA model indices and AA Coding Agent Index are different products; verify intended metric and export/API before linking them.
- Data cookbook publishes acceptable-use/attribution guidance and links upstream citations. Do not assume the OpenAPI document's MIT license or usage-dataset CC BY terms license every upstream benchmark score. Confirm redistribution terms for snapshots bundled with a public package.
- No live harness-transfer, model-effort sweep, selector quality/cost or cancellation E2E has been verified.
