# Shared Jev status and assessment spinner regression

## Contract

One `jev-pilot` component owns Jev presentation above the editor. Worker visibility publishes its bounded recent rows into that component, not a separate widget or worker footer. The header retains effort, skill, strategy, activity, warnings and observed worker counts. Worker rows keep existing privacy and receipt rules: generic success and async completion do not confirm launch model/effort; a native receipt reports its target, not provider identity.

Only pending Jev assessments animate the spinner. Main generation, observed thinking/tools and worker execution may update text but cannot start its timer. Main choices retain their revision token. Each worker assessment gets a distinct cleanup identity, allowing overlapping assessments and making old cleanup harmless after a new assessment or session attachment. The existing authority lifecycle invokes an optional presentation callback and cleans it on abort and in `finally`; authority registration, policy, decisions and executor fences remain unchanged.

## Acceptance matrix

Source: explicit shared-status/spinner bug report. Public seams: rendered component, extension lifecycle/events and executor preparation. Expected values are the requested ON/OFF states, not recomputed from implementation.

| Criterion                                                            | Regression coverage                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Main assessment pending: ON                                          | `live-status.test.ts` LIVE-2; native main-assessment phase                                                    |
| Main streaming: OFF                                                  | LIVE-2, LIVE-7, LIVE-15; native main-stream phase                                                             |
| Worker execution: OFF                                                | LIVE-9; native worker-stream phase                                                                            |
| Worker assessment pending: ON                                        | `worker-visibility.test.ts` STATUS-4 through real public executor preparation; native worker-assessment phase |
| Errors, timeout, cancellation, session transitions: no stuck spinner | STATUS-5 worker lifecycle matrix; LIVE-12 timer cleanup; existing effort-visibility cancellation tests        |
| Old completion cannot clear newer pending work                       | STATUS-5 stale worker cleanup and concurrent main/worker assessments; existing main revision tests            |
| One Jev widget contains bounded worker details                       | UNIT-WV-pending, privacy/lifecycle/receipt tests; STATUS-6 narrow widths; native Jev widget-key observations  |
| Owner fix preserved                                                  | `worker-owner-reload-cli.test.ts`: actual foreground child after reload, missing/stale fail-closed controls   |

Worker-state and durable-decision test fixtures now consume the row callback instead of expecting a separate widget. Existing receipt/policy assertions remain.

## Reproduction

Reuse existing local dependencies without installation. Native fixture requires an existing direct Pi-Bolt binary; never use an npm first-run launcher. It creates an isolated HOME/settings/model file under the supplied evidence directory and serves deterministic classifier/provider responses on loopback. No real credentials, hosted inference, package install or personal settings are needed.

```sh
UV_OFFLINE=1 uv run --offline --no-project --python /usr/bin/python3 \
  tests/fixtures/jev-status-terminal.py "$PWD" /path/to/direct/pi-bin \
  /tmp/jev-status-regression/ui
```

The fixture holds four independent transport gates, records real component renders and actual PTY output, launches a real foreground child through the unchanged executor, then types interactive `/reload`. It asserts only Jev-prefixed widget keys: executor-owned fleet widgets are outside this contract. Artifacts include per-phase ANSI captures and rendered text, event log, fake request log and check summary. Deadlines and subprocess termination are bounded.

Owner proof can run without installation because its explicit `-e` extension list now sets `PiFixture.installPackage=false`. The fixture's default remains unchanged for existing package tests.

## Recorded evidence and limits

At candidate baseline `c595ac1`, native fixture reaches main streaming but fails the required OFF expectation; the old spinner remains ON. Four unit/integration RED→GREEN slices independently cover main spinner, shared worker rows, cleanup identity and real delayed worker assessment. Candidate native Pi-Bolt1.0.3 (Pi1.4.0, arm64, JIT off), 160×40 fullscreen, passes all six phase checks including actual child and interactive reload. Combined native RPC owner proof passes 21 assertions: reload changes owner generation, duplicate dependency paths share registry identity, actual low-effort child executes, missing/stale owner controls launch no child.

Evidence is stored outside the repository under `/tmp/jev-status-regression`. It proves native rendering through a real terminal transport plus component output, not human visual review or a full VT screen-emulator screenshot. Resize, alternate themes, accessibility and detached async process behavior were not newly exercised. Unit tests cover width bounds and existing async receipt limitations. Full install-heavy suite was not run. Baseline `routing-settings-host.test.ts` has an unchanged failure because its mock lacks `getSessionFile`; reproduced against unmodified `c595ac1` source. Independent review and later integration with owner API follow-up remain required.
