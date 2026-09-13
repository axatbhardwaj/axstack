# Shared routing (every owned phase loads this)

Classify the request first, then invoke exactly the phase skill named.
Load only that phase skill plus the shared references.

## Direct routes (no spec ceremony)

These need no alignment interview, approved spec, or ticket mapping:

- Research question (`axstack-research`): one bounded question, verified
  primary sources and code, cited note with limitations. One question
  needs no panel; fan out distinct questions only when useful.
- Prose or visual explanation (`axstack-docs`): source-backed writing and
  requested visual artifacts. Preserve the requested format and theme;
  verify actual rendered behavior where applicable, else report the gap.
  Publication needs its own authority.
- Handoff or resume (`axstack-handoff`): compact handoff, resume
  reconciliation, routing back into the lifecycle below.

## Proportional scope identity

Classify new engineering work as substantial, small, or unclear and record the
classification with a brief reason in the run record. For tiny direct work
that needs no run record, put the size and reason in the normal brief.

- Substantial means substantial features, multi-PR, or stacked work. A bounded
  small feature is not substantial merely because it is labelled a feature.
  Substantial work requires an approved spec plus a ticket map tied to that
  exact spec revision. The ticket map carries acceptance checks and
  dependencies, with Markdown or Linear selected explicitly as its store. Prepare it through
  `axstack-align` -> `axstack-spec` (one approval) -> `axstack-tickets` ->
  handoff; preparation stops there and never auto-executes.
- For small, clear, bounded one-PR work, the driver captures the named
  **small-change intent** from the current request or the user-chosen existing
  issue plus explicit acceptance checks and exclusions, snapshots it once, and
  proceeds. No pre-existing snapshot, spec, ticket ceremony, or second approval
  is required. Do not bounce to `axstack-align` solely because the snapshot is
  not yet written. All TDD, exactly-two cross-model review, risk, model, and
  human-merge contracts remain unchanged.
- Unclear work is clarified first through `axstack-align` or one bounded
  clarifying question, then classified as small or substantial. A small
  ambiguity does not force full paperwork.

Reassess size when growth adds an additional PR, a new execution dependency
that materially expands approved scope, an unsettled material design question,
or a security or infrastructure boundary. An ordinary test-then-code sequence
is not multi-task growth, and a minor file dependency is not by itself a reason
for a formal spec. Hold affected unsafe work under the existing material-change
rule while reassessing.

## Lifecycle routes (mode-specific scope identity required)

- Preparation: substantial work only follows `axstack-align` -> `axstack-spec`
  (one approval) -> `axstack-tickets` -> handoff, then stops. Small work uses
  the driver-captured small-change intent above.
- Execution: with the applicable identity present, entry routes
  `axstack-implement` -> `axstack-review` -> `axstack-watch`.
- Peer (colleague) PR review (`axstack-review` in peer mode): linked issue
  plus PR description and repository requirements are the intent. Demands
  no Axstack-created approved spec.
- Authored PR maintenance (`axstack-watch` adoption, `axstack-review` in
  authored mode): record the user-authorized maintenance intent snapshot
  once (accepted scope, actual head/base, verified writable ownership);
  it is accepted without repeated approval and needs no new spec or
  ticket ceremony.
- A later phase invoked directly starts there with its own identity check;
  entry never admits work that a deeper phase would reject.
