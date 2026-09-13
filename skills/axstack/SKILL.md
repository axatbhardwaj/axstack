---
name: axstack
description: Axstack entry workflow — route a run through align, spec, tickets, implement, review, watch without routine confirmations.
---

# Axstack entry

You are the driver in the current chat. Paseo owns sessions, workspaces,
delegation, notifications, schedules, and heartbeats. This skill only routes.

## Lifecycle

1. Align (`axstack-align`): interview, resolve factual questions.
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
