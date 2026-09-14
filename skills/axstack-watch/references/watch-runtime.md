# Watch runtime

Read this before starting, resuming, or stopping automated PR observation.

## Accepted policy

The PR owner remains accountable throughout one shared default 24-hour window.
`axstack-monitor` and `axstack-watchdog` are independent, read-only roles, not
authors, reviewers, repliers, or owners.

- **Monitor:** reads GitHub, all PR feedback, and latest checks every five
  minutes. It persists event IDs and wakes the owner only for a new actionable
  event.
- **Watchdog:** reads only automation health, handshake state, and snapshot
  freshness hourly. It reports a verified health failure to the owner.

Healthy observations are snapshot-only and update quietly; they wake neither owner nor
driver. Both roles deduplicate event IDs. Uncertain delivery is reconciled
before retry. Restart reuses prior watch identity rather than registering a
duplicate. The shared deadline ends earlier on completion or cancellation and
is never silently renewed.

## Native Orca capability hold

Load the version-matched Orca automation guidance through the shared
[runtime boundary](../../axstack/references/orca-runtime.md). The verified
native automation schema supports provider selection, but model, effort, and
permission pinning are unsupported. Its schedule parser also cannot preserve
the accepted bounded expiry. Requested role values or a post-launch self-report
are not effective launch evidence.

Therefore watch activation and the complete Orca migration claim are held.
Create no schedule while this hold remains, activate no production timer, use
no legacy runtime fallback, and introduce no custom scheduler or polling loop.
Core installer and supervised workflow work may continue independently; A8
remains unverified.

## Resume when capability exists

A future approved implementation must preserve the roles, five-minute/hourly
cadences, quiet healthy behavior, deduplication,
handshake, watched scope, wake
owner, and shared expiry. Test active expiry, missed final ticks, restart,
duplicate ticks, cancellation, session-reuse fallback, and final cleanup.
A firing timestamp proves neither delivery nor work advancement. A fallback
session reconciles ownership and never becomes owner silently.

At every end condition, stop all task-owned registrations, verify runtime
cleanup receipts, and capture remaining work as resumable state. Removing watch
coverage, weakening role discipline, or changing the deadline requires a
material specification revision; it is not an implementation workaround.
