# Pi thinking provenance investigation

## Status

Local experiment reviewed as **viable with limitations**, not production approval. Ticket 01 remains blocked on supported host provenance. The operator authorized investigation only; no target change, upstream submission, remote publication, or installed-host patch is authorized.

## Prototype

- Official baseline: Pi v1.3.0, `71023aec1546d6d677a65669c5665c0927ce0dd0`.
- Separate checkout: `/tmp/pi-jev-host-api-investigation`.
- Experimental branch: `investigate/jev-effort-boundary`.
- Experimental commit: `a5eef4497a8fed4c86d2c7250fe2ce59681e31cf`.
- Proposal and acceptance matrix: `packages/coding-agent/docs/experimental-thinking-provenance.md` in that checkout.

The additive public proposal is `SessionStartEvent.thinkingLevelOverride?: ThinkingLevel`. SDK derives it from raw explicit `options.thinkingLevel`, after spreading caller-supplied event metadata. It does not infer provenance from effective value, settings, history or extension-side argv parsing. Undefined differs from explicit off; raw requested effort may differ from clamped effective effort.

A copied experimental consumer honors authoritative startup selection on runtime creation/replacement, while retaining manual active-prefix thinking on tree navigation and same-runtime reload. Production port source and installed packages were not modified.

## Evidence

The prototype satisfies the three previously conflicting cases together: no-override fork-before restores medium; explicit startup high equal to excluded provisional high stays high; tree navigation retains manual low. Tests also cover queue batches, cancellation, defaults, fork-at, explicit off, clamping and SDK metadata spoof prevention.

Independent read-only review found no concrete defect in the bounded proposal. Parent independently reran all eight focused test files at the exact clean experimental commit: **79 tests pass**, exit 0. Log: `/tmp/pi-jev-host-api-parent-tests.log`. These are source CLI/SDK tests with deterministic local fixtures, not installed official-release acceptance or paid-provider verification.

Worker additionally ran read-only Biome and decomposed root-check subgates. Literal root `npm run check` was not run because it writes repository-wide formatting. Full monorepo build/test suite and interactive rendering were not verified.

## Production constraints and options

Old Pi hosts without the optional field are indistinguishable from supporting hosts with no startup override. Production needs an authoritative capability/version contract; field presence alone is not a safe gate. Direct AgentSession construction bypassing SDK and competing startup writers are outside the experiment's guarantee. Some replacement subpaths were source-inspected rather than separately exercised by new provenance tests.

Safe next decisions are either to prepare a local upstream-ready proposal without submitting it, explicitly authorize an upstream submission, or approve designing a separate custom-host target with explicit capability gating. None is implicit in investigation approval. Retaining official stable Pi-only support means ticket 01 stays blocked until an appropriate supported release/API exists. No workaround or acceptance reduction has been approved.
