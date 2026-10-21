# 05: Attach the upstream design pack using available Pi resources

**What to build:** An eligible UI-design prompt receives the upstream design pack with installed design skills and available tool references, prioritizing the project design system.

**Blocked by:** 03: Match Pi skills in the combined classification request

**Status:** ready-for-agent

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-09, AC-17. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [ ] Include the upstream design question in the shared initial classification rather than adding an unconditional extra call.
- [ ] Preserve design probability gating and separation from ordinary single-skill matching.
- [ ] Mention only installed configured design skills and actually available tools.
- [ ] Prioritize the existing project design system and retain upstream reference guidance without automatically fetching assets or invoking tools.
- [ ] Non-design and UI-bug fixtures do not receive inappropriate design instructions.

## Verification

Exercise Pi with disposable design systems, resource catalogs and available-tool combinations; assert model-visible guidance and shared-request behavior using pinned upstream positive/negative examples.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments
