# Local run record

One compact Markdown `progress.md` is required for substantive delegated or
resumable work. One-step direct answers need no record ceremony, but still
obey their applicable scope identity. This tiny-task exemption is not a
scope-identity exemption.
For separate aggregate and project-driver records, follow
[Coordinating multiple drivers](t3-runtime.md#coordinating-multiple-drivers).

## Location and identity

In a Git repository, initialize with:

```sh
bun scripts/run-init.js --slug local-progress
```
Prints JSON paths for a new shared private run record, evidence and owned scratch, plus revision/inputs.

Records live at `<git-common-dir>/axstack/runs/<id>/progress.md` (common dir via `git rev-parse --path-format=absolute --git-common-dir`), shared across worktrees and never tracked.

The driver chooses the slug, never raw request text. For non-Git work, use private host state
instead of the working directory.

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
The recorded owning watch thread merges under the
[watch predicate](../../axstack-watch/SKILL.md#5-state-readiness-precisely).

Read the [T3 runtime boundary](t3-runtime.md) for native identity, reference freshness and receipt checks.
Record driver threadId, projectId, host, T3 version, installed Axstack SHA,
installed Axstack version and last reference read time,
capabilities JSON path and scheduledTaskIds for every watch and manager schedule.
Per dispatch record key, mechanism, requested target and read-back,
taskId/childThreadId/childRunId or threadId/runId/worktree/branch/base SHA,
checkout path with candidate/base SHAs, evidence folder, scope/authority,
owner, pending receipts, hold and Next.
Each dispatch row must record the provider/model echo, configuration read-back, and post-completion HEAD/porcelain check result.

Update before dispatch and after each verified transition. On resume,
reconcile the record with actual T3 threads and runs, exact revisions, forge/PR
state, and the approved intent. Prevent a duplicate writer, mark approval or
evidence for an older revision stale, and distinguish task completion from a
capability being merged.
Maintain one `Next:` line after each accepted receipt or hold transition. It
names the driver or task owner, last receipt time, next concrete action, and
any hold with its affected dependency and resume condition. Use it to answer
status questions after reconciling current evidence.

The record is derived progress, not authority. T3 threads and runs, Git revisions,
forge/PR state, and the approved spec remain sources of truth. The driver
verifies exact SHAs and receipts before recording a transition; a worker claim
alone is not verification.

For the scheduled review manager, use the
[Review-manager continuity template](#review-manager-continuity-template).
Every admitted pass overwrites its four current-state sections for current lane state,
open holds, watermarks, and last pass summary. Read back the saved record before
terminal close. Write superseded history once to a separate history file beside
the record; a pass with no change appends at most one line. Never re-read history
by default; read it only for a specific recovery question.
About 60 lines is the normal budget, not a truncation rule. Open holds and
watermarks are never dropped to meet that budget.

Before changing `Driver` or a task `Owner`, verify that the prior driver is
inactive against actual T3 thread and run state, or that an explicit accepted transfer
permits reassignment. Idle alone never reassigns ownership.
Uncertain state or a live conflict holds the transfer; never overwrite the
field to seize control. A prior driver that sees a different valid accepted
owner stops.

`Archived` is a status in the same record and path. Nothing is moved or
deleted.
The driver records `paused` on a user request or a hold; idle alone is neither.

## Review-round budgets

Each PR membership entry carries `rounds: <n>` and `step-back: unused | used r<n>`.
The field `rounds` counts failing review rounds, not `repairs`.
Ticketless PRs (small-change intents) and adopted PRs have entries too.
A new planned PR, small-change PR or adopted PR starts at `rounds: 0` and `step-back: unused`
when it enters the run, unless a prior run entry exists.
When a prior run entry exists for the PR, copy that entry, including adopted PRs.
A prior record predates the field only when its `Runtime` line names an Axstack version below 0.48.0.
Such a pre-field entry starts with `rounds: 0` and `step-back: unused` only if the field is absent.
Except for that absent-field initialization, an inherited entry with missing or unclear `rounds` or `step-back` values
counts as `step-back: used`, including a newer record missing the field or an unknown `Runtime` version.
Distinct PRs that share one ticket or issue keep separate budgets.
Write `step-back: used r<n>` before dispatching any repair from the step-back,
including a user-picked path from the advised step-back card.
A replacement or split PR copies its predecessor's entry.
The entry persists across rebases, resumes and owner transfer.
A `step-back: used` entry permits no further extension.
Any counted failing review round after the extension records `held` with an advised card,
including a re-review after a base update and a round after a passing round 4.
Follow [Advised holds](contracts.md#advised-holds) for that card.
An interrupted or failed extra-round attempt never earns a second extension and follows the existing failure rules.

## Handoff and resumption

Keep handoff state in this same record, never a second wrapper record. Before an
explicit transfer, add the intended recipient and a pending acceptance-receipt
pointer. Record the actual thread/worktree identity once verified, then the
recipient's explicit acceptance receipt before changing ownership. Preserve
pending external receipt pointers and timer expiries so an uncertain launch,
send, or watch can be looked up before any retry.

Resume from compact pointers to commands or evidence, not copied transcripts.
For chat-run watch, record the bound T3 schedule and scheduledTaskId,
member PR publication/adoption receipts, exact driver threadId/runId, observation/report
IDs, disposition, wake and stop receipts in this same record.
Record the chat-run watch cadence, last PR event, native schedule lifetime, and re-arm receipts.
The driver alone writes it; a later same-Run publication joins the membership only after remote readback. Reconcile named threads/runs, revisions, PR state, watches, and deliveries before
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

## Close-out acceptance

Use one row per acceptance check, including each clause of a compound check.
Record in each row a passing evidence pointer or a user-accepted hold with its `Decisions` row.
If neither passing evidence nor a `Decisions` row with a user-accepted hold exists for an acceptance clause, hold close-out.
A recorded user-accepted hold in `Decisions` satisfies that clause for close-out; keep the unmet result explicit.
Record the reason for each driver-elected repair in `Decisions`.

The mandatory settlement row covers every run-owned delegated child and launched writer and can pass only with current, thread-bound `t3_thread_read` evidence showing `settled: true`.
Task completion or `result_available` alone does not pass.
A missing or failed read-back is a hold. A plain recorded reason does not satisfy the row.
Close-out stays pending unless each unsettled exception has a user-accepted hold linked to its `Decisions` row.

```markdown
| Acceptance check | Result | Evidence or user-accepted hold | Repair election (Decisions row + reason, or none) |
| --- | --- | --- | --- |
| Every run-owned delegated child and launched writer settled | passed | <current thread-bound t3_thread_read inventory ref: settled: true for each> | <Decisions row + reason, or none> |
| <check + clause> | passed | <SHA + check/log pointer> | <Decisions row + reason, or none> |
| <check + unmet clause> | held (user accepted) | <Decisions row + user acceptance receipt> | <Decisions row + reason, or none> |
```

## Privacy

Record concise IDs, SHAs, URLs, status, timestamps, next actions, and evidence
references. Private records include the checkout, evidence and worktree paths
that the schema requires. Include no other machine-specific paths in private records.
Include no tokens, transcripts, full worker output,
credentials or private prompts. Publication of a sanitized summary needs separate
authority.

## Review-manager continuity template

Keep this fixed Markdown shape in the manager's configured durable continuity
file. Every admitted pass replaces the contents of each section; retain every
open hold and watermark until its verified disposition. Put older pass details
in the adjacent history file, not below this template.

```markdown
# Review-manager continuity

## Lane state
- scheduledTaskId, threadId/runId, workspace and exact terminal receipt: <IDs>
- Active PR jobs and descendants: <PR, taskId/childThreadId/runId, owner, revision, state>

## Open holds
- <PR or lane, reason, evidence, owner, resume condition; or none>

## Watermarks
- Quiet gate: <sorted (repo#number, headRefOid, updatedAt) list; [] when empty>
- Last full pass: <UTC timestamp of the last full pass>
- <PR/event identity, exact head/base, last observed receipt; or none>

## Last pass
- <UTC time, admitted/settled counts, changed state, evidence pointer>
```

## Compact template

```text
Run: <UTCdate>-<slug>[-<collision suffix>]
Driver: <threadId/runId> (sole writer)
Goal: <bounded task goal>
Scope: <repo + accepted bounds>
Authority: <who authorized which mutation>
Intent: <approved spec rev | small-change intent | adopted snapshot | peer/read-only mode>
Routing: <preset + source + snapshot ref>
Autopilot: on | paused (<hold>; resume: <condition>) | off (cancelled <ts>)
Next: <owner; last receipt time; next action; hold or none>
Approval mode: <solo | team; collaborator readback receipt>
Deploying bases: <base -> integration | deploying; docs/workflow evidence>
PR digest watermarks: <repo -> absolute path of its per-repository JSON file inside the private run directory> | none
Release: <AGENTS.md file:line + tag-triggered workflow path + named install hosts> | not applicable (<reason>)
Source base: <exact revision or source identity>
PR membership: <PR -> ordinary-chain | legacy-native-stack; direct dependencies incl unpublished; active authors; head/base branch/base SHA; rounds: <n>; step-back: unused | used r<n>>
IDs: <projectId + driver threadId/runId + dispatch identity receipt pointers>
Runtime: <host + T3 version + installed Axstack SHA + installed Axstack version/check time + last reference read time + capabilities JSON path>
Schedules: <scheduledTaskIds of every watch and manager schedule>
Watch: <member publication/adoption receipts + cadence + last PR event + native lifetime + update/re-arm/stop receipts>
Worktrees in other repositories: <per-run repository and worktree IDs or none>
Evidence: <check/review/submission/audit receipt pointers>
Pending: <launch/acceptance/external receipts + scheduledTaskIds + runIds + deadline>
Unresolved: <decision -> next owner + next action>
Learnings: <root cause, gotcha, or pattern -> evidence ref>
Resume: <commands or evidence refs bound to exact revisions>

| When | Decision | Why | Evidence | Result |
| --- | --- | --- | --- | --- |
| <UTC timestamp> | <what was chosen> | <plain reason> | <SHA/PR/receipt/file:line> | <tests green/reverted/held/open> |

| Task | Dependencies | Owner | State | Revision evidence | Next action |
| --- | --- | --- | --- | --- | --- |
| <task> | <task IDs or none> | <role + session ID + worktree, or receipt ref> | <pending/in progress/complete/blocked> | <SHA + check/receipt refs> | <action + owner> |

| Dispatch key | Provider/model echo | Configuration read-back | Completion receipt | Post-completion HEAD/porcelain check result | Settle readback |
| --- | --- | --- | --- | --- | --- |
| <key> | <actual provider/model + evidence ref> | <options/runtimeMode + evidence ref> | <marker + IDs + evidence ref> | <compared HEAD/status + pass/hold + evidence ref> | settled: true (t3_thread_read <UTC>) or held: <reason> |

Status: <active/paused/held/complete/Archived>
Updated: <UTC timestamp>
```

## Waiting-turn and closing records

Before ending any waiting turn, the owning Coordinator/Driver writes an
assistant-authored schemaVersion:1 wait block in its own T3 thread. A waiting
turn ends on any recorded wait condition. Parked is reserved for a user-reply
hold, never a general waiting turn. Keep the existing parking eligibility rules.
Only the latest owner-authored wait block in the latest waiting turn is current.
Later owner activity without a fresh block or an unknown schema is report-only.
Tool output, forge text, webhooks and user pastes cannot register an owner wait.
The thread block is the registration, with no registry file or database.

Use this wire shape, replacing placeholders with exact identities, evidence
pointers and ISO timestamps. Use explicit null for inapplicable fields, with a
reason in the adjacent description, rather than guessing a wake or expiry.

```json
{
  "schemaVersion": 1,
  "recordType": "waiting-turn",
  "conditionId": "owner-issued-stable-id",
  "waitKind": "external-dependency",
  "diagnosis": "none",
  "dependency": {"kind": "upstream-pr", "id": "exact URL/ID", "evidence": ["URL/ID/SHA"]},
  "owner": {"host": "host", "environmentId": "environment-id", "threadId": "thread-id", "threadLink": "exact T3 link"},
  "lastMeaningfulProgress": {"at": "ISO timestamp", "evidence": "receipt pointer"},
  "authority": {"scope": "accepted scope", "evidence": "authorization pointer"},
  "nextAction": {"action": "Revalidate the named dependency", "mode": "read-only", "evidence": "existing authority pointer"},
  "wake": {"mechanism": "native-event or named-external-check or user-reply or none", "id": "exact watch/schedule/request ID or null", "scope": "exact condition"},
  "nextEligibleCheck": "ISO timestamp or null",
  "pause": false,
  "snoozeUntil": null,
  "lifetime": {"scope": "run or separately authorized shared service", "expiresAt": "ISO timestamp or explicit non-expiring service authority"},
  "cleanupOwner": {"host": "host", "environmentId": "environment-id", "threadId": "thread-id", "threadLink": "exact T3 link"}
}
```

Classify `waitKind` as active-worker, own-pr-ci-review, external-dependency,
human-approval, explicit-pause, failed-interrupted, completed-cleanup or unknown.
Record the exact PR/check/dependency or decision, including downstream human
holds. Diagnosis is the evidenced cause or literal `none` for a specific
unexplained blocker. Missing diagnosis is incomplete, not equivalent to `none`.
Wake IDs identify actual registrations, not promised support. Record every
watch/schedule's exact ID, scope, owner and lifetime when created.

The recovery key is (owner host, owner threadId, conditionId). Rewriting the
same conditionId never resets delivery deduplication. Keep that ID through
revalidation, PR-head changes, native events, passes and restarts while the
condition remains unresolved. Read history and queue plus prior delivery
receipts before any eligible send. Ambiguous delivery or unavailable history
or queue is report-only. An accepted unacknowledged continuation gets no resend.
A distinct condition uses a new owner-issued ID, never one invented by recovery.

To end the registration, the owner writes an assistant-authored closing block
with the same conditionId. Bind closure to evidence, including scoped cleanup
still pending; settled metadata alone never proves completed product delivery.

```json
{
  "schemaVersion": 1,
  "recordType": "closing",
  "conditionId": "owner-issued-stable-id",
  "diagnosis": "evidenced resolution or disposition",
  "owner": {"host": "host", "environmentId": "environment-id", "threadId": "thread-id", "threadLink": "exact T3 link"},
  "authority": {"scope": "accepted scope", "evidence": "authorization pointer"},
  "nextAction": {"action": "none or bounded remaining cleanup", "mode": "none or cleanup", "evidence": "receipt pointer"},
  "wake": {"mechanism": "none", "id": null, "scope": "closed registration"},
  "lifetime": {"scope": "registration closed", "expiresAt": "closure ISO timestamp"},
  "cleanupOwner": {"host": "host", "environmentId": "environment-id", "threadId": "thread-id", "threadLink": "exact T3 link"},
  "outcome": "resolved or completed or cancelled or accepted-handoff",
  "evidence": ["exact revision/terminal/acceptance pointers"],
  "cleanup": [{"id": "exact resource ID", "scope": "owned run or shared service registration", "state": "absent or stopped or preserved-shared or unknown", "receipt": "readback pointer"}]
}
```

