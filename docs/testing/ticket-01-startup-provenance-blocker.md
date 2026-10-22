# Historical ticket 01 blocker: startup thinking provenance

**Superseded by operator decision — not a current startup-provenance blocker.** Integration `38d02aaccf422463129c1942d7cd3f1c4bd86569` records that installing/enabling auto-effort authorizes policy-based selection over default/current thinking. Native startup priority is not a persistent effort lock. No host patch, opt-in/default-off mode, capability deferral or automatic native-intent detection is required. The historical RED below remains valid evidence against the old high-preservation requirement; it is **not claimed fixed** under that superseded requirement.

Current dispositions:

- `CLI-26l` retains the collision scenario but now asserts branch baseline medium after fork-before; a no-change decision dispatches medium. This is an explicitly changed acceptance expectation.
- `CLI-26j` now verifies included-owner high survives a re-applied unequal startup low; no equality-based heuristic remains.
- `CLI-26m` protects initial startup/reload before any eligible decision; `CLI-26n/o` protect manual model/thinking changes during outstanding classification and prove the next prompt can route again.
- The original excluded-owner branch and steering-all predecessor regressions remain required. See the current [matrix](ticket-01-matrix.md) and [validation](ticket-01-validation.md).

## Historical checkpoint (unchanged evidence)

The following status/options/expectations describe the earlier checkpoint, not current instructions or a pending host decision.

**Historical merge status: BLOCK.** The bounded re-review of candidate `917ec659422e05243d3eb66ab1d82f61f54c4bd6` confirmed both original ownership P1 scenarios resolved, but reproduced a distinct startup-override collision. This checkpoint adds a named **expected-failing regression**, not a fix or an accepted contract change. Implementation is stopped pending a parent/operator host/API decision.

The scope remains the official Pi 1.3.0 package boundary. No private state, built-in argv parsing, monkey patch, value-based provenance workaround, provider-specific payload patch, new feature, or changed precedence is authorized.

## Preserve all three invariants

The next solution must satisfy these together, not trade one passing test for another:

| Invariant                                         | Required observation                                                                                                                     | Existing regression                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| No explicit startup override                      | Fork before an excluded high-classified user restores its medium baseline; no-change classification dispatches medium                    | `CLI-26g`                                           |
| Explicit startup override, including equal values | Runtime replacement honors explicit startup high even when it equals excluded provisional high; no-change classification dispatches high | `CLI-26j` (unequal low), new `CLI-26l` (equal high) |
| Manual thinking on a retained tree prefix         | Tree navigation replays manual low on that prefix rather than excluded provisional high                                                  | `CLI-26h`                                           |

Keep `CLI-26i` fork-at ownership, `CLI-26k` orphan ownership, all six prior regressions, and the steering-all continuation fix (`CLI-08c`). Their acceptance is not weakened by this blocker.

## Reproduce the equality collision

Run the new regression through the actual installed official Pi CLI and local System One/model HTTP fixtures:

```bash
bun test tests/pi-cli.test.ts --test-name-pattern CLI-26l
```

The test's independent expected values come from the accepted re-review and the SDK's explicit-option precedence, not from extension restoration code:

1. Start Pi with explicit `--thinking high`; assert high.
2. Manually select medium through RPC; assert medium.
3. Submit a task classified high/.95. The provisional application has baseline medium and effective high.
4. Fork **before** its owning user. The replacement SDK selects the explicit startup high, equal to the transcript's last provisional high.
5. Submit an independent long task classified low/confidence 0, which cannot authorize a downgrade.
6. Assert restored state, captured next provider `reasoning_effort`, and retained effective decision are all **high**.

**Observed RED:** all three are **medium**. The current `restoreThinking()` equality check (`src/extension.ts:37–49`) mistakes equal values for provenance, overwrites the host's explicit selection, and persists the incorrect restore marker. The test is neither skipped nor marked as an expected failure in the runner; the full suite must report this failure until a valid solution is approved and implemented.

