# Jev single-file configuration migration

Status: approved for specification and ticket publication. Operator confirmed the plan, native/local-provider test seam and six-ticket vertical breakdown in this session. No implementation or personal installation authorized by this plan alone.

## Goal and baseline

Replace Jev option environment variables and merged project/global settings with one global configuration file. Baseline source/installed revision: `f0adafa0599611da12c43eafceb843f72665c129`; paired executor `9f0dcee736e64db6ecc1cfcd87bb0eecac5fbf51`.

Operator decisions supersede earlier routing-only migration notes. Latest decisions: one `jev-pilot.json`, crew inline (supersedes separate crew-file proposal); base directory follows official `PI_CODING_AGENT_DIR`; options are global-only; secret value remains in a named environment variable; immediate legacy option-env cutover; manual migration; next-assessment snapshots; junior definition changes require reload.

## Configuration source

Resolve the directory through public Pi `getAgentDir()` semantics: `PI_CODING_AGENT_DIR`, otherwise the host default `~/.pi/agent`. Read `<agentDir>/jev-pilot.json` only. Never merge project settings, `settings.json.jevPilot`, or project-local files. Expand no arbitrary config paths. SDK custom/in-memory settings managers are not a configuration source; this file contract is process agent-directory scoped, not session-manager scoped.

Missing file means defaults. Invalid JSON, unreadable existing file, invalid types, explicit invalid/null values and unknown fields produce actionable path-based diagnostics, never values/secrets. Root `schemaVersion` is optional with default 1; any explicitly unsupported version rejects. Validate supplied fields even when their feature is disabled; only resolve the named credential when an actual classifier request is needed. Diagnostics must remain visible even when work can safely continue without the invalid consumer.

No automatic file creation, rewrite, copying from legacy settings, credential migration or paid model seeding. Main model selection remains user-owned.

## Proposed version-1 schema

Names below are proposed for final operator confirmation; all values shown are defaults.

```json
{
  "schemaVersion": 1,
  "effortEnabled": true,
  "workerRoutingEnabled": true,
  "skillsEnabled": true,
  "skillRerank": false,
  "strategyEnabled": true,
  "qualityEnabled": true,
  "designEnabled": true,
  "recordDecisions": true,
  "designSkills": ["design-taste-frontend", "impeccable", "web-design-guidelines"],
  "classifier": {
    "url": "https://api.typesafe.ai/v1/systemone",
    "apiKeyEnv": "TYPESAFE_API_KEY",
    "model": "jev-latest",
    "timeoutMs": 1500
  },
  "tiers": {},
  "crew": {"mode": "standard", "slots": []}
}
```

- Booleans must be JSON booleans, not strings. Timeout is a positive safe integer, preserving base timeout semantics.
- `designSkills` is an array of strings, trimmed/deduplicated; explicit `[]` means none. Reject non-string elements. Preserve matching semantics.
- `tiers` accepts `fast`, `balanced`, `deep`, `expert` only. Preserve existing sparse tier behavior: missing/empty/whitespace disables that tier; invalid physical identity syntax rejects. Resolve physical model/auth at the existing execution seam.
- `crew` retains existing strict mode/slots/junior schema, slot limits and policies. Inline object replaces `JEV_CREW_CONFIG` and external-file reads.
- `classifier.model` must be nonblank. `apiKeyEnv` is a nonblank environment identifier (portable identifier syntax), never the secret itself. Resolve only that name; missing/blank secret rejects before request. No implicit `JEV_SYSTEM_ONE_API_KEY` fallback. A legacy name may still be explicitly selected as the secret source; diagnostics must not call the selected credential ignored.
- URL must be a valid HTTP(S) endpoint without embedded credentials. Remote HTTP remains operator-selectable with documented plaintext transport risk. Do not follow redirects; any redirect is an actionable failure. No origin allowlist or silent endpoint/model fallback.

## Complete migration inventory

