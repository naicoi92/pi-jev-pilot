# Jev Pilot for Pi — routing and skills preview

A regular [Pi package](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/docs/packages.md) that asks Jev how much reasoning each user task needs and matches an eligible installed skill. **By default, the selected physical model and configured defaults stay unchanged:** session thinking may change and selected skill instructions enter the model context. Optional main-model routing uses an explicitly selected virtual model and configurable physical tiers. This preview implements tickets 01–03, not quality/design guidance, worker routing, reporting or tuning.

## Install and configure

Requires official Pi; tested with **`@earendil-works/pi-coding-agent` 1.4.0**, the stable release verified against npm and the official release tag. Pi-Bolt is not the target. Select a physical model with configured authentication before submitting work.

From a local checkout:

```bash
bun install --frozen-lockfile
pi install /absolute/path/to/pi-jev-pilot
export JEV_SYSTEM_ONE_API_KEY='your-key'
pi --model provider/model-id
```

Do not commit credentials. Configuration is read from the Pi process environment for each eligible user message:

| Variable                 | Default / meaning                                                                |
| ------------------------ | -------------------------------------------------------------------------------- |
| `JEV_EFFORT_ENABLED`     | `true`; only `true`/`false` accepted; false disables effort questions and writes |
| `JEV_SKILLS_ENABLED`     | `true`; only `true`/`false` accepted; false disables new skill matching          |
| `JEV_SKILL_RERANK`       | `false`; optional upstream shortlist recheck; only `true`/`false`                |
| `JEV_SYSTEM_ONE_URL`     | `https://api.typesafe.ai/v1/systemone`; complete TypeSafe-compatible endpoint    |
| `JEV_SYSTEM_ONE_API_KEY` | Bearer key; falls back to `TYPESAFE_API_KEY` when unset                          |
| `JEV_SYSTEM_ONE_MODEL`   | `jev-latest`                                                                     |
| `JEV_TIMEOUT_MS`         | `1500`; positive integer milliseconds                                            |

An empty/malformed setting is a configuration error, not permission to choose another service or model. The endpoint must use HTTP(S), without embedded username/password. Use HTTPS for hosted services; HTTP is supported for local fixtures. No automatic classifier-backend fallback is performed.

## Enable optional main-model routing

Automatic main-model routing is **off by default**. To enable it, configure all three exact physical identities, restart/reload Pi, and explicitly select `jev/auto`:

```bash
export JEV_MAIN_ROUTING_ENABLED=true
export JEV_TIER_FAST='provider/fast-model-id'
export JEV_TIER_BALANCED='provider/balanced-model-id'
export JEV_TIER_DEEP='other-provider/deep-model-id'
pi --model jev/auto
```

`JEV_MAIN_ROUTING_ENABLED` accepts only `true` or `false`. Tier mappings may be identical and model IDs may contain slashes: the first slash separates provider from model ID. When main routing is disabled, unused tier settings/authentication are not validated. Enabling registration does not switch an existing physical selection: physical selections continue using effort and skill matching without tier routing. Neither path writes global defaults or automatically selects the router. Registration changes require extension reload; tier mappings are read on each routed request.

Every configured target must resolve exactly to a physical Pi registry model with configured authentication. Unknown IDs, virtual targets and missing authentication produce actionable errors, without fuzzy matching, health probes, failover or cross-provider retry. The initial physical default is **configured balanced**, an approved adaptation of upstream balanced/Sonnet. The latest successful physical response on the active request branch is the baseline (including a manually selected physical turn); saved Jev state is used only when no successful response remains, then balanced when neither exists. Classifier failure retains that valid baseline. If Pi omits `previous` because the latest successful physical identity no longer resolves, public transcript validation reports the exact invalid identity rather than hiding it behind saved state/balanced. Failed/aborted assistants do not establish a new successful baseline. This does not make a manual physical model a persistent pin: future eligible tier decisions may route again.

The tier rubric and .3 upgrade/.6 downgrade confidence gates come from pinned Jev Pilot. Risk strictly above .7 forces deep. Physical identity ranking is exact (the first matching tier when mappings duplicate), not Claude family-name inference. System One receives tier/risk plus effort when auto-effort is enabled and at least one tier candidate supports multiple thinking levels; selected non-reasoning targets never apply speculative effort. `JEV_EFFORT_ENABLED=false` disables effort questions and policy without disabling tier routing. Applicable tier/effort/risk questions share **one call in the virtual route**; the physical effort hook skips only this package's router.

