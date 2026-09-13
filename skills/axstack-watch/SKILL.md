---
name: axstack-watch
description: When babysitting an existing PR, use axstack-watch to monitor or maintain it within bounded authority.
---

# Watch

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)
- [Shared routing](../axstack/references/routing.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)

PR owners remain responsible during the configured monitoring window
(default 24 hours). One persistent owner per PR; one watch per PR.

## Standalone owner

Standalone watch adoption materializes `axstack-owner` via
[Paseo launch](../axstack/references/paseo-launch.md); reuse the
existing owner where live. The current chat stays out of coordination
once the owner exists — no competing coordinator. Only the owner
launches the writer, reviewers, monitor, and watchdog. Workers launch
no recursive teams and create no children. The adoption watcher itself
is never the writer.

## Adopt an existing PR

Babysitting starts by adopting the PR, not by re-specifying it: verify
writable ownership and user maintenance authority first, then record
the accepted maintenance scope snapshot once (user-authorized
maintenance intent, actual remote head and base, current ownership and
watch state). The snapshot is accepted without repeated approval and
needs no new spec or ticket ceremony. Without verified authority, all
write paths hold; monitoring and read-only checks may continue.
Monitoring-only adoption never authorizes repairs or replies. Reuse the
recorded owner and watch where live; reconcile before registering
anything new.

## Wake ownership

The owner registers wake-ups through existing Paseo mechanisms (CI/review
state changes, bounded scheduled checks) and records what is watched and
who wakes. Do not keep models reasoning continuously while waiting. On
resume, reconcile against recorded watch state first; never spawn duplicate
watchers for the same PR.

## Observation-only dispatch (dominates every repair path)

Observation-only monitoring dispatches no author and sends no reply: the
driver (or the read-only monitor below) reconciles recorded watch state,
runs read-only CI and review checks, and reports observations in chat.
This restriction dominates every repair path — changed heads, CI
results, and review feedback never route to a writer in this mode, no
matter how obvious the fix; product code is untouched. Peer mode never
repairs: colleague PRs are read-only by definition.

## Authorized repairs (adopted own PRs only)

Writable babysitting requires verified author ownership and authorized
publication. Route accepted fixes to the original author session (the
same author where evidence allows), followed by a refreshed independent
review before anything is republished (see `axstack-review`). Before
an authorized push or reply, all of the following hold:

- The repaired code and the exact public reply bodies — keyed to their
  feedback IDs and bound to the exact revision under review — were both
  reviewed.
- Fresh remote head and base, reply body identity, and feedback
  freshness were confirmed (exact-head readback; stale reads never
  authorize publication).
- The expected-old SHA was confirmed before any history rewrite; no
  blind overwrite, ever.
- Current verified receipts from both reviewers cover the exact new
  revision, with no unresolved material finding and no open urgent hold.

Deliver through `gh stack` scoped to the adopted PR only, with no
overwrite of unrelated stack entries. Verify the submission receipt
after publication; on unknown send outcome, inspect remote IDs, bodies,
and actor before any retry, and remain blocked while the outcome stays
ambiguous.

## Monitor and watchdog

The monitor and the watchdog are independent, read-only Opus medium
sessions on native Paseo timers — not authors, not reviewers, not
repliers. No new scheduler: each owns its own timer and snapshot.

- Monitor: reads GitHub and all PR feedback plus the latest check runs
  (default 5min cadence). Surfaces actionable events with persisted,
  acknowledged event IDs so a retried wake never triggers a duplicate
  repair.
- Watchdog: reads only watch health — timer liveness, handshake state,
  snapshot freshness (default hourly cadence). Reports its handshake to
  the owner; owns its timer and snapshot.

Both require initial verified handshakes and emit snapshot-only healthy
ticks that wake neither owner nor driver. Both dedup event IDs and
reconcile uncertain sends before any retry. On restart they reuse prior
watch state instead of registering duplicates. Both stop at the same
configured default 24h deadline, including registrations for still-open
PRs — never silently renewed. Timer receipts are verified and cleaned
up on early PR closure, cancel, or expiry.

## Readiness (owner validates)

API errors block readiness — never imply coverage. The owner validates
readiness against current required checks, feedback, approvals, and
mergeability before any merge-ready statement. A review approval alone
is not merge-ready.

## Feedback routing

Changed heads, CI results, and review feedback route to the same author
session where evidence allows, followed by a refreshed independent review
before anything is republished (see `axstack-review`). Repairs route only
under a confirmed approved spec baseline (substantial new work), a
snapshotted small-change intent (small new work), or an accepted maintenance
snapshot (adopted own PRs): a missing or unaccepted scope holds repair routing
while monitoring and read-only checks continue.
Publishing still requires a current verified receipt and no open urgent
hold.

## End conditions and cleanup

- End early when all required PRs merge; stop all owned watch registrations.
- Otherwise end at the configured deadline and stop all owned watch registrations — including registrations for still-open PRs, which continue only via their resumable handoffs. Work remaining at expiry gets a resumable handoff, never silently renewed monitoring.
- Merge-ready is an observed state, distinct from merged; the human
  merges by default, bottom-up for a stack.

## Template: resumable handoff (all fields required)

```text
Record: <progress.md path>
PR: <URL> rev <sha>
Owner: <profile> Worktree: <path>
Spec: <approved rev or accepted linked intent> Capability: <issue + state>
CI/review: <states + links>
Remaining: <next actions + who>
Resume: <commands/refs to restart from this rev>
```
