# 03: Match Pi skills in the combined classification request

**What to build:** A main user prompt discovers the eligible Pi skill catalog, shares classification with routing, and attaches at most one ordinary selected skill while leaving resources on disk intact.

**Blocked by:** 01: Run the Pi package with per-prompt effort routing

**Status:** ready-for-agent
**Implementation:** completed

**Parent:** Jev Pilot for Pi — Faithful Port (local feature spec).

**Spec acceptance criteria:** AC-09, AC-10, AC-14. The current parent spec and the operator-approved faithful-port scope are authoritative.

- [x] Preserve upstream skill eligibility, none option, confidence/gate policy and main-conversation scope.
- [x] Ordinary one-batch/no-rerank routing and skill questions share a request; standalone routing still works when there are no eligible skills.
- [x] Catalogs beyond upstream choice limits are batched without dropping candidates; optional rerank can reject every candidate.
- [x] Attach selected skill content or configured upstream-equivalent representation using supported Pi resource/context APIs.
- [x] Do not rename, hide or mutate skill files; do not advertise skill-list suppression unless actually supported and verified.
- [x] Only applicable skill metadata/excerpts enter classifier requests; preserve bounded conversation minimization.

## Verification

Use real Pi resource discovery with disposable skills and captured local classifier requests; verify none/selection, content visible to the model, batching/rerank call counts and unchanged resource files.

Before writing tests, map each test to exactly one parent acceptance criterion and an independent expected-value source. Tests and verification belong to this slice, not a later horizontal testing ticket.

## Comments

Accepted at integration merge `b9e80367fafb13fc3eef098c6c64a6adb8dd4e94`, candidate `b7bb0abbbcffc9ec47170a0ab80e8236366c2eb2`. Independent initial review and targeted duplicate-body follow-up: OK. Integration Oxc/Bun gates and 218 tests / 641 assertions pass; installed, selected-content and native-to-auto smokes pass. Tested official Pi 1.4.0 with local providers; UUID/native expansion/persistence are version-tested dependencies, not universal guarantees. Skill snapshots contain body in local session; catalog/files remain intact. See docs/testing/ticket-03-validation.md and retained review/merge artifacts.