Pi keeps **selected** `jev/auto`/thinking apart from **dispatched** physical model/thinking. Every fresh user request starts from its current selected thinking input; enabled effort policy may overwrite it, while disabled effort or a classifier failure preserves it (subject to physical model clamping). Plain continuation reuses the numeric decision, not a frozen old effort setting. Tool continuations and ordinary retries keep the applied physical pair without reclassification, mid-turn escalation or provider failover.

Native router state is stored as Pi's branch-local `pi.virtual-model-state` entry: `physical`, `requested`, `effective`, `outcome`, `source` (`decision`, `retained`, `default`) and reusable decision. The interactive status shows selected router → physical model, requested → effective thinking and source/outcome. Default/retained failure dispatch is not reported as a new classifier decision. Assistant responses provide Pi's authoritative physical provider/model/thinking receipts. This is routing state, not a ledger/report.

Pi's documented virtual state follows resume, forks/tree, compaction and reload; no process-global route cache is used. A fork before a route-state entry cannot reuse that excluded decision. Native batched steering gets **one decision per model request**: trailing users after the last assistant/tool boundary form the batch, and the last non-continuation input is the anchor when followed by plain `continue`. A final approval is still classified, with bounded recent context. An only-continuation batch reuses valid branch state; without one it classifies normally.

**Native cancellation difference:** in tested Pi 1.4.0, changing model/thinking while a virtual route is pending cancels that request entirely (no physical generation or new route state). The manual choice remains; the next prompt works normally. The physical effort hook can instead discard its stale decision and let the original request proceed. User abort always stops work; classifier deadline expiry aborts only classification and permits valid retained/default dispatch. No private host patch is required. The official `jev-router` example is API prior art, not this port's business policy.

## Match installed skills

Matching is **on by default**, independently of effort and optional tier routing. The effective main-session catalog comes from public `pi.getCommands()` skill resources and their `sourceInfo.path`, not a parallel directory scan. Unreadable resources and `disable-model-invocation: true` skills are excluded. Pi's own resource/package filters, collision resolution and reload behavior remain authoritative. Explicit `/skill:name` commands, blank input and plain continuations do not trigger matching. Skill-only classification works with effort disabled or a non-reasoning physical model. Zero applicable questions means zero classifier HTTP, even with unused invalid System One configuration.

The ordinary unbatched path combines the skill `which` choice and three gate nouls with applicable effort/risk/tier questions in **one System One request**. Criteria include each eligible description and the first **300 body characters**, never the whole resource. `(none)` is an explicit ordinary choice. A probability of at least **.5** selects a batch leader regardless of the action gate; otherwise both fit **.3** and the oriented gate mean **.3** are required. Missing confidence cannot make an ordinary pick. These are pinned upstream rules, not a new ranking heuristic.

A choice supports at most **255 options**. Catalogs use near-equal batches of at most **254 skills**, reserving the none slot; only the first batch carries routing and gate questions. No candidate is dropped. Ordinary no-rerank selection compares qualifying batch leaders. With `JEV_SKILL_RERANK=true`, the first pass sends descriptions only (no none choice), then rereads the top **three per batch**, capped at 255, with 300-character excerpts. The first gate can skip rerank; the chosen rerank candidate must itself fit at least **.3**. Every candidate can be rejected. A failed/malformed batch or failed rerank yields no skill, not an older selection or another backend.

A selected skill's full body is attached to its originating user **only in the supported `context` projection**. Its directory is supplied for relative references. The persisted user's content, role and timestamp remain unchanged; a branch-owned `jev-pilot:skill` custom entry stores the selected resource snapshot and originating UUID for reload/resume. This entry contains skill text, not a decision ledger or captured user prompt. Repeated identical visible instructions get a short already-loaded reference rather than duplicate bodies, including a preceding native `/skill:name` load whose complete resource name, path, directory and body match exactly. A changed body or a different resource still loads in full. If compaction removes them, a fresh selection can load them again. None/rejected selections do not attach an older skill to a new user; earlier visible instructions remain historical context.

