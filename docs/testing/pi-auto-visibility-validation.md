# Durable Jev visibility validation

## Scope and baseline

Isolated `fix/durable-visibility` worktree from `394f936500a1012e8c9b455ecf94a9fb2d32705c`, tree `830fbb96cfa29432d6c92ec71aa8a23a0e38b536`. Main, parent untracked research, installed package, global settings and executor unchanged. No inference outside deterministic localhost fixtures. No dependency installation/pin change, host patch, push, or full-suite run. Lifecycle investigation remains **paused**; two historic full REDs retained outside this correction, not rerun or reinterpreted.

Read project agent rules and tui-design/test-from-spec/coding-standards/diagnosing-bugs before matrix/tests. CodeGraph initialized/status/explored isolated checkout, synchronized after edits. Logs: `/tmp/durable-visibility/codegraph-{init,status,explore,sync}.log`.

## Public host contract

Read installed official Pi **1.4.0** `docs/extensions.md`, `docs/tui.md`, relevant exported extension types and hello/todo examples. `EntryRenderer(entry, { expanded }, theme)` and `appendEntry`/`registerEntryRenderer` are public. Host source inspection confirms append emits `entry_appended`; interactive mode renders a `CustomEntryComponent` immediately and again from retained branch history. Production extension uses only public APIs. No `sendMessage`, model-context diagnostic, private render call, session-file rewrite, custom footer, or powerbar change.

Pinned pi-auto `6c60ab37debc96ae48e1ca0957e777c2b3ebacc8` remains reference only. Re-read pinned index/selection renderer: same transient widget → append custom entry → collapsed/expanded renderer pattern. This pattern coexists with powerbar because transcript rendering is separate from footer. **No pi-auto runtime control run claimed**. Installed powerbar source `src/powerbar/index.ts:174–181` replaces footer with `render() => []`, hiding `setStatus` text, not custom entries or independent worker widgets. This is not a pi-auto incompatibility.

## Actual official PTY RED → GREEN

Bun driver + `uv run --offline --no-project python`, official Node CLI 1.4.0, **installed powerbar extension loaded**, isolated HOME/agent settings composed from safe fixed values, exact local provider/classifier, native pinned worker executor. No real settings copied. PTY run uses 180×70 terminal; public Ctrl+O expansion and `/reload` exercised. No RPC output described as visual evidence.

Reproduce GREEN:

```sh
POWERBAR_EXTENSION=/Users/naicoi/.pi/agent/npm/node_modules/@juanibiapina/pi-powerbar/src/powerbar/index.ts \
EVIDENCE=/tmp/durable-visibility/recheck \
bun tests/fixtures/durable-visibility/pty.ts
```

Committed raw bytes, exit codes, safe request summaries and persisted decision rows: [evidence directory](pi-auto-visibility-evidence/). RED captured **before production code edits**. First throwaway harness attempt shadowed Python's `pty` module; renamed driver before accepted RED. First timing attempt sent input during startup; accepted RED waits six seconds. First GREEN reload screenshot missed main row outside 42-row viewport; expanded terminal to 70 rows, then main+worker both observed after public reload. Intermediate logs retained under `/tmp/durable-visibility/`.

| Check                                     | Accepted RED    | GREEN                       |
| ----------------------------------------- | --------------- | --------------------------- |
| Main transient pending                    | true            | true                        |
| Durable main conversation row             | **false**       | **true**                    |
| `/jev status` before first task           | **false**       | **true**                    |
| Independent worker pending widget         | **true**        | **true**                    |
| Durable named worker plan                 | **false**       | **true**                    |
| Native executor receipt visible           | true (widget)   | true (widget + durable row) |
| Main + worker durable after public reload | not implemented | true                        |
| Public expansion details                  | not implemented | true                        |
| Native CLI exit                           | 0               | 0                           |
| Driver assertion exit                     | **1**           | **0**                       |
| Classifier requests                       | **2**           | **2**                       |
| HTTP before startup status/task           | absent status   | **0**                       |

GREEN local main `local/parent`, effort `low → medium`; worker retained `local/configured` → selected `local/selected`, requested/effective `medium → medium`. Native receipt reports same selected/medium, same sanitized agent `receipt-worker` and generated label across plan/receipt. Pending main removed, conversation row retained. Footer hidden by unchanged installed powerbar. RED extra parent generation caused by unsupported `/jev status`; GREEN command never enters inference. Local receipt JSON proves exact targets, not a claim about hosted provider internals.

## Focused automated evidence

Final affected slice: **160 unique tests across 11 files**, no overlap double-counting. New tests: **26** (18 renderer/state tests + 8 official CLI tests). Tests trace to matrix ACs. Existing skill/context/native-skill/required-denied test files unmodified. Last smaller slice repeats 52 already-counted tests; not additional tests.

```sh
bun test tests/decision-visibility.test.ts tests/decision-visibility-cli.test.ts \
  tests/effort-visibility.test.ts tests/worker-visibility-state.test.ts \
  tests/worker-visibility.test.ts tests/main-routing.test.ts \
  tests/worker-visibility-cli.test.ts tests/worker-main-isolation.test.ts \
  tests/skill-effort-visibility.test.ts tests/skill-matching.test.ts tests/native-skill.test.ts
bun run lint
bun run fmt:check
bun check
```

New coverage: real public entry renderer collapse/expand (20-column wrapping); exact persisted-key validation and malformed-history rejection; status before turn with zero HTTP; safe HTTP503/deadline/cancel outcomes; UI rows excluded from model requests; reuse without extra classification; public reload/new/switch/fork/tree preservation without duplicate row writes; stale main/session suppression; two concurrent **same-agent** worker owners with different target/effort and out-of-order native receipts; async launch remains unconfirmed; workflow per-child executor receipts; bounded restore snapshots and invocation sequence restoration. Existing focused suites check policy/classification counts, direct/async native CLI receipts, sibling isolation and 12 retained / 4 visible widget bounds.

## Bounds, privacy and limitations

Each direct invocation creates one plan entry and at most one executor entry. No tool polling entry stream. Immutable append-only UI records do not expand the effort/reuse ledger. Status retains latest main plus at most 12 latest worker snapshots. Workflow results expose up to 12 per-child executor-only receipts when public `Details.results` supplies launch proof. Their inner plans remain executor-owned/unknown; async completion without native receipt stays unconfirmed. No dispatch/envelope/worker lifecycle behavior changed.

Persisted UI schema accepts only version/kind, validated model identity, enumerated effort/outcome, elapsed time, and worker agent/local invocation/stage/retained identity. Extra keys rejected, malformed entries ignored. Agent labels derive from successful public preflight catalog identity; before validation they remain unknown. Raw task, description, skill bodies, errors, arbitrary invocation IDs and run IDs never enter new UI records. Existing legacy policy-state entries are unchanged.

Official Pi is verified host. Pi-Bolt runtime/visual compatibility **not verified**; no own CLI or hosted/paid run attempted. Shared configuration needs same public renderer APIs. Narrow wrapping unit-tested; TERM=dumb, RTL, screen-reader and interactive resize not separately PTY-tested. Main meaning is Pi-selected identity, not server-resolved identity. Plan alone never claims actual child launch. Reviewer gate required before separate parent-managed deployment; installed 394f936 remains untouched.
