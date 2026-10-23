# Distribution proposal: per-agent mandatory child extensions

Status: operator approved fork-first distribution and patches on the user-owned fork. Verified existing fork: https://github.com/naicoi92/pi-subagents, parent nicobailon/pi-subagents. The fork is the primary dependency source; an upstream PR is optional and not a roadmap blocker. Package publication remains a separate decision; do not impersonate upstream pi-subagents@0.80.0.

## Business outcome

Jev's named junior declares maxTurns:40. The local integration preserves its budget when admitted and rejects incompatible launches before provider activity when the required helper is denied. Ordinary siblings remain unaffected. Public installation still needs an available dependency artifact exposing the reviewed contract; an unpublished local tarball labelled 0.80.0 is not a production pairing.

## Reviewed patch provenance and optional upstream contribution

Repository: https://github.com/nicobailon/pi-subagents

Baseline: 80f8f79d51ee8075fd39baf7fe8ff36b43c3a790 (npm pi-subagents@0.80.0 gitHead).

Proposed commits:
- 2f6c64ee166d5429060db64a704673e2370865ab: public RuntimeAgentDefinition.requiredExtensions, mandatory admission and retained propagation using existing required-extension machinery.
- b044248a3634bc8698fc6034fa955c3db243b227: intersect trusted current-session UUID/file capability policies, preserving inherited/retained restrictions and public UUID registration semantics.

Reviewed tree: e1b29075fcde1a1d34203d6ad76acfb7cebefa0f.

Suggested PR title: Support per-agent required child extensions with fail-closed admission

## Draft PR body

### Problem

An extension-owned agent can require child-side behavior, but optional agent extensions can be removed by a capability ceiling. Session-wide mandatory extensions cannot express a requirement belonging only to one agent. This can silently remove a required behavior while admitting the agent.

### Changes

- Add validated, canonical, immutable requiredExtensions to runtime-agent definitions.
- Compose per-agent requirements with existing global, inherited and retained requirements across direct, async, workflow and recovery launches.
- Reject incompatible policies/runners or required-helper load failures before provider work; preserve ordinary agents without requirements.
- Resolve current capability policies from trusted session UUID and file identities by restrictive intersection, consistent with documented UUID registration.

### Verification

Independent source review: OK with notes, no concrete P0/P1/P2 findings. Fresh exact-head focused suites:40 pass; typecheck passed. Local broad dependency unit/integration and native/clean-install gates are recorded separately with platform/skip limitations. Initial broad unit run had an intermittent global-npm-root timeout-test failure; isolated and shard repeats passed, but root cause and baseline equivalence are not established. Preserve this observation.

Packed CLI exercises denied direct/async/workflow/recovery, allowed helper delivery and unaffected sibling. Separate packed Jev compatibility proof: allowed6/6, denied4/4, focused10/10; same-session resume/reload budget and zero additional requests after denied recovery verified. This is local deterministic evidence, not hosted-quality or universal compatibility proof.

### Remaining gates

Run upstream exact-head/exact-platform CI. Local macOS alternatives do not certify the configured Ubuntu/Windows/Node matrix. Maintainer review and a published compatible release remain required; a PR does not itself provide that release.

## Historical upstream-first consumption proposal — superseded

1. Obtain separate operator approval for remote contribution (push/fork/PR as needed); do not publish credentials or fixture transcripts.
2. Submit source changes and honest test/CI limitations for upstream review.
3. Await/verify a public release containing the reviewed API. Do not guess a version or claim maintainer acceptance.
4. Verify the released artifact, API and pairing; propose the exact Jev dependency pin and rerun final package/integration gates before ticket08 acceptance.

Operator superseded upstream-first distribution with fork-first. Preserve upstream attribution/license and keep a separate upstream remote. Push only reviewed source/docs/tests to a dedicated fork branch. Verify an immutable installable Git commit or built artifact before selecting the exact Jev reference; source Git installability must be tested, not assumed. If a release asset or scoped npm publication is needed, obtain explicit publication approval for the concrete artifact. The user-owned fork remains usable regardless of whether upstream accepts an optional PR.

## Local P2 correction

The disposable integration test expected URL.pathname instead of a filesystem path. Corrected to fileURLToPath(new URL(...)); production unchanged. Targeted crew-junior.test.ts:4 pass/0 fail/15 assertions, exit0, recorded at /tmp/pi-jev-ticket-08-required-integration/p2-path-correction.log. Original reviewed evidence remains unchanged. No actual Windows execution is claimed.
