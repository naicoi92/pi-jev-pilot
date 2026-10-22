# 05: Attach the upstream design pack using available Pi resources

**What to build:** An eligible UI-design prompt receives the upstream design pack with installed design skills and available tool references, prioritizing the project design system.

**Blocked by:** 03: Match Pi skills in the combined classification request

**Status:** ready-for-agent
**Implementation:** completed

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-09, AC-17. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [x] Include the upstream design question in the shared initial classification rather than adding an unconditional extra call.
- [x] Preserve design probability gating and separation from ordinary single-skill matching.
- [x] Mention only installed configured design skills and actually available tools.
- [x] Prioritize the existing project design system and retain upstream reference guidance without automatically fetching assets or invoking tools.
- [x] Non-design and UI-bug fixtures do not receive inappropriate design instructions.

## Verification

Exercise Pi with disposable design systems, resource catalogs and available-tool combinations; assert model-visible guidance and shared-request behavior using pinned upstream positive/negative examples.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

Accepted at integration merge `9104782d03b114336cbc29021292fbdfc61f8da1`, exact candidate `ef49111af9ed4217c7c234eeaf228c841544a014`. Independent review: OK, no findings. Integration Oxc/Bun gates, 340 tests / 1,102 assertions, installed smoke and eight design/resource/tool/privacy/combined smokes pass. Official Pi 1.4.0 with local providers; metadata ownership remains version-tested, active tool prefixes do not prove live capabilities/schema or hosted quality. Interrupted separate worker E2E was not counted as pass; completed full suite includes actual installed CLI tests. See docs/testing/ticket-05-validation.md and retained review/merge artifacts.

