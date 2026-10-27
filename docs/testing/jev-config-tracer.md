# Single-file effort tracer (ticket 01)

This is an integration-only tracer, not a completed configuration cutover or a deployment guide. Tickets 02–04 still own other consumers. Do not install this intermediate revision into a personal profile.

## Shared boundary API

- `jevConfigPath()` uses public Pi `getAgentDir()` semantics: `PI_CODING_AGENT_DIR`, otherwise `~/.pi/agent`, then `jev-pilot.json`. No project or merged settings input.
- `loadJevConfig(): JevConfig` synchronously reads and strictly validates the complete approved version-1 schema. Missing file/fields use defaults. Explicit nulls, unsupported versions, unknown fields and invalid supplied fields reject, even when a feature is disabled. Errors name the file and known schema path, not supplied values. Unknown keys report their parent path because arbitrary keys may contain secrets.
- Returned options, classifier, design names, tiers, crew, slots and junior definitions are recursively immutable. Nothing is cached, written or created. An invalid new read never reuses an earlier configuration.
- `captureEffortAssessment(): EffortAssessment` captures `config` plus immutable effective `tuning` synchronously, before asynchronous main assessment work. Precedence is defaults → JSON `classifier.timeoutMs` base → existing learned overlay. Unreadable tuning retains existing base fallback behavior; invalid configuration does not.
- `systemOneConfig(assessment)` resolves exactly `assessment.config.classifier.apiKeyEnv` once while building a request configuration, after applicable questions are known. Missing/blank named credentials reject before transport. No implicit fallback. The secret is only in the request configuration, never the file snapshot. Main batches/rerank reuse this request configuration; neither options, tuning nor credentials are reread between those requests.
- Main physical effort, native skill effort and classifier requests receive an explicit captured assessment. Pending effort applications retain the owning eligibility decision; later edits cannot erase them. Restore boundaries read current options and report invalid files.
- Classifier transport uses `redirect: "manual"`. Redirects return a service error with a fixed actionable diagnostic. Location headers, response bodies, credentials and endpoint values are not echoed. Requests are never sent to a redirect target.

Remote HTTP endpoints remain operator-selectable. **HTTP sends credentials and request contents without transport encryption. Use HTTPS except for isolated trusted local tests.**

## Remaining reader ownership

These are intentionally unfinished migration seams, not release compatibility promises:

| Owner     | Remaining consumers                                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticket 02 | Main skills/rerank, strategy/quality/design flags and design names, inline main crew advice, recording toggle, status readers and bounded ignored-legacy diagnostics                                       |
| Ticket 03 | Worker adapter/registration/authority, tiers from effective Pi settings, external crew, worker effort toggle, no-argument legacy `systemOneConfig()`; executor timeout/admission and junior lifecycle work |
| Ticket 04 | No-argument `baseTunables()`/`effectiveTunables()`, tuning commands, proposals and base/overlay/effective display                                                                                          |
| Ticket 05 | Remove every legacy options reader, migrate remaining fixtures, run combined native and installed packed-artifact acceptance                                                                               |

`decideMain` requires an assessment argument: the main classifier cannot silently take the no-argument legacy worker path. `effectiveTunables(base)` accepts an explicit validated base; its no-argument form remains for the later tuning/worker migration. No executor dependency changed.

## Focused verification

The native suite runs `/bin/sh /Users/naicoi/.bun/bin/pi-bolt ...`: that installed entry is a shell wrapper without a shebang, so direct `spawn` returns `ENOEXEC`. The wrapper execs the actual native binary. This is not Bun running `node_modules/.../cli.js`.

The harness copies the existing verified `1.0.4` native cache into a disposable HOME, checks version `1.4.0 (Pi-Bolt 1.0.4, ...)`, uses a disposable custom or default agent directory, and loads this checkout explicitly with `-e`. It does not install the package, use personal settings, call paid providers or constitute packed-artifact acceptance. Local classifier/provider HTTP receipts are asserted in memory; optional evidence contains counts/models/efforts only, never keys or prompts.

`tests/main-config-native.test.ts` requires explicit `JEV_NATIVE_EXECUTABLE` and `JEV_NATIVE_CACHE` paths; missing paths fail at import rather than silently skip native coverage. `bun test tests` includes native suites and is not a portable non-native command. For the main native suite, opt in with a verified Pi-Bolt 1.0.4 shell launcher and its existing npm cache directory (containing `1.0.4/pi-bolt-<platform>-<variant>/pi`):

```sh
JEV_NATIVE_EXECUTABLE=/absolute/path/to/pi-bolt \
JEV_NATIVE_CACHE=/absolute/path/to/.pi-bolt/npm \
  bun test tests/main-config-native.test.ts
```

The main suite refuses a missing, non-regular or non-executable cached binary before running the launcher. Other native suites still use developer-specific paths and need their own verified environment; setting these variables does not make the full suite portable or prove full-suite success.

```sh
JEV_CONFIG_EVIDENCE_DIR=/absolute/path/outside/repo \
  bun test tests/config-native.test.ts tests/jev-config.test.ts
bun test tests/pi-cli.test.ts
bun test tests/decision-visibility-cli.test.ts tests/ledger-cli.test.ts tests/pi-cli-fixture.test.ts
bun run typecheck
bun run lint
bun run fmt:check
```

Other CLI fixture tests remain unmigrated until their owning tickets; do not claim their legacy-env cases pass against this tracer.

Missing-file/default native tests explicitly omit fixture configuration and leave the default credential absent, proving default selection without contacting the remote default endpoint. Invalid legacy environment values have a separate native test; the fixture never converts environment input into JSON. Loader tests provide supporting complete schema and immutability coverage, not substitutes for native proof.
