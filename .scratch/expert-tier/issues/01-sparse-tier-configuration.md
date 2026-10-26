# 01: Sparse tier configuration

**What to build:** Every worker tier becomes optional in Pi settings. A tier with no model is never offered to Jev, so the operator pays for and exposes only chosen tiers. With no tier configured, ordinary worker launches keep the worker's own model.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent
**Implementation:** completed

- [x] An absent key, an empty string and a whitespace-only string each hide that tier from the classification request.
- [x] `null`, a non-string and a malformed physical model identity fail with a message that names the setting.
- [x] Choices sent to Jev are all configured tiers plus all offered custom slots; custom slots no longer displace `fast`.
- [x] With no tier and no slot configured, no tier question is sent and the worker keeps its retained baseline model.
- [x] One availability snapshot drives both request construction and response validation (allowed choices and probability distributions); advice and strategy-only reads do not break on it.
- [x] A high-risk decision (risky above 0.7) selects `deep`; when `deep` is not configured it selects the highest configured tier, and when none is configured it changes nothing. Operator-approved default.
- [x] Verified through the worker adapter test seam against a fake classification service; existing worker and routing behavior tests still pass.
