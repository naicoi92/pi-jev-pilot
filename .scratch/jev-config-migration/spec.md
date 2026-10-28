# Single-file Jev configuration

Status: ready-for-agent
Implementation: pending

## MVP amendment: worker registration settings

Operator accepted a full Pi process restart, after existing work has ended, to apply changes to `workerRoutingEnabled` and the effective worker classifier timeout (JSON base plus tuning overlay). Same-process `/reload` is not sufficient. Do not restart automatically or claim active work survives shutdown. Main assessments continue to capture the current timeout at their next boundary; non-timeout worker settings continue to use their existing per-leaf snapshot. This amendment supersedes next-boundary claims for these two worker registration settings only. Remaining acceptance and malformed-configuration requirements are unchanged and must not be silently waived.

## Problem Statement

Jev options still span environment variables, merged Pi settings, a separately selected crew file and learned state. Operators cannot manage one global options file or predict whether an edit takes effect at the next assessment. Multiple readers can observe inconsistent state; legacy sources obscure effective values.

## Solution

Use one global `jev-pilot.json` under the official Pi agent directory, selected by `PI_CODING_AGENT_DIR` or the host default. Keep crew inline. Resolve secrets only through the explicitly named environment variable. All eligible assessments use one immutable configuration snapshot; new configuration applies next boundary, except changed registered junior definitions require reload. Retain learned tuning as visible overlay, not another options source.

The approved [plan](plan.md) defines the version-1 schema, defaults, complete inventory, acceptance matrix and rollout/rollback contract. It is normative alongside this specification.

## User Stories

1. As an operator, I want one options file so that configuration is discoverable.
2. As an operator, I want official agent-directory overrides respected so that isolated profiles remain isolated.
3. As an operator, I want project settings ignored so that project content cannot redirect my global classifier.
4. As an operator, I want absent fields to use documented defaults so that minimal files work.
5. As an operator, I want invalid and unknown fields rejected so that typos cannot silently change behavior.
6. As an operator, I want a credential environment-variable name rather than a secret value in JSON so that configuration remains shareable without embedding credentials.
7. As an operator, I want exactly the named credential resolved so that no fallback key is selected implicitly.
8. As an operator, I want endpoint redirects rejected so that credentials and requests stay at the chosen endpoint.
9. As an operator, I want feature toggles and status to agree so that displayed configuration is trustworthy.
10. As an operator, I want worker tiers in the same file so that routing does not depend on merged Pi settings.
11. As an operator, I want crew modes and slots inline so that no path environment variable is needed.
12. As an operator, I want junior definition changes flagged as reload-required so that old definitions and new policy cannot mix.
13. As an operator, I want edits effective at the next assessment so that routine changes do not require reload.
14. As an operator, I want active work to retain its captured configuration so that edits cannot change committed model/effort pairs.
15. As an operator, I want timeout and worker admission refresh to match next-boundary behavior so that registration state cannot silently override JSON.
16. As an operator, I want tuning base, overlay and effective values visible so that applied learning never hides my configuration.
17. As an operator, I want reset to affect only tuning so that configuration and ledger data remain independent.
18. As an operator, I want legacy options ignored with bounded diagnostics so that stale shell exports cannot override JSON.
19. As an operator, I want manual migration examples so that model mappings and paid targets remain my decision.
20. As a maintainer, I want native and packaged acceptance so that passing parser tests cannot conceal runtime integration failures.
21. As an operator, I want malformed edits to fail explicitly instead of using stale data so that my next action is predictable.
22. As an operator, I want existing worker authority, expert, fallback and presentation behavior preserved so that configuration migration does not redesign routing.

## Implementation Decisions

- Use a strict versioned single-file loader and immutable assessment snapshot. Do not use merged settings or project configuration as option sources.
- Follow public host agent-directory semantics; custom SDK settings managers are not an alternate configuration source under this file contract.
- Preserve approved defaults and policies. The secret source is only `classifier.apiKeyEnv`, defaulting to `TYPESAFE_API_KEY`; never echo values or secret-derived fingerprints.
- Use valid HTTP(S) endpoints without embedded credentials, with redirect following disabled. Operator-chosen remote HTTP has documented plaintext risk.
- Inline existing crew schema. Preserve specialized effort-only exception, sparse expert tiers, authority gates, model-support clamps and pre-launch-only fallback.
- Keep tuning and ledger as separate runtime state. Precedence is defaults, JSON base, applied tuning overlay; no confidence-veto restoration.
- A boundary captures a coherent snapshot; active work never rereads it. Malformed new files reject new boundaries without last-good fallback.
- Reconcile registration/admission and authority assessment windows for next-boundary edits. Junior definition changes remain reload-required without cancelling active work.
- Remove legacy source compatibility at final cutover; do not automatically rewrite user files or seed model mappings. Intermediate work stays on an integration branch, not deployed.

## Testing Decisions

- Primary seam approved by operator: real native Pi-Bolt CLI in isolated agent directories with actual files, localhost classifier/provider, observable request and worker receipts. No paid inference is required.
- Use parser/validation unit tests as supporting coverage, not substitutes for native or packaged proof.
- Derive tests from CFG-01 through CFG-12 in the approved plan. Each ticket records meaningful RED and GREEN commands and limits.
- Exercise delayed assessments with mid-flight edits, settings/project/env conflicts, named-secret negatives, redirects, cancellation, owner refresh and junior reload.
- Preserve existing native owner, comparison, specialized effort, sparse expert/slot/fallback, live summary/Ctrl+O and assessment-only spinner regressions.
- Final packaged artifact must install into a disposable profile and consume the exact same file contract. No no-install fixture may be reported as packaged acceptance.

## Out of Scope

Project overrides, options in Pi settings, generic secret-store integrations, a main virtual router, automatic migration command, routing/gating redesign, SDK settings-manager or host patches, paid inference without separate budget, and resolving the historical malformed-stream incident.

## Further Notes

Operator approved the plan, proposed test seam and six-ticket breakdown in this session. This authorizes publication of planning artifacts, not coding or personal installation. The plan's earlier C1–C6 sketch is superseded by the approved vertical ticket graph in this directory. Rollout requires separate explicit approval after verification gates.
