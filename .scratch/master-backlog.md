---
title: Master backlog
summary: Ordered list of all remaining work across jev-pilot-port and expert-tier, for implement-spec.
---

## Scope

Covers every open item in `jev-pilot-port` and `expert-tier`. Ticket files stay in their own spec directories; this file is the single ordering and gate list. Checked against repo files only; no tests were rerun when this was written.

## Gate 0: decisions needed before implementation

| ID | Decision | Blocks |
|---|---|---|
| D1 | Full-suite RED (4 native async terminals missing process-close proof, root cause unknown): approve bounded diagnosis, or accept the exact residual risk | Release of anything; W1 |
| D2 | Which models fill `fast/balanced/deep/expert` in personal settings | Enabling automatic routing; not code |

Code work below does not need D1 or D2 to start. Only final acceptance and installation do.

## Ordered work

| Order | ID | Task | Source | Blocked by |
|---|---|---|---|---|
| 1 | E1 | Sparse tier configuration | `expert-tier/issues/01` | none |
| 2 | E2 | Expert tier + `expert_needed > 0.9` gate, deep fallback | `expert-tier/issues/02` | E1 |
| 3 | E3 | NOTICE attribution + deterministic Pi CLI verification | `expert-tier/issues/03` | E2 |
| 4 | P9 | Ledger and report: persist outcomes, report corrections | `jev-pilot-port/issues/09` | none |
| 5 | P10 | Explicit tuning: apply and reset evidence-based tuning | `jev-pilot-port/issues/10` | P9 |
| 6 | P12 | Live status line above the editor, replaces ordinary decision rows | `jev-pilot-port/issues/12` | none |
| 7 | P11 | Public package acceptance (final gate for the port) | `jev-pilot-port/issues/11` | P10; also E3 and P12 recommended first |
| 8 | W1 | Resolve full-suite RED per D1; lifecycle blocker run `761e67ca-1743-4c25-b64f-6b9a1c37eaf2` | `main-removal-verification-blocker.md`, `durable-visibility-delivery.md` | D1 |
| 9 | W2 | Assess the 2 reported dependency vulnerabilities (1 moderate, 1 high) and git-dependency integrity warning | installer notes | none |
| 10 | W3 | Commit untracked docs and checkpoints; remove merged `ticket/*`, `fix/*` branches and worktrees | git status | after 1–8 |

## Sequencing notes

- **Same area:** P12 and P9 both touch decision visibility; E1/E2 touch worker routing. Run E1→E3 on one integration branch, P9→P10 on another, and P12 after P9 to avoid conflicting edits. Do not run writers in parallel on the same files.
- **P11 is the acceptance gate.** It must run after E3 and P12 so it verifies the whole package, including expert and the status line.
- **Installation is not implied.** Any install of a new commit needs explicit operator approval of that exact SHA.

## Out of scope for all items above

Decision packet, `expert-consultant` role, hard quota, token caps, write/tool restrictions for expert, global spending guard, expert model choice, calibrating 0.9.

## Open verification

- Real-session cause of main effort staying near default is unconfirmed; check with `/jev status` after the next approved install.
- Whether `W3` branches are all merged is unchecked.
