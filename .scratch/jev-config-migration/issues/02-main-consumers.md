# 02: Main consumers and effective status

Status: ready-for-agent
Implementation: pending

**Parent:** [Single-file Jev configuration](../spec.md)

**What to build:** Make skills, rerank, strategy, quality, design and decision recording use the same options snapshot as effort; show effective configuration accurately.

**Blocked by:** 01 — Single-file effort tracer.

**Traceability:** CFG-03, CFG-06, CFG-12, [approved contract](../plan.md).

## Acceptance criteria

- [ ] Each main consumer honors JSON toggles and list defaults/empty values; legacy option env cannot override migrated consumers.
- [ ] Delayed skill batches/rerank and observation/recording preserve the captured options despite file edits.
- [ ] Status agrees with execution and exposes no secret value; existing guidance/design/ledger privacy controls remain green.

## Verification and handoff

Before implementation, map each criterion to an observable test and record the RED command. Use the highest approved native/local-provider seam; parser tests alone are insufficient. Record GREEN commands, source SHA, artifacts and limits. Keep intermediate changes on the integration branch; do not deploy or alter personal settings. Each ticket needs independent review before completion.
