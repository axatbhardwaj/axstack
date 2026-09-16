# Watch runtime

Read this before starting, resuming, or stopping automated PR observation.

## Accepted policy

The PR owner remains accountable throughout one shared default 24-hour window.
`axstack-monitor` and `axstack-watchdog` are independent, read-only roles, not
authors, reviewers, repliers, or owners.

- **Monitor:** `axstack-monitor` is an optional read-only observer that reads
  GitHub, all PR feedback, and latest checks every five minutes, persists event
  IDs, wakes the owner only for a new actionable event, and never sends.
- **Watchdog:** `axstack-watchdog` reads only automation health, handshake
  state, and snapshot freshness hourly and never mutates GitHub; it may perform
  exactly one kind of send, a gate-authorized automation-health escalation
  recorded in `watchdog.json`, and otherwise reports a verified health failure
  to the owner.

Healthy observations are snapshot-only and update quietly; they wake neither owner nor
driver. Both roles deduplicate event IDs. Uncertain delivery is reconciled
before retry. Restart reuses prior watch identity rather than registering a
duplicate. The shared deadline ends earlier on completion or cancellation and
is never silently renewed.

## Native Orca automations

Load the version-matched Orca automation guidance through the shared
[runtime boundary](../../axstack/references/orca-runtime.md). The verified
native automation schema supports provider selection, but model, effort, and
permission pinning are unsupported, and its schedule parser cannot preserve
the accepted bounded expiry by itself. Requested role values or a post-launch
self-report are not effective launch evidence.

The user lifted the native-watch hold by user decision on 2026-09-16. The accepted
contract now has a new shape: the driver automation is a mutating owner for the
PRs it handles, not an independent read-only monitor, and the watchdog keeps
the independent read-only health contract. The driver is the automation
session itself, with no `axstack-monitor` or `axstack-owner` role row
materialized for it. The driver records its own model
identity on every tick and the watchdog compares it with the expected model; a
mismatch is a safety hold, never a silent substitution. The bounded expiry is
enforced by the run record's watch deadline, not by the schedule parser. Still
introduce no custom scheduler or polling loop and use no legacy runtime
fallback. The session-level contract lives in
[Automation sessions](../../axstack/references/automations.md).

## Preserve the contract under automation

An automation session preserves the roles, five-minute/hourly cadences, quiet
healthy behavior, deduplication, handshake, watched scope, wake owner, and
shared expiry. Test active expiry, missed final ticks, restart, duplicate
ticks, cancellation, session-reuse fallback, and final cleanup before enabling.
A firing timestamp proves neither delivery nor work advancement. An unrequested
fallback session reconciles ownership and never becomes owner silently.

At every end condition, stop all task-owned registrations, verify runtime
cleanup receipts, and capture remaining work as resumable state. Removing watch
coverage, weakening role discipline, or changing the deadline requires a
material specification revision; it is not an implementation workaround.
