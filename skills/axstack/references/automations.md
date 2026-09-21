# Native PR managers

Read this only for the two native Orca PR-manager automations. The historical
automation specs and plans describe retired designs and are not instructions.

## Topology and schedules

There are exactly two reusable manager chats:

- **Review manager:** runs at minutes `0,15,30,45` and invokes
  [axstack-review](../../axstack-review/SKILL.md) for eligible peer reviews.
- **Watch manager:** runs at minutes `7,22,37,52` and invokes
  [axstack-watch](../../axstack-watch/SKILL.md) for eligible own-PR watch or
  repair events.

Each uses native existing-workspace reuse in its own dedicated manager
workspace. A manager never checks out a PR branch in that workspace. Missed
slots do not replay a backlog; the next ordinary tick discovers current state.
The two short packaged prompts sit beside this file and discover these rules by
relative link instead of copying them.

This is prompt policy, not proof that Orca serializes a busy tick or reuses a
session. Before activation a native canary must prove same-session reuse, busy
tick behavior, recovery after session loss, nested dispatch depth for
coordinator-launched leaves, and total process and memory effects. A firing
timestamp proves neither delivery nor useful completion.

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

The reusable manager owns ongoing discovery and continuity; the bounded PR
coordinator owns only its admitted event. Do not create a second live owner or
writer for the same PR. Reuse an existing valid per-PR worktree, owner, and
unchanged receipts before creating anything. Otherwise create one separate
Orca worktree per PR job, parented to that repository's primary worktree, and
pin the observed head and base. The bounded PR coordinator loads the
appropriate skill, launches only the reviewers or author that skill owns,
handles the current actionable event, returns exact receipts, then settles.
Settlement returns continuity to the manager rather than retaining an idle PR
coordinator. Reviewers retain the isolation required by `axstack-review`.

An unchanged exact head and event creates no job. Dedupe from current GitHub
state, native Orca Task and Dispatch state, and the existing compact run record;
do not create machine cursor files or a queue engine. Record enough to resume:
PR, head, base, event identity, mode, owner and worker receipts, candidate,
publication receipt, hold, and next action. GitHub remains authoritative for
open state, revisions, reviews, checks, and merge state.

When the current event is handled, settle and release owned native resources.
Preserve a dirty worktree, an unpushed candidate, pending external result, or
user-owned work until its durability and ownership are proven. Here a pending
external result means an unconfirmed publication or send outcome, not pending
CI. Waiting state belongs in GitHub and the compact record, never in an idle
model, per-PR timer, or polling loop.

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
decision is held in the reusable manager's Orca conversation. Store the PR,
head, base, action, candidate, decision context, and preserved candidate bytes
or refs in the compact record. Send one deduplicated Telegram notification only
when the recorded `Notification policy` authorizes it, using
[axstack-relay](../../axstack-relay/SKILL.md) and telling the user to act in
that manager conversation.

Telegram delivery, a Telegram reply, or silence never authorizes an action.
After a decision in the manager conversation, revalidate the exact candidate,
head, base, event, authority, and remote state before acting. A changed input
makes the old decision stale and holds that action. There are no token files,
Telegram decision interpreter, or separate model gate.

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
The live VPS activation, native reuse and busy-tick behavior, recovery path,
nested dispatch depth for coordinator-launched leaves, and resource ceiling
remain unverified until the canary succeeds.
