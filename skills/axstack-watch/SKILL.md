---
name: axstack-watch
description: Bounded 24h monitoring with Paseo wake ownership, resumable handoff, and feedback routing.
---

# Watch

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)

PR owners remain responsible during the configured monitoring window
(default 24 hours).

## Wake ownership

The owner registers wake-ups through existing Paseo mechanisms (CI/review
state changes, bounded scheduled checks) and records what is watched and
who wakes. Do not keep models reasoning continuously while waiting. On
resume, reconcile against recorded watch state first; never spawn duplicate
watchers for the same PR.

## Feedback routing

Changed heads, CI results, and review feedback route to the same author
session where evidence allows, followed by a refreshed independent review
before anything is republished (see `axstack-review`). Repairs route only
under a confirmed approved baseline: a missing or unaccepted baseline holds
repair routing while monitoring and read-only checks continue. Publishing still
requires a current verified receipt and no open urgent hold.

## End conditions and cleanup

- End early when all required PRs merge; stop all owned watch registrations.
- Otherwise end at the configured deadline and stop all owned watch registrations — including registrations for still-open PRs, which continue only via their resumable handoffs. Work remaining at expiry gets a resumable handoff, never silently renewed monitoring.

## Template: resumable handoff (all fields required)

```text
PR: <URL> rev <sha>
Owner: <profile> Worktree: <path>
Spec: <approved rev> Capability: <issue + state>
CI/review: <states + links>
Remaining: <next actions + who>
Resume: <commands/refs to restart from this rev>
```
