# Workspace hygiene for driver-owned Orca runs

This is a prompt contract for drivers, not a cleanup daemon or new Orca
protocol. Use the version-matched Orca guides for native operations. A worker
never sweeps or removes another session. Record each decision and native
readback in the private run record; uncertain ownership, liveness, or evidence
holds only the affected resource.

## Settlement

At intermediate completion, once a worker or reviewer Dispatch is accepted,
the driver releases it natively, confirms closure from a fresh native terminal
list, then removes its worktree, descendants first, after the preservation
checks below. Keep the author worktree and session until merge so repairs return
to the same author. Release, terminal closure, worktree removal, and branch
retirement each need their own receipt.

At final settlement, no eligible non-driver session or worktree remains,
including the run's worktrees in other repositories. Report each remaining
resource as a hold with its reason. Recorded native ownership by Run, Task,
and Dispatch decides; parent/child display lineage does not. The creator closes
what it created. A finite scheduled pass closes only its own exact terminal as
its final action. Manual chats, automation dedicated workspaces, and genuine
`user_takeover` sessions are never removed. Deleting a session means closing
its terminal; agent chat history is not deleted.

## Preserve before removal

Workers write reports, probes, logs, evidence, and scratch to the private
`<run dir>/evidence/<dispatch>/` directory outside the disposable worktree.
Name the exact directory in the dispatch brief and completion receipt. Peer
reviewers use separate worktrees and separate evidence folders; neither reads
the other's first-pass work. Authors commit the candidate before reporting
done. Workers never push; the driver publishes under candidate-publication.

If a completed non-author worktree has uncommitted or unpublished content,
salvage before removal: create a salvage ref in that worktree, run `git add -A`
and commit everything on that ref, write a `git bundle` for it into the private
run folder, then run `git bundle verify`. Record the bundle path, bundle SHA-256, and salvage commit SHA in the
receipt before removing the worktree. A failed verify holds the worktree. Never
salvage an author worktree before merge. Ignored non-cache files (anything other
than known build and dependency caches), submodule changes, and content outside
the worktree hold instead of being salvaged. Preserve any ambiguous source or
publication state. Recheck the native owner and liveness immediately before
removal, and use exact native worktree removal without force.

## Driver-start orphan sweep

Drivers only sweep on phase-skill entry; dispatched workers never sweep. Scope
the sweep to the current repository and the per-run worktrees in other
repositories recorded in the driver's run records. If Orca is unreachable,
report one line and continue the phase; an unreachable host holds only its
items. This is standing authority to remove an orphan after salvage when every
owning Dispatch and descendant is settled, ownership and liveness are rechecked
from a fresh native list, and evidence is durable. Remove descendants first.
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
