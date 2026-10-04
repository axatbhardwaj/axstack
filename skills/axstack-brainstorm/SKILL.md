---
name: axstack-brainstorm
description: When validating a design approach, use axstack-brainstorm to compare independent candidates and return a synthesis.
---

# Brainstorm

Standalone usage: `/axstack-brainstorm <problem + candidate approach>`.
Run inline in the current T3 driver thread. Never delegate a coordinator.
This procedure is report-only. Do not implement, prototype, or grant execution
or spec approval. Never interview the user or invoke Align.

Load [Standing contracts](../axstack/references/contracts.md) before acting.
Set the rung from researched facts under the
[design lens](../axstack/references/design-lens.md); Rung 2 meets its ADR test.
Follow the [arena procedure](references/arena.md), preserving settled decisions
and naming missing evidence. Candidates challenge the supplied approach as
well as proposing alternatives.

Return `recommend | revise | reject | unresolved` with the
[sketch](../axstack/references/design-lens.md#sketch), including `Rejected` and
`Open`, plus base, criterion scores, grafts, dropouts and completed judge rounds.
Return proposed questions to the caller. The caller owns preferences, next
steps and any approval; an open blocker stays unresolved.