| Existing source | New field/source |
|---|---|
| JEV_EFFORT_ENABLED | effortEnabled |
| JEV_WORKER_ROUTING_ENABLED | workerRoutingEnabled |
| JEV_SKILLS_ENABLED | skillsEnabled |
| JEV_SKILL_RERANK | skillRerank |
| JEV_STRATEGY_ENABLED | strategyEnabled |
| JEV_QUALITY_ENABLED | qualityEnabled |
| JEV_DESIGN_ENABLED | designEnabled |
| JEV_RECORD_DECISIONS | recordDecisions |
| JEV_DESIGN_SKILLS | designSkills |
| JEV_SYSTEM_ONE_URL | classifier.url |
| JEV_SYSTEM_ONE_MODEL | classifier.model |
| JEV_TIMEOUT_MS | classifier.timeoutMs base, then tuning overlay |
| JEV_SYSTEM_ONE_API_KEY / TYPESAFE_API_KEY fallback | only env named by classifier.apiKeyEnv |
| JEV_CREW_CONFIG and separate crew file | crew inline |
| settings.json jevPilot.tiers | tiers |
| JEV_TIER_* / JEV_MAIN_ROUTING_ENABLED / mainRoutingEnabled | remain obsolete, no replacement main router |

Legacy option env never changes behavior. Emit bounded deduplicated diagnostics naming ignored variables, never their values. Legacy `settings.json.jevPilot` is ignored; detect/warn from the global file only, never read project settings for migration. Do not mutate unrelated package entries. Tests and docs must cover duplicated execution/status readers, not only the backend reader.

## Snapshot, refresh and lifecycle

At each eligible main assessment or worker logical launch, read and validate one immutable configuration snapshot before effects. Capture base options, credential reference/resolved credential for that request, tiers, crew and effective tuning consistently. Share it across skill batches/rerank, preflight, assessment, policy/clamp and related status; no mid-assessment rereads. Do not persist the resolved secret, secret-derived fingerprints, prompts or authored task bodies.

A partially written/malformed file rejects the new boundary; never silently reuse a last-good configuration. Already captured assessments continue with their immutable snapshot. Recommend atomic file replacement when editing with external tooling.

Changes apply at the next boundary, without relying on host settings-manager reload. A snapshot is a boundary observation, not a cross-file transaction. Existing runs/committed pairs remain unchanged. Worker children must not reassess main work or inherit a second conflicting option source; use existing launch/child-suppression contracts. No invented new worker snapshot transport unless required by a verified consumer.

Junior-definition changes are reload-required. Detect the pending difference, notify once, and refuse launches that would mix a new junior definition/policy with the registered old definition. Preserve old committed runs; do not auto-reload. Non-definition options remain next-boundary effective. Owner session/generation gates and presentation lifecycle remain intact.

A next-boundary change to `workerRoutingEnabled` must reconcile admission and owner registration behavior, not merely hide a classifier question while the registration remains stale. Preserve current worker-disabled behavior and fail-closed executor contract; active commitments must neither be cancelled nor reassessed by this change. Test both enable and disable transitions with active and subsequent launches.

Registration-time assessment timeout currently snapshots a value. Implementation must ensure a changed effective timeout governs the next assessment window as well as HTTP timeout, without clearing claims, losing the owner or invalidating active commitments. Determine the supported executor seam; if dependency work is necessary, make it explicit and separately reviewed, never silently retain a stale smaller window.

## Tuning and persisted state

Keep existing learned-state files `<agentDir>/jev-pilot/tuning.json` and `ledger.json`; 'one config file' does not mean deleting runtime state. Defaults → JSON base → applied tuning overlay. `/jev tune` shows base, overlay and effective values plus reset guidance; no hidden overwrite of JSON. `/jev tune reset` resets only learned overlay/evidence window, not configuration or ledger. Confidence fields remain storage-compatible/diagnostic; do not reintroduce vetoes. No new user-adjustable gates or tier policy changes.

## Acceptance matrix

