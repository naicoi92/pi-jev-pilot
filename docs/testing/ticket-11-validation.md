# Ticket 11 — acceptance validation record

Scope: final acceptance gate for the faithful port on branch `ticket/11-acceptance`, based on integration `8462915` (tickets 01–06, 08, 09, 10, 12). Matrix: [ticket-11-matrix.md](ticket-11-matrix.md). No release, remote repository, hosted request or paid model call was made, and **no live-provider E2E is claimed**.

## Environment

Official Pi `@earendil-works/pi-coding-agent` 1.4.0 (`@earendil-works/pi-ai` 1.4.0) run under Bun 1.4.4 on macOS; executor `pi-subagents` fork commit `5f8adccb235f1a45858c84b5110c105108947de2` (installed `package.json` version label `0.81.0`). Every Pi process used a disposable `HOME`, `PI_CODING_AGENT_DIR`, local loopback System One and OpenAI-compatible fixtures, `PI_OFFLINE=1` and `PI_TELEMETRY=0`. The only network access was Bun resolving the pinned public GitHub dependency/registry manifests, served from the Bun cache with `--prefer-offline`.

## Packaged-artifact path

1. `bun pm pack --destination <tmp>` produces `pi-jev-pilot-0.1.0.tgz` (72 files, ~0.84 MB unpacked).
2. A throwaway consumer project runs `bun add <tgz> --omit=peer --prefer-offline`. Result: `pi-jev-pilot`, the pinned `pi-subagents` and its transitive dependencies; **no** `@earendil-works/*` copy, so the host-provided packages come from Pi as the Pi package documentation requires.
3. `pi install <consumer>/node_modules/pi-jev-pilot` (normal package discovery; settings record the installed path) then the actual Pi CLI in RPC mode. Pi accepts a `.tgz` path only as a single extension file, so extracting through a package manager is the verified route.

## Results

| Command                                                          | Result                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run lint`                                                   | passed, 0 warnings                                                                                                                                                                                      |
| `bun run fmt:check`                                              | passed                                                                                                                                                                                                  |
| `bun run typecheck` (`bun check`)                                | passed, 180 files                                                                                                                                                                                       |
| `git diff --check`                                               | passed                                                                                                                                                                                                  |
| `bun test tests/package-acceptance.test.ts`                      | 19 tests passed after the matrix and this record existed (see below)                                                                                                                                    |
| `bun test tests/worker-routing-cli.test.ts -t "<six scenarios>"` | passed: WORKER-20 direct-max/async-max, WORKER-12 direct-cancel, WORKER-21 workflow-guidance, WORKER-19 junior-selected, WORKER-13 coexistence, each against a packed tarball and a real executor child |
| `bun test tests` (full suite, once)                              | 612 tests in 38 files, 4179 expect() calls, 1393 s: 611 passed, 1 failed (below)                                                                                                                        |

The single failure in the full run was `PKG-28-links`, which correctly reported that README linked this record before it existed. After adding `ticket-11-validation.md` and the matrix, that test and the whole acceptance file were re-run; the full suite was **not** repeated, so the final tree's only unrun-in-full delta is these two Markdown files and their formatting.

## Defects found and fixed by this gate

The integration base was not green: ten tests failed before any ticket 11 change. All were stale test expectations after later tickets, not product regressions:

- `tests/pi-cli.test.ts` (7: CLI-09a ×2, CLI-09b ×3, CLI-26p, CLI-26q) asserted that an inapplicable/disabled effort turn writes no `jev-pilot:*` entry. Since ticket 12 every turn also stores a visibility row `jev-pilot:decision:v1` (outcome `skipped`), which is display evidence and not effort/skill/advice state. The assertions now exclude exactly that type and keep checking the effort, application, restore, skill and advice entries.
- `tests/worker-adapter.test.ts` (WORKER-26 `model_select`, `thinking_level_select`): an invalidated pending plan is recorded as a durable `cancelled` plan row. The assertions still require no controls, no ownership and no entry other than that cancelled plan.
- `tests/routing-settings-host.test.ts`: the hand-written host stub lacked `registerEntryRenderer`, `registerCommand`, session and UI methods that ticket 09/12 code now calls.

Documentation fixes: the README still said the worker adapter was an "unaccepted checkpoint" and "ticket06 is not accepted", and gave the fork's manifest label as `0.80.0`. The tracker marks ticket 06 completed, and the installed fork's `package.json` at the pinned commit reads `0.81.0`; the README now states the unresolved single-owner coexistence as a limitation, uses the installed label and no longer carries internal ticket status. `PKG-28-compatibility` compares the README label with the installed manifest so this cannot drift silently.

## Findings left open

- The reserved agent names `jev-pilot:codex-review` / `jev-pilot:opencode-review` still map to the fast tier when a launch names them (see the matrix, "Scope observations"). Nothing registers or starts them. Removing them is a parent scope decision.
- Older validation records (`ticket-01` … `ticket-08`, `ticket-06-*`) keep their original `0.80.0` statements and virtual-routing results; they are historical and are not current guidance.

## Limits

No live-provider or hosted-System-One run, no other Pi version, no Pi-Bolt, no `pi install npm:`/`git:` of this package (unpublished, no remote), no offline install from an empty dependency cache, and no screen-reader/RTL/light-theme rendering check. Worker evidence directories written by the worker suite live under the system temp directory and are outside the repository.
