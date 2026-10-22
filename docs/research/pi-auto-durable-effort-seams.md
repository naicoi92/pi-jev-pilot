# pi-auto, Pi Durable and effort-routing seams

Status: source research only; no production integration or upstream submission approved. No runtime E2E was performed for these alternatives.

## Pinned sources

- [pi-auto](https://github.com/ekil1100/pi-auto/tree/6c60ab37debc96ae48e1ca0957e777c2b3ebacc8), package manifest version 0.3.0, Pi peer >=0.99.0.
- [Pi Durable introduction](https://earendil.com/posts/pi-durable/).
- [Pi Durable v1.3.0 README](https://github.com/earendil-works/pi/blob/v1.3.0/packages/durable/README.md) and source at official Pi commit `71023aec1546d6d677a65669c5665c0927ce0dd0`.
- [Latest extension examples/reference](https://pi.dev/docs/latest/extensions#examples-and-reference), compared with [release-pinned virtual-model documentation](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/docs/virtual-models.md) and [jev-router example](https://github.com/earendil-works/pi/blob/v1.3.0/packages/coding-agent/examples/extensions/jev-router.ts).

## Findings

| Source | Mechanism | Fit and limitation |
| --- | --- | --- |
| pi-auto | Ordinary extension: before_agent_start → model registry classify/chat → setThinkingLevel; retains answering model, filters supported effort and guards stale/manual changes | Closest effort-only precedent. Uses the same session-level setter, not a separate request-local effort API. Its extension-unit harness does not establish fork-before restored thinking/provider payload, queued-all continuation or runtime startup-provenance behavior. README warns the before_agent_start signal may be unavailable. |
| Pi virtual models / jev-router | Public route(request, ctx) returns physical model + thinkingLevel; request signal, request reasons and branch-local state | Existing request-scoped routing abstraction. Requires selecting a virtual model, changing selected-model/transcript/UI semantics. Not a transparent physical-selection-preserving effort path under the current contract; useful if that UX difference is explicitly approved. |
| Pi Durable | Separate experimental harness with transactional admission/configuration, durable tasks, forks, queue and abort ownership | Strong state primitives, but not a coding-agent CLI extension adapter. Generation beforeRequest transforms messages only; thinking is captured from agent configuration earlier. Using it requires an application/harness integration rather than dropping a helper into this package. |

### Source locations

In pi-auto at the pinned commit: `src/index.ts:216–270,273–385` handles lifecycle, classification and effort application; `src/classifier.ts:57–131` uses Pi classifier transport; `src/router.ts:58–137` retains the answering model. `tests/index.test.ts:86–173` defines its mocked extension harness; abandoned-branch tests at `1378–1403` check decision display rather than restored provider effort. See [source](https://github.com/ekil1100/pi-auto/blob/6c60ab37debc96ae48e1ca0957e777c2b3ebacc8/src/index.ts).

In official Durable v1.3.0: [GenerationHooks](https://github.com/earendil-works/pi/blob/v1.3.0/packages/durable/src/harness/types.ts#L756-L769) permits a beforeRequest result containing messages, not thinkingLevel. [Generation execution](https://github.com/earendil-works/pi/blob/v1.3.0/packages/durable/src/harness/generation.ts#L129-L219) captures model/thinking in prepare before invoking that hook. Durable cancellation of a wait is distinct from explicitly aborting conversation work.

## What this establishes

No reviewed source supplies a documented ordinary-extension request-local thinking seam that transparently retains selected physical-model semantics and proves the full current lifecycle matrix. This is a bounded source finding, not proof that every implementation approach is impossible or that either package is defective.

The lifecycle ownership requirement in AC-26 is approved. Preserving native explicit startup thinking precedence on every runtime replacement, including equality with an excluded provisional value (CLI-26l), is a separate compatibility interpretation added during implementation. It is not explicitly stated in AC-26 and must not be presented as an independently approved original Jev requirement. A host patch is one investigated solution to the stronger combined contract, not an inevitable prerequisite for every faithful port.

Before adopting pi-auto's event/setter pattern or virtual routing, run actual official CLI/local-classifier/local-provider fixtures for dispatch, fork/tree, queues and cancellation. No source-only research result should be reported as E2E acceptance. No proposal has been integrated and ticket 01 remains unmerged.
