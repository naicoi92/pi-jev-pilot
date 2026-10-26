# 04: Runtime fallback to lower tier at highest supported effort

**What to build:** When the selected tier cannot run, Jev reports the failure and cascades to lower configured tiers instead of failing the whole turn, so a rate-limited or misconfigured tier degrades gracefully.

**Blocked by:** 02

**Status:** ready-for-agent
**Implementation:** completed

- [x] When the selected tier's model is invalid, unresolvable, unauthenticated, or rejected at preflight, report the failure naming the tier and setting.
- [x] Cascade to the next lower configured tier until one launches; if none launches, retain the baseline model.
- [x] Errors during the child run (rate limit, timeout, provider) are NOT cascaded; they stay executor-surfaced. Documented as an explicit limitation.
- [x] Each fallback tier uses the highest effort level its model supports via `clampThinkingLevel`, never a hardcoded `max`.
- [x] Invalid settings values are still reported as configuration errors, not silently ignored.
- [x] Verified through the worker adapter test seam with fake invalid-model and fake rate-limit failures.
