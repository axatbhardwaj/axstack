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

Record per-run cross-repository worktrees for the driver-start sweep in
[Workspace hygiene](workspace-hygiene.md).

## Writer and transitions

The driver is the sole record writer. Workers send concise receipts; they do
not edit `progress.md`. This is a prompt contract, not a lock or runtime
coordination mechanism. Each task names the actual owner session and worktree,
or a receipt pointer containing both; a role label alone is insufficient.

Update before dispatch and after each verified transition. On resume,
reconcile the record with actual Orca sessions and Dispatches, exact revisions, forge/PR
state, and the approved intent. Prevent a duplicate writer, mark approval or
evidence for an older revision stale, and distinguish task completion from a
capability being merged.

The record is derived progress, not authority. Orca sessions and Dispatches, Git revisions,
forge/PR state, and the approved spec remain sources of truth. The driver
verifies exact SHAs and receipts before recording a transition; a worker claim
alone is not verification.

For the scheduled review manager, use the
[Review-manager continuity template](#review-manager-continuity-template).
Each pass overwrites its four current-state sections for current lane state,
open holds, watermarks, and last pass summary. Read back the saved record before
terminal close. Write superseded history once to a separate history file beside
the record; a pass with no change appends at most one line. Never re-read history
by default; read it only for a specific recovery question.
About 60 lines is the normal budget, not a truncation rule. Open holds and
watermarks are never dropped to meet that budget.

Before changing `Driver` or a task `Owner`, verify that the prior driver is
inactive against actual Orca session and Dispatch state, or that an explicit accepted transfer
permits reassignment. Idle alone never reassigns ownership.
Uncertain state or a live conflict holds the transfer; never overwrite the
field to seize control. A prior driver that sees a different valid accepted
owner stops.

`Archived` is a status in the same record and path. Nothing is moved or
deleted.
The driver records `paused` on a user request or a hold; idle alone is neither.

## Handoff and resumption

Keep handoff state in this same record, never a second wrapper record. Before a
native handoff launch, add the intended recipient and a pending launch-receipt
pointer. Record the actual agent/workspace receipt once verified, then the
recipient's explicit acceptance receipt before changing ownership. Preserve
pending external receipt pointers and timer expiries so an uncertain launch,
send, or watch can be looked up before any retry.

Resume from compact pointers to commands or evidence, not copied transcripts.
For chat-run watch, record member PR publication/adoption receipts, exact driver session, native automation/workspace identity, observation/report IDs, disposition, wake and stop receipts in this same record. The driver alone writes it; a later same-Run publication joins the membership only after remote readback. Reconcile named sessions, revisions, PR state, watches, and deliveries before
creating or redelivering anything. Outside the bounded driver-start orphan
sweep, touch only this run; no unscoped global sweep, runtime database, or
scheduler follows from the record.

## Decision trail and learnings

Two fields make the record reviewable by a human who stepped away and usable
by the next owner:

- `Decisions` holds one row per consequential choice: when, what was chosen,
  why in plain words, the evidence pointer that proves it (SHA, PR, receipt,
  `file:line`, or artifact path, never a paragraph), and the result
  (`tests green`, `reverted`, `held`, `open`). A choice that a reviewer could
  not reconstruct from Git or PR state belongs here; routine mechanics do not.
  An arena synthesis note (base, grafts and their source candidate,
  rejections, judge verdicts) is recorded as `Decisions` rows.
- `Learnings` holds what the next owner needs that the code and history do not
  show: root causes, gotchas, patterns that held or failed, and where the
  evidence lives. Read it on resume before reconciling; append, never rewrite,
  and keep entries as short as the evidence pointer allows.

## Privacy

Record concise IDs, SHAs, URLs, status, timestamps, next actions, and evidence
references. Include no tokens, transcripts, full worker output, credentials,
private prompts, or machine-specific paths beyond the private record's own
resolved location. Publication of a sanitized summary needs separate
authority.

## Review-manager continuity template

Keep this fixed Markdown shape in the manager's configured durable continuity
file. Replace the contents of each section on every admitted pass; retain every
open hold and watermark until its verified disposition. Put older pass details
in the adjacent history file, not below this template.

```markdown
# Review-manager continuity

## Lane state
- Automation ID, native run ID, workspace and exact terminal receipt: <IDs>
- Active PR jobs and descendants: <PR, Task/Dispatch, owner, revision, state>

## Open holds
- <PR or lane, reason, evidence, owner, resume condition; or none>

## Watermarks
- <PR/event identity, exact head/base, last observed receipt; or none>

## Last pass
- <UTC time, admitted/settled counts, changed state, evidence pointer>
```

## Compact template

```text
Run: <UTCdate>-<slug>[-<collision suffix>]
Driver: <session ID> (sole writer)
Goal: <bounded task goal>
Scope: <repo + accepted bounds>
Authority: <who authorized which mutation>
Intent: <approved spec rev | small-change intent | adopted snapshot | peer/read-only mode>
Routing: <preset + source + snapshot ref>
Notification policy: <none | transport/target label/host/instructions path>
Source base: <exact revision or source identity>
IDs: <repo/project + workspace/agent receipt pointers>
Worktrees in other repositories: <per-run repository and worktree IDs or none>
Evidence: <check/review/submission/audit receipt pointers>
Pending: <launch/acceptance/external receipts + timer execution heartbeat actual ID + handshake + deadline>
Unresolved: <decision -> next owner + next action>
Learnings: <root cause, gotcha, or pattern -> evidence ref>
Resume: <commands or evidence refs bound to exact revisions>

| When | Decision | Why | Evidence | Result |
| --- | --- | --- | --- | --- |
| <UTC timestamp> | <what was chosen> | <plain reason> | <SHA/PR/receipt/file:line> | <tests green/reverted/held/open> |

| Task | Dependencies | Owner | State | Revision evidence | Next action |
| --- | --- | --- | --- | --- | --- |
| <task> | <task IDs or none> | <role + session ID + worktree, or receipt ref> | <pending/in progress/complete/blocked> | <SHA + check/receipt refs> | <action + owner> |

Status: <active/paused/held/complete/Archived>
Updated: <UTC timestamp>
```
