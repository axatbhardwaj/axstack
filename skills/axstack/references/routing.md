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

## Lifecycle routes (approved scope required)

- New work: `axstack-align` -> `axstack-spec` (user approves; the approved
  revision is the execution baseline) -> `axstack-tickets` ->
  `axstack-implement` -> `axstack-review` -> `axstack-watch`.
- Peer (colleague) PR review (`axstack-review` in peer mode): linked issue
  plus PR description and repository requirements are the intent. Demands
  no Axstack-created approved spec.
- Authored PR maintenance (`axstack-watch` adoption, `axstack-review` in
  authored mode): record the accepted maintenance scope snapshot once;
  it is accepted without repeated approval.
- A later phase invoked directly with its required inputs starts there;
  lifecycle phases still confirm their required baseline first.
