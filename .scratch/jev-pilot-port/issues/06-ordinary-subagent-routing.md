# 06: Route direct and async native subagents through Pi

**What to build:** A normal direct or asynchronous native subagent call reaches a real execution-package worker with the selected model and effort, allowing Jev policy to overwrite caller-supplied models while preserving cancellation. This ticket must resolve the remaining runtime adapter feasibility through executable evidence.

**Blocked by:** 01: Run the Pi package with per-prompt effort routing

**Status:** ready-for-agent
**Implementation:** in-progress

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-03, AC-06, AC-10, AC-12, AC-13, AC-20, AC-21, AC-26. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Validate the exact external package/Pi versions and the supported tool-call mutation contract; start with source-researched pi-subagents 0.80.0, rechecking compatibility before committing to it.
- [ ] Classify the worker brief/description/type without parent conversation history.
- [ ] Resolve only baseline/applicability information required by routing through supported APIs; do not duplicate private precedence or impose generic discovery/provenance requirements without a concrete failing scenario.
- [ ] Apply valid Jev model/effort selections even when the ordinary caller supplied a model; use the documented model suffix and verify direct/async child receipts. Disabled routing preserves input; timeout/error/cancellation retain their defined contracts.
- [ ] Execute direct and async native workers and capture actual effective model/thinking and returned outcomes/usage.
- [ ] Cancellation aborts classifier and worker work; lifecycle cleanup is idempotent and isolated to the correct run.
- [ ] Characterize fork/specialized-agent exceptions and fail clearly for unsupported runners; no private monkey patches or dependency-cache edits.
- [ ] Workflow inner launches remain advice-based as upstream; do not claim transparent routing.
- [ ] If a required supported seam cannot satisfy ordinary routing, stop with exact failing contract evidence rather than silently substituting prompt advice.

## Verification

Run Pi CLI contract smokes with the real execution package and deterministic local model/System One fixtures. Assert child settings from actual receipts, direct/async precedence, malformed configuration, cancellation and cleanup. A source report or standalone suffix resolver check is insufficient completion.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

Implementation remains incomplete. Superseding checkpoint `31cbfb1589af81f9ca681fd5704f4c1ddcb65074` retires the blanket discovery blocker under the operator's caller-model overwrite authority and upstream caller-or-parent model baseline. The remaining concrete gate is transporting one parent classifier decision to the child's first-request hook through a supported run-scoped read contract. Child max/low baseline and hook delivery are observed, not production effort-routing verification. Six focused feasibility tests pass; production source is unchanged. A bounded transport-contract review is pending; no undocumented ENV exception or new API requirement is approved.

Historical checkpoint: blocked on supported effective-executor discovery/provenance. Clean feasibility checkpoint `ddae716c2957154a1103217b680c6221e1391684` on the ticket branch is NOT an accepted implementation and is not merged. See that worktree's `docs/testing/ticket-06-contract-gap.md`. Official Pi 1.4.0 / pi-subagents 0.80.0 direct and async fixtures prove mutation/suffix execution; machine and runtime-registration fixtures expose preflight/executor mismatches. 344 passing tests characterize feasibility/gaps, not ticket completion. Production source is unchanged. Independent review confirms the two discovery gaps but not impossibility of ordinary native routing. Operator subsequently superseded caller-pin preservation: Jev may overwrite ordinary caller models. Reassess minimum required data under that authority before treating these gaps as blockers; no narrowed compatibility scope or required new API approved.

