# Jev Pilot for Pi — effort, skills, advice and worker routing preview

A regular [Pi package](https://github.com/earendil-works/pi/blob/v1.4.0/packages/coding-agent/docs/packages.md) that asks Jev how much reasoning each user task needs and matches an eligible installed skill. **The user-selected physical main model and configured defaults stay unchanged:** session thinking may change and selected skill instructions enter the model context. Automatic main-model routing has been removed; auto-effort remains unchanged pending a separate cache investigation. This preview implements tickets 01–05 and a partial ticket-06 ordinary-worker routing adapter. Worker routing remains an unaccepted checkpoint with a required-child-extension coexistence limitation; reporting and tuning are not implemented.

## Install and configure

Requires official Pi; tested with **`@earendil-works/pi-coding-agent` 1.4.0**, the stable release verified against npm and the official release tag. Pi-Bolt is not the target. Select a physical model with configured authentication before submitting work.

From a local checkout:

```bash
bun install --frozen-lockfile
pi install /absolute/path/to/pi-jev-pilot
export JEV_SYSTEM_ONE_API_KEY='your-key'
pi --model provider/model-id
```

Do not commit credentials. Backend keys and feature switches remain in the Pi process environment. Worker physical tiers use JSON-only public effective Pi settings, described below:

| Variable                 | Default / meaning                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `JEV_EFFORT_ENABLED`     | `true`; only `true`/`false` accepted; false disables effort questions and writes                      |
| `JEV_SKILLS_ENABLED`     | `true`; only `true`/`false` accepted; false disables new skill matching                               |
| `JEV_SKILL_RERANK`       | `false`; optional upstream shortlist recheck; only `true`/`false`                                     |
| `JEV_STRATEGY_ENABLED`   | `true`; only `true`/`false`; strategy advice, never worker dispatch                                   |
| `JEV_QUALITY_ENABLED`    | `true`; only `true`/`false`; request quality reads and loop observation advice                        |
| `JEV_DESIGN_ENABLED`     | `true`; only `true`/`false`; upstream design-pack context advice                                      |
| `JEV_DESIGN_SKILLS`      | `design-taste-frontend, impeccable, web-design-guidelines`; comma-separated configured resource names |
| `JEV_SYSTEM_ONE_URL`     | `https://api.typesafe.ai/v1/systemone`; complete TypeSafe-compatible endpoint                         |
| `JEV_SYSTEM_ONE_API_KEY` | Bearer key; falls back to `TYPESAFE_API_KEY` when unset                                               |
| `JEV_SYSTEM_ONE_MODEL`   | `jev-latest`                                                                                          |
| `JEV_TIMEOUT_MS`         | `1500`; positive integer milliseconds                                                                 |

An empty/malformed boolean or backend setting is a configuration error, not permission to choose another service or model. An explicitly empty `JEV_DESIGN_SKILLS` list names no skills; comma-separated names are trimmed, deduplicated and empty entries ignored, as upstream. The endpoint must use HTTP(S), without embedded username/password. Use HTTPS for hosted services; HTTP is supported for local fixtures. No automatic classifier-backend fallback is performed.

## Configure worker model tiers

The main model stays the physical model selected by the user. Jev never registers `jev/auto`, automatically changes the main model or writes model defaults. Start with `pi --model provider/model-id`; old `jev/auto` startup/default selections must be replaced with a physical model. Auto-effort, skill matching and eligible advice still operate on that physical session.

Ordinary direct/async worker routing uses these mappings in Pi's `settings.json` (agent-directory global settings, or trusted project settings):

```json
{
  "jevPilot": {
    "tiers": {
      "fast": "provider/fast-model-id",
      "balanced": "provider/balanced-model-id",
      "deep": "other-provider/deep-model-id"
    }
  }
}
```

Keep unrelated settings/package declarations intact. No credentials belong in `jevPilot`; System One keys remain environment variables and model authentication uses Pi's normal configuration. The worker adapter consumes public `pi.getSettings()` at session start/reload; host recursive global/project merge, project trust, `PI_CODING_AGENT_DIR` and SDK settings overrides remain authoritative. It does not independently read project settings. Reload/restart after editing mappings.

Worker mappings are **JSON-only**. Legacy `JEV_MAIN_ROUTING_ENABLED` and `JEV_TIER_FAST/BALANCED/DEEP` are ignored. Obsolete `jevPilot.mainRoutingEnabled` is ignored like an unknown key, regardless of value: **remove it from settings**. It cannot register a router or change main selection. No replacement main-enable switch exists. Authentication keys (including `TYPESAFE_API_KEY`) and unrelated environment settings are unchanged.

Omitted tiers remain unconfigured and must be supplied before an applicable ordinary worker launch. Malformed applicable mappings fail with the field name, never select a substitute. Main-only operation and inapplicable workers do not validate unused tiers. Every applicable target must resolve exactly to an authenticated physical Pi registry model; virtual/unknown/unauthenticated targets fail actionably. Mappings may be identical; the first slash separates provider from model ID, which may itself contain slashes. Worker tier policy and custom slots remain independent of main selection.

The [removal matrix](docs/testing/main-routing-removal-matrix.md) distinguishes retired virtual-dispatch acceptance from retained physical ownership/lifecycle behavior. Historical ticket02/ticket08 and unfinished JSON main-router checkpoint reports are not current installation guidance or evidence that removed capabilities still exist.

## Match installed skills

Matching is **on by default**, independently of effort and worker routing. The effective main-session catalog comes from public `pi.getCommands()` skill resources and their `sourceInfo.path`, not a parallel directory scan. Unreadable resources and `disable-model-invocation: true` skills are excluded. Pi's own resource/package filters, collision resolution and reload behavior remain authoritative. Explicit `/skill:name` commands, blank input and plain continuations do not trigger matching. Skill-only classification works with effort disabled or a non-reasoning physical model. Zero applicable questions means zero classifier HTTP, even with unused invalid System One configuration.

The ordinary unbatched path combines the skill `which` choice and three gate nouls with applicable effort/risk/tier questions in **one System One request**. Criteria include each eligible description and the first **300 body characters**, never the whole resource. `(none)` is an explicit ordinary choice. A probability of at least **.5** selects a batch leader regardless of the action gate; otherwise both fit **.3** and the oriented gate mean **.3** are required. Missing confidence cannot make an ordinary pick. These are pinned upstream rules, not a new ranking heuristic.

A choice supports at most **255 options**. Catalogs use near-equal batches of at most **254 skills**, reserving the none slot; only the first batch carries effort/advice and gate questions. No candidate is dropped. Ordinary no-rerank selection compares qualifying batch leaders. With `JEV_SKILL_RERANK=true`, the first pass sends descriptions only (no none choice), then rereads the top **three per batch**, capped at 255, with 300-character excerpts. The first gate can skip rerank; the chosen rerank candidate must itself fit at least **.3**. Every candidate can be rejected. A failed/malformed batch or failed rerank yields no skill, not an older selection or another backend.

A selected skill's full body is attached to its originating user **only in the supported `context` projection**. Its directory is supplied for relative references. The persisted user's content, role and timestamp remain unchanged; a branch-owned `jev-pilot:skill` custom entry stores the selected resource snapshot and originating UUID for reload/resume. This entry contains skill text, not a decision ledger or captured user prompt. Repeated identical visible instructions get a short already-loaded reference rather than duplicate bodies, including a preceding native `/skill:name` load whose complete resource name, path, directory and body match exactly. A changed body or a different resource still loads in full. If compaction removes them, a fresh selection can load them again. None/rejected selections do not attach an older skill to a new user; earlier visible instructions remain historical context.

**Host difference:** this package does not suppress Pi's skill catalog, rename/hide skill files, change resource settings, or claim that other skills are unavailable. Pi's normal catalog remains in the system prompt. Selected instructions really reach the provider, but this is guidance, not exclusive tool/skill enforcement. Claude-specific path substitutions and the upstream Skill tool are replaced by Pi's resource directory convention. No independent worker-session matcher is registered.

Main matching runs at the existing user `message_start` boundary; it never classifies again in `context`. A trailing continuation does not steal the substantive queued input's selection. Tool continuations and retries reuse the visible content without additional matching. Cancellation, manual selection changes and session/branch invalidation discard pending selections; timeout aborts the HTTP request and allows ordinary physical generation without skill injection.

**Version-tested ownership expansion:** skill projection reuses ticket 01's single `jevPilotInputId` seam. The supervisor approved this within official **Pi 1.4.0**, not as a documented arbitrary-user-metadata guarantee. Missing/stripped identity means no injection for that user, including after an older valid selection; there is no older-skill fallback. Actual CLI tests include a second extension stripping newer identities. Revalidate metadata serialization, hook identity, context ordering, native explicit skill expansion and provider conversion on host/provider upgrades. Unsupported composition may lose matching fidelity rather than guess ownership.

## Receive strategy and quality advice

Both guidance switches default to **true**, independently of effort, skills and worker routing. Applicable questions join the same first System One request, never a second ordinary guidance call. Blank/command-like input and plain continuations do not request new guidance. Disabling all applicable consumers produces zero HTTP, including with unused invalid backend settings.

Strategy asks for `direct`, `delegate`, `parallel` or `graph` plus the raw task tier used by upstream advice gates. A physical selection is **not routed** by this advice-tier answer and needs no configured tier mappings. Direct adds no strategy block. Other advice needs confidence **.6**, except graph **.8**; parallel rejects raw fast, and graph requires raw deep. These gates use the classifier's raw tier, never main-model dispatch. A partial raw-tier probability distribution can support advice; independently valid advice can appear while malformed effort answers retain the current thinking baseline. Junior is additionally offered only with an eligible configured crew slot; see the custom crew section below. Unknown or malformed optional reads do not fabricate advice.

Quality asks four nouls: ambiguity (`underspecified`, **.85**), bugfix (**.8**), costly/sensitive code (**.8**) and correction (`corrects`, **.7**). The first three can attach concise upstream `<jev_quality>` checks. Correction is read but does not invent a fourth advice line, correction ledger, tuning or escalation. These are suggestions, not proof of quality improvement or mandatory procedural review gates.

`<execution_strategy>` and `<jev_quality>` enter only the originating user's request-local context projection. A branch-owned `jev-pilot:advice` entry stores the block and the same originating UUID used by effort/skills, never a competing ID or a persisted-user-content rewrite. Missing/stripped metadata fails closed without attaching an older block to a newer user. Earlier owned blocks remain historical context; removed/compacted users cannot resurrect them. This expands the **version-tested Pi 1.4.0 ownership seam**, not a documented arbitrary metadata guarantee. Revalidate on upgrades and extension composition changes.

Strategy is **advice, not execution authority**: user/project delegation constraints take precedence. No worker is invoked, no model/effort pin is granted, and no permission is inferred by parsing instructions. The graph's upstream read-only check is conditional strategy advice, not a mandatory external-review engine. Permitted workflow-script inner agents retain model-selection guidance (configured fast for lookup/report, balanced for specified implementation, workflow default for judgment); this package does **not** transparently intercept them. Ordinary direct/async worker routing is described below.

Public Pi `tool_result` outcomes observe top-level built-in `edit`/`write` by path and failed `bash` commands. The fourth same-file modification or third same normalized failed command attaches the common upstream step-back note once per user work period. A successful instance resets that command's failure counter; new user input/session/branch work resets observations. Tool input/result text is not sent to System One. Loop observation creates no classifier request, model switch, thinking write or dispatch. The tool-result annotation persists with that result, without altering user content. Nested tools, custom wrappers and instruction enforcement are not universally monitored. Host difference: upstream's Claude-specific high-effort/Fable tail is omitted; no substitute model suggestion or mid-turn escalation is added.

## Receive the upstream design pack

Design advice is **on by default**, independently of ordinary skill matching, effort and worker routing. Eligible input adds the original `ui_design` noul to the same initial System One request, only in the first skill batch and never the optional rerank. A finite probability **at least .8** attaches `<jev_design>`; missing/malformed answers, non-design work and purely wiring UI bugs do not. This is the classifier's read, not a local keyword detector or a guarantee of design quality.

The pack names only configured design skills present in Pi's effective public resource catalog and readable with model invocation enabled. Names match exactly first, then the upstream `:name` suffix using catalog order; no Pi aliases or separate filesystem discovery are invented. Defaults are the upstream `design-taste-frontend`, `impeccable` and `web-design-guidelines`, not similarly named local alternatives. `JEV_SKILLS_ENABLED=false` disables ordinary matching, not design advice. The design pack can reference several resources independently of the **one ordinary selected skill**; it does not inject their full bodies.

The project's existing design system/tokens take priority. Only if absent does the pack suggest the original [awesome-design-md references](https://github.com/VoltAgent/awesome-design-md/tree/main/design-md) or connected reference libraries. The port does not fetch a DESIGN.md, create assets, call tools, write models/settings or launch workers automatically. User/project instructions remain authoritative.

**Pi substitutions:** there is no invented Claude Skill tool. A resource reference includes its exact catalog file path with `read` only when public `pi.getActiveTools()` declares `read`; otherwise it merely names the installed resource. Mobbin/Inspo guidance appears only for active tool names with upstream `mcp__mobbin__`/`mcp__inspo__` prefixes and lists those exact names. Prefix recognition does not prove a particular search operation, schema or argument contract; consult the available tool schemas. Registered but inactive tools are not advertised by this pack. Other library names are not guessed.

The pack shares `jev-pilot:advice` context projection and the same existing input UUID, including queued requests. It never rewrites persisted user content or attaches old guidance to a newer unidentified user. This remains a **version-tested Pi 1.4.0 ownership dependency**, not a documented arbitrary metadata guarantee. Reload/resume/fork keep only included owners; compacted/removed owners cannot resurrect advice. Cancellation/manual selection discard pending packs; timeout aborts classification and fail-opens without new guidance. Independently valid design advice may survive effort schema rejection, but cannot change its status or retained thinking. Pi's normal catalog is not suppressed and guidance is not exclusive enforcement.

## Understand effort decisions

Installing/enabling auto-effort authorizes Jev to choose over default/current session thinking under the pinned upstream policy. A named current level, including a startup selection, is **not a persistent user pin**. A manual model/thinking change during an outstanding classification aborts/discards that stale result without a late effort write; it does not lock future eligible prompts. Before the first eligible decision, startup/reload does not invent effort.

Only enabled, applicable questions run. Effort is inapplicable when selected model metadata is non-reasoning or offers only one supported thinking level; a reasoning model currently set to `off` is still eligible. Disabled/inapplicable effort creates no effort state or setter writes, but eligible skills can still contribute questions. Empty input, explicit skill commands and command-like input skip classification. On the physical path, effort and risk share the applicable skill/guidance request; tier is asked only for enabled strategy gates, never unused physical routing. No extra ownership or lock mode is introduced.

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

## Ordinary workers — incomplete checkpoint

`JEV_WORKER_ROUTING_ENABLED` defaults to `true` and accepts only `true`/`false`. Ordinary direct/async `subagent` calls require configured authenticated `jevPilot.tiers` physical identities. Enable the exact tested fork executor separately with official Pi:

```bash
pi install git:github.com/naicoi92/pi-subagents@5f8adccb235f1a45858c84b5110c105108947de2
```

The runtime dependency uses the same immutable Git commit; importing its public adapter exports does not enable its tools. Keep **one physical executor owner**: do not also enable an upstream npm executor or another checkout. The fork tree is `7201b00488f688479241a4e44be9b42e6a403a0e`; its manifest version `0.80.0` is only a source label, not upstream npm identity. This pairing uses official Pi 1.4.0, not a universal host guarantee. No npm publication or GitHub Release is required for this verified Git installation route.

One worker decision uses only bounded brief, agent type and available caller description, not parent history. A valid decision may overwrite a supplied model and configured agent thinking (max/low→medium). Requested effort is clamped against the final physical target. Disabled/error/timeout retain the original envelope; parent cancellation stops applicable work. Fork calls bypass routing, reviewer/junior paths retain specialized slots, and workflow inner launches remain advice-based.

The adapter delivers a static child-only helper through the public required-child-extension API to prevent inherited main hooks from classifying the child again. That API supports only one registration owner per session. If another host already owns it, the adapter fails actionably before worker decision/mutation/launch without changing that registration. **Coexistence is unresolved; ticket06 is not accepted or complete.** No local-only restriction or undocumented transport is used. See [checkpoint evidence](docs/testing/ticket-06-production-checkpoint.md) and [matrix](docs/testing/ticket-06-matrix.md).

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

See the [design-pack matrix](docs/testing/ticket-05-matrix.md), [design-pack evidence](docs/testing/ticket-05-validation.md), [strategy/quality matrix](docs/testing/ticket-04-matrix.md), [strategy/quality evidence](docs/testing/ticket-04-validation.md), [skill matching matrix](docs/testing/ticket-03-matrix.md), [skill matching evidence](docs/testing/ticket-03-validation.md), [effort AC-to-test matrix](docs/testing/ticket-01-matrix.md), [historical main-routing matrix](docs/testing/ticket-02-matrix.md), [historical main-routing evidence](docs/testing/ticket-02-validation.md), [compatibility evidence](docs/testing/ticket-01-validation.md), and [MIT attribution](NOTICE.md). Local fixtures verify host behavior, not hosted Jev availability, real-provider compatibility or routing quality.

## Configure custom slots and junior-lead

Set `JEV_CREW_CONFIG` to a persistent JSON file. Relative paths resolve against the current Pi working directory; the package never writes this file. Absence means `standard` with no slots. Each eligible main decision or worker launch reads one snapshot. Reload/restart after changing crew membership so the installed executor can refresh its registered junior.

```json
{
  "mode": "junior-lead",
  "slots": [
    { "name": "alpha", "model": "provider/bulk-model" },
    {
      "name": "coder",
      "model": "other-provider/coding-model",
      "when": "Well-specified work with an exact check."
    }
  ],
  "junior": "coder"
}
```

Only `mode`, `slots`, `junior` are allowed; mode defaults to `standard`, slots to `[]`. Only `name`, `model`, optional `when` are allowed within slots. Names match `^[a-z][a-z0-9-]{0,23}$`, must be unique, and cannot be the pinned command/feature words: `effort raise subagents skills strategy quality design model pet all reset status mode models crew junior reviewer tune remove delete on off help list default set when`. At most **eight** slots are accepted. Missing or blank `when` uses the original **read-only bulk work, never writing/changing code** description. A description is not permission. Models require exact qualified physical registry identities without a thinking suffix. Malformed files/types, unknown fields, excess slots or an explicitly unknown junior name are actionable errors, not silent mode resets. Eligible targets and authentication are validated without health requests, probes or fallback workers.

`standard` offers only fast/balanced/deep. `budget` and `junior-lead` offer custom slots **instead of fast**, retaining balanced/deep. Custom selection requires confidence **.6**; risk **strictly greater than .7 forces deep and cannot be overwritten by a custom slot**, the approved ticket-07 correction. Valid ordinary Jev selections override caller model and configured worker effort as described above. The physical main model does not become a custom dispatch candidate.

Public names including `fast`, `balanced`, `deep` remain legal. Classifier keys use `slot::<name>` for every custom candidate to avoid collisions with the actual tier keys; returned keys map back to the configured names before policy/dispatch. Unknown keys fail open without guessing a target. Qualified model and `when` text are included in candidate descriptions sent to System One; do not put secrets there.

In `junior-lead`, `jev-pilot:junior` uses the explicitly configured junior slot, or the **first configured slot** when junior is omitted. No slots/noneligible mode retains the source's balanced specialized mapping, not a health-triggered fallback. The selected slot must resolve and authenticate; no arbitrary replacement worker is invented. Like pinned Jev's specialized branch, the named junior does not issue an ordinary worker classification and retains executor/default thinking; actual provider receipts determine its effective setting. The package registers its source-backed junior prompt/tools through the **installed fork executor's public owner event**; merely depending on that package does not activate its executor. Missing executor does not break main-only startup but blocks a requested configured junior actionably. Name collisions are errors, never overwrites of user agents. Repeated calls reuse the owned handle; session exit/reload disposes it. The junior definition declares the mandatory helper through public per-agent `requiredExtensions`; an effective ceiling denying it rejects the launch before junior provider activity instead of silently removing the bound. Ordinary siblings do not acquire this requirement. The upstream `maxTurns: 40` is enforced through a junior-only Pi extension (including direct, async and workflow-inner launches), not a timeout/tool budget or an unsupported runtime-definition field. One assistant agent turn is reserved at public `turn_start`, before generation; errors/cancellation consume that reservation, multiple tools do not consume extra turns, and a denied synthetic abort consumes none. A natural answer at turn 40 may complete; otherwise the child stops with an explicit limit error before further provider/tool activity. Session custom entries preserve the owned budget across retained resume, reload and compaction; a fresh independent child session starts a new budget. Partial output and tool history remain in the child session/transcript; abort telemetry can include a synthetic error turn beyond the 40 reserved turns. The executor may still advertise the failed run as resumable, but resuming that retained session grants no extra turns. This public Pi adaptation does not claim equivalence to unavailable upstream runtime counting/termination internals.

Eligible strategy questions additionally offer `junior`; advice requires confidence .6, raw tier other than deep and risk at most .5. The lead receives the configured junior target, a self-contained brief recommendation and diff-review guidance. Workflow-script model selection remains **advice**, naming eligible custom models for permitted bulk work, balanced for specified implementation and the workflow default for judgment. No automatic dispatch, universal inner-launch interception, review authority, extra roles/tiers, external reviewers, health/failover or broad live controls are introduced.
