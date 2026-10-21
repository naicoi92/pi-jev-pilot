# 08: Run custom model slots and junior-lead crew modes

**What to build:** Configure custom model slots, select standard/budget/junior-lead, and observe real workers/junior using the corresponding upstream candidate rules and slot mappings.

**Blocked by:** 04: Deliver upstream strategy and quality advice in Pi; 06: Route direct and async native subagents through Pi; 07: Record the risk versus custom-slot precedence decision

**Status:** ready-for-agent

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-02, AC-03, AC-13, AC-15, AC-18, AC-19, AC-20, AC-21, AC-27. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Validate upstream slot names/reserved names, a maximum of eight active slots, qualified targets and name/model/when configuration.
- [ ] Default when guidance remains read-only bulk work, never implicitly a code-writing permission.
- [ ] Standard offers no custom slots; budget/junior-lead offer eligible slots in place of fast while retaining balanced/deep.
- [ ] Custom choices follow original confidence policy and the explicitly recorded risk/slot decision from ticket 07.
- [ ] Named junior uses the configured slot or original first-slot default; invalid/unconfigured targets fail without health probes or fallback workers.
- [ ] Ordinary explicit pins and specialized junior semantics stay distinct; do not create a generic coder/reviewer role system.
- [ ] Eligible junior strategy and workflow scripts receive upstream-equivalent advice; advice does not dispatch workers or enforce a review gate.
- [ ] Provide only the minimal persistent slot/mode controls needed by included capabilities, not the excluded broad live-switch/statistics product.

## Verification

Through Pi CLI and the real adapter, compare classifier candidate payloads by mode, dispatch selected slots/junior and inspect worker receipts. Verify configuration limits, explicit override, invalid target behavior, workflow advice and absent health/fallback calls.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments
