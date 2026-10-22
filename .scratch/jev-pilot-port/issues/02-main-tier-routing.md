# 02: Route main requests through configurable model tiers

**What to build:** Enable automatic main routing and observe the physical model selected from configured fast/balanced/deep mappings while preserving the selected-router versus dispatched-model distinction.

**Blocked by:** 01: Run the Pi package with per-prompt effort routing

**Status:** ready-for-agent
**Implementation:** completed

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-02, AC-03, AC-05, AC-06, AC-07, AC-13, AC-26. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [x] Main-model routing remains off by default; enabling it uses supported Pi virtual-model APIs.
- [x] Resolve qualified physical registry identities and configured authentication, including the same model mapped to multiple tiers; reject invalid targets without fuzzy substitution.
- [x] Preserve upstream tier confidence/risk policy and explicit user selection semantics without writing global defaults.
- [x] Map upstream requested effort to supported settings and expose the effective dispatch.
- [x] Keep the applied route through tool continuation and ordinary retries without unnecessary classifier calls; do not add provider failover.
- [x] Resume, fork/tree navigation, compaction and reload retain branch-local ownership rather than leaking another decision.

## Verification

Drive the installed extension through Pi CLI with distinct deterministic local model identities; assert selected and physical models, continuation/retry request counts, unsupported-effort behavior and branch/session isolation.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

Accepted at integration merge `96c5dcbcb3897895021516aed1ab5b13e433bfa0`, exact candidate `d8845660883badf074fed6677793494acb1c9695`. Independent review: OK, no findings. Parent candidate and integration gates: Oxc/Bun checks, 142 tests / 394 assertions and installed physical/virtual-route smokes pass. Tested official Pi 1.4.0 with deterministic local providers; no hosted/paid-provider quality or availability claim. See docs/testing/ticket-02-validation.md and retained reviewer/merger artifacts.