**Host difference:** this package does not suppress Pi's skill catalog, rename/hide skill files, change resource settings, or claim that other skills are unavailable. Pi's normal catalog remains in the system prompt. Selected instructions really reach the provider, but this is guidance, not exclusive tool/skill enforcement. Claude-specific path substitutions and the upstream Skill tool are replaced by Pi's resource directory convention. No independent worker-session matcher is registered.

Physical matching runs at the existing user `message_start` boundary; virtual matching runs in the native route after queued users form a request batch. Both call the same orchestration; neither classifies again in `context`. A trailing continuation does not steal the substantive queued input's selection. Tool continuations and retries reuse the visible content without additional matching. Cancellation, manual selection changes and session/branch invalidation discard pending selections; timeout aborts the HTTP request and allows valid retained/default generation without skill injection.

**Version-tested ownership expansion:** skill projection reuses ticket 01's single `jevPilotInputId` seam, including eligible virtual users. The supervisor approved this within official **Pi 1.4.0**, not as a documented arbitrary-user-metadata guarantee. Missing/stripped identity means no injection for that user, including after an older valid selection; there is no older-skill fallback. Actual CLI tests include a second extension stripping newer identities. Revalidate metadata serialization, hook identity, context ordering, native explicit skill expansion and provider conversion on host/provider upgrades. Unsupported composition may lose matching fidelity rather than guess ownership.

## Understand effort decisions

Installing/enabling auto-effort authorizes Jev to choose over default/current session thinking under the pinned upstream policy. A named current level, including a startup selection, is **not a persistent user pin**. A manual model/thinking change during an outstanding classification aborts/discards that stale result without a late effort write; it does not lock future eligible prompts. Before the first eligible decision, startup/reload does not invent effort.

Only enabled, applicable questions run. Effort is inapplicable when selected model metadata is non-reasoning or offers only one supported thinking level; a reasoning model currently set to `off` is still eligible. Disabled/inapplicable effort creates no effort state or setter writes, but eligible skills can still contribute questions. Empty input, explicit skill commands and command-like input skip classification. On the physical path, effort and risk share the applicable skill request without unused tier or guidance questions. No extra ownership or lock mode is introduced.

The pinned Jev Pilot effort rubric is `low`, `medium`, `high`, `xhigh`, `max`. Confidence thresholds remain .3 for an upgrade, .6 for a downgrade and .5 for raising to high or above. Near ties lean upward only through high (.15 margin); very-hard distributions need combined xhigh/max probability .6. Starts are capped at xhigh. Risk greater than .7 forces at least high without reducing an already higher setting. Short approvals may raise effort but not lower it.

Pi's own supported-thinking metadata and clamping determine the effective setting. The interactive status displays `requested → effective` and the outcome. A session custom entry `jev-pilot:effort` also records these values and the reusable numeric decision, without prompt text. It is state, **not a decision ledger/report**. For example, a reasoning model without xhigh may show `xhigh → high`. A non-reasoning model skips effort classification instead of spending a call on unusable high→off diagnostics. Labels across providers do not promise equal budgets or quality.

On the physical effort path, plain `continue`, `go on`, `keep going`, `carry on` and `resume` reuse the preceding branch-owned decision. `yes`, `go ahead` and other approvals are classified with recent context. Tools and provider retries do not trigger classification or mid-turn escalation. Queued user input is classified at its own message boundary before its next model request.

Service errors, malformed answers and deadline expiry retain the current valid model/effort. Deadline expiry **aborts the HTTP request**, then allows ordinary generation. Explicit parent cancellation **stops** classifier/model work; it does not launch fallback generation. Invalid configuration stops work with an actionable error. Pi itself rejects a selected model without authentication.

## Know what leaves the device

System One receives:

- the current text prompt;
- up to four recent user/assistant messages, bounded to 2,000 characters in total;
- derived counts/flags, recent tool names and failure markers;
- available tool names and recognized platform names inferred from shallow file/directory names;
- eligible skill descriptions and bounded body excerpts in choice criteria (300 body characters each; only shortlisted excerpts during optional rerank).

