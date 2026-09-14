# Local run record

One compact Markdown `progress.md` is required for substantive delegated or
resumable work. One-step direct answers need no record ceremony, but still
obey their applicable scope identity. This tiny-task exemption is not a
scope-identity exemption.

## Location and identity

In a Git repository, store the record at:

```text
<git rev-parse --path-format=absolute --git-common-dir>/axstack/runs/<id>/progress.md
```

`git rev-parse --path-format=absolute --git-common-dir` resolves the main
repository's `.git` directory for the main checkout and linked worktrees.
Without `--path-format=absolute`, the main checkout returns a relative `.git`,
making the persisted path ambiguous across worktrees and the current working
directory. The record is shared across those worktrees and never enters the
tracked tree.

Use `<UTCdate>-<slug>`, where UTCdate is `YYYYMMDD`, for example
`20260913-local-progress`. The driver chooses the slug using lowercase letters,
digits, and hyphens only, never raw request text. It has no separators
or path segments, so it stays inside `axstack/runs/`; add a collision-safe
suffix when needed. For non-Git work, use private host state instead of the
working directory.

On resume, discover existing runs and match both repository and scope;
never blindly select the latest. Git metadata is not pushed, but it can be
copied or backed up, so its contents remain private and compact.

## Writer and transitions

The driver is the sole record writer. Workers send concise receipts; they do
not edit `progress.md`. This is a prompt contract, not a lock or runtime
coordination mechanism. Each task names the actual owner session and worktree,
or a receipt pointer containing both; a role label alone is insufficient.

Update before dispatch and after each verified transition. On resume,
reconcile the record with actual Paseo sessions, exact revisions, forge/PR
state, and the approved intent. Prevent a duplicate writer, mark approval or
evidence for an older revision stale, and distinguish task completion from a
capability being merged.

The record is derived progress, not authority. Paseo sessions, Git revisions,
forge/PR state, and the approved spec remain sources of truth. The driver
verifies exact SHAs and receipts before recording a transition; a worker claim
alone is not verification.

Before changing `Driver` or a task `Owner`, verify that the prior driver is
inactive against actual Paseo session state, or that an explicit accepted transfer
permits reassignment. Idle alone never reassigns ownership.
Uncertain state or a live conflict holds the transfer; never overwrite the
field to seize control. A prior driver that sees a different valid accepted
owner stops.

`Archived` is a status in the same record and path. Nothing is moved or
deleted.

## Handoff and resumption

Keep handoff state in this same record, never a second wrapper record. Before a
native handoff launch, add the intended recipient and a pending launch-receipt
pointer. Record the actual agent/workspace receipt once verified, then the
recipient's explicit acceptance receipt before changing ownership. Preserve
pending external receipt pointers and timer expiries so an uncertain launch,
send, or watch can be looked up before any retry.

Resume from compact pointers to commands or evidence, not copied transcripts.
Reconcile named sessions, revisions, PR state, watches, and deliveries before
creating or redelivering anything. Touch only this run; no global sweep, new
runtime database, or scheduler follows from the record.

## Privacy

Record concise IDs, SHAs, URLs, status, timestamps, next actions, and evidence
references. Include no tokens, transcripts, full worker output, credentials,
private prompts, or machine-specific paths beyond the private record's own
resolved location. Publication of a sanitized summary needs separate
authority.

## Compact template

```text
Run: <UTCdate>-<slug>[-<collision suffix>]
Driver: <session ID> (sole writer)
Goal: <bounded task goal>
Scope: <repo + accepted bounds>
Authority: <who authorized which mutation>
Intent: <approved spec rev | small-change intent | adopted snapshot | peer/read-only mode>
Routing: <preset + source + snapshot ref>
Notification policy: <none | transport/mode/host/instructions path>
Source base: <exact revision or source identity>
IDs: <repo/project + workspace/agent receipt pointers>
Evidence: <check/review/submission/audit receipt pointers>
Pending: <launch/acceptance/external receipt pointers + timer expiries>
Unresolved: <decision -> next owner + next action>
Resume: <commands or evidence refs bound to exact revisions>

| Task | Dependencies | Owner | State | Revision evidence | Next action |
| --- | --- | --- | --- | --- | --- |
| <task> | <task IDs or none> | <role + session ID + worktree, or receipt ref> | <pending/in progress/complete/blocked> | <SHA + check/receipt refs> | <action + owner> |

Status: <active/held/complete/Archived>
Updated: <UTC timestamp>
```