| ID | Required observable proof |
|---|---|
| CFG-01 | Custom PI_CODING_AGENT_DIR and default directory resolve only jev-pilot.json; cwd/project/global merged settings cannot override it. |
| CFG-02 | Missing file/fields use documented defaults; strict unknown/type/null/version errors identify paths without values. |
| CFG-03 | Every inventory row migrated; legacy option env conflicts have no effect and bounded name-only diagnostics. |
| CFG-04 | apiKeyEnv selects exactly one env; missing/blank fails only when request is needed, no key fallback or secret in files/logs/status/ledger. |
| CFG-05 | Valid HTTP(S), credential-free URL; HTTP risk documented; redirect returns error without forwarding key/body to target. |
| CFG-06 | All consumers and /jev status agree on one snapshot; edits during delayed batches/worker preflight do not produce mixed config. |
| CFG-07 | Changes take effect next boundary, including raised/lowered HTTP and authority assessment timeout and worker-routing enable/disable admission/owner reconciliation; active launch/commitment unchanged. Partial/malformed new file rejects that boundary without last-good fallback. |
| CFG-08 | Inline crew standard/budget/junior-lead, slots and specialized effort-only exception preserve behavior; changed registered junior is reload-required and cannot mix definitions. |
| CFG-09 | JSON base/tuning overlay/reset show correct precedence; no confidence-veto regression or ledger-reset coupling. |
| CFG-10 | Actual native Pi-Bolt local-provider reload/dispatch, ordinary and specialized workers, skill/guidance/design/status and cancellation paths pass. |
| CFG-11 | Packed artifact installed in disposable profile consumes exact file/path and ignores conflicting legacy env/settings; official packaged path remains tested. |
| CFG-12 | Existing owner, comparison, expert/slots/fallback, live summary/Ctrl+O and assessment-only spinner regressions stay green; actual user settings unchanged until explicitly approved deployment. |

## Initial planning sketch (superseded by published tickets)

The following preparatory sketch is historical. The approved vertical graph is: 01 → {02, 03} → 04 → 05 → 06; see [specification](spec.md) and one-file-per-ticket under `issues/`.


1. **C1 — Configuration contract and loader:** schema/defaults/strict diagnostics/agentDir/manual migration examples; CFG-01–03. No independent new env options.
2. **C2 — Classifier and main consumers:** depend C1; named secret, no redirects, shared batch snapshot, toggles/status/design/ledger; CFG-04–06.
3. **C3 — Worker authority and crew:** depend C1, coordinate C2 shared snapshot; mandatory public authority timeout/admission refresh seam (not deferrable acceptance debt), preflight, inline crew/junior lifecycle; CFG-06–08. Any executor change gets its own isolated branch and review before pin.
4. **C4 — Tuning and commands:** depend C1; overlay/base/effective display and reset independence; CFG-09. No independent user schema for obsolete diagnostic confidence bars.
5. **C5 — Combined acceptance and migration documentation:** depend C2–C4; CFG-10–12, audit production env access allowlist, remove stale README config guidance, run native and packaged gates. Independent Standards + Spec/security review before integration.
6. **C6 — Authorized rollout:** only after gates and deployment approval; private backup, exact paired SHA pins if executor changed, verify installed source/settings entries and disposable installed runtime. Manual copy of model mappings is operator-controlled. No paid inference without separate budget.

Each implementation ticket must include exact AC rows, red command, green command and evidence limitations before coding. Distinct worktrees and one writer per file/worktree; integration reviews verify shared loader/snapshot seams.

## Rollout and rollback

Provide a minimal defaults file and a manual mapping example from global settings/env options, never paste secret values. No automatic config conversion. Warn users that missing new tier mappings disables ordinary routing rather than silently reading legacy settings. Before enabling, show effective source/base/overlay/credential variable name without value. Backup settings and config with private permissions before any approved edits.

Rollback package pins together if contract changed. Keep jev-pilot.json and runtime state intact; explain old versions will not consume the new options. Never restore credentials from logs or automatically re-enable legacy env behavior.

## Non-goals and plan gate

No implementation in this planning phase; no main virtual router, project overrides, generic secret store, settings-manager/SDK host patch, tier/gating redesign, quota policy, automatic migration command, or new paid model experiment. Historical malformed-stream incident is not closed by config migration.

Operator confirmation approved this schema and source/refresh/validation contract, followed by explicit approval of the native testing seam and six vertical tickets. Self-contained tickets are published with Implementation: pending. Unresolved technical risk: executor assessment-window update seam; must be resolved with source-backed tests, not by silently reducing next-boundary guarantees.
