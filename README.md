# Jev Pilot for Pi — effort-only preview

A regular [Pi package](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/packages.md) that asks Jev how much reasoning each user task needs, then changes **only session thinking**. The selected physical model and configured defaults stay unchanged. This preview implements ticket 01, not automatic tier routing, skills, worker routing, reporting or tuning.

## Install and configure

Requires official Pi; tested with **`@earendil-works/pi-coding-agent` 1.3.0**, the stable release verified against npm and the official release tag. Pi-Bolt is not the target. Select a physical model with configured authentication before submitting work.

From a local checkout:

```bash
bun install --frozen-lockfile
pi install /absolute/path/to/pi-jev-pilot
export JEV_SYSTEM_ONE_API_KEY='your-key'
pi --model provider/model-id
```

Do not commit credentials. Configuration is read from the Pi process environment for each eligible user message:

| Variable                 | Default / meaning                                                             |
| ------------------------ | ----------------------------------------------------------------------------- |
| `JEV_SYSTEM_ONE_URL`     | `https://api.typesafe.ai/v1/systemone`; complete TypeSafe-compatible endpoint |
| `JEV_SYSTEM_ONE_API_KEY` | Bearer key; falls back to `TYPESAFE_API_KEY` when unset                       |
| `JEV_SYSTEM_ONE_MODEL`   | `jev-latest`                                                                  |
| `JEV_TIMEOUT_MS`         | `1500`; positive integer milliseconds                                         |

An empty/malformed setting is a configuration error, not permission to choose another service or model. The endpoint must use HTTP(S), without embedded username/password. Use HTTPS for hosted services; HTTP is supported for local fixtures. No automatic classifier-backend fallback is performed.

## Understand effort decisions

The pinned Jev Pilot effort rubric is `low`, `medium`, `high`, `xhigh`, `max`. Confidence thresholds remain .3 for an upgrade, .6 for a downgrade and .5 for raising to high or above. Near ties lean upward only through high (.15 margin); very-hard distributions need combined xhigh/max probability .6. Starts are capped at xhigh. Risk greater than .7 forces at least high without reducing an already higher setting. Short approvals may raise effort but not lower it.

Pi's own supported-thinking metadata and clamping determine the effective setting. The interactive status displays `requested → effective` and the outcome. A session custom entry `jev-pilot:effort` also records these values and the reusable numeric decision, without prompt text. It is state, **not a decision ledger/report**. For example, a model without xhigh may show `xhigh → high`; a non-reasoning model shows `high → off`. Labels across providers do not promise equal budgets or quality.

Plain `continue`, `go on`, `keep going`, `carry on` and `resume` reuse the preceding branch-owned decision. `yes`, `go ahead` and other approvals are classified with recent context. Tools and provider retries do not trigger classification or mid-turn escalation. Queued user input is classified at its own message boundary before its next model request.

Service errors, malformed answers and deadline expiry retain the current valid model/effort. Deadline expiry **aborts the HTTP request**, then allows ordinary generation. Explicit parent cancellation **stops** classifier/model work; it does not launch fallback generation. Invalid configuration stops work with an actionable error. Pi itself rejects a selected model without authentication.

## Know what leaves the device

System One receives:

- the current text prompt;
- up to four recent user/assistant messages, bounded to 2,000 characters in total;
- derived counts/flags, recent tool names and failure markers;
- available tool names and recognized platform names inferred from shallow file/directory names.

The extension does not automatically send tool arguments/results, thinking blocks, images, file contents or the full transcript. Platform discovery reads directory entries only, at the project root and at most 60 immediate subdirectories, excluding dependencies/build outputs and symbolic links. Prompt and assistant text may themselves contain sensitive data: **there is no automatic secret-redaction guarantee**. Authentication headers and complete service responses are not logged.

Branch state is reconstructed only from the active Pi branch. New sessions do not inherit another session's decisions; resume/reload, forks/tree navigation and compaction retain only their owned history. Shutdown/reload cleanup aborts active classifier work and is idempotent.

## Verify locally

```bash
bun run typecheck
bun test tests/effort-policy.test.ts
bun run test:e2e
bun test
```

The CLI suite installs the local package into a temporary agent directory and starts the **actual official Pi CLI** in RPC mode under Bun. Local deterministic System One and OpenAI-compatible HTTP fixtures capture payloads, dispatched model/effort, real tool continuations, deadlines, cancellation, faults, retries and lifecycle operations. It uses no paid APIs or real credentials and changes no user/global settings. Pure-policy tests are not described as E2E.

See the [AC-to-test matrix](docs/testing/ticket-01-matrix.md), [compatibility evidence](docs/testing/ticket-01-validation.md), and [MIT attribution](NOTICE.md). Local fixtures verify host behavior, not hosted Jev availability, real-provider compatibility or routing quality.
