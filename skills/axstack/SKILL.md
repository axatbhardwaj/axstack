---
name: axstack
description: Axstack entry workflow — route a run through align, spec, tickets, implement, review, watch without routine confirmations.
---

# Axstack entry

You are the driver in the current chat. Paseo owns sessions, workspaces,
delegation, notifications, schedules, and heartbeats. This skill only routes.

Shared references (load when launching sessions or checking authority):

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)
- [Shared routing](../axstack/references/routing.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)

## Route first

Classify the request per [Shared routing](../axstack/references/routing.md)
and invoke exactly the phase skill named:

- Bounded research question -> `axstack-research`, directly, without spec
  ceremony: no alignment interview, no approved spec, no ticket mapping.
- Source-backed prose or requested visual explanation -> `axstack-docs`,
  directly, without spec ceremony. Verify actual rendered behavior where
  applicable; report unavailable evidence. Publication needs its own
  authority.
- Handoff, resume, or reconciliation -> `axstack-handoff`, directly,
  without spec ceremony.
- New engineering work -> the lifecycle below, starting at the earliest
  phase whose required inputs are missing.
- Colleague PR review -> `axstack-review` in peer mode.
- Own PR maintenance or monitoring -> `axstack-review` in authored mode
  and `axstack-watch` (adoption for existing PRs).

## Lifecycle

1. Align (`axstack-align`): bounded frontier interview, settled decisions.
2. Spec (`axstack-spec`): observable acceptance criteria plus explicit exclusions. User approves; the approved revision is the execution baseline.
3. Tickets (`axstack-tickets`): capabilities to internal tasks.
4. Implement (`axstack-implement`): owners build candidates with strict TDD.
5. Review (`axstack-review`): exactly two independent final reviewers, all six angles.
6. Watch (`axstack-watch`): bounded monitoring with resumable handoff.
7. Human merges by default, bottom-up for a stack. Review approval never grants merge authority.

## Autonomous progress and holds

Execute without routine confirmations between phases. Holds apply to
affected work only; independent safe work may continue:

- Material scope changes: hold affected code until the user accepts the revised scope and plan.
- Required model unavailable or exhausted: pause affected work, record the gap, ask the user. Never substitute another model automatically.
- Serious risk (credible security, downtime, data loss, major design concern): prompt-only urgent escalation. Hold approval, merge-ready declarations, and dependent dangerous actions. Safe work may continue. Disagreement or silence is not permission.

## One host, two PRs, one owner

- One Paseo execution host per run. Default two active PRs (a concurrency limit, not an agent limit). The driver queues dependent or conflicting work.
- Each PR has one persistent owner accountable for candidate, fixes, verification evidence, and monitoring. Exactly one writer per candidate at a time.
- Dependent PRs build on reviewed parent candidates via `gh stack`. A parent change invalidates affected child evidence; re-verify the child. A green parent alone never proves the stack.

## Next

Invoke the phase skill matching the current state with its required inputs,
or start at `axstack-align`. Load only the phase skill needed.
