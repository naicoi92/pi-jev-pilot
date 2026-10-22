# Ticket 06 — bounded first-child-request effort checkpoint

**Incomplete; no production adapter.** This checkpoint follows operator model-override authority at integration `576dbc7` and model-baseline clarification `ca998b6`. It retires the earlier blanket discovery blocker, not the historical gap evidence. A separately demonstrated first-child-request effort transport remains unproven through supported public APIs.

## Minimum information audit

Pinned Jev Pilot 0.12.1 commit `5d27135b34edf81b40c0bf1df01ae401f6b72ea7` separates two boundaries:

- `hooks/jev-model-router.ts:1133–1137`: model policy uses `e.model ?? e.parentModel`. The supervisor approved this exact baseline under the new authority, without treating executor agent defaults as implicit pins. Parent fast, omitted call model, configured agent deep, classifier balanced/.45/risk0 selects balanced. Disabled/error/timeout leave the original envelope unchanged, so the executor retains deep in those cases. Owner-aware effective discovery is **not** needed merely to retrieve deep for this model-policy example.
- `hooks/jev-model-router.ts:651–671`: effort is settled at the child's first request, from the effort the execution engine built it with. The engine's unset effort is left unset. The `route(...)` result is retained for subsequent requests. This is not the parent's thinking level and is not determined by the caller-or-parent model rule.

The concrete remaining scenario is a runtime agent registered on the installed executor owner, ordinary call `model: "local/selected"` with no suffix, parent thinking medium, and runtime agent thinking either max or low. For the same hypothetical classifier decision medium/confidence .45/risk0, pinned policy keeps max (ceiling) but permits low→medium (upgrade threshold .3). A parent-level suffix applied before observing child effort would erase this distinction. Public preflight returns missing_agent for both registered instances, so it cannot supply that baseline for this concrete path.

## Actual official CLI evidence

Two additional source-named tests in `tests/worker-adapter-feasibility.test.ts` use official Pi 1.4.0, pi-subagents/preflight 0.80.0, Node v26.8.1 and Bun 1.4.3 in disposable allowlisted HOME/agent/runtime directories. No real credentials, paid provider, remote dispatch, harness implementation delegation, cache patch or private import is used.

The documented installed-owner event registers the runtime child. The call contains the same physical model and **no effort suffix mutation**. The test's required child extension is registered with `registerRequiredChildExtensions` without `requireForAllRunners`; its only action is recording public `ctx.model` and `ctx.thinkingLevel` at `before_provider_request`. It does not classify, transport a decision, set thinking or enforce local-only execution.

| Test                           | Public preflight | Child hook before provider | Actual provider / terminal receipt                                                                           |
| ------------------------------ | ---------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| WORKER-06-runtime-max-baseline | missing_agent    | local/selected, max        | selected / reasoning_effort max; local/selected:max, thinking max, exit0, output CHILD_RECEIPT_OK, usage10/4 |
| WORKER-06-runtime-low-baseline | missing_agent    | local/selected, low        | selected / reasoning_effort low; local/selected:low, thinking low, exit0, output CHILD_RECEIPT_OK, usage10/4 |

`bun test tests/worker-adapter-feasibility.test.ts -t WORKER-06-runtime`: **2 pass, 0 fail, 16 assertions** after hook instrumentation. Fixture directories: `pi-jev-worker-feasibility-L23Qru` and `pi-jev-worker-feasibility-uATOpS` under the system temp directory. Both include `trace.json`, `preflight.jsonl`, `result.jsonl`, `child-baseline.jsonl`, adapter and child-hook files.

These are **baseline and hook-delivery observations**, not medium-policy GREEN: neither max→max nor low→medium with one transported classifier decision has been executed. First-request policy persistence/retries, cancellation, async effort transport, machine applicability and production cleanup remain unverified.

Initial baseline-probe assertions failed because the generic compatible fixture exposed only high on its provider map, and the executor receipt includes the configured suffix. The fixture was corrected to explicitly declare max support (`thinkingLevelMap`) and assert its actual suffixed receipt; no host or dependency change was made.

