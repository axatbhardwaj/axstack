---
name: axstack-align
description: When exploring or planning an idea before a spec, use axstack-align to resolve decisions that lead to a spec and tickets.
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
4. Read-back: include the alignment summary — decisions, constraints, exclusions — as part of the draft spec in `axstack-spec`. The ONE human phase checkpoint is spec approval; this read-back informs it and adds no separate gate.

## Fable hook

Involve the Fable advisor for consequential scoping trade-offs (per
[Standing contracts](../axstack/references/contracts.md)): driver
assessment first, then advisor evidence; cache the decision receipt and
carry it into `axstack-spec` so covered ground is not re-consulted.
The driver owns the outcome; the user resolves decisions.

Output: an agreed decision/constraint list ready for `axstack-spec`. If the
user invoked a later phase directly with its required inputs, skip to that
phase skill (which still requires its mode's scope identity).
