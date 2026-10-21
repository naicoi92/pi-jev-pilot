# 01: Run the Pi package with per-prompt effort routing

**What to build:** Install and load a minimal working Pi package, submit a prompt, classify it through configurable System One, and apply the upstream effort decision without switching the selected physical model. This slice delivers a complete effort-only user path, not standalone policy or transport scaffolding.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-01, AC-03, AC-04, AC-06, AC-08, AC-10, AC-11, AC-12, AC-13, AC-26. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Recheck the latest stable Pi contract and record the tested version; preserve upstream MIT attribution from the first imported behavior.
- [ ] Configure System One endpoint/auth/model with Jev as default and a configurable 1,500 ms deadline; credentials never enter logs or fixtures.
- [ ] Preserve upstream effort/confidence/risk/ceiling and approval-versus-continuation behavior using pinned upstream examples.
- [ ] Dispatch supported thinking only; expose requested/effective differences and leave global defaults unchanged.
- [ ] Capture minimized main payload with four-message/2,000-character defaults, tool names/signals/platform markers, without automatically sending tool inputs/results or file contents.
- [ ] Service/schema errors leave the valid current route unchanged; invalid configuration produces an actionable error rather than an invented route.
- [ ] Timeout aborts classification and allows fail-open; parent cancellation stops work without fallback generation.
- [ ] Exercise startup, reload/shutdown and session replacement ownership with deterministic offline fixtures.

## Verification

Run a real Pi CLI prompt with a deterministic local System One fixture and a local fake model provider; assert dispatched thinking, unchanged model, captured payload, cancellation and fault outcomes. Map policy cases to independent pinned upstream expectations.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments
