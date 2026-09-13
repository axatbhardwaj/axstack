---
name: axstack-align
description: Bounded frontier interview — agent researches facts, user resolves decisions and constraints.
---

# Align

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)

Research facts yourself; spend user questions on decisions and constraints.

## Bounded frontier interview

1. Research: gather facts from docs, code, and tool access first. Never ask the user for something you can verify cheaply.
2. Frontier: ask only about open decisions and constraints (scope edges, trade-offs, priorities). Cap rounds: state what you already settled, ask the smallest set that unblocks the spec, and offer a recommendation with each question.
3. Reuse: settled decisions carry forward across phases and resumes. When revisiting, restate the settled decision and ask only for confirmation or the delta.
4. Completion check: close by reading back shared understanding — decisions, constraints, exclusions — and require explicit user agreement before `axstack-spec`.

Output: an agreed decision/constraint list ready for `axstack-spec`. If the
user invoked a later phase directly with its required inputs, skip to that
phase skill (which still requires an approved spec baseline).
