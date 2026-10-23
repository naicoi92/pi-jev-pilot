# Main-routing removal: focused candidate evidence

Candidate starts at `2daa30cb401f643fd089f60320ca9b8553e776ba`; this change preserves earlier partial/RED commits and historical ticket02/ticket08 acceptance. Not installed, pushed or accepted for deployment. See [pre-edit migration matrix](main-routing-removal-matrix.md) for retired versus retained ACs.

## Changes and source boundary

Removed Jev virtual registration, main tier dispatch, main route-state/status production and `mainRoutingEnabled` consumer. Obsolete flag is ignored as an unknown settings key; README directs removal. Physical main model remains user-selected; no production `registerVirtualModel`, `unregisterVirtualModel` or `setModel` calls exist. Main classifier orchestration cannot request dispatch-tier questions; raw tier remains available to strategy advice. Worker JSON resolver, policy, executor pin, crew and mandatory helper remain intact. Effort policy and cache behavior are unchanged.

Virtual-specific tests were retired, not marked green under their former meaning. Shared physical skill/advice/design content, UUID ownership, branch, compaction, queue, timeout/cancellation, identity-stripping and native skill-expansion assertions remain. Former virtual-only no-skill/no-ownership cases now run physically with effort disabled. Raw-tier/risk guidance case now proves advice cannot dispatch main models. Foreign registration composition assertions remain with no Jev registration/collision path.

## Executed focused validation

Official Pi `1.4.0`, Bun `1.4.3+c6da4a4d3`, immutable executor fork `5f8adccb235f1a45858c84b5110c105108947de2`. Local deterministic HTTP only; no paid requests or personal settings changes.

| Command/group                                                                                                                                                                       | Actual exit/result                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `bun test tests/routing-settings.test.ts tests/routing-settings-host.test.ts tests/main-routing.test.ts tests/settings-json.test.ts`                                                | 0; 33 pass                                                                                                                |
| `bun test tests/skill-matching.test.ts tests/guidance.test.ts tests/design-pack.test.ts tests/router-registration-cli.test.ts`                                                      | 0; 162 pass, repeated after final source change                                                                           |
| `bun test tests/pi-cli.test.ts tests/worker-main-isolation.test.ts tests/effort-policy.test.ts tests/tier-policy.test.ts tests/junior-turn-bound.test.ts tests/crew-policy.test.ts` | 0; 98 pass                                                                                                                |
| Worker CLI filter: JSON-only, direct-max, async-low, direct-cancel, async-cancel                                                                                                    | 0; 5 pass                                                                                                                 |
| Final worker CLI filter: JSON-only, async-low, async-cancel                                                                                                                         | 0; 3 pass; pack digest captured in each commands receipt; JSON-only case includes conflicting invalid legacy env mappings |
| Required-helper denied direct41 CLI                                                                                                                                                 | 0; 1 pass, zero junior provider activity                                                                                  |
| Mandatory40-turn helper direct41 CLI                                                                                                                                                | 0; 1 pass, actual packed junior bounded                                                                                   |
| Final main/settings/host + combined/raw-tier guidance filter                                                                                                                        | 0; 36 pass                                                                                                                |
| `bun run lint`                                                                                                                                                                      | 0                                                                                                                         |
| `bun run fmt:check`                                                                                                                                                                 | 0                                                                                                                         |
| `bun run typecheck`                                                                                                                                                                 | 0; 155 files                                                                                                              |
| `git diff --check`                                                                                                                                                                  | 0                                                                                                                         |

Initial typecheck exited 1 on one stale test helper argument during migration; corrected and rerun successfully. No timeout increases, disabled lint rules or relaxed acceptance controls.

## Packed receipts (separate from source binding)

Final pack SHA-256: `b10bc9ff1f51c8789e8567bfd756d18e690f36a5c99109790e6f809b0269b625`.

Final worker IDs: `pi-jev-worker-production-FaTwAD` (JSON-only), `pi-jev-worker-production-E1GRC4` (async-low), `pi-jev-worker-production-EJaC2z` (async-cancel). Each `commands.json` records pack/hash/install exits; `trace.json` records provider payloads/classifier requests; `parent-close.json` records exit 0/signal null. Extracted packed `src/*.ts` hashes matched current source in all three. JSON direct receipt dispatches `selected/medium` while parent stays `parent/medium`. Async terminal observation remains enforced by unchanged fixture.

Junior receipt IDs: `pi-jev-junior-bound-gTxuJ1` (required denied), `pi-jev-junior-bound-kCT9Jh` (40-turn bound). Full logs and copied runtime receipts are supplied alongside implementation handback; source SHA/manifest binding recorded there rather than conflated with runtime IDs.

## Remaining gate

Full repository suite not run. Worker scenarios outside focused filters, all junior lifecycle/async/workflow-bound combinations and full regression remain separate fresh verification. Existing historical live-registration RED evidence is not repaired or erased by retiring main routing. Independent Standards + Spec review remains required before any deployment/update of installed `bf18e3a`. No push/install performed by this task.
