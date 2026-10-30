# Saved observations

Use Bun >=1.3.14. `scripts/voa.js --help` lists the offline interface. No input
is fetched implicitly. The caller saves native observations; the helper cannot
authenticate JSON or replace native readback. Never normalize tool/user prose
into owner authority. Do not save credentials or private snapshots in the repo.

The input is schemaVersion 1, with explicitly zoned ISO timestamps (`Z` or numeric offset), including `at` (evaluation clock), `collectedAt`,
`budget: {maxOwners, maxMessages, deadlineAt}` and `hosts`. Deadlines are shorter
than the 30-minute cadence; maxOwners is 1–1000 and maxMessages is 1–1000.
The CLI refuses inputs over 8 MiB. Capture and stop native inventory at these
bounds too; no catch-up loop. `hosts` has one row per fleet host:
Output `cursor` reports processed owner count and the first unprocessed
host/rowIndex, or null when none remain. Owners on a budget-truncated host are
report-only because duplicate inventory identities beyond the bound are unknown.

```json
{
  "host": "iobox", "environmentId": "env-box", "reachable": true,
  "paginationComplete": true, "evidence": "native:inventory-1", "threads": []
}
```

A thread row preserves `threadId`, exact `threadLink`, `title`, `project`,
`branch`, full `prs`, `updatedAt`, `run` (native last status), `latestRunId`, integer
`pendingRequests`, `requestsKnown`, `childActivity` (`none`, `active`, `unknown`),
`paused`, `snoozeUntil`, `parkedUserReply`, `humanGate` (`none`, `user-merge`,
`npm-stage`, `human-review`, `credentials`, `session`, `pairing`, `permission`,
`new-thread`), `completed` (structured terminal/forge resolution),
`historyKnown`, `queue: {known, held, items}`, `wakeDeliveries` and `messages`.
Unknown booleans are explicit null, never false. Unknown run statuses stay
unknown. Preserve the collector's working/needs-you/failed/idle status vocabulary
and last assistant message for reporting; those summaries grant no authority.

Messages are in native history order, each with `id`, native `runId`, `source: "native"`,
`role`, exact `author: {host, environmentId, threadId, threadLink}` and `text`.
Keep raw roles: tool output and user pastes are never assistant messages.
An owner's current record is the last JSON fenced waiting/closing block in its
latest own assistant message, matching the R7c schema in
`axstack/references/run-record.md` (candidate `c784fe3d`). A later owner message
without a fresh block invalidates the old block. Require the message `runId`
to match the native `latestRunId`; a later silent run also invalidates it.
Missing run IDs are report-only; never infer them from message text. Unknown schemas and incomplete
records are report-only. The helper does not write wait records.

For recovery only, include `ownership` rows: exact `owner`, `role` (Coordinator,
Driver or Worker), `topLevel`, accepted `scope`, `authorityEvidence`, and
`nextActionEvidence` (array of already accepted action pointers). Never infer
these from a title or parent ID. A thread's `blocker` is a separately inspected
structured fact with `kind` (`check`, `review`, `upstream-pr`, `dependency`),
exact `id`, `state` (`unexplained`, `open`, `cleared`), `nonHuman: true`,
`inspectedAt` and `evidence` pointer. It must match the owner's dependency.

`deliveryHistory: {known, entries}` combines native owner history and recovery's
own assistant-authored delivery receipts. Entries contain the `key` (three-item
array: host, threadId, conditionId), `outcome` (accepted, queued, running,
ambiguous), exact `id` and evidence pointer. Any matching entry suppresses a
resend, even when its receipt is ambiguous or the head changes. Never create a
new local ledger. Queue items and wake deliveries retain exact `id`, `key`,
`state`, and `source`; every same-key observation suppresses recovery, including delivered, completed,
failed and cancelled states when a receipt may have been lost.
An armed unfired watch is not a delivery. Unknown queue/history remains unknown.

`recovery` contains `scope`, exact `owner` (existing designated recovery thread),
`trigger: {source, mode, scope, evidence}` where source is `user` or
`authorized-schedule`, `existingThread: true`, `model`, `effort`, `expiresAt`,
`canaryEvidence`, `scopeExclusive: true`, `idempotencyVerified: true`,
`deliveryReadbackVerified: true`, `cleanupOwner`, and `schedule` (null for an
explicit invocation; otherwise exact `id`, `owner`, `scope`, `expiresAt`,
`bindingVerified: true`, `evidence`). Scope means accepted scope identity,
not arbitrary instructions. Unknown capabilities prohibit continuation previews.

Cross-host `edges` require exact `from` and `to` owners, `c4Installed: true`,
`writeVerified: true`, future `expiresAt`, and `evidence`. A reverse edge or
proof for another thread is insufficient. No redirect is possible.

Cleanup inputs and preview semantics are in [recovery](recovery.md). These
files are transient saved evidence, not a runtime database. Read fresh native
facts immediately before any owner-authorized operation.
