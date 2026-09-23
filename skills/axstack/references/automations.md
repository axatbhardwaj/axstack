# Native PR managers

Read this only for the two native Orca PR-manager automations. The historical
automation specs and plans describe retired designs and are not instructions.

## Topology and schedules

There are exactly two logical manager lanes:

- **Review manager:** runs at minutes `0,15,30,45` and invokes
  [axstack-review](../../axstack-review/SKILL.md) for eligible peer reviews.
- **Watch manager:** runs at minutes `7,22,37,52` and invokes
  [axstack-watch](../../axstack-watch/SKILL.md) for eligible own-PR watch or
  repair events.

Use a new isolated workspace for every scheduled pass, with one fresh finite
manager session. Configure native repo-created worktree mode against the
designated manager repository; never target an existing shared workspace.
Do not use `--reuse-session`. The scheduler creates the pass workspace before
launch; the manager must not move itself from a shared launch workspace.
Keep lane continuity and evidence outside disposable manager workspaces at
the configured durable absolute paths. A manager never checks out a PR branch
in its pass workspace. Missed slots do not replay a backlog; the next ordinary pass
discovers current state. The two short packaged prompts sit beside this file
and discover these rules by relative link instead of copying them.

Provision one explicit absolute continuity path per automation ID in the
scheduled prompt. Follow [Run record](run-record.md) for its contents; the
repository's absolute Git common directory is a valid durable root, but a pass
worktree is not. Missing or non-durable continuity configuration holds admission.

This is prompt policy, not proof that Orca starts a fresh session or prevents
overlapping passes. Before activation a native canary must prove fresh-session
launch, overlapping-pass behavior, recovery after session loss, nested
dispatch depth for coordinator-launched leaves, and total process and memory
effects. A firing timestamp proves neither delivery nor useful completion.

## Session admission

Reconcile saved state, current GitHub state, and native Orca Tasks, Dispatches,
sessions, and liveness across all workspaces belonging to the same automation
before discovery or admission; never infer lane ownership from an empty local
workspace. Bind the lane to the automation ID and pass to its native run ID,
workspace ID, and terminal identity, not a title or directory-name guess.
A confirmed live manager for the same lane remains authoritative.
The new duplicate does no PR work, makes no shared-record write, touches
nothing owned by the live manager, and closes only itself as its final action
by the same guarded isolated-workspace retirement below, not a tab-only close.
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
status says failed or dispatched. Require confirmed native process exit for its
exact terminal incarnation, saved continuity, and settlement of all owned jobs
and descendants before releasing its lane ownership. Absence or saved retirement
intent alone is insufficient. Conversely a completed run row does not prove exit.
If these facts remain unknown, report the hold at the durable decision location;
do not silently stand down forever or replace a potentially live owner.

### Guarded completed-predecessor recovery

A successor may retire a positively completed predecessor whose manager terminal
survived only through this narrow recovery path. Eligibility requires an exact
automation ID, run ID, workspace ID, and terminal incarnation match, a positive
completion receipt bound to that incarnation, zero active or unsettled descendants,
and every owned Task and Dispatch settled. A completed row or saved retirement
intent alone is not positive completion. Age, status, and idle state are never
cleanup authority. Active, unknown, protected, identity-mismatched,
`user_takeover`, unexpected-terminal, permission-held, or otherwise unverifiable
state preserves the predecessor and pauses admission; this path never takes over
its PR work.

Exactly one successor, selected by native run ordering, may write the cleanup
claim. Immediately before writing, re-read the complete lane inventory and
ordering; then save and read back claimant identity, predecessor identity,
completion, and zero-descendant continuity before the exact native workspace
close. A later successor reconciles that claim and performs no cleanup mutation.
Missing ordering or a conflicting claim holds both cleanup and admission. This
ordering is not an atomic lock; activation still depends on the overlap canary
proving that two successors cannot both mutate one predecessor.

Use the version-matched native workspace close against the receipt's complete
workspace ID, never an individually guessed terminal or broad selector. After
close, re-list native runs, workspaces, terminals, Tasks, and Dispatches and prove
the full predecessor process tree exited before ownership release. Save and read
back the exit and release receipts, then use native worktree cleanup only when the
workspace has no children, dirty or unknown files, unpushed commits, unarchived
evidence, or user-owned work. Preserve every failed or uncertain close, exit,
release, or removal with its exact resume condition and pause the lane. An
unchanged cleanup failure gets no destructive retry or duplicate notification.

Before PR admission, reconcile old pass resources and reclaim every safely
removable earlier pass workspace under the retirement guards below. This is
routine cleanup on every admitted pass; do not wait for the three-workspace
threshold to start cleanup. Save confirmed exit and ownership-release receipts
before removing each workspace. Preserve dirty, unpushed, evidence-bearing,
user-owned, active, or uncertain resources; the threshold never relaxes these guards.
Explicitly classified evidence may cease to block cleanup only after the
[private evidence archive](evidence-archive.md) is verified and its receipt is
read back from durable continuity. This never makes other dirt disposable.
After cleanup, re-list and count only the earlier pass workspaces still remaining.
If three or more unreclaimed
earlier pass workspaces remain, disable only this automation through the native
CLI, verify the disabled setting, save/report the cleanup hold, and admit no new
PR jobs. Also pause on a confirmed earlier-manager retirement failure or
unresolved lane ownership. A settled PR-job worktree retained for evidence is a
cleanup hold, not unsettled execution or lane ownership.
Already-dispatched passes still reconcile and retire only their own safe resources;
this threshold is a stop condition, not an atomic hard cap on in-flight creations.
An uncertain disable is a reported failure, not proof scheduling stopped. Resume
only after ownership/cleanup is verified and explicit activation authority exists.

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

The watch manager covers every open non-draft PR authored by self. It may
repair only `defi-com/monorepo` and `defi-com/mobile`; PRs elsewhere remain
observed but read-only. Preserve deploy-on-push exclusions, lowest-first stack
dependencies, and existing ownership boundaries. Peer code is always
read-only.

Coverage is not execution. Waiting for CI, a reviewer, a user decision, or a
merge occupies no execution slot after owned work and descendants settle.
Watch membership never reserves a slot and no job stays active merely until a
PR merges or closes. Thirty open PRs, including ten settled waiting PRs, are
all scanned; those ten occupy zero slots.

## Admission and fairness

Each manager admits at most five concurrently executing PR tasks across ticks.
The review manager admits at most five, and the watch manager admits at most
five. Their caps are separate; never borrow unused capacity from the other
lane. Admit fewer when the whole worker tree would put the host under resource
pressure.

A slot covers one bounded PR event and remains occupied while its author,
reviewers, or other owned descendants are active or unsettled. Leaf workers do
not create recursive teams. Settlement of the PR job and every descendant
frees the slot even while the PR stays open.

Inspect all eligible PRs before admission. Preserve unserved work in the
compact run record and select the oldest actionable unserved event first, with
ascending repository and PR-number tie breaks. A sixth event is admitted after
a slot settles; repeatedly changing PRs cannot starve older unserved work.

## Per-PR jobs

The logical manager lane owns ongoing discovery and continuity across finite
sessions; the bounded PR coordinator owns only its admitted event. Do not create a second live owner or
writer for the same PR. Reuse an existing valid per-PR worktree, owner, and
unchanged receipts before creating anything. Otherwise create one separate
Orca worktree per PR job, parented to that repository's primary worktree, and
pin the observed head and base. The bounded PR coordinator loads the
appropriate skill, launches only the reviewers or author that skill owns,
handles the current actionable event, returns exact receipts, then settles.
Settlement returns continuity to the manager rather than retaining an idle PR
coordinator. Reviewers retain the isolation required by `axstack-review`.

Give each job a private job-local temporary directory under its per-PR
worktree, following the ownership, containment, and cleanup checks in the
[runtime boundary](orca-runtime.md#reviewer-workspaces-and-evidence). Never
delete through a broad `TMPDIR` glob, sweep a shared temporary root, or wipe a
general cache. Preserve evidence and any temporary path whose ownership or
containment is uncertain.

An unchanged exact head and unchanged event identity creates no job; an
unchanged exact head with a new event identity remains actionable. Event
identity includes the applicable review ID and body digest, check identity and
result, or other current GitHub event receipt. Dedupe from current GitHub state,
native Orca Task and Dispatch state, and the existing compact run record; do
not create machine cursor files or a queue engine. Record enough to resume: PR,
head, base, event identity, mode, owner and worker receipts, candidate,
publication receipt, hold, and next action. GitHub remains authoritative for
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
execution teardown, or failure to retire the manager pass itself, pauses the
lane before another pass can admit work rather than accumulating active passes
or claiming capacity from an uncertain process tree.

When the current event is handled, settle and release owned native resources.
Preserve dirty worktrees, unpushed candidates, unarchived review evidence, pending
external results, and user-owned work until durability and ownership are
proven. Unknown liveness, `user_takeover`, and ambiguous publication likewise
forbid cleanup. Here a pending external result means an unconfirmed publication
or send outcome, not pending CI. Waiting state belongs in GitHub and the compact
record, never in an idle model, per-PR timer, or polling loop.
Follow the [private evidence archive](evidence-archive.md) when evidence is the
only local state to preserve; archive success does not relax any other guard.
For a completed PR-job, including one whose PR remains open, archive classified
reviewer scratch through the [private evidence archive](evidence-archive.md),
read back the archive and compact receipt, then follow
[axstack-cleanup](../../axstack-cleanup/SKILL.md)'s exact-path guards to retire
the reviewer checkout before merge. This does not release active jobs or manager
pass workspaces.

## Review and repair authority

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

An own PR becomes actionable for repair only when a failing check has a base
check-run with the same name and producing app identity observed passing (or a
legacy status has the same context), or when a new current-head
`CHANGES_REQUESTED` review has both an unhandled review ID and an unhandled body
digest. Missing, pending, or same-name/different-app base evidence holds repair.
A new head or generic event grants no repair authority by itself.

Authorized own-PR repair follows `axstack-watch`: produce the smallest repair
in the per-PR worktree, obtain the actual-author-provenance reviewer pairing,
and publish only a reviewed fast-forward repair push after exact-current
candidate, head, base, event, allowlist, deploy, and remote readback receipts.
Reconcile an ambiguous review or push result before any retry.

No manager, coordinator, or worker may merge, close, force-push, rebase,
restack, broaden scope, or use `gh stack` mutation. Human merge remains the
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
manager session ends; active or unknown descendants keep their PR slot occupied
and must be reconciled rather than trusted from saved status. Then save durable
continuity, evidence locations, pending receipts, and user decisions before
self-close. Waiting PRs still occupy zero slots once their owned trees settle.

Cleanup of PR-job setup shells stays scoped to positively identified owned unused
setup shells: use the native exact-terminal close operation for each only.
Preserve dirty worktrees, unpushed candidates, unarchived review evidence, user-owned
terminals, unknown liveness, `user_takeover`, and ambiguous publication state.
Never classify all dirt as evidence. If explicitly classified evidence is the
last retention reason, apply and verify the [private evidence archive](evidence-archive.md),
update durable continuity, and read it back before native retirement.
Completed PR-job reviewer scratch uses axstack-cleanup after archive and readback;
it never changes manager pass preservation or retirement guards.

For the manager pass only, verify native run/workspace identity, exclusive
automation ownership, no unsettled descendants, and a fresh terminal inventory
containing only this manager and its proven unused setup shells. No other pass
may target this workspace. If an unexpected terminal or user takeover is present,
do not bulk-close; preserve the workspace and report the hold at its durable
decision location. Never bulk-close a shared manager workspace or a PR-job worktree.

After saving continuity, use the version-matched native workspace retirement:
`terminal close --worktree id:<exact-native-workspace-id> --all --json`.
Copy the complete ID from the run/workspace receipt; never use a name, branch,
path-only selector, or `active` for this destructive operation.
Self-close is the final action; perform no record write or cleanup afterward.
A failed or uncertain close is not proof of retirement. The next admitted pass
reconciles prior retirement from native state before trusting saved intent.
Retire only positively identified completed pass resources; do not kill another
live or unknown manager. Remove an old pass worktree only with native cleanup
after terminal retirement is confirmed and it has no unpushed commits,
unarchived evidence, children, user-owned work, unknown files, or unexplained
dirty source. A verified evidence archive does not require otherwise clean Git
state, but every remaining change must still be positively classified and safe;
unknown dirt blocks removal. Never use recursive shell deletion. Failed cleanup
remains recorded, not silently forgotten. Failed PR-job workspace cleanup stays
a cleanup hold after execution settles; failed or unverifiable manager-pass
retirement pauses the lane instead of allowing active passes to accumulate.

The activation canary must additionally prove distinct workspace IDs per pass,
cross-workspace lane admission, self-retirement and absence after client reconnect,
and bounded retained worktrees over repeated passes. A shell-only close test does
not prove agent resume-record retirement. Do not activate on source checks alone.

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