Apart from these explicit bounded skill excerpts, the extension does not automatically send tool arguments/results, thinking blocks, images, repository file contents or the full transcript. Native explicit skill expansion bodies and projected auto-selected instructions are excluded from subsequent classifier history; the actual prompt and permitted excerpts still may contain secrets. Platform discovery reads directory entries only, at the project root and at most 60 immediate subdirectories, excluding dependencies/build outputs and symbolic links. Prompt and assistant text may themselves contain sensitive data: **there is no automatic secret-redaction guarantee**. Authentication headers and complete service responses are not logged.

Branch state is reconstructed only from the active Pi branch. A pre-application `jev-pilot:effort-application` entry records the baseline, numeric decision and random input UUID before Pi appends a thinking change. Ownership requires that exact UUID on the originating persisted user, never the next unrelated user. A `jev-pilot:effort` receipt links the application to its persisted user ID. Missing/dropped identity prevents reuse, including fallback to older decisions. Restore boundaries record `jev-pilot:effort-restored`, discard excluded provisional changes and replay manual thinking entries on the retained prefix. Enabled applicable auto-effort restores that branch deterministically even when the SDK reapplies a different startup value; startup thinking is not a persistent lock. Disabled/inapplicable effort adds no effort identity, effort state or setters; a selected skill can independently need the shared input identity and its own branch entry. These entries contain no prompt text and are not sent to the model.

**Accepted version-tested ownership dependency:** the public `message_end` same-role replacement API transports `jevPilotInputId` on a copied user message without changing role/content/timestamp. Official Pi 1.4.0 preserves that extension-owned property through serialization, reload/resume and forks in actual CLI tests, and its tested provider conversion omits it. However, arbitrary `UserMessage` metadata persistence is **not a documented host guarantee**. After independent review, the parent accepted this dependency specifically for tested official Pi 1.4.0. This is not a supported metadata slot, a guarantee for wildcard peer versions or universal provider compatibility; upgrading the host/provider requires revalidating hook object identity, persistence/fork and payload conversion. Missing identity fails closed without older-decision fallback. See [review follow-up evidence](docs/testing/ticket-01-validation.md#review-follow-up-originating-input-identity-spike).

New sessions do not inherit another session's decisions; resume/reload, forks/tree navigation and compaction retain only their owned history. In steering mode `all`, each persisted queued user's receipt is committed before the next queued message reads its predecessor; `continue` therefore reuses the immediate decision rather than an older one. Shutdown/reload cleanup aborts active classifier work and is idempotent.

## Verify locally

Development requires **Bun >=1.4.3** (verified with `1.4.3+c6da4a4d3`). Use `oxlint` for linting, `oxfmt` for formatting, and `bun check` for typechecking. Do not use Prettier. The TypeScript compiler package is not required: Bun includes its checker and standard library declarations.

```bash
bun run lint
bun run fmt:check
bun run typecheck
bun test tests/effort-policy.test.ts tests/tier-policy.test.ts
bun test tests/main-routing.test.ts tests/skill-matching.test.ts
bun run test:e2e
bun test
```

Use `bun run fmt` to apply formatting. Linting is read-only (`--deny-warnings`); no unsafe autofix or disabled rule categories are used. `bun check` honors `tsconfig.json` and never emits build files.

The CLI suite installs the local package into a temporary agent directory and starts the **actual official Pi CLI** in RPC mode under Bun. Local deterministic System One and OpenAI-compatible HTTP fixtures capture payloads, dispatched model/effort, real tool continuations, deadlines, cancellation, faults, retries and lifecycle operations. It uses no paid APIs or real credentials and changes no user/global settings. Pure-policy tests are not described as E2E.

See the [skill matching matrix](docs/testing/ticket-03-matrix.md), [skill matching evidence](docs/testing/ticket-03-validation.md), [effort AC-to-test matrix](docs/testing/ticket-01-matrix.md), [main-routing matrix](docs/testing/ticket-02-matrix.md), [main-routing evidence](docs/testing/ticket-02-validation.md), [compatibility evidence](docs/testing/ticket-01-validation.md), and [MIT attribution](NOTICE.md). Local fixtures verify host behavior, not hosted Jev availability, real-provider compatibility or routing quality.