The unchanged parent repro is also available locally:

```bash
bun /tmp/pi-jev-ticket-01-review-917ec65/startup-equality-repro.ts
```

Worker capture: `/tmp/pi-jev-ticket-01-review-917ec65/worker-startup-equality-before.json`. The test failure is captured in `worker-equality-test-red.log` in the same directory. These local captures supplement the durable regression; they are not dependencies of the test suite.

## Released public API and source evidence

The following paths are from the installed, exact published `@earendil-works/pi-coding-agent` **1.3.0** package under `node_modules/`. They are read-only evidence, not files patched by this checkpoint.

| Published seam/source                                                                                | Exact evidence                                                                                                                                 | Consequence                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dist/core/sdk.js:121–143`                                                                           | Starts with `options.thinkingLevel`; restores transcript only when that option is undefined, then applies settings fallback and model clamping | Explicit startup selection outranks saved transcript. The extension must not silently reverse that priority.                                                                |
| `dist/core/sdk.js:253–258,291–301`                                                                   | Initializes `Agent` with the chosen thinking value; an existing transcript with a thinking entry gets no new provenance entry                  | No transcript record distinguishes an explicit startup option from an equal restored value.                                                                                 |
| `dist/core/extensions/types.d.ts:575–581`                                                            | `SessionStartEvent` provides `reason` and optional `previousSessionFile`                                                                       | Startup/fork/reload reason and previous path are not the source of thinking selection.                                                                                      |
| `dist/core/extensions/types.d.ts:233–234,1300–1305`                                                  | `ctx.thinkingLevel`, `pi.getThinkingLevel()`, and `pi.setThinkingLevel(level)` expose values and a session-local setter                        | No documented override-source field or no-persist setter option exists at the extension seam.                                                                               |
| `dist/core/extensions/runner.js:650–652`                                                             | Context thinking getter delegates to runtime `getThinkingLevel()`                                                                              | The context getter supplies the same effective value, not extra provenance.                                                                                                 |
| `dist/core/extensions/types.d.ts:892–896`; `dist/core/agent-session.js:2085–2103`                    | `ThinkingLevelSelectEvent` has only `level`/`previousLevel`; emitted only when `setThinkingLevel()` actually changes the value                 | It cannot identify an equal explicit startup choice. SDK initialization does not emit this selection event.                                                                 |
| `dist/main.js:676–693`                                                                               | Runtime creation passes `sessionOptions.thinkingLevel`; CLI override handling calls `setThinkingLevel(created.session.thinkingLevel)`          | The same-value call emits no change event and adds no source metadata.                                                                                                      |
| `dist/core/extensions/types.d.ts:1238–1248`                                                          | `registerFlag()` and `getFlag()` are documented for registered extension flags                                                                 | Reading a built-in CLI flag through `getFlag("thinking")` is not a supported provenance contract. Adding a new required extension flag would change the user/host contract. |
| `dist/core/extensions/types.d.ts:589–599,637–642`                                                    | Before-fork/switch and shutdown events provide target IDs, positions, reasons and paths                                                        | They do not supply the fixed startup option used by the replacement factory.                                                                                                |
| `dist/core/agent-session-runtime.js:102–126,219–231`; `dist/core/agent-session-runtime.d.ts:106–117` | Replacement tears down the current runtime and creates/rebinds a fresh one through the same factory                                            | Old extension-local state is not an authoritative source of the replacement host's explicit input.                                                                          |

The inspected API also exposes effective settings (`getSettings()`), but settings are not the source of a fixed CLI/SDK option. Comparing settings, initial values, recorded values, or later events would still infer provenance from values rather than obtain it.

## Why moving to another existing event is not an established solution

`dist/core/agent-session.js:752–768` awaits extension `message_end` handlers **before** appending the user message. Both user `message_start` and user `message_end` therefore place a session thinking change before its owning user entry. A fork-before retains that provisional entry.

`dist/core/agent-session.js:435–460` prepares the request using agent thinking state. `@earendil-works/pi-agent-core/dist/agent-loop.js:123–142` captures that request thinking before calling `streamAssistantResponse()`; its `:260–266` context transform calls the handler installed by `dist/core/sdk.js:278–282` later. Deferring the setter to `context` alone cannot change the effort already captured for the current request. `before_provider_request` exposes an opaque payload (`types.d.ts:693–696`), not a provider-neutral request thinking selection. Rewriting provider payloads would introduce an unapproved different seam.

There is no released extension event in the inspected Pi 1.3.0 contract that both follows user persistence and precedes provider-neutral thinking capture. No alternate supported solution satisfying all three invariants was established. This is a host-seam blocker under the current constraints, not permission to call equality provenance.

## Options for a parent/operator decision

No option below is implemented or approved by this checkpoint.

| Option                                           | Correct direction                                                                                                                                                                                    | Trade-off                                                                                                                                                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — wait for an official host seam (recommended) | Request documented startup thinking provenance, or a request-local effort / after-user-persistence-before-request hook; require the released host version that supplies it and rerun every invariant | Preserves standard CLI/SDK precedence and package portability; blocks this release until upstream support is available. A provenance API keeps current restoration logic possible; a request-local hook could avoid provisional persistence instead.        |
| B — approve an explicit host-contract adaptation | A host-owned SDK integration could communicate the original override with a documented, authoritative extension-visible signal; alternatively approve a new explicit user configuration contract     | Changes scope, installation/user behavior and supported-host claims. A wrapper or flag is not a transparent ordinary-package fix and must not masquerade as built-in CLI provenance. Requires a new approved seam and independent CLI/SDK acceptance cases. |
| C — retain BLOCK and defer the port              | Keep this diagnostic checkpoint and previously fixed behavior without merging or publishing ticket 01                                                                                                | No workaround, precedence change or hidden regression; delivers no accepted ticket 01 release until the host/API decision is made.                                                                                                                          |

Always trusting the host value would regress no-override fork restoration; always restoring the baseline would violate explicit override priority; keeping the equality heuristic leaves this P1. Those are not acceptable options under the current acceptance contract.

## Checkpoint validation

The named regression is intentionally RED. Lint, formatting and typecheck remain mandatory, but must not be represented as proof that the ticket is fixed. The earlier candidate's green results in `ticket-01-validation.md` remain historical.

| Checkpoint command                                          | Result                                                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`                                              | Pass, oxlint, no rule suppression/autofix                                                                                    |
| `bun run fmt:check`                                         | Pass, oxfmt, 14 authored files                                                                                               |
| `bun run typecheck`                                         | Pass, bun check, 7 TypeScript files                                                                                          |
| `bun test tests/pi-cli.test.ts --test-name-pattern CLI-26l` | **Expected RED:** 0 pass / 1 fail, exit 1; state, provider effort and retained effective decision are medium instead of high |
| `bun test`                                                  | **Not green:** 60 pass / 1 fail / 154 assertions, exit 1; only `CLI-26l` fails, all six previous regressions remain passing  |
| Original `branch-repro-no-thinking.ts`                      | Pass: fork state/provider and tree state/provider all medium                                                                 |
| Original `queue-repro.ts`                                   | Pass: efforts `[high, high, low]`                                                                                            |
| New `startup-equality-repro.ts`                             | Still reproduces the P1: startup high, manual medium, fork medium, next provider medium                                      |

Full-suite log and latest captures are under `/tmp/pi-jev-ticket-01-review-917ec65/`: `worker-blocked-full-tests.log`, `worker-branch-checkpoint.json`, `worker-queue-checkpoint.json`, and `worker-startup-equality-checkpoint.json`. The equality repro script prints observations and exits zero; the named regression above and the worker's explicit comparison establish the failing behavioral verdict.

No implementation source is changed by this checkpoint. The parent owns the next decision, independent review and integration acceptance.
