# Workspace hygiene for driver-owned Orca runs

This is a prompt contract for drivers, not a cleanup daemon or new Orca
protocol. Use the version-matched Orca guides for native operations. Dispatched
workers never sweep or remove another session. A scheduled pass with recorded
cleanup authority acts as its lane's driver for the sweep; read-only observers
only report leftovers. Record each decision and native readback in the private
run record; uncertain ownership, liveness, or evidence
holds only the affected resource.

## Settlement

At intermediate completion, once a worker or reviewer Dispatch is accepted,
the driver releases it natively, confirms closure from a fresh native terminal
list, then removes its worktree, descendants first, after the preservation
checks below. Keep the author worktree and session until the PR merges or closes
so repairs return to the same author. Release, terminal closure, worktree removal, and branch
retirement each need their own receipt.

At final settlement, no eligible non-driver session or worktree remains,
including the run's worktrees in other repositories. Report each remaining
resource as a hold with its reason. Recorded native ownership by Run, Task,
and Dispatch decides; parent/child display lineage does not. The creator closes
what it created. A finite scheduled pass closes only its own exact terminal as
its final action. Manual chats, automation dedicated workspaces, and genuine
`user_takeover` sessions are never removed. Deleting a session means closing
its terminal; agent chat history is not deleted.

If native exact terminal close returns `runtime_error` for a provably finished
agent, send `/quit` + Enter to that exact terminal, wait about 5 seconds, then
send `exit` + Enter. Confirm it left a fresh native terminal list. Never use
this fallback for a working, user-taken-over, or unclear agent; never use
`--all` or a name selector. A finite scheduled pass whose own close fails
leaves its terminal for the next pass, without treating that expected failure
as a hold. At pass start, clear only provably finished predecessor terminals
of the same automation in its dedicated workspace by this exact-handle path.

## Preserve before removal

Workers write reports, probes, logs, evidence, and scratch to the private
`<run dir>/evidence/<dispatch>/` directory outside the disposable worktree.
Name the exact directory in the dispatch brief and completion receipt. Peer
reviewers use separate worktrees and separate evidence folders; neither reads
the other's first-pass work. Authors commit the candidate before reporting
done. Workers never push; the driver publishes under candidate-publication.

If a completed eligible worktree has uncommitted or unpublished content,
salvage before removal: create a salvage ref in that worktree, run `git add -A`
and commit everything on that ref, write a `git bundle` for it into the private
run folder, then run `git bundle verify`. Record the bundle path, bundle SHA-256, and salvage commit SHA in the
receipt before removing the worktree. A failed verify holds the worktree. Never
salvage an author worktree before merge or closure. Ignored non-cache files
(anything other than known build and dependency caches), submodule changes, and content outside
the worktree hold instead of being salvaged. Preserve any ambiguous source or
publication state. Recheck the native owner and liveness immediately before
removal, and use exact native worktree removal without force.

## Driver-start orphan sweep

Drivers sweep on phase-skill entry. A scheduled pass that owns its lane with
recorded cleanup authority runs the driver-start orphan sweep after predecessor
terminal cleanup, scoped to repositories listed in its run record. On
phase-skill entry, scope the sweep to the current repository and the
per-run worktrees in other
repositories recorded in the driver's run records. If Orca is unreachable,
report one line and continue the phase; an unreachable host holds only its
items. This is standing authority to remove an orphan after salvage when every
owning Dispatch and descendant is settled, ownership and liveness are rechecked
from a fresh native list, and evidence is durable. Remove descendants first.
An author worktree of a merged or closed PR is sweep-eligible when its head
commit is retrievable from the forge (for example, the PR's recorded head or a
remote branch contains it); unverifiable state is a hold. For an eligible
author worktree, salvage first if dirty, under the preservation guards above.
Phase-skill entry drivers report sweep results and holds in chat and run record.
A scheduled review-manager pass records sweep results and holds in its
continuity record's Open holds table; a maintenance watch pass reports them to
its driver for the run record. Both are silent when nothing was removed.
Branches with a remote counterpart are never deleted. List live or unsettled
work, genuine `user_takeover`, and items without provable Axstack provenance in
one table with their reason; do not remove them.

## Native bookkeeping exceptions

A repair into an existing author terminal may be labelled `user_takeover` or
`external_terminal`. Treat a repair-labelled terminal as run-owned only when
the run record contains the exact repair Dispatch ID for that terminal;
otherwise hold. Report the mislabel to Orca upstream through the driver.
For `release_unknown`, reconcile with native worker inspection. If a fresh
native terminal list confirms the terminal is gone, record the readback and
proceed; otherwise hold.

## Known Orca issues

Mark these for upstream reporting: in Orca 1.4.209 desktop, `orca terminal
close` on an agent terminal returns `runtime_error` with `Error invoking remote
method 'session:set': TypeError: Cannot convert undefined or null to object`.
Dispatch into an existing terminal marks the worker retained/`user_takeover`.
Cross-repository `--parent-worktree` is silently dropped.

## Readable sidebar

Set the Orca display name with `orca worktree set --display-name` when creating
each run worktree. Use run first, then role, space-separated: `<run> driver`,
`<run> author #<pr>`, and `<run> review #<pr> r<n>`. Peer reviewers append
`primary` or `secondary`; authored reviewers have no `primary` or `secondary`
qualifier, and authors carry no round number. Use the task ID in
place of `#<pr>` before a PR number exists, then update the name when assigned.

Set `--comment` at dispatch, at settlement with the verdict and short SHA, and
on a hold with its reason. Use `--workspace-status` for the coarse state and
the comment for detail; never set `--workspace-status completed` for a hold.

Use worktree parentage only to present ownership where supported: reviewer under
its author, author under its driver in the same repository. Dependency order
lives in names and `gh stack`. Do not rely on cross-repository parents, which
Orca silently dropped, or remote `new-child`, which is invalid. Native Run,
Task, and Dispatch receipts remain the source of ownership truth.
