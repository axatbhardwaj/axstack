---
name: axstack-align
description: When exploring or planning an idea and settling its scope and decisions, use axstack-align for a bounded interview before any spec.
---

# Align

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)

Research facts yourself; spend user questions on decisions and constraints.

## Bounded frontier interview

1. Research: gather facts from docs, code, and tool access first. Never ask the user for something you can verify cheaply.
2. Frontier: ask only about open decisions and constraints (scope edges, trade-offs, priorities). Cap rounds: state what you already settled, ask the smallest set that unblocks the spec, and offer a recommendation with each question.
3. Reuse: settled decisions carry forward across phases and resumes unless material new evidence changes them. When revisiting, restate the settled decision and proceed; reopen it only on such evidence.
4. Read-back: include the alignment summary — decisions, constraints,
   exclusions — in the handoff. For substantial work it becomes part of the
   draft spec in `axstack-spec`; the one human checkpoint is spec approval.

## Fable hook

Involve the Fable advisor for consequential scoping trade-offs (per
[Standing contracts](../axstack/references/contracts.md)): driver
assessment first, then advisor evidence; cache the decision receipt and
carry it into `axstack-spec` so covered ground is not re-consulted.
The driver owns the outcome; the user resolves decisions.

## Stop with preparation

Classify the result using the shared
[proportional scope identity](../axstack/references/routing.md#proportional-scope-identity).
For small unclear work, resolve the bounded ambiguity and return a
**small-change intent** handoff. For substantial work, prepare an approved spec
and matching ticket map through `axstack-spec` then `axstack-tickets`, and
return that handoff. A still-valid approval is never repeated. Alignment stops
for both sizes and never auto-executes; the user invokes `axstack` to execute.
