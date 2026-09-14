# Watch runtime

Read this before registering, resuming, or stopping watch roles or timers.

## Roles

The PR owner remains accountable throughout the configured monitoring window.
`axstack-monitor` and `axstack-watchdog` are independent, read-only configured
sessions, not authors, reviewers, or repliers. Materialize each through the
shared Paseo launch sequence and routing snapshot. Each owns its timer and
snapshot.

- **Monitor:** read GitHub, all PR feedback, and the latest check runs. Default
  cadence is 5min. Surface actionable events with persisted, acknowledged event
  IDs so a retried wake cannot start a duplicate repair.
- **Watchdog:** read only watch health: timer liveness, handshake state, and
  snapshot freshness. Default cadence is hourly. Report the verified handshake
  to the owner.

Record the verified session, handshake, timer, snapshot, watched scope, wake
owner, and expiry for each role before treating the watch as live.

## Wake and retry discipline

Healthy ticks update snapshots only; they wake neither owner nor driver. Both
roles dedup event IDs. Before retrying an uncertain send, reconcile its actual
delivery state. On restart, reconcile and reuse prior watch state instead of
registering duplicates.

A wake records whether it was healthy, actionable, or uncertain. Wake the owner
only for a new actionable event.

## Shared expiry and cleanup

The configured default 24h deadline is one deadline for monitor and watchdog,
including timers attached to still-open PRs. Stop both earlier when all required
PRs merge or when the watch is cancelled. Clean up an individual PR's owned
timers when that PR closes. At every end condition, cancel all owned
registrations and verify their timer receipts. A new user-authorized window is
a new decision, never a silent renewal.

Runtime cleanup ends with every owned registration confirmed stopped and any
remaining work captured as resumable state in the private run record.
