# 03: Worker tiers and inline crew

Status: ready-for-agent
Implementation: pending

**Parent:** [Single-file Jev configuration](../spec.md)

**What to build:** Launch ordinary and specialized workers using tiers and inline crew from the single-file snapshot, without merged settings or an external crew path.

**Blocked by:** 01 — Single-file effort tracer.

**Traceability:** CFG-01, CFG-06, CFG-08, CFG-12, [approved contract](../plan.md).

## Acceptance criteria

- [ ] Native preflight → authority → actual worker uses the same captured tiers/crew, preserving sparse expert/slot/fallback/clamp gates.
- [ ] Actual junior missing-effort assessment stays effort-only with fixed model; verified pair performs no assessment.
- [ ] Changed registered junior definition is detected and reload-required without mixing policy/definition or changing active commitments.
- [ ] Missing/stale owner, caller/parent comparison, cancellation and receipt controls remain fail-closed.

## Verification and handoff

Before implementation, map each criterion to an observable test and record the RED command. Use the highest approved native/local-provider seam; parser tests alone are insufficient. Record GREEN commands, source SHA, artifacts and limits. Keep intermediate changes on the integration branch; do not deploy or alter personal settings. Each ticket needs independent review before completion.
