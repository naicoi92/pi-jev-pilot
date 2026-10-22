# Issue Tracker: Local Markdown

## Layout

- Feature directory: `.scratch/<feature-slug>/`
- Spec: `.scratch/<feature-slug>/spec.md`
- Implementation tickets: `issues/<NN>-<slug>.md` within that directory,
  numbered from `01`, one file per ticket.
- Triage state: a `Status:` line near the top, using the vocabulary
  in `triage-labels.md`.
- Comments: append under `## Comments`.

## Implementation lifecycle

Triage `Status:` remains the readiness label, not execution completion. Implementation tickets use a separate `Implementation:` field: `pending`, `in-progress`, or `completed`. Mark completed only after reviewed work is merged and integration verification passes; record merge SHA and evidence under Comments. Dependencies are satisfied by completed implementation fields or resolved decision tickets.

## Skill Operations

- Publish a spec or ticket: create its file in the layout above.
- Fetch a ticket: read the referenced file.
- Record dependencies: add `Blocked by:` with ticket numbers.

## Wayfinding

- Map: `.scratch/<effort>/map.md`
- Decision tickets: `.scratch/<effort>/issues/<NN>-<slug>.md`
- Type: `research`, `prototype`, `grilling`, or `task`.
- Decision lifecycle: `Status: claimed` or `Status: resolved`;
  this is separate from implementation triage vocabulary.
- A decision ticket is unblocked when all listed blockers are resolved.
- Frontier: unclaimed, unresolved, unblocked tickets, ordered by number.
- Claim: set `Status: claimed` before work.
- Resolve: append `## Answer`, set `Status: resolved`, and link the
  result from the map's Decisions-so-far section.
