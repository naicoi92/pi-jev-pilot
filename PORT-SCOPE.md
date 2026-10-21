# Jev Pilot → Pi: Faithful Port Scope

Status: product direction confirmed; capability boundaries proposed for review before module specifications and implementation.

## Baseline and authority

Port Jev Pilot 0.12.1 at `5d27135b34edf81b40c0bf1df01ae401f6b72ea7` to Pi upstream. Preserve selected upstream behavior; replace host integration only. User's latest direction supersedes proposed execution profiles, automatic benchmark/cost ranking and new role mechanisms. Research remains historical evidence, not implementation requirements.

Previously verified target: Pi 1.3.0. Recheck stable version and contracts before implementation; do not silently move to unreleased APIs.

## Confirmed behavior

- Three configurable tiers: `fast`, `balanced`, `deep`, with upstream classification rubric and confidence policy. Resolve configured physical models through Pi's qualified provider/model registry.
- Effort remains a separate decision. Preserve upstream rubric and thresholds, applying only supported Pi levels; expose requested versus effective settings when adaptation is required.
- Custom slots preserve `name`, `model`, `when`, maximum eight slots, mode eligibility and default read-only bulk-work description. They are classifier candidates, not automatically bound worker roles.
- `standard`, `budget`, `junior-lead` retain upstream meaning. Named junior uses the configured slot, not a new pool-ranking algorithm.
- System One endpoint/auth/model are configurable; default decision model is Jev. Preserve combined typed questions, bounded context and applicable batching behavior.
- Strategy remains advice. Host/user/project delegation restrictions retain authority. The classifier does not spawn workers or grant permissions.
- Subagent execution belongs to an external package adapter; native Pi workers managed by such a package are allowed. Do not build an independent engine.
- Main classifier context defaults to four recent messages / 2,000 characters, derived signals, tool names and skill metadata/excerpts; worker classification uses its own brief without conversation history. Do not silently expand data sent to classifier.
- Classifier failures are fail-open; keep current eligible route or configured default. Approved change from upstream: timeout must abort the classification request, while explicit user cancellation stops work rather than starting fallback generation.
- Preserve skill matching, quality guidance, design pack, ledger/report and explicit tuning apply/reset within selected scope.
- Public package documentation/code-facing content is English; direct user communication remains Vietnamese.

## Scope exclusions

Excluded feature IDs: 02 mid-turn effort escalation (including escalation triggered by quality/circle detection; step-back advice may remain under feature 07 without changing effort); 11 external CLI review; 12 proactive worker health/fallback; 15 pet; 16 broad live controls/session statistics. Minimal report/tuning/config interfaces required by selected capabilities remain in scope. Registry/config validation is not proactive health probing. Do not reintroduce excluded features via upstream imports.

No automatic benchmark feeds, model score/cost optimizer, execution-profile system, invented expert tier, or Pi-specific reviewer-role product behavior.

## Proposed capability map

| Module ID | Responsibility | Depends on |
|---|---|---|
| decision-policy | Upstream task/effort/strategy/quality questions, parsing and pure policy | — |
| pi-routing | Config, System One transport, Pi lifecycle, tier resolution and main routing | decision-policy |
| skill-guidance | Skill catalog/matching, combined decision call and design context | pi-routing |
| crew-adapter | Custom slots, modes, named junior and subagent model/effort routing | pi-routing |
| decision-history | Ledger/report, correction attribution, tuning proposals/apply/reset | pi-routing |

Build order: decision-policy → pi-routing → skill-guidance / crew-adapter / decision-history. One shared upstream policy seam, no independent routing implementations per adapter.

## Implementation gates

1. Review capability boundaries, then write module parity specifications and AC-to-test matrices.
2. Verify ordinary native subagent routing through supported Pi tool-call input mutation and the external package's model/effort contract. Workflow-script inner launches retain model-selection advice as pinned Jev Pilot does; transparent workflow interception is not required. pi-subagents 0.80.0 is source-verified as a candidate, with direct/async runtime smoke, effective-agent resolution, overrides, cancellation and actual settings still to verify. No package-cache edits, monkey patches or prompt-only substitutes for ordinary runtime routing.
3. Preserve pure policy where possible, with MIT provenance and license attribution. Host adapters own lifecycle/session/store/model/resource translation.
4. Record unavoidable host differences explicitly. Investigate the observed upstream risk/custom-slot precedence discrepancy before copying or changing it; do not silently alter business policy under the name of porting.
5. Validate offline policy parity and Pi host integration; verify actual Pi CLI flow before claiming E2E. Report unavailable credentials/runtime limitations rather than treating unit tests as E2E.

## Evidence

- `docs/research/jev-pilot-current-behavior.md`: pinned upstream lifecycle and behavior.
- `docs/research/pi-multi-provider-routing-options.md`: host API research; profile-selector recommendations are deferred/superseded.
- Other benchmark/source research is explored and deferred, not required for v1.
