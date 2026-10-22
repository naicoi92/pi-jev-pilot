# 01: Run the Pi package with per-prompt effort routing

**What to build:** Install and load a minimal working Pi package, submit a prompt, classify it through configurable System One, and apply the upstream effort decision without switching the selected physical model. This slice delivers a complete effort-only user path, not standalone policy or transport scaffolding.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent
**Implementation:** completed

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-01, AC-03, AC-04, AC-06, AC-08, AC-10, AC-11, AC-12, AC-13, AC-26. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [x] Recheck the latest stable Pi contract and record the tested version; preserve upstream MIT attribution from the first imported behavior.
- [x] Configure System One endpoint/auth/model with Jev as default and a configurable 1,500 ms deadline; credentials never enter logs or fixtures.
- [x] Preserve upstream effort/confidence/risk/ceiling and approval-versus-continuation behavior using pinned upstream examples.
- [x] Dispatch supported thinking only; expose requested/effective differences and leave global defaults unchanged.
- [x] Capture minimized main payload with four-message/2,000-character defaults, tool names/signals/platform markers, without automatically sending tool inputs/results or file contents.
- [x] Service/schema errors leave the valid current route unchanged; invalid configuration produces an actionable error rather than an invented route.
- [x] Timeout aborts classification and allows fail-open; parent cancellation stops work without fallback generation.
- [x] Exercise startup, reload/shutdown and session replacement ownership with deterministic offline fixtures.

## Approved gating clarification

Read [decision-gating.md](../decision-gating.md) before further implementation. Operator clarified that installing/enabling auto-effort permits upstream-policy effort selection over default/current thinking; named thinking is not a persistent lock. Drop automatic-intent/startup-equality acceptance, not real branch ownership. Discard stale in-flight classifications after manual model/thinking changes. No applicable questions means zero classifier requests. Retain the effort-only vertical slice and original dependency graph; no extra opt-in/default-off, host patch or persistent lock. Candidate must be revised and independently accepted, including real timeout/cancel/privacy/ownership/queue tests.

## Verification

Run a real Pi CLI prompt with a deterministic local System One fixture and a local fake model provider; assert dispatched thinking, unchanged model, captured payload, cancellation and fault outcomes. Map policy cases to independent pinned upstream expectations.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

Accepted at integration merge `a2d7dfc09def16c12881e78f302f4f84bdd813e0`, candidate `f5bebfe252752b44f88e85e238b2c9a182990e13`. Independent review: Merge verdict OK. Parent candidate and merger integration checks: oxlint, oxfmt, bun check, full 80 tests / 255 assertions and install-only CLI smoke pass. Local fixture coverage, not hosted Jev/paid-provider verification. Tested official Pi 1.4.0; UUID message identity/persistence is a version-tested adapter dependency with fail-closed identity loss, not a documented arbitrary-metadata or universal-provider guarantee. Validation: docs/testing/ticket-01-validation.md; reviewer and merge receipts retained in session artifacts. No remote/release/publish.

