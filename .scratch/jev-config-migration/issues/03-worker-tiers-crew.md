# 03: Worker tiers and inline crew

Status: ready-for-agent
Implementation: in-progress

**Parent:** [Single-file Jev configuration](../spec.md)

**What to build:** Launch ordinary and specialized workers using tiers and inline crew from the single-file snapshot, without merged settings or an external crew path.

**Blocked by:** 01 — Single-file effort tracer.

**Traceability:** CFG-01, CFG-06, CFG-08, CFG-12, [approved contract](../plan.md).

## Acceptance criteria

- [ ] Native preflight → authority → actual worker uses the same captured tiers/crew, preserving sparse expert/slot/fallback/clamp gates.
- [ ] Actual junior missing-effort assessment stays effort-only with fixed model; verified pair performs no assessment.
- [ ] Changed registered junior definition is detected and reload-required without mixing policy/definition or changing active commitments.
- [ ] Missing/stale owner, caller/parent comparison, cancellation and receipt controls remain fail-closed.

## Verification and handoff

Before implementation, map each criterion to an observable test and record the RED command. Use the highest approved native/local-provider seam; parser tests alone are insufficient. Record GREEN commands, source SHA, artifacts and limits. Keep intermediate changes on the integration branch; do not deploy or alter personal settings. Each ticket needs independent review before completion.

## Comments

### Boundary and test plan

Approved boundary: authority entry, not outer `tool_call`. Capture configuration and effective tuning synchronously before any target/classifier await. No correlation queue or executor-private registry.

Adapter gate mapping: enabled/automatic-main required-helper admission remains outer-envelope policy (refresh owned by 04); workflow, supported agent, owner readiness and fork checks remain adapter envelope gates; configured tier validation and offered-slot exact physical/auth validation move into authority preflight. Presentation, accepted capability, cancellation and receipts remain unchanged. Junior registered-definition ownership uses an ExtensionAPI-keyed local owner, not executor transport. Registration-time routing enablement and authority timeout remain explicit ticket04 acceptance obligations.

| Criterion | Test ID / public seam | Expected source |
| --- | --- | --- |
| AC-1 | WCFG-1 native localhost worker receives JSON tier despite conflicting settings; WCFG-snapshot delayed assessment | Plan snapshot/inline crew; authority-entry clarification |
| AC-2 | WCFG-2 native junior fixed model, missing effort; WCFG-verified zero assessment | Plan specialized exception |
| AC-3 | WCFG-3 native registered junior edit refuses pending definition before inference | Plan reload-required lifecycle |
| AC-4 | Existing public owner/comparison/bounds tests and native owner/cancel receipts | Existing fail-closed executor contract |

Initial RED: `bun test tests/worker-config-native.test.ts --test-name-pattern WCFG-1`. Durable logs: `/Users/naicoi/Projects/jev-config-migration-evidence/ticket03/`. Candidate only; no completion or deployment claim.

### Candidate evidence and approved boundary clarification

Source base `37e4616c79b19d1a253c7510188fae8cc1d16f8d` contains reviewed ticket01 merge `93745779ed1fbe6b0e4e4f1fe3cb445026cddbb5`; ancestry verified. Local Markdown only; no project-room operator thread. Implementation remains in-progress pending independent review, merge and integration verification.

The pinned executor does not expose originating toolCallId in its pre-commit authority request. Supervisor approved moving config-dependent preflight into authority entry, rather than inventing snapshot transport/correlation. Adapter retains registration-captured admission/helper eligibility and envelope/presentation/cancel mechanics; authority synchronously captures immutable config+tuning, checks registered junior and offered physical/auth targets, then awaits target/classifier work. Classifier credential is resolved lazily from exactly the named variable. No worker guidanceEnabled calls remain. No dependency, shared loader/classifier/tuning/fixture, main entrypoint or installed source edits.

