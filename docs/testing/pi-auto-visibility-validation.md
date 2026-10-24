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

## Independent review correction: P1/P1/P2

Base candidate: `117969c00a559972762d169d3b772e858627c82b`, tree `98b40f8593b781fd11db12d44d559f535fb4d43d`. Matrix RC-1/2/3 recorded before regression tests. Corrections limited to worker adapter metadata, worker visibility, persisted invocation validation and their tests. No main routing, policy, executor, tool envelope, dependency, settings or installed-package changes. Installed `394f936` remains unchanged.

- **RC-1:** specialized replacement resets persisted requested/effective effort to `unknown`; caller `local/deep:high` no longer leaks discarded preview effort into suffix-free selected target. Tests inspect actual adapter-persisted decision entry for junior and codex-review, not only widget.
- **RC-2:** verified native single receipt sanitizes public `SingleResult.agent` into executor entry and live owner/widget. Historical plan stays unknown, same invocation retained. Six adapter cases cover runtime preflight miss and explicit fork, safe/unsafe verified identities, and unverified payload. `/jev status` reads executor identity from persisted rows. Workflow child evidence path remains independent.
- **RC-3:** canonical invocation sequence is positive decimal, 1–999999999, at most nine digits; schema and defensive restore use same bounded reader. Reject oversized 400-digit history, literal Infinity, near-MAX_SAFE values, zero and leading zero. Parent-approved exhaustion handling resets sequence to 1 and uses fresh UUID-backed 32-hex suffix for all subsequent labels, including after restore of rollover rows. Legacy six-hex labels unchanged before cap. Constant-size sequence/rollover state, no label-history Set; existing latest-12 restore bound unchanged. UUID uniqueness is probabilistic, ordinary UUID collision risk; labels are correlation only, not security authority. Regression persists two post-cap labels and a post-reload third through public append seam.

### Exact RED / GREEN

Logs: `/tmp/durable-visibility-corrections/`. RED ran against unchanged production candidate `117969c00a55` after adding matrix and regressions:

```sh
bun test tests/worker-visibility.test.ts tests/decision-visibility.test.ts
# red.log: exit 1; 42 pass, 9 fail, 183 assertions, 51 tests / 2 files
# Failures: RC-1 specialized; RC-2 verified-safe runtime + fork;
# RC-3 400 digits, both near-MAX_SAFE values, zero, leading zero, cap rollover.
# Literal Infinity already rejected before correction, remains passing control.
```

Post-correction same-command regression GREEN: **51 pass, 0 fail, 209 assertions** (`green-regressions.log`). Final affected slice, **78 unique tests / 8 files, 381 assertions, zero failures** (`green-focused-final.log`):

```sh
bun test tests/decision-visibility.test.ts tests/decision-visibility-cli.test.ts \
  tests/effort-visibility.test.ts tests/worker-visibility-state.test.ts \
  tests/worker-visibility.test.ts tests/main-routing.test.ts \
  tests/worker-visibility-cli.test.ts tests/worker-main-isolation.test.ts
bun run lint
bun run fmt:check
bun check
git diff --check
```

Added **13 tests** (six receipt cases, six malformed sequences, one rollover/reload); extended existing specialized test. RC coverage **3/3**. Smaller two-file slices and intermediate focused pass are overlapping checks, **not additional tests**. Initial typecheck caught fixture spread across `SessionEntry` union; fixture now uses existing typed entry factory, no runtime behavior change. Final typecheck checks **169 files**, clean. No full suite, paid inference, new PTY, install, push or deployment. Prior official-Pi + powerbar PTY remains prior evidence only; no both-host/Pi-Bolt verification claimed.

### Outcome mapping inspection / scope proof

Inspected actual production mappings, not only render enum fixtures: main summary mapping order is cancelled → timeout → error/invalid → reused → skipped → classified → kept; adapter passes structured outcomes for specialized, classifier timeout/error, kept and classified. Worker fallback maps blocked/cancelled, timeout/error, specialized/kept/executor-owned; verified receipt versus unconfirmed comes from native proof, workflow per-child proof stays independent. This correction changes no classifier request, outcome mapping, policy or main source. No extra classification added. `git diff 117969c00a55 -- src/extension.ts src/*policy.ts src/system-one.ts src/routing-settings.ts package.json bun.lock` is empty; adapter diff contains only requested/effective visibility metadata.

### Raw ANSI artifact privacy / byte identity

Independent full-byte read/hash comparison, including huge first lines; no raw content printed or rewritten. Bounded scan strips ANSI in memory, scans entire resulting text for credential-token, private-key, bearer-credential and email patterns; **zero findings**. Known task text matches synthetic fixture `Run deterministic worker.`; fixture uses isolated HOME, localhost, `fixture-not-a-credential`, synthetic agent/task. Operator checkout/powerbar paths remain (RED 13, GREEN 15 `/Users/...` occurrences); captures are not path-anonymized. This is bounded pattern/fixture review, **not exhaustive secrets certification**; parent secrets review remains required.

| Committed artifact                      | Bytes / first line bytes | SHA-256                                                            | External byte-identical source             |
| --------------------------------------- | ------------------------ | ------------------------------------------------------------------ | ------------------------------------------ |
| `pi-auto-visibility-evidence/red.raw`   | 72212 / 59427            | `7eb40dce5a7c62df632af7c05b96052ce8807991c441429db71a6402e0793e3f` | `/tmp/durable-visibility/red.raw`          |
| `pi-auto-visibility-evidence/green.raw` | 103608 / 85509           | `109c5d6633f9f962a2620d8c58515681a6276ab2e70cb50c374972905333fba5` | `/tmp/durable-visibility/green-final2.raw` |

Scan metadata: `/tmp/durable-visibility-corrections/artifact-scan.log`. No real credential/private prompt detected; original raw evidence untouched. Parent fresh independent correction review required before separate deployment gate.