## Bounded public transport cross-reference

The supervisor permitted one bounded public-reader audit and rejected treating an observed private environment variable as an approved interface. Audit result: a documented writer exists, but **no documented/exported child reader was established**.

All source references below are published pi-subagents 0.80.0 (`80f8f79d51ee8075fd39baf7fe8ff36b43c3a790`); reading private implementation is characterization only, never an import or transport implementation.

| Contract/source                                             | Exact finding                                                                                                                                                                                                                    |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/tool-reference.md:113`                                | `options.extensionBindings` is documented child-only namespaced JSON, native Pi only, bounded 16 namespaces/16KiB; external runners and retained resumes reject it. No reader API/environment name/access example is documented. |
| `docs/configuration.md:143`                                 | Only lists the extension-bindings feature gate.                                                                                                                                                                                  |
| `src/api/preflight.d.ts:44`                                 | Accepts extensionBindings as preflight input. No child reader.                                                                                                                                                                   |
| `package.json:61–125`, `src/api/*.d.ts`                     | Exported APIs include preflight, required child extensions, agents registration, shared-types, child-tool-plan and lifecycle surfaces. None exports a binding reader, environment-name constant or getter.                       |
| `src/runs/shared/extension-bindings.d.ts:1–16`              | Internal declaration names `PI_SUBAGENT_EXTENSION_BINDINGS`, JSON shape and encoder, but this module is not a public package export. A declaration in an internal path does not authorize reliance on it.                        |
| `src/runs/shared/child-launch.js:48–62,225`                 | Internal `childProcessEnv` encodes that environment variable; processEnv is added only for `input.host === "runner"`. This is not proof of documented direct/async reader parity.                                                |
| `src/runs/shared/child-session.js:113–136,437–442`          | Internal launch loading applies processEnv before extension loading; not a supported extension-side transport getter or a permission to mutate shared environment.                                                               |
| Official Pi 1.4.0 `dist/core/extensions/types.d.ts:213–253` | Public context has model/thinking/session APIs but no extensionBindings reader.                                                                                                                                                  |
| pi-subagents `docs/extension-api.md:168–170`                | Public event bus is process-local and cannot alone transport a decision to a detached async child.                                                                                                                               |

The numeric decision must be tied to the exact child/run, avoid prompt/credential/history leakage, survive direct and async execution, and be consumed idempotently at first request without clobbering the baseline. No per-run generated extension files, global environment mutation, private registry access, parent-thinking fallback, child reclassification or independent worker engine has been introduced to fake this seam.

Required-extension loading itself is supported and the local fixture confirms delivery. That does not create a numeric decision reader; it also does not establish saved-machine delivery. Missing machine metadata remains historical characterization, **not** authorization to exclude native machine calls or require local placement universally.

## Checkpoint validation

After documentation/test updates, the complete focused feasibility file passes: **6 tests, 0 failures, 48 assertions** (27.83 s). Final baseline fixture directories are `pi-jev-worker-feasibility-0f7lPf` (max) and `pi-jev-worker-feasibility-HXhSha` (low). `bun run lint`, `bun run typecheck` (19 files), `bun run fmt:check`, and `git diff --check` pass. No full suite was rerun during this bounded reassessment; the prior 344-test result remains historical, and the accepted 340-test baseline is unchanged in source. Production `src/` is unchanged.

## Next decision boundary

Model routing remains feasible through public tool-call mutation with the newly approved caller-or-parent baseline. The unresolved bounded issue is how one approved parent classifier decision reaches a child hook through a **supported run-scoped read contract** so effort can be applied to its true first-request baseline.

A public child-binding reader/access contract, or a separately explicit operator-approved version-pinned undocumented transport exception, would need to be decided before implementation. Neither is approved here. The supervisor required stopping production transport rather than silently relying on the internal environment variable. No claim is made that every ordinary native routing case is impossible, and no acceptance/scope reduction is proposed.
