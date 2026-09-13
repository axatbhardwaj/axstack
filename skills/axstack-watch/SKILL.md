---
name: axstack-watch
description: Bounded 24h monitoring with Paseo wake ownership, resumable handoff, and feedback routing.
---

# Watch

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)
- [Shared routing](../axstack/references/routing.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)

PR owners remain responsible during the configured monitoring window
(default 24 hours). One persistent owner per PR; one watch per PR.

## Adopt an existing PR

Babysitting starts by adopting the PR, not by re-specifying it: record
the accepted maintenance scope snapshot once (linked issue plus
acceptance criteria, actual remote head and base, current ownership and
watch state). The snapshot is accepted without repeated approval.
Monitoring-only adoption never authorizes repairs or replies. Reuse the
recorded owner and watch where live; reconcile before registering
anything new.

## Wake ownership

The owner registers wake-ups through existing Paseo mechanisms (CI/review
state changes, bounded scheduled checks) and records what is watched and
who wakes. Do not keep models reasoning continuously while waiting. On
resume, reconcile against recorded watch state first; never spawn duplicate
watchers for the same PR.

## Observation-only dispatch

Observation-only monitoring dispatches no author and sends no reply: the
driver (or the read-only monitor below) reconciles recorded watch state,
runs read-only CI and review checks, and reports observations in chat.
Changed heads, CI results, and review feedback never route to a writer
in this mode; product code is untouched.

## Authorized repairs

Writable babysitting requires author ownership and authorized
publication. Route accepted fixes to the original author session (the
same author where evidence allows), followed by a refreshed independent
review before anything is republished (see `axstack-review`). Before
publication, all of the following hold:

- The repaired code and the exact public reply text were both reviewed.
- Fresh remote head and base plus fresh review feedback were confirmed
  (exact-head readback; stale reads never authorize publication).
- Current verified receipts from both reviewers cover the exact new
  revision, with no unresolved material finding and no open urgent hold.

Deliver through `gh stack` scoped to the adopted PR only, with no
overwrite of unrelated stack entries. Verify the submission receipt
after publication; on ambiguity, lookup before retry.

## Monitor and watchdog

The monitor and the watchdog are independent, read-only Opus medium
sessions on native Paseo timers — not authors, not reviewers, not
repliers. They require initial verified handshakes, emit snapshot-only
healthy ticks that never wake the driver, dedup event IDs, and reconcile
uncertain sends before any retry. On restart they reuse prior watch
state instead of registering duplicates. Both stop at the same
configured default 24h deadline, including registrations for still-open
PRs — never silently renewed.

## Feedback routing

Changed heads, CI results, and review feedback route to the same author
session where evidence allows, followed by a refreshed independent review
before anything is republished (see `axstack-review`). Repairs route only
under a confirmed approved baseline (authored mode) or accepted linked
intent (peer mode): a missing or unaccepted baseline holds repair
routing while monitoring and read-only checks continue. Publishing still
requires a current verified receipt and no open urgent hold.

## End conditions and cleanup

- End early when all required PRs merge; stop all owned watch registrations.
- Otherwise end at the configured deadline and stop all owned watch registrations — including registrations for still-open PRs, which continue only via their resumable handoffs. Work remaining at expiry gets a resumable handoff, never silently renewed monitoring.
- Merge-ready is an observed state, distinct from merged; the human
  merges by default, bottom-up for a stack.

## Template: resumable handoff (all fields required)

```text
PR: <URL> rev <sha>
Owner: <profile> Worktree: <path>
Spec: <approved rev or accepted linked intent> Capability: <issue + state>
CI/review: <states + links>
Remaining: <next actions + who>
Resume: <commands/refs to restart from this rev>
```
