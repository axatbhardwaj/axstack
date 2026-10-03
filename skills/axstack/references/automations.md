# Native peer-review manager

Read this for the optional native T3 peer-review schedule. The historical
automation specs and plans describe retired designs and are not instructions.

For optional weekly test audits, use the separate packaged
[Weekly test-audit prompt](test-audit-weekly.md).
The native canary below is also required before weekly activation.

## Topology and schedules

The T3 project `axstack-review-lane` uses the VPS's existing
`axatbhardwaj/axstack` clone with `origin` and `main`.
Unbound pass worktrees branch from `origin/main` and each pass fetches first.
Continuity stays at `~/.local/share/axstack/runs/review-manager/progress.md`,
outside every worktree.
A missing, non-durable or unreadable continuity path holds admission.
Follow the [Run record](run-record.md) and use the
[Review-manager continuity template](run-record.md#review-manager-continuity-template):
overwrite its four current-state sections and archive superseded history once
beside it. A no-change pass appends at most one history line.

Configure the lane thread via `t3_thread_configure` with the `axstack-owner`
binding and verify its read-back. Then `schedule_task` uses the packaged prompt,
`everyMs:900000`, `bindToCurrentThread:false`, and a stable `clientRequestId`.
Record the schedule ID, project, lane binding and pass thread/run identities.
Each pass compares its own `t3_thread_configuration` with the recorded binding.
A binding mismatch holds admission.
Read [T3 runtime](t3-runtime.md) for capability, provider/effort, prompt, dispatch,
completion and cleanup boundaries; a manager never checks out a PR branch in
its pass worktree. Missed slots do not replay a backlog.

T3 sessions are exempt from Claude trust preflight.

## Session admission

Perform guarded predecessor retirement in [Finite-session teardown](#finite-session-teardown).
Lane identity requires exact thread/run identity, never a title or directory-name
guess; never infer lane ownership from an empty local workspace.
Reconcile saved state, current GitHub state, and native T3 threads, runs,
delegated tasks and liveness across the whole lane before discovery or admission.
Discovery reads every page of PRs and native threads.
A truncated or failed inventory holds admission and cleanup.
A pass never admits a PR owned by a live or uncertain earlier pass.
A confirmed live manager for the same lane remains authoritative.
The earlier pass wins only when ordering evidence exists.
Missing ordering or ownership evidence holds admission and never guesses a winner.

Once identified as a duplicate, the new pass does no PR work, makes no further
shared-record write and touches no live or unsettled resource owned by the
live manager. A duplicate pass admits nothing and runs read-only discovery
into its own pass note in its private evidence folder, recording new eligible
events and the unserved count. If a duplicate finds a stalled owner idle at its
prompt with a final turn lacking a completion receipt for more than five
minutes (nudged or not), record it in that private note and send one deduplicated
notification under the recorded `Notification policy`.
Unknown liveness blocks admission and shared-record writes; it does not
permit takeover or cleanup. Preserve user-taken-over threads.
This is prompt policy, not an atomic lock: the overlap canary must demonstrate
one admission owner before activation. Count all unsettled PR jobs and descendants.

A failed scheduled run alone proves neither predecessor exit nor release.
Predecessor exit requires exact thread/run identity and terminal run evidence;
a completed run row alone does not prove the work settled.
Require reconciled continuity and settlement of every descendant before releasing ownership.
Unknown facts hold at the durable decision location; never replace a
potentially live owner.

## Discovery and coverage

Resolve self on every tick with `gh api user --jq .login`; never hardcode the
account. Read every discovery page. If pagination or an API call fails, report
coverage incomplete and make no completeness claim; never silently cap the
monitored set.

The review manager covers open non-draft PRs across accessible repositories
that are authored by someone else and either officially request review from
self or have a non-self comment that explicitly mentions self and requests a
review or response. Incidental mentions grant no authority. Preserve a prior
human `CHANGES_REQUESTED` block across head changes. It has workflow provenance
only when its body ends with
`<!-- axstack-automation verdict head=<sha> -->` bound to its reviewed commit,
or a retained legacy receipt proves that provenance; otherwise never replace
it automatically.

Coverage is not execution. Waiting for CI, a reviewer, a user decision, or a
merge occupies no execution slot after owned work and descendants settle.
Review waiting state never reserves a slot and no job stays active merely until a
PR merges or closes. Thirty open PRs, including ten settled waiting PRs, are
all scanned; those ten occupy zero slots.

## Admission and fairness

The review manager admits all eligible actionable PR events
that measured host capacity can support across ticks. Before each admission,
inspect available memory, CPU load, and active worker trees across the host;
account for the whole proposed worker tree, dependencies, spending limits, and
exclusive ownership. Report unavailable metrics as unknown; use the remaining
host evidence rather than treating a missing metric alone as a blocker. Defer
an event when observed pressure or uncertain headroom cannot support its whole
tree, record the reason, and remeasure on the next pass. Do not use a fixed
PR-job count or reserve a fixed slot.

A slot covers one bounded PR event and remains occupied while its reviewers
or other owned descendants are active or unsettled. Leaf workers do
not create recursive teams. Settlement of the PR job and every descendant
frees the slot even while the PR stays open.

Inspect all eligible PRs before admission. Preserve unserved work in the
compact run record and select the oldest actionable unserved event first, with
ascending repository and PR-number tie breaks. Continue admitting eligible
events while measured capacity supports their whole worker trees. Reconsider
deferred events as trees settle or host capacity changes; repeatedly changing
PRs cannot starve older unserved work.

## Per-PR jobs

Include [Safe deletion](workspace-hygiene.md#safe-deletion) in PR-job briefs.

The logical manager lane owns ongoing discovery and continuity across finite
sessions; the bounded PR coordinator owns only its admitted event. Do not create a second live owner or
writer for the same PR. Reuse an existing valid per-PR worktree, owner, and
unchanged receipts before creating anything. Otherwise create one separate detached checkout
per PR job from its existing
host clone: `git -C <host clone> worktree add --detach <run>/checkouts/<key> <sha>`;
pin the observed head and base. A repository without a host clone is a held job. The bounded
PR coordinator loads the
review skill, launches only the reviewers that skill owns,
handles the current actionable event, returns exact receipts, then settles.
Check admitted delegated jobs with persisted `task_status` before thread reads
under [T3 runtime](t3-runtime.md). For a worker's own brief question, confirm the
brief once.
A second brief ask follows the five-minute stop rule, never an open-ended hold.
An idle final turn without a valid completion
receipt is incomplete, not successful. A started coordinator waiting on its
reviewers (a live reviewer task or running wait) is not idle and is never
stopped for waiting. Reconcile terminal failure and all descendants before
recording an event unserved and re-admissible.
Steer an idle PR job once with `t3_thread_send`.
If it is still idle without a valid completion receipt five minutes after the steer,
stop the owned job with `t3_thread_interrupt` or `task_cancel` as applicable,
reconcile the coordinator and every descendant, and record the event unserved and re-admissible.
Uncertain liveness retains the slot only within that five-minute bound;
unverified settlement after the stop holds lane admission.
Settlement returns continuity to the manager rather than retaining an idle PR
coordinator. Each reviewer uses a separate driver-made detached checkout and
private evidence folder, with evidence read-back before removal.

Set `TMPDIR` for manager and job commands to each dispatch's 0700 private
`<run dir>/evidence/<dispatch>/` folder under
[Workspace hygiene](workspace-hygiene.md).
Never write temporary files under `/` or another shared root. Never delete
through a broad `TMPDIR` glob, sweep a shared temporary root, or wipe a general
cache. Preserve evidence and any temporary path with uncertain ownership or
containment.

An unchanged exact head and unchanged event identity creates no job; an
unchanged exact head with a new event identity remains actionable. Event
identity includes the applicable review ID and body digest, request identity, or other current GitHub event
receipt. Dedupe from current GitHub state,
native T3 task and thread/run state, and the existing compact run record; do
not create machine cursor files or a queue engine. Record enough to resume: PR,
head, base, event identity, mode, owner and worker receipts, verdict,
submission receipt, hold, and next action. GitHub remains authoritative for
open state, revisions, reviews, checks, and merge state.

## Held job settlement

Use native runtime inspection, not saved prose or silence, to identify an
actual hold and bind it to the exact task, thread/run, event, and
evidence. Permission prompts and provider safety refusals are incomplete held
outcomes: do not answer or bypass them, retry their content through another
model, or claim completion. Do not forge `AXSTACK-DONE`. Record the held event
identity and its resume condition in durable continuity. An unchanged hold creates no new job, no
retry, and no repeated notification; a changed event is reconsidered against
the original authority rather than assumed safe.

Preserve the prompt or refusal evidence, then follow the [T3 runtime](t3-runtime.md)
recovery and cleanup guidance for every owned descendant. Use
only supported native lifecycle actions and receipt-supplied next actions;
saved status, contact loss, and a coordinator narrative do not settle a worker.
Unknown or user-owned work is never a kill target. Do not release the PR slot
until native state verifies settlement of the coordinator and every descendant.
Unrelated eligible PRs continue after the tree is verified settled, while the
held PR waits durably for its resume condition.

Execution settlement and cleanup retention are separate. Positive full-tree
process exit plus native task and thread/run settlement frees the slot. Retained
metadata does not occupy an execution slot: preserve it and its evidence for
reconciliation without reviving the failed job. Likewise, an archive hold
blocks workspace removal, not settled execution capacity; record the cleanup
hold, preserve the workspace, and let unrelated eligible PRs continue.

An active, unknown, protected, or unverifiable coordinator or descendant is
different: preserve its evidence and keep its slot occupied. Unresolved
execution teardown pauses the lane before another pass can admit work rather
than claiming capacity from an uncertain process tree.

When the current event is handled, settle the PR job and descendants, then use
`t3_thread_organize` to settle their terminal threads after verifying terminal run evidence. For a completed non-author
PR-job worktree with dirty source or unpushed commits, use the
[Workspace hygiene](workspace-hygiene.md) salvage path before removal.
Preserve review evidence not yet durable, pending external results, and user-owned
work until durability and ownership are proven. Unknown liveness, genuine
`user_takeover`, and ambiguous publication likewise forbid cleanup. Here a
pending external result means an unconfirmed review submission
or send outcome, not pending CI. Waiting state belongs in GitHub and the compact
record, never in an idle model, per-PR timer, or polling loop.
Follow the [private evidence archive](evidence-archive.md) when legacy
in-worktree evidence is the only local state to preserve; archive success does not relax any other guard.
For a settled PR job with legacy in-worktree scratch, archive it through the
[private evidence archive](evidence-archive.md), read back its archive and
compact receipt, then use [axstack-cleanup](../../axstack-cleanup/SKILL.md)'s
exact-path guards to retire reviewer and PR-job worktrees in the same pass.
A merged or closed PR must never keep a job worktree waiting for a user decision;
resolve that hold by archive, verified salvage when needed, and cleanup.
Preserve genuine protections: `user_takeover`, unknown liveness, ambiguous
publication, and failed salvage verification.

## Review authority

Peer review follows `axstack-review` peer mode: two isolated configured
reviewers inspect the exact head and base. Complete review may publish the
ordinary binding `APPROVE` or `REQUEST_CHANGES` verdict after a final head,
base, request, open-state, and existing-review readback. Incomplete review,
unknown GitHub state, unavailable required models, or unresolved disagreement
publishes nothing.

The public verdict is bound to the GitHub review commit parameter, ends with
the workflow marker above, and is read back by review ID at that head. It is
self-contained for the PR reader: include every validated finding and its
evidence and consequence; never narrate reviewer counts, gates, receipts, or
private or local artifacts. Write the local HTML copy under the established
`~/defi/misc/reviews/review-<repo>-PR-<num>.html` convention, with
`review-PR-<num>.html` reserved for `defi-com/monorepo`. Never publish a
`COMMENT` review. An ambiguous submission is looked up before retry.

No manager, coordinator, or worker may merge, close, force-push, rebase,
restack, broaden scope, or mutate a PR branch. Human merge remains the
boundary.

## Exceptional decisions and notifications

A credible security concern, permanent on-chain state change, or architecture
decision is held in GitHub or a durable user-owned conversation that survives
the finite manager session. Store the PR, head, base, action, candidate,
decision context, durable decision location, and preserved candidate bytes or
refs in the compact record. The decision must never depend on a closed manager
chat. Send one deduplicated Telegram notification only when the recorded
`Notification policy` authorizes it, using
[axstack-relay](../../axstack-relay/SKILL.md) and telling the user where the
durable decision is actionable.

Telegram delivery, a Telegram reply, or silence never authorizes an action.
After a decision, revalidate the exact candidate, head, base, event, authority,
and remote state before acting. A changed input makes the old decision stale
and holds that action. There are no token files, Telegram decision interpreter,
or separate model gate.

## Finite-session teardown

Each pass retires settled predecessor passes and reports the retained worktree
count. Retirement requires terminal run evidence and settled descendants,
durable continuity, evidence read-back and verified salvage where needed;
follow [Workspace hygiene](workspace-hygiene.md) and [T3 runtime](t3-runtime.md).
Then run the driver-start orphan sweep under Workspace hygiene; the sweep is
silent when nothing was removed. Record sweep results and holds in continuity's
Open holds table.
The orphan sweep covers the run record's repositories plus registered repositories on this host.
`t3_thread_organize` settle/archive changes metadata only; exact guarded Git
worktree removal remains separate. Unknown, active or user-taken-over threads,
ambiguous publication and failed salvage stay preserved.
Past the authorized storage limit (default 20 retained lane worktrees), disable the schedule
with `update_scheduled_task` using `enabled:false` and hold.
Read back the disabled schedule with `list_scheduled_tasks`; uncertainty holds.

After admission closes, settle every owned PR job and all descendants before
the manager pass ends. Complete guarded evidence archival and worktree cleanup.
Save continuity, open decisions, and the last pass summary using the linked
template; read back all four sections and the save before ending the finite turn.
Waiting PRs occupy zero slots after their trees settle. Cleanup retention holds
removal, not settled execution capacity. The next pass retires this settled pass.

## Activation canary

The canary runs two overlapping `run_scheduled_task_now` passes and proves one
admission owner per PR. The canary reviews or correctly no-ops one real PR event.
The canary reconciles a killed predecessor.
With a temporary limit equal to the current count, the canary disables the
schedule and verifies that the following interval creates zero new pass worktrees.
The previous review-manager automation is disabled, never deleted, only after all four T3 canary checks pass.
A firing timestamp proves neither delivery nor useful completion.
Source checks alone do not prove launch, overlap, recovery, or growth behavior.

## Recovery and limits

On a lost manager session, reconcile native T3 workers, task status, thread/run
state, GitHub state, and the compact run record. Reuse valid unchanged receipts.
Unknown ownership blocks only the affected PR; unknown liveness, approval or
publication outcome preserves its hold. Recovery never replaces a live writer
or takes over user work. Other unambiguous work can proceed.

Use only native T3 schedules and orchestration. Add no daemon, shell precheck,
watchdog script, custom scheduler, cursor or pending sidecar, runtime database,
workflow state machine, decision interpreter, or programmatic escalation gate.
Live VPS activation and the four canary outcomes remain unverified until exercised.
