# Watch runtime

Read this before starting, resuming, or stopping automated PR observation.

## Accepted policy

The PR owner remains accountable throughout a standalone watch's default
24-hour window. `axstack-monitor` and `axstack-watchdog` are independent,
read-only roles, not authors, reviewers, repliers, or owners.

- **Monitor:** `axstack-monitor` is an optional read-only observer that reads
  GitHub, all PR feedback, and latest checks on its registered cadence, persists event
  IDs, wakes the owner only for a new actionable event, and never sends.
- **Watchdog:** for the PR automations, it is a model-free hourly shell precheck
  that never mutates GitHub, has no gate, and records each tick in
  `watchdog.log`.

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

The user lifted the native-watch hold by user decision on 2026-09-16. The
driver every 15 minutes dispatches and exits as the mutating owner, and the
watchdog is model-free and read-only, has no gate, and records `watchdog.log`;
there is no watch deadline for automations. The driver is the automation
session itself, with no `axstack-monitor` or `axstack-owner` role row. Still
introduce no custom scheduler or polling loop and use no legacy runtime
fallback. The session-level contract lives in
[Automation sessions](../../axstack/references/automations.md).

## Preserve the contract under automation

An automation session preserves its 15-minute driver and hourly model-free
watchdog cadences, quiet healthy behavior, deduplication, handshake, watched
scope, and wake owner. Test restart, duplicate ticks, cancellation,
session-reuse fallback, and final cleanup before enabling.
A firing timestamp proves neither delivery nor work advancement. An unrequested
fallback session reconciles ownership and never becomes owner silently.

At every end condition, stop all task-owned registrations, verify runtime
cleanup receipts, and capture remaining work as resumable state. Removing watch
coverage, weakening role discipline, or changing the deadline requires a
material specification revision; it is not an implementation workaround.
