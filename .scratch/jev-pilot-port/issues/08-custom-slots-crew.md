# 08: Run custom model slots and junior-lead crew modes

**What to build:** Configure custom model slots, select standard/budget/junior-lead, and observe real workers/junior using the corresponding upstream candidate rules and slot mappings.

**Blocked by:** 04: Deliver upstream strategy and quality advice in Pi; 06: Route direct and async native subagents through Pi; 07: Record the risk versus custom-slot precedence decision

**Status:** ready-for-agent
**Implementation:** completed

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-02, AC-03, AC-13, AC-15, AC-18, AC-19, AC-20, AC-21, AC-27. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Validate upstream slot names/reserved names, a maximum of eight active slots, qualified targets and name/model/when configuration.
- [ ] Default when guidance remains read-only bulk work, never implicitly a code-writing permission.
- [ ] Standard offers no custom slots; budget/junior-lead offer eligible slots in place of fast while retaining balanced/deep.
- [ ] Custom choices follow original confidence policy and the explicitly recorded risk/slot decision from ticket 07.
- [ ] Named junior uses the configured slot or original first-slot default; invalid/unconfigured targets fail without health probes or fallback workers.
- [ ] Ordinary caller models do not bypass valid Jev selections; specialized junior semantics remain source-backed and distinct; do not create a generic coder/reviewer role system.
- [ ] Eligible junior strategy and workflow scripts receive upstream-equivalent advice; advice does not dispatch workers or enforce a review gate.
- [ ] Provide only the minimal persistent slot/mode controls needed by included capabilities, not the excluded broad live-switch/statistics product.

## Verification

Through Pi CLI and the real adapter, compare classifier candidate payloads by mode, dispatch selected slots/junior and inspect worker receipts. Verify configuration limits, Jev override of ordinary caller models, invalid target behavior, workflow advice and absent health/fallback calls.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

### Parent acceptance — 2026-10-23

Accepted after independent whole-feature Standards and Spec verdicts (both OK with notes, no issues found), exact-candidate merge and fresh integration verification. Candidate `c68c186dee9387b8b2d8c730c994c23644a841bb`; merge `fe4f2be6ea4f0080d372d09ef1c3cd02df3c335f`, parents `3991458e51cdb3f69aba2da0329112ff99f2eb40` and that candidate; identical tree `8793879a31821820901e4ecae3e306fd24cd3a52`. Candidate full: 458 pass / 0 fail / 2916 assertions. Integration full: 458 pass / 0 fail / 2900 assertions, actual exit0; 33/33 saved native terminal pairs valid, audit anomalies0. Frozen install, lint, format, typecheck and whitespace gates passed.

Evidence under parent-session subagent-artifacts/outputs: `0f4dd902-6309-4f52-a6ad-b51f18927f9c/ticket-08/final-integrated-review.task-{1,2}.md`; `85549847-2296-41fb-a7e9-4e6acf094276/ticket-08/p1-corrected-full-verification.md`; `53f62d62-3add-4d7e-9fbc-91040f5bba2f/ticket-08/merge.md`; `29c3f455-feb3-4f4f-9214-acf7c5a34dca/ticket-08/integration-full-verification.md`, with sibling raw evidence directories.

Both integrated P1s are closed: cancelled transitions preserve junior registration, and forced deep remains authoritative with omitted caller model. Historical full REDs, ownership reproduction, interrupted worker, intermediate harness failures and original pending-terminal fixtures remain retained, not rewritten as passes. Verification is bounded to official Pi1.4.0/Bun1.4.3/exact fork5f8adccb with deterministic localhost fixtures and one physical executor owner; no universal/live-provider/remote compatibility claim. Fork PR2 remains Draft; no publication or fork merge authorized.
