# Local run record

One compact Markdown `progress.md` is required for substantive delegated or
resumable work. One-step direct answers do not require this ceremony.
That tiny-task exemption is not a scope-identity exemption.

## Location and identity

In a Git repository, store the record at:

```text
<git rev-parse --path-format=absolute --git-common-dir>/axstack/runs/<id>/progress.md
```

`git rev-parse --path-format=absolute --git-common-dir` resolves to the main
repository's `.git` directory for the main checkout and all linked worktrees.
Without `--path-format=absolute`, the main checkout returns a relative `.git`,
making the persisted path ambiguous across worktrees and the current working
directory. The path is shared across those worktrees and is never part of the
tracked tree. Form the run id as `<UTCdate>-<slug>` and add a collision-safe
suffix when that id already exists. For non-Git work, use private host state
instead of the working directory.

On resume, discover existing runs and match both repo and scope. Never blindly
select the latest record. Git metadata is not pushed, but it can be copied or
backed up, so keep the contents private and compact.

## Writer and transitions

The driver is the sole writer. Workers send concise receipts to the driver;
they do not edit `progress.md`. This single-writer rule is a prompt contract,
not a lock or runtime coordination mechanism.
For each task, Owner carries the actual session ID and worktree, or a receipt
reference containing both; a role name alone is insufficient.

Update the record before dispatch and after each verified transition. Reconcile
the record with actual sessions, revisions, and external state before resuming:
prevent a duplicate writer, treat approval or evidence bound to an older
revision as stale, and never infer completion from missing or ambiguous state.
Task completion is distinct from capability merged.

The record is derived progress, not authority: Paseo sessions, Git revisions,
forge/PR state, and the approved spec remain the sources of truth. The driver
verifies exact SHAs and receipts itself before recording a transition; a
worker's claim is not verification.

Before changing the Driver field, verify that the prior driver is inactive or
that an explicit accepted transfer exists. If ownership is uncertain or there
is a live conflict, reconcile or hold and never overwrite the field to seize
control. A prior driver that sees a different valid owner stops.

`Archived` is a status in the same record and path. Nothing is moved or deleted.

## Privacy

Record only concise IDs, SHAs, URLs, status, timestamps, next actions, and
evidence references. Include no tokens, no transcripts, and no full worker
output.

## Compact template

```text
Run: <UTCdate>-<slug>[-<collision suffix>]
Driver: <session ID> (sole writer)
Scope: <repo + bounded goal + authority>
Source base: <exact revision or source identity>

| Task | Dependencies | Owner | State | Revision evidence | Next action |
| --- | --- | --- | --- | --- | --- |
| <task> | <task IDs or none> | <role + session ID + worktree | receipt ref> | <pending/in progress/complete/blocked> | <SHA + check/receipt refs> | <action + owner> |

Status: <active/held/complete/Archived>
Updated: <UTC timestamp>
```
