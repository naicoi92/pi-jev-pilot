# Command Code Model Data Review

Research snapshot: 2026-10-21. Public page and raw HTML inspection only; no inference/authenticated calls.

## Finding

Command Code presents useful model-level benchmark summaries and its own route pricing, but the inspected pages do not establish per-effort quality/cost measurements. This is not an independent replacement for Artificial Analysis: GPT-6 Luna page footer explicitly attributes benchmark data to Artificial Analysis, index version v4.3, linking to its model page. Embedded data includes source/indexVersion/url metadata. No documented benchmark export API was established in this limited inspection; absence is not proven.

| Model page | Intelligence | Coding | Terminal-Bench (version unspecified on page) | Input/output/cache-read USD per million tokens |
|---|---:|---:|---:|---|
| [GPT-6 Luna](https://commandcode.ai/models/gpt-6-luna) | 37.3 | unscored | absent | 0.10 / 0.50 / 0.01 standard band |
| [GLM 5.3 Flash](https://commandcode.ai/models/glm-5-3-flash) | 41.8 | 71.5 | 84.3 | 0.15 / 0.50 / 0.03 |
| [DeepSeek V4 Flash latest](https://commandcode.ai/models/deepseek-v4-flash) | 34 | 69.1 | 78.7 | 0.15 / 0.60 / 0.003 off-peak |

DeepSeek page release date is July 31, 2026, not the April 23 version from the earlier OpenRouter catalog sample. Same family slug is not proof of same revision. DeepSeek peak price doubles to 0.30/1.20/0.006 during 01–04 and 06–10 UTC Monday–Friday. ZDR can cost extra. GPT above 272K input tokens has 0.20/0.75/0.02 rates.

## Cost provenance

The pages show a calculator and “what real work costs” table with fixed token counts (lookup 8K input/1K output; bug fix 180K/12K, etc.). They do not demonstrate per-model empirical token consumption for the same scored task. Header “agent-loop cost” is effective INPUT price per million input tokens, not measured total task cost. For Luna 75% cache hit yields 0.25*0.10 + 0.75*0.01 = 0.0325 USD/M input; actual displayed catalog value 0.037 is a separate aggregate assumption whose exact blend was not established. Never label these figures measured effort-aware benchmark cost.

## Limitations for selector

- One score per model, not separate scores for low/medium/high/max in inspected detail pages.
- Supported reasoningEfforts metadata was seen in embedded data, but it is capability metadata, not measured effort-specific outcomes.
- Luna intelligence 37.3 differs from AA live v4.3.2 max value 38.1245 previously inspected; snapshot/version/config cause not established. Do not merge as the same observation.
- GLM Terminal-Bench 84.3 is not comparable to AA Terminal-Bench 4.0 value 32.83 without confirming version/harness. The page does not specify its Terminal-Bench revision in extracted content.
- Prices reflect Command Code route conditions, not every Pi provider/subscription.

## Recommendation

Use Command Code as a convenient catalog/reference and provider pricing source when executing on that route. Do not use it as an effort-specific benchmark ground truth without additional run-config evidence. Preserve source/index version/model revision and distinguish modeled cost examples from measured evaluation telemetry.
