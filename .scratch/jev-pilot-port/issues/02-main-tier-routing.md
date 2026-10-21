# 02: Route main requests through configurable model tiers

**What to build:** Enable automatic main routing and observe the physical model selected from configured fast/balanced/deep mappings while preserving the selected-router versus dispatched-model distinction.

**Blocked by:** 01: Run the Pi package with per-prompt effort routing

**Status:** ready-for-agent

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-02, AC-03, AC-05, AC-06, AC-07, AC-13, AC-26. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Main-model routing remains off by default; enabling it uses supported Pi virtual-model APIs.
- [ ] Resolve qualified physical registry identities and configured authentication, including the same model mapped to multiple tiers; reject invalid targets without fuzzy substitution.
- [ ] Preserve upstream tier confidence/risk policy and explicit user selection semantics without writing global defaults.
- [ ] Map upstream requested effort to supported settings and expose the effective dispatch.
- [ ] Keep the applied route through tool continuation and ordinary retries without unnecessary classifier calls; do not add provider failover.
- [ ] Resume, fork/tree navigation, compaction and reload retain branch-local ownership rather than leaking another decision.

## Verification

Drive the installed extension through Pi CLI with distinct deterministic local model identities; assert selected and physical models, continuation/retry request counts, unsupported-effort behavior and branch/session isolation.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments
