# Watch runtime

Read this before starting, resuming, or stopping automated PR observation.

## Standalone watch

A standalone PR owner remains accountable through the default 24-hour window.
`axstack-monitor` is an optional independent read-only observer: it reads the
current GitHub state, persists event IDs, wakes the owner only for a new
actionable event, and never sends or mutates. Healthy observations update
quietly. Reuse prior watch identity rather than registering a duplicate, and
stop task-owned registrations at completion, cancellation, or expiry.

## Native watch manager

The separate native watch manager lane follows the
[native PR-manager contract](../../axstack/references/automations.md). Each pass
uses a new isolated workspace and fresh finite session at minutes `7,22,37,52`.
Continuity survives outside disposable workspaces; admission reconciles the
whole lane across workspaces. It scans every eligible own PR and
admits bounded actionable-event jobs within measured host capacity. Waiting PRs
stay covered without reserving slots. Each job uses its own repository-parented worktree and
settles with all descendants; no model, per-PR timer, or polling loop waits for
CI, review, a user decision, or merge.

Load the version-matched Orca automation and orchestration guidance through the
shared [runtime boundary](../../axstack/references/orca-runtime.md). Requested
settings or source configuration are not runtime evidence. Preserve quiet
unchanged behavior, exact-head event dedupe, ownership, complete discovery,
and current authority.

Before activation, canary fresh-session launch, an overlapping scheduled pass,
session loss and recovery, nested dispatch depth for coordinator-launched leaves, and
total process and memory behavior. Until observed, those remain unverified; do
not replace them with a precheck, watchdog, custom scheduler, state engine, or
legacy fallback.

On recovery reconcile actual native workers, GitHub, and the compact run record
before admitting work. Unknown state blocks only the affected PR. At every job
end, settle owned workers, preserve unsafe or user-owned state, release proven
resources, and leave exact resumable receipts.
