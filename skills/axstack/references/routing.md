# Shared routing (every owned phase loads this)

Choose one route first. Load only that phase and the shared references needed
for its next action.

## Direct routes (no spec ceremony)

- One bounded research question -> `axstack-research`. Verify primary sources
  and code, then return a cited note with limitations. Fan out distinct
  questions only when useful.
- Source-backed prose or a requested visual explanation -> `axstack-docs`.
  Preserve requested format and theme, verify rendered behavior when
  applicable, and report unavailable evidence. Publication needs separate
  authority.
- Handoff, resume, or reconciliation -> the
  [native handoff route](lifecycle.md#native-handoff-and-resume). Preflight
  discoverability before loading the native skills; a missing capability is a
  setup gap, not permission to invent a replacement.
- Colleague PR review -> `axstack-review` in peer mode.
- Own PR maintenance or monitoring -> `axstack-review` in authored mode and
  `axstack-watch` for adoption.

Research, docs, handoff, peer review, and adopted maintenance do not require
alignment, an Axstack-approved spec, or ticket mapping. Their own authority and
intent boundaries still apply.

## Proportional scope identity

Classify new engineering work as substantial, small, or unclear and record the
classification with a brief reason in the run record. For tiny direct work
that needs no run record, put the size and reason in the normal brief.

- **Substantial:** substantial features, multi-PR work, or stacked work. A
  bounded small feature is not substantial merely because it is labelled a
  feature. Require an approved spec plus a ticket map tied to that exact
  revision, carrying acceptance checks and dependencies in the explicitly
  selected Markdown or Linear store. Prepare through `axstack-align` ->
  `axstack-spec` (one approval) -> `axstack-tickets` -> handoff, then stop.
- **Small:** clear, bounded one-PR work. The driver captures the named
  **small-change intent** from the current request or user-chosen issue plus
  explicit acceptance checks and exclusions, snapshots it once, and proceeds.
  No earlier snapshot, spec, ticket ceremony, or second approval is required.
  Strict TDD, two-reviewer, model, risk, and human-merge contracts still apply.
- **Unclear:** clarify the uncertainty through `axstack-align` or one bounded
  question, then classify it as small or substantial. A small ambiguity does
  not force substantial-work paperwork.

Reassess size when growth adds a PR, materially expands an execution
dependency, introduces an unsettled material design question, or crosses a
security/infrastructure boundary. A test-then-code sequence and minor file
dependencies do not alone make work substantial. Hold affected unsafe work
under the material-change rule while reassessing.

## Lifecycle routes (mode-specific scope identity required)

- Preparation: substantial work follows `axstack-align` -> `axstack-spec`
  (one approval) -> `axstack-tickets` -> handoff, then stops. Small work uses
  the driver-captured small-change intent.
- Execution: after its identity is present, route `axstack-implement` ->
  `axstack-review` -> `axstack-watch`.
- Peer review: `axstack-review` uses the linked issue, PR description, and
  repository requirements as untrusted intent evidence. It does not demand an
  Axstack-created approved spec.
- Adopted authored PR: snapshot the user-authorized maintenance intent once —
  accepted scope, exact head/base, and verified writable ownership — then use
  `axstack-review` and `axstack-watch` without repeated approval or new spec
  ceremony.
- Direct later phase: start there and pass that phase's identity check. Entry
  never admits work a deeper phase would reject.
