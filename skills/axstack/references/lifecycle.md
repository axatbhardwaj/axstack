# Shared lifecycle and receipts

Phases load through [Standing contracts](contracts.md).
Driver settlement follows [Workspace hygiene](workspace-hygiene.md).
Delegated or resumable work uses a driver-owned [Run record](run-record.md)
binding state and receipts to exact revisions.

## Roster (compact)

- Driver: current chat; owns scope, decisions, cross-PR dependencies,
  external-tracker mutations, integration.
- Owner: driver for loop PRs; `axstack-owner` for standalone watch/review without
  a live driver. PR-scoped publication is within user authority.
  Own PRs default to automatic merge under watch §5's predicate.
- Author: exactly one writer per candidate; accepted fixes return there.
  Workers launch no recursive teams.
- Reviewers: peer = two configured roles with the same brief and isolated first
  pass; authored = one eligible role from author provenance. Each uses a
  separate driver-made detached checkout and private per-attempt evidence folder. Owner and author never review.
- Automation review manager and monitors: see
  [Review automation health](#review-automation-health).
- Auditor (`axstack-auditor`): report-only; never edits, merges, activates, or
  audits itself.

Prefer parallel independent bounded work; no redundant workers. Fanout is dependency- and
capacity-driven within host/spending limits. [PR shape](pr-shape.md) covers
theme/size; queue dependencies through `gh stack`.

## Ownership

The PR owner is accountable for candidate, fixes, evidence, monitoring; a
chat-run observer reports only to its driver. Peer code stays read-only.
Missing or idle sessions never transfer ownership.
Owned work enters review via the revision-bound
[candidate-publication boundary](candidate-publication.md).

## Native handoff and resume

Preparation completion/watch expiry writes a record. Ordinary resume
reconciles it, keeps the current owner, and launches no native handoff.
Only an explicit user request to transfer ownership enters this branch.

1. Reconcile the [Run record](run-record.md) with T3 threads, runs, Git revisions,
   forge state, pending receipts and scheduled-task expiries; live owners and
   current attempt identities beat stale state.
2. Load [T3 runtime](t3-runtime.md) for native resume and transfer. Keep the same
   owner, author, attempt and worktree on ordinary resume; never guess tools,
   roles, paths or fallback models. Capability discovery is not execution proof.
3. Missing capability holds transfer with the current owner retained; read-only
   reconciliation may continue. Record the recipient and pending receipt before
   launch; reconcile exact-title thread inventory and Git worktrees before retry
   to block duplicates.
4. Launch is not ownership. Record the recipient's explicit acceptance receipt
   before changing ownership; current owner remains accountable until then. A
   prior owner seeing a different valid accepted owner stops.

Complete record: goal, authority, intent, IDs, revisions, evidence, pending
receipts/timers, unresolved decisions, next action, and transfer status.

## Receipts (bind each decision to evidence)

Store receipt references, not raw output, in the [Run record](run-record.md).

- Session receipt: actual projectId, threadId/runId or taskId/childThreadId/childRunId, attempt key and checkout path, requested provider/model and
  role; reuse on resume.
- Acceptance receipt: sender/recipient, accepted scope/authority, timestamp,
  and ownership session receipt.
- Review receipt: mode, provenance, reviewer, SHA/base,
  verdict (`APPROVE | REQUEST_CHANGES | INCOMPLETE`), coverage, limitations and
  findings. Changed code needs a new receipt. Codebase: revision/scope,
  `COMPLETE | INCOMPLETE` coverage, no PR verdict.
- Submission receipt: actual commit, review, remote confirmation; ambiguity
  requires external lookup before retry.
- Audit receipt: scope, evidenced PASS/FAIL/UNKNOWN counts/denominators and
  proposals. Only an authorized sanitized summary publishes.

## Execution tracking

Follow [T3 runtime](t3-runtime.md) for native completion, questions, launch
recovery and run-watch waits. Delegated notifications wake the driver; a launched
writer sends its marker with `t3_thread_send` using `mode: queue` to the recorded driver thread.
Delegated completion requires persisted `task_status` before `t3_thread_read`, terminal `completed`, `result_available`, `hasPendingChildRuns:false`, and final `AXSTACK-DONE`.
Writer completion requires `AXSTACK-DONE` plus terminal `t3_thread_wait` on the recorded run and candidate checks: non-empty diff, clean tree, and named red/green logs.
Completion must match the current attempt key and candidate SHA; an older attempt never completes a newer one.
Process the whole delivery before advancement, validating sender, scope,
authority, revisions and artifacts. Deduplicate by native task/thread/run identity.
A question marker stays incomplete; failure, interruption, permission prompts
and refusals hold with preserved evidence. Receipt messages alone are progress.
Healthy unchanged passes are silent.
An explicitly invoked phase dispatches its configured roles through T3 and
closes with the lifecycle close-out; in-chat execution covers only ordinary
reading, writing and local checks.

For a required change with an empty base-to-head diff or missing named artifact,
retain the incomplete state, return to the same author once, and hold on repeat.
Dispatch each unblocked dependent after verifying scope, authority, owner,
revisions and dependencies in the same driver turn; record why others are not
ready. An unreachable predecessor holds. Update one `Next:` line on each
transition with owner, last receipt time, next action and hold; reconcile it for
status questions. Stale receipts remain evidence only.

End a driver turn with an unsettled launched thread only while the bound run watch is armed; each wake reconciles all unsettled runs.
Use terminal `t3_thread_wait` and the recorded watch as the runtime contract
requires, re-arming waits on timeout; sleep or poll loops are forbidden. Delete the watch by exact ID and
verify absence once nothing remains unsettled. After each delegated completion,
verify the driver's HEAD and status unchanged before advancing. Input acceptance,
run start, effective configuration, terminal success and verified advancement
are distinct evidence. Detect completed-but-unadvanced work, failed runs,
unresolved launch receipts and stalls through native state. Idle is not complete; never duplicate a writer. Reconcile
thread/run identity mismatches rather than borrowing identities. Retain a
user-taken-over thread without cleanup commands.

After accepting task or run completion, the driver invokes
[axstack-cleanup](../../axstack-cleanup/SKILL.md) inline; it never dispatches cleanup work.
Axstack creates no heartbeat or substitute scheduler.
Tracking grants no merge, release, model-substitution, or scope authority.

## Deadline (one rule for every owned timer)

The default 24-hour deadline covers standalone task-owned timers. Stop them at
deadline and preserve remaining work; the review automation has no task-owned
deadline. Merge-ready requires applicable review receipt(s) and current diligence
`PASS` at the exact head; CI/tests alone are insufficient. Merge-ready
differs from merged.

## Review automation health

The native review manager uses fresh finite T3 pass threads from its dedicated
lane project on a 15-minute T3 scheduled task. It admits actionable PR events
within measured host capacity; waiting PRs remain covered without reserving slots.
Bounded PR jobs use driver-made detached checkouts and settle after descendants.
Build no custom scheduler, state engine or legacy fallback. See
[Review manager](automations.md) for binding, canary, capacity and schedule health.

## Audit hook (close-out and meaningful checkpoints)

Audit measurement is enabled by default for every substantive run; dispatch
follows [Close-out](#close-out) or a material-deviation/repeated-repair
checkpoint. An `axstack-audit` run is excluded; it launches no children.
Load [axstack-audit](../../axstack-audit/SKILL.md). Accepted proposals
require a regression scenario and unchanged holdout checks; they change
nothing without tested independent review.

## Close-out

Close-out requires the [close-out acceptance table](run-record.md#close-out-acceptance).

PRs merge by forge state; close out: (1) settle every T3 worker run and archive eligible threads; (2) compact record with counts and denominators—user
interventions/deviations from plan/repairs; (3) `axstack-auditor`: settle
non-zero/requested, else `counts zero`. A base auditor preflight rejection
(no delegated task started) records `auditor: UNKNOWN (unlaunchable)` with the
attempted route and error as the archive receipt; no substitution. A launched
auditor task must settle; (4) release merged run worktrees and branches;
use `axstack-cleanup`, remove the run's own scheduled tasks under
[Workspace hygiene](workspace-hygiene.md), and close selected external-tracker tickets;
(5) mark the
[Run record](run-record.md) `Archived`. `Archived`—one each:
settlement receipt; compact record path; close-out acceptance table; auditor decision plus settlement
receipt, `counts zero`, or the unlaunchable UNKNOWN archive receipt; scheduled-task,
release, and ticket receipts; archive timestamp.
`active`/receipt-incomplete record: close-out pending, never done. One-step
lookups exempt.
