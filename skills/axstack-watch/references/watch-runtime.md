# Watch runtime

Read this before starting, resuming, or stopping automated PR observation.

## Standalone watch

A standalone PR owner remains accountable through the default 24-hour window.
`axstack-monitor` is an optional independent read-only observer: it reads the
current GitHub state, persists event IDs, wakes the owner only for a new
actionable event, and never sends or mutates. Healthy observations update
quietly. Reuse prior watch identity rather than registering a duplicate, and
stop task-owned registrations at completion, cancellation, or expiry.
