# 06: Route direct and async native subagents through Pi

**What to build:** A normal direct or asynchronous native subagent call reaches a real execution-package worker with the selected model and effort, preserving deliberate model pins and cancellation. This ticket must resolve the remaining runtime adapter feasibility through executable evidence.

**Blocked by:** 01: Run the Pi package with per-prompt effort routing

**Status:** ready-for-agent

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-03, AC-06, AC-10, AC-12, AC-13, AC-20, AC-21, AC-26. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Validate the exact external package/Pi versions and the supported tool-call mutation contract; start with source-researched pi-subagents 0.80.0, rechecking compatibility before committing to it.
- [ ] Classify the worker brief/description/type without parent conversation history.
- [ ] Resolve the effective configured/inherited worker model through supported discovery/preflight APIs; do not duplicate private precedence or mistake agent configuration for an explicit caller pin.
- [ ] Preserve ordinary caller model pins; inject chosen supported effort using the documented model suffix without replacing the pinned physical identity.
- [ ] Execute direct and async native workers and capture actual effective model/thinking and returned outcomes/usage.
- [ ] Cancellation aborts classifier and worker work; lifecycle cleanup is idempotent and isolated to the correct run.
- [ ] Characterize fork/specialized-agent exceptions and fail clearly for unsupported runners; no private monkey patches or dependency-cache edits.
- [ ] Workflow inner launches remain advice-based as upstream; do not claim transparent routing.
- [ ] If a required supported seam cannot satisfy ordinary routing, stop with exact failing contract evidence rather than silently substituting prompt advice.

## Verification

Run Pi CLI contract smokes with the real execution package and deterministic local model/System One fixtures. Assert child settings from actual receipts, direct/async precedence, malformed configuration, cancellation and cleanup. A source report or standalone suffix resolver check is insufficient completion.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments
