# Native peer-review manager

Read this for the optional native Orca peer-review automation. The historical
automation specs and plans describe retired designs and are not instructions.

## Topology and schedules

The review manager runs at minutes `0,15,30,45` and invokes
[axstack-review](../../axstack-review/SKILL.md) for eligible peer reviews.

Use one dedicated existing Orca workspace owned by this automation. Configure
native existing-workspace mode with `--fresh-session`, never `--reuse-session`;
each pass gets a fresh finite manager session. Keep lane continuity and evidence
at configured durable absolute paths. A manager never checks out a PR branch
in its workspace. Missed slots do not replay a backlog; the next ordinary pass
discovers current state. The short packaged review prompt sits beside this file
and discovers these rules by relative link instead of copying them.

Provision one explicit absolute continuity path per automation ID in the
scheduled prompt. The repository's absolute Git common directory is a valid
durable root; missing or non-durable configuration holds admission. Follow the
[Run record](run-record.md). Each pass
uses the [Review-manager continuity template](run-record.md#review-manager-continuity-template),
overwrites its four current-state sections, and archives superseded history once
in the adjacent history file. A no-change pass appends at most one history line.

This is prompt policy, not proof that Orca starts a fresh session or prevents
overlapping passes. Before activation a native canary must prove fresh-session
launch, overlapping-pass behavior, recovery after session loss, nested
dispatch depth for coordinator-launched leaves, and total process and memory
effects. A firing timestamp proves neither delivery nor useful completion.

## Session admission

Reconcile saved state, current GitHub state, and native Orca Tasks, Dispatches,
sessions, and liveness across all workspaces belonging to the lane before
discovery or admission; never infer lane ownership from an empty local workspace.
Bind the lane to the automation ID and pass to its native run ID, workspace ID,
and terminal identity, not a title or directory-name guess.
A confirmed live manager for the same lane remains authoritative.
The new duplicate does no PR work, makes no shared-record write, touches
nothing owned by the live manager, and closes only its own exact terminal as
its final action under the guard below.
Unknown liveness blocks admission and shared-record writes; it does not
authorize takeover, cleanup, or a duplicate manager. Preserve `user_takeover`
and other user-owned sessions.

When two new passes overlap, reconcile native run ordering before either admits
work; the earlier unsettled pass retains the lane. Missing ordering or ownership
evidence holds admission, never guesses a winner. This is not an atomic lock:
activation requires an overlap canary proving only one pass admits work. Count
all unsettled PR jobs and descendants across the lane, not just this workspace.
Read every page of native runs, workers, and workspace inventory; truncated or
failed inventory holds admission and cleanup rather than implying absence.

A prior manager does not retain the lane merely because its automation run
status says failed or dispatched. Reconcile a surviving prior terminal using
exact identity and proven completion from native state before treating it as
live or releasing ownership. Require confirmed process exit for its exact
terminal incarnation, saved continuity, and settlement of all owned jobs and
descendants before ownership release. A completed run row alone does not prove exit.
If these facts remain unknown, report the hold at the durable decision location;
do not silently stand down forever or replace a potentially live owner.

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

The logical manager lane owns ongoing discovery and continuity across finite
sessions; the bounded PR coordinator owns only its admitted event. Do not create a second live owner or
writer for the same PR. Reuse an existing valid per-PR worktree, owner, and
unchanged receipts before creating anything. Otherwise create one separate
Orca worktree per PR job, parented to that repository's primary worktree, and
pin the observed head and base. The bounded PR coordinator loads the
review skill, launches only the reviewers that skill owns,
handles the current actionable event, returns exact receipts, then settles.
Settlement returns continuity to the manager rather than retaining an idle PR
coordinator. Reviewers retain the isolation required by `axstack-review`:
each runs in a separate Orca child worktree, keeps its probes and evidence
inside that worktree, and preserves required evidence before removal.

Set `TMPDIR` for manager and job commands to a private directory inside each
command's owning workspace. Follow ownership, containment, and cleanup checks
in the [runtime boundary](orca-runtime.md#reviewer-workspaces-and-evidence).
Never write temporary files under `/` or another shared root. Never delete
through a broad `TMPDIR` glob, sweep a shared temporary root, or wipe a general
cache. Preserve evidence and any temporary path with uncertain ownership or
containment.

An unchanged exact head and unchanged event identity creates no job; an
unchanged exact head with a new event identity remains actionable. Event
identity includes the applicable review ID and body digest, request identity, or other current GitHub event
receipt. Dedupe from current GitHub state,
native Orca Task and Dispatch state, and the existing compact run record; do
not create machine cursor files or a queue engine. Record enough to resume: PR,
head, base, event identity, mode, owner and worker receipts, verdict,
submission receipt, hold, and next action. GitHub remains authoritative for
open state, revisions, reviews, checks, and merge state.

## Held job settlement

Use native runtime inspection, not saved prose or silence, to identify an
actual hold and bind it to the exact Task, Dispatch, terminal, event, and
evidence. Permission prompts and provider safety refusals are incomplete held
outcomes: do not answer or bypass them, retry their content through another
model, or claim completion. Do not forge `worker_done`. Record the held event
identity and its resume condition in durable continuity. An unchanged hold creates no new job, no
retry, and no repeated notification; a changed event is reconsidered against
the original authority rather than assumed safe.

Preserve the prompt or refusal evidence, then follow the version-matched
orchestration recovery and cleanup guidance for every owned descendant. Use
only supported native lifecycle actions and receipt-supplied next actions;
saved status, contact loss, and a coordinator narrative do not settle a worker.
Unknown or user-owned work is never a kill target. Do not release the PR slot
until native state verifies settlement of the coordinator and every descendant.
Unrelated eligible PRs continue after the tree is verified settled, while the
held PR waits durably for its resume condition.

Execution settlement and cleanup retention are separate. Positive full-tree
process exit plus native Task and Dispatch settlement frees the slot. Retained
metadata does not occupy an execution slot: preserve it and its evidence for
reconciliation without reviving the failed job. Likewise, an archive hold
blocks workspace removal, not settled execution capacity; record the cleanup
hold, preserve the workspace, and let unrelated eligible PRs continue.

An active, unknown, protected, or unverifiable coordinator or descendant is
different: preserve its evidence and keep its slot occupied. Unresolved
execution teardown pauses the lane before another pass can admit work rather
than claiming capacity from an uncertain process tree.

When the current event is handled, settle the PR job and descendants, then use
native `worker-release` for their worker terminals. Preserve dirty source,
unpushed commits, unarchived review evidence, pending
external results, and user-owned work until durability and ownership are
proven. Unknown liveness, `user_takeover`, and ambiguous publication likewise
forbid cleanup. Here a pending external result means an unconfirmed review submission
or send outcome, not pending CI. Waiting state belongs in GitHub and the compact
record, never in an idle model, per-PR timer, or polling loop.
Follow the [private evidence archive](evidence-archive.md) when evidence is the
only local state to preserve; archive success does not relax any other guard.
For a settled PR job, archive classified scratch through the
[private evidence archive](evidence-archive.md), read back its archive and
compact receipt, then use [axstack-cleanup](../../axstack-cleanup/SKILL.md)'s
exact-path guards to retire reviewer and PR-job worktrees in the same pass.
A merged or closed PR must never keep a job worktree waiting for a user decision;
resolve that hold by archive and cleanup. Preserve genuine protections: dirty
source, unpushed commits, `user_takeover`, unknown liveness, and ambiguous publication.

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

After admission closes, settle every owned PR job and all descendants before the
manager session closes; active or unknown descendants keep their PR slot occupied
and must be reconciled from native state. Release settled worker terminals and
complete guarded evidence archival and worktree cleanup in this pass. Save
continuity, open decisions, and the last pass summary using the linked template;
read back all four sections and the save before closing.
Use the exact native terminal close for this pass's own terminal from its run
receipt: `orca terminal close --terminal <exact-handle> --json`. Terminal close
is the final action. Never use `--all`, a broad or name selector, or another
terminal in the dedicated workspace; uncertain identity or close outcome holds
the lane for native reconciliation, never a guessed retry.
Waiting PRs still occupy zero slots once their owned trees settle. A failed
cleanup remains a recorded hold with its exact resume condition, but does not
keep settled execution active.

The activation canary must prove fresh sessions in the dedicated workspace,
same-lane overlap admission, recovery after session loss, nested dispatch depth,
process and memory effects, and terminals in the dedicated workspace bounded
over repeated passes. Do not activate on source checks alone.

## Recovery and limits

On a lost manager session, native recovery first reconciles actual Orca
workers and Dispatches, GitHub state, and the compact run record. Reuse valid
unchanged receipts. Unknown ownership blocks only the affected PR, as does
unknown liveness, approval, or publication outcome; recovery never copies old
capability, replaces a live writer, or takes over live user work. Other
unambiguous work may proceed.

Use only native schedules and Orca orchestration. Add no daemon, shell precheck,
watchdog script, custom scheduler, cursor or pending sidecar, runtime database,
workflow state machine, decision interpreter, or programmatic escalation gate.
The live VPS activation, native fresh-session and overlapping-pass behavior, recovery path,
nested dispatch depth for coordinator-launched leaves, and resource ceiling
remain unverified until the canary succeeds.
