# Subagent Adapter Feasibility

Research date: 2026-10-21. Exact published `pi-subagents@0.80.0` tarball inspected under a temporary directory; no installation, credentials, paid requests or dependency mutation. Source pin previously identified: `80f8f79d51ee8075fd39baf7fe8ff36b43c3a790`. Findings are source-verified, not Pi runtime/E2E-verified.

## Result

Main routing has a supported Pi virtual-model seam. Ordinary native subagent routing has a concrete supported candidate: Pi `tool_call` input mutation before pi-subagents executes, carrying model plus effort via its documented model suffix. Workflow-created agents do not require transparent interception for parity: pinned Jev Pilot README explicitly says they bypass the Agent hook and receive model-selection advice for script opts.model. Requiring an all-workflow resolver hook was an overconstraint introduced during research and is withdrawn. Ordinary direct/background runtime integration still needs a contract smoke; no existing universal before-spawn callback was established.

## Examined contracts

| Contract | What it proves | What it does not prove |
|---|---|---|
| `pi-subagents/delegation` | Structured foreground leaf launches, thinking/model config contract, exact cancellation tuple, returned usage/outcome | Transparent interception of arbitrary existing launches; background/workflow interception |
| `pi-subagents/preflight` / `resolveSubagentLaunchContract` | Preview effective launch model/thinking and constraints | A callback to replace defaults at all launch points |
| `pi-subagents/required-child-extensions` / `registerRequiredChildExtensions` | Required extension paths carried into native foreground/background/nested/recovered/workflow launches; can reject incompatible runners | Explicit-versus-inherited model provenance passed as a public routing hook, or replacement of the selected model at launch |
| Virtual-model support in configuration docs | Native child model verification accepts selected virtual identity while responses name physical targets | Automatic application to agents with their own physical model config, or routing of every existing workflow child |

Sources: [public extension API](https://github.com/nicobailon/pi-subagents/blob/80f8f79d51ee8075fd39baf7fe8ff36b43c3a790/docs/extension-api.md), [agents child-extension contract](https://github.com/nicobailon/pi-subagents/blob/80f8f79d51ee8075fd39baf7fe8ff36b43c3a790/docs/agents.md), [virtual model verification](https://github.com/nicobailon/pi-subagents/blob/80f8f79d51ee8075fd39baf7fe8ff36b43c3a790/docs/configuration.md).

## Resolution and execution trace

- `resolveEffectiveSubagentModel` uses explicit per-run model, then configured agent model, then in-memory parent model. `resolveModelOrigin` distinguishes explicit/configured/inherited internally. `resolveModelSelection` validates and enforces model scope; this is internal resolution, not a registered routing extension callback.
- Foreground execution resolves `options.modelOverride ?? agent.model`. Background execution separately uses the shared model resolver before starting its runner.
- Native child session creation loads required/declared extensions before resolving launch model and creating/binding the session. It then resolves `launch.model` through `resolveCliModel` and passes the resulting model/thinking to `createAgentSession`.
- Required extensions could register a virtual router in children. That gives a supported model dispatch seam WHEN the child selects that router. It does not by itself select it for every worker or expose whether the physical selection was an explicit caller override.
- Generic Pi tool-call mutation could handle an ordinary tool envelope but is not proof of coverage for workflow scripts calling their internal launch API. Do not claim all-launch parity on that basis.

Inspect corresponding pinned sources: `src/runs/shared/model-resolution`, `src/runs/foreground/execution`, `src/runs/background/async-execution`, `src/runs/shared/child-session`, and `src/shared/required-child-extensions`.

## Ordinary tool routing plan and checks

Pi 1.3.0 documents `tool_call` input mutation as supported, with later handlers receiving earlier mutations and no automatic post-mutation validation. The adapter must validate its own assigned arguments. pi-subagents 0.80.0 schema states dispatch ignores the top-level thinking field and requires `model: provider/id:level`; the executor uses params.model before agent configuration. Its `resolveEffectiveThinking` consumes the suffix before configured thinking. An offline check imported the exact published resolver and confirmed provider/coder:high overrides configured low, while provider/coder with configured medium resolves medium.

Therefore ordinary single/native launches can be classified at tool_call and assigned a validated qualified model suffix. Explicit model pins are visible in the original envelope and must be retained. For an explicit model without effort, attaching chosen supported effort requires preserving that model identity. For omitted model, full parity requires resolving the package's effective agent model without reimplementing private precedence; public get/preflight contracts must be exercised in the integration smoke. Agent-configured physical model versus caller override must not be conflated.

Coverage: ordinary direct and async tool envelopes are candidates; workflow-script inner launches retain upstream advice semantics, not runtime interception. Native launch cancellation and actual effective model receipts must be checked through Pi CLI before declaring completion. No replacement tool, private monkey patch or new execution engine is needed for the candidate ordinary seam.

Sources: Pi v1.3.0 extensions tool-call contract; pi-subagents published `src/extension/schemas.js` model/thinking descriptions, `src/runs/foreground/subagent-executor.js` runSinglePath, `src/shared/model-info.js` resolveEffectiveThinking; upstream README line 297 workflow behavior.

## Optional integration addition for stronger-than-upstream interception

A supported async model-selection callback at the shared resolved-launch boundary would receive brief, agent identity, explicit/configured/inherited provenance, parent/selected model, selected thinking, runner/context kind and cancellation signal. It would return a permitted model/thinking decision plus audit metadata before execution, leaving scope/ceiling validation, lifecycle and worker execution owned by pi-subagents. All direct and workflow launch paths must invoke it; explicit model precedence and abort propagation need contract tests.

This optional stronger integration is not required by pinned upstream workflow behavior. It is not an existing API and not authorization to patch dependency internals. A configuration-only alternative selects a child virtual router through defaults/agent overrides and required child extensions, but its coverage and override semantics differ from transparent upstream interception. It must not be silently substituted as full parity.

## Upstream risk/custom-slot precedence: characterization

Pinned Jev source `hooks/jev-model-router.ts:1137-1148` calls pure `route(...)`, then replaces the resulting model with a chosen slot if confidence meets the downgrade bar, unless the caller named a model.

An offline Bun check executed the real pure policy with: current Sonnet, fast/custom slot choice, confidence 0.9 and risky 0.95. Pure route returned Opus/high, forced by risk. Applying the exact subsequent slot-branch condition produced `jev-cheap`. This verifies the policy-composition discrepancy at source/characterization level, NOT an actual Claude hook E2E. Explicit caller model still wins in the ordinary path.

Source: [pinned upstream branch](https://github.com/Akramovic1/jev-pilot/blob/5d27135b34edf81b40c0bf1df01ae401f6b72ea7/hooks/jev-model-router.ts#L1130-L1149).

Changing risk precedence is a behavioral/safety correction, not mechanical porting. Keep this case visible and request approval before resolving it differently. Do not advertise a universal risk floor while reproducing that branch.

## Readiness

- Pure policy/main Pi integration: architecture researched sufficiently to specify and implement against verified contracts, subject to integration tests.
- Ordinary subagent routing: supported candidate seams identified; needs direct/async Pi contract smoke, effective-agent resolution, cancellation and receipt checks. No all-workflow interception blocker remains: workflows use advice as upstream.
- No live host integration, cancellation/usage accounting E2E or workflow routing smoke was run. No declaration of full adapter compatibility is warranted.
