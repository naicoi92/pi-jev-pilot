# 01: Single-file effort tracer

Status: ready-for-agent
Implementation: pending

**Parent:** [Single-file Jev configuration](../spec.md)

**What to build:** Make a real isolated CLI assessment use the global single-file source, effort toggle and classifier options, with exactly the named credential. Establish the shared immutable loader contract while preserving green integration defaults.

**Blocked by:** None (can start immediately).

**Traceability:** CFG-01, CFG-02, CFG-04, CFG-05, [approved contract](../plan.md).

## Acceptance criteria

- [ ] Actual custom/default agent-directory files control the outgoing localhost request; project and merged Pi settings cannot override the tracer.
- [ ] Missing fields/file use approved defaults; malformed/type/null/unknown/version diagnostics are actionable and secret-free.
- [ ] Named credential resolves exactly once per request, no implicit fallback; unused credential is not required.
- [ ] Endpoint validation and redirect rejection are verified with two local servers; no key/body reaches redirect target.

## Verification and handoff

Before implementation, map each criterion to an observable test and record the RED command. Use the highest approved native/local-provider seam; parser tests alone are insufficient. Record GREEN commands, source SHA, artifacts and limits. Keep intermediate changes on the integration branch; do not deploy or alter personal settings. Each ticket needs independent review before completion.
