# 06: Route direct and async native subagents through Pi

**What to build:** A normal direct or asynchronous native subagent call reaches a real execution-package worker with the selected model and effort, allowing Jev policy to overwrite caller-supplied models while preserving cancellation. This ticket must resolve the remaining runtime adapter feasibility through executable evidence.

**Blocked by:** 01: Run the Pi package with per-prompt effort routing

**Status:** ready-for-agent
**Implementation:** completed

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-03, AC-06, AC-10, AC-12, AC-13, AC-20, AC-21, AC-26. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [x] Validate the exact external package/Pi versions and the supported tool-call mutation contract; start with source-researched pi-subagents 0.80.0, rechecking compatibility before committing to it.
- [x] Classify the worker brief/description/type without parent conversation history.
- [x] Resolve only baseline/applicability information required by routing through supported APIs; do not duplicate private precedence or impose generic discovery/provenance requirements without a concrete failing scenario.
- [x] Apply valid Jev model/effort selections even when the ordinary caller supplied a model; use the documented model suffix and verify direct/async child receipts. Configured worker effort, including max, must not veto valid Jev effort (medium means supported medium for max/low defaults). Disabled routing preserves input; timeout/error/cancellation retain their defined contracts.
- [x] Execute direct and async native workers and capture actual effective model/thinking and returned outcomes/usage.
- [x] Cancellation aborts classifier and worker work; lifecycle cleanup is idempotent and isolated to the correct run.
- [x] Characterize fork/specialized-agent exceptions and fail clearly for unsupported runners; no private monkey patches or dependency-cache edits.
- [x] Workflow inner launches remain advice-based as upstream; do not claim transparent routing.
- [x] If a required supported seam cannot satisfy ordinary routing, stop with exact failing contract evidence rather than silently substituting prompt advice.

## Verification

Run Pi CLI contract smokes with the real execution package and deterministic local model/System One fixtures. Assert child settings from actual receipts, direct/async precedence, malformed configuration, cancellation and cleanup. A source report or standalone suffix resolver check is insufficient completion.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

Accepted at integration merge `184c5e2a6154108a953af781e423f71911471914`, exact candidate `3702568de88ec9e88211a6d3d3133b5be414f359`, tree `873d59c75aaa311ea858ed446998546dd48f605f`. Independent production/follow-up reviews close F1–F5; final verdict OK. Integration Oxc/Bun gates, 396 tests / 1,881 assertions, installed smoke and six worker lifecycle/resume/fallback-cancellation smokes pass. Actual packed official Pi 1.4.0 / pi-subagents 0.80.0 local receipts verify model/effort overrides and direct/async execution. Profile projection, unknown effort-only retained runtime target and required-child singleton collision are actionable compatibility negatives, not successful routing or universal composition claims. No hosted-quality/remote-runner guarantee. Final evidence: retained ticket-06 merge and F5 review artifacts.

### Historical checkpoints — superseded, not current state

Implementation remained incomplete at the following checkpoints. Superseding checkpoint `31cbfb1589af81f9ca681fd5704f4c1ddcb65074` retires the blanket discovery blocker under the operator's caller-model overwrite authority and upstream caller-or-parent model baseline. The child-default-preserving transport gate was subsequently superseded by operator authority: Jev-selected worker effort replaces configured child thinking. Resume parent tool-call model/effort suffix implementation; no child decision transport or internal binding ENV is required for this discarded requirement. Child max/low baseline and hook delivery are observed, not production effort-routing verification. Six focused feasibility tests pass; production source is unchanged. Bounded transport review found no documented reader, but that research does not justify requiring a new API after the worker-effort clarification. No undocumented ENV exception or API proposal is approved.

Historical checkpoint: blocked on supported effective-executor discovery/provenance. Clean feasibility checkpoint `ddae716c2957154a1103217b680c6221e1391684` on the ticket branch is NOT an accepted implementation and is not merged. See that worktree's `docs/testing/ticket-06-contract-gap.md`. Official Pi 1.4.0 / pi-subagents 0.80.0 direct and async fixtures prove mutation/suffix execution; machine and runtime-registration fixtures expose preflight/executor mismatches. 344 passing tests characterize feasibility/gaps, not ticket completion. Production source is unchanged. Independent review confirms the two discovery gaps but not impossibility of ordinary native routing. Operator subsequently superseded caller-pin preservation: Jev may overwrite ordinary caller models. Reassess minimum required data under that authority before treating these gaps as blockers; no narrowed compatibility scope or required new API approved.