Local junior owner WeakMap is keyed by ExtensionAPI instance. Metadata is published only after successful public agent registration; old registered definition is retained until explicit reload. Mismatch notifies once and refuses new policy before classifier/spawn. Active captured launches continue unchanged. This is local registration ownership, not executor registry access or worker snapshot transport.

| Criterion | Final proof | Result |
| --- | --- | --- |
| AC-1 | WCFG-1, WCFG-snapshot, WCFG-boundary (repair/invalid), WCFG-concurrent native/public preparations; adapter sparse expert/slots/fallback suite | PASS |
| AC-2 | WCFG-2, WCFG-verified; existing context native low/high/xhigh clamp and service-failure tests | PASS |
| AC-3 | WCFG-3 missing registration, registered-old edit/refuse/reload, active junior edit | PASS |
| AC-4 | Native owner reload/missing/stale fences, WCFG-cancel, public owner/comparison/bounds/status/receipt regressions | PASS |

Meaningful RED before production edits: `bun test tests/worker-config-native.test.ts --test-name-pattern WCFG-1` failed actual provider target assertion (expected JSON judgment, absent). `red-native.log`. Next slice WCFG-3 failed reload refusal (unknown-agent instead), `red-junior.log`. Initial missing-dependency harness failure was fixed with `bun install --frozen-lockfile`, not counted as RED.

GREEN commands/logs under `/Users/naicoi/Projects/jev-config-migration-evidence/ticket03/`:

- `JEV_WORKER_CONFIG_EVIDENCE_DIR=... bun test tests/worker-config-native.test.ts`: 10 pass / 0 fail before final concurrency addition, `green-native.log`; final concurrency test separately 1 pass / 0 fail, four assertions including two actual provider calls and two native launch receipts, `concurrent-native-green.log`. New file total 11 tests covered by these runs.
- `bun test tests/worker-authority-context-cli.test.ts`: 11 pass / 0 fail, `green-context-native.log`.
- `bun test tests/worker-owner-reload-cli.test.ts`: 1 pass / 0 fail, `green-owner-native.log`.
- `bun test tests/worker-authority-migration-cli.test.ts`: 4 pass / 0 fail, `green-migration-native.log`; named missing credential cannot use legacy key; invalid URL/model edited after outer gate reject at authority, service failure retains verified pair.
- Focused 13-file unit union (authority registration/bounds/comparison, crew junior/config/policy, adapter, routing host/scalar, status/renderer/visibility-state, executor pairing): 185 pass / 0 fail, 590 assertions, `green-units.log`.
- `bun run typecheck`, `bun run lint`, `bun run fmt:check`, `git diff --check`: PASS.

Executable is actual `/bin/sh /Users/naicoi/.bun/bin/pi-bolt`, `1.4.0 (Pi-Bolt 1.0.4, darwin-arm64, JIT off)`, disposable HOME/cache/profile, localhost classifier/provider, no paid calls or personal settings/install. Sanitized `worker-receipt-*.json` stores only counts, provider model/effort, credential equality boolean and receipt-presence flags. Supporting native owner log contains public generation/launch receipt. Executor pin remains `9f0dcee736e64db6ecc1cfcd87bb0eecac5fbf51`.

Failed extra workflow attempts are retained as evidence: named parallel resource defaults children to background, exceeding shared fixture prompt deadline; adding unsupported task fields rejects shape. Correct public scripted workflow `runs.all` with foreground child controls and bounded owned terminal wait passes. No production workaround or dependency edit. One initial regression command timed out at 60 seconds because unmigrated legacy fixture requests never reached localhost; migrated explicit JSON fixtures now pass.

Limits and next owners: ticket04 must reconcile next-boundary enable/disable owner/admission/required-child-helper and both authority/native timeout budgets; registration-captured eligibility is not CFG-07 acceptance. No dispose/re-register refresh shortcut. Ticket05 still owns broader legacy native/package fixture migration and packed acceptance; full suite not run. Five baseline rubric failures untouched, not filtered in these targeted files. No packaged/deployment/full-spec acceptance claimed. Independent reviewer required.
