# 03: Attribution and deterministic CLI verification

**What to build:** Record `expert` and its gate as an extension of the pinned upstream design, and prove the settings-to-model path in the real Pi CLI without paid hosted requests.

**Blocked by:** 02

**Status:** ready-for-agent
**Implementation:** completed

- [x] The attribution notice states that the `expert` tier and its `expert_needed` gate extend the pinned upstream design.
- [x] A deterministic Pi CLI fixture run shows sparse tiers, expert disabled and expert enabled producing the expected requests and selected models.
- [x] No hosted paid request is made; lint, format, typecheck and the relevant regression tests pass.
