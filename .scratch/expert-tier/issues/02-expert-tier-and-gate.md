# 02: Expert tier and admission gate

**What to build:** A fourth tier, `expert`, above `deep` for rare, exceptionally difficult architectural or advisory reasoning. When an expert model is configured, Jev can nominate it, but it only runs when a separate fixed `expert_needed` answer is strictly above 0.9; otherwise the work runs on `deep`. When no expert model is configured, the request is indistinguishable from the non-expert request.

**Blocked by:** 01

**Status:** ready-for-agent
**Implementation:** completed

- [x] Tier order is fast, balanced, deep, expert, and `expert` is configured through the same optional tier settings.
- [x] Expert absent or empty: the request contains no expert choice, no `expert_needed` question or placeholder, and the existing `deep` rubric unchanged; a response without an expert answer is accepted.
- [x] Expert configured: the request adds the expert choice, the fixed `expert_needed` noul question and the differentiated deep/expert rubrics in the same single request; no per-invocation advice is added and agent names grant no eligibility.
- [x] A valid expert choice with `expert_needed` of 0.91 selects the expert model; exactly 0.9, a missing answer or an invalid answer does not.
- [x] A rejected expert choice runs on `deep`; if `deep` is not configured the retained baseline model is kept. Expert is never a silent fallback. Operator-approved default.
- [x] High risk alone, or a non-expert choice, never selects expert, and the risk override cannot bypass or suppress the gate.
- [x] A structurally malformed response remains a schema error exactly as today.
- [x] Existing confidence and physical-identity checks still apply to the selected model, and the decision row shows the model actually selected.
- [x] Verified through the worker adapter test seam against a fake classification service, including the 0.9 boundary and both expert-on and expert-off requests.
