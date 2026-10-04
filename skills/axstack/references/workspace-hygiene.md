# Workspace hygiene for driver-owned T3 runs

This is a prompt contract, not a cleanup daemon. Follow [T3 runtime](t3-runtime.md)
for native identities, terminal run evidence and schema. Dispatched workers never
sweep or remove another session. A scheduled pass with recorded cleanup authority
acts as its lane's driver; read-only observers only report leftovers. Uncertain
ownership, liveness or evidence holds only the affected resource.
Record each decision and native readback in the private run record.

## Safe deletion

Before use, commands must scope `TMPDIR` to an owned 0700 directory under the system temp directory, never under `$HOME`, named from the dispatch key and recorded in the receipt.
Validate its real path, absence of symlinks and ownership before use and cleanup; remove it afterwards by literal absolute path.
Evidence files still go to the private `<run>/evidence/<key>/` folder.

Every shell deletion targets a literal absolute path or a `${VAR:?}`-guarded expansion, only inside the worker's own evidence folder, `TMPDIR`, or worktree.
For validated owned scratch, use `rm -r /tmp/<dispatch-key>/scratch` on a literal absolute path inside the evidence folder, `TMPDIR`, or worktree.
Never use a bare `$VAR`, a glob on a variable, `/`, `HOME`, or a shared root as a deletion target.
Prefer `git clean -- <exact prefix>` or tool-native cleanup. A safety prompt that
still appears is a hold; agents do not answer it.

## Project preflight

`worktreeCleanup` must be `off` for every Axstack project.
Preflight reads back `worktreeCleanup` via `t3_project_read` where exposed; otherwise record a limitation pointing to the documented installation setup step.
Automatic deletion cannot replace evidence readback or salvage. Do not change
project settings without recorded host-mutation authority.

## Settlement

Cleanup order is: settled descendants -> evidence readback -> salvage dirty or ignored non-cache content -> t3_thread_organize archive -> exact git worktree remove without force -> git branch -d for local-only branches.
Require terminal run evidence before `t3_thread_organize` settle or archive.
These metadata actions do not remove worktrees. Accept matching delegated task
or launched run completion under the runtime contract before settlement.
Keep the author worktree and thread until the PR merges or closes.
Retain a user-taken-over T3 thread and never send cleanup commands to it, including `t3_thread_organize` settle or archive.
Never remove the current driver, current pass, an active or unknown thread, an unsettled descendant, or a resource with ambiguous ownership.
At final settlement, no eligible non-driver thread or worktree remains.
At final settlement include run-owned worktrees in other repositories of the
same project and report each remaining resource as a hold with its reason. Recorded
projectId, threadId/runId, delegated taskId/childThreadId/childRunId, attempt key,
checkout path and revision decide ownership. Idle alone never proves exit.

Read back the durable receipt and evidence manifest before removing source copies or the worktree; missing or differing readback holds removal.
Evidence already outside the checkout needs no copy; read back its receipt and
supporting files. Keep settlement, evidence preservation, thread archival,
worktree removal and branch retirement as separate receipts.
Remove only the exact recorded path with `git worktree remove <path>` without force, then read back `git worktree list --porcelain` to verify absence.
Branches with a remote counterpart are never deleted.
Use exact `git branch -d <branch>` only for a proven run-owned local-only branch whose tip is reachable from the preserved candidate, verified salvage ref, or confirmed remote PR head; unique or unknown commits hold branch deletion.
Never delete the author branch for reviewer cleanup. Verify ref absence; a failed
or uncertain operation preserves the resource and resumes from its last receipt.

## Owned schedule retirement

At Close-out reconcile recorded scheduledTaskIds with `list_scheduled_tasks`:
the owning run must have created each exact per-run watch selected for retirement.
Use `delete_scheduled_task` by exact ID and verify absence via
`list_scheduled_tasks` once nothing remains unsettled. An uncertain result holds
and retains the recorded ID. Cross-run retirement of an owned per-run watch
requires that its run is closed or every watched PR is merged or closed.
Read-only observers report to the driver; they do not remove schedules or worktrees.
Never remove the durable review-manager schedule, its lane resources, or a
user-created schedule through ordinary run settlement. See
[Review manager](automations.md) for scheduled-task health and lane policy.
Schedule deletion is distinct from thread archival and Git worktree removal.

## Preserve before removal

Workers write reports, probes, logs, evidence and scratch to private
`<run>/evidence/<key>/` outside disposable worktrees. Name the exact directory
in the brief and completion receipt. Peer reviewers use separate detached
checkouts and separate evidence folders with no first-pass cross-read. Authors commit
before reporting done; workers never push. The driver publishes under
[candidate publication](candidate-publication.md).

Before removal of an eligible non-author worktree with uncommitted or unpublished content, create a salvage ref, run `git add -A`, commit on that ref, write a `git bundle` into the private run folder, and run `git bundle verify`.
Ignored non-cache files must be explicitly classified and preserved in a verified salvage bundle before removal; unknown files hold the worktree.
Stage each classified ignored file separately with `git add -f -- <exact path>`
on the salvage ref before the commit; known build and dependency caches are
excluded. Verify the bundle includes every classified file's bytes and salvage
commit, beyond the bundle's structural verification.
Record the bundle path, bundle SHA-256, and salvage commit SHA in the receipt before removing the worktree.
A failed bundle verify holds the worktree.
Never salvage an author worktree before merge or closure.
Submodule changes and content outside the worktree hold instead of being salvaged.
Preserve ambiguous source or publication state. Recheck native owner, terminal
run evidence and no-writer proof immediately before archival and removal.
A verified bundle changes preservation classification, not ownership or liveness.

## Driver-start orphan sweep

Drivers sweep on phase-skill entry. The sweep inventory is fully paginated project-scoped T3 threads plus `git worktree list --porcelain` plus run records.
Use projectId and exact recorded identities, not title substrings or age, to
prove Axstack provenance; include per-run worktrees in other repositories only
when the same project's records identify them. User-created threads and other projects' items are reported, never touched.
Report an unreachable T3 host and continue the phase; hold only its items.
Incomplete inventory holds affected eligibility; it never establishes absence.

Cross-run sweep eligibility for another Axstack run's settled reviewer or merged
or closed author in this project requires all attempts and descendants settled,
every agent inactive, the exact thread quiet for at least 60 minutes,
and fresh native state proving ownership and liveness with durable evidence.
Remove descendants first. Settled reviewer eligibility is independent of whether
its owning run is live. For a merged or closed author, prove its head is
retrievable from the forge (recorded PR head or remote branch); unverifiable state holds. Salvage an
eligible dirty author first under the preservation guards above. Align/Spec
advisers reused between rounds remain until their owning phase approves or stops.
Never archive active or waiting workers, or sweep solely because they are idle.

Record removed and held resources in the private run record, with exact
identities and resume conditions; phase-entry drivers also report in chat.
Cleanup-authorized scheduled passes record their own sweep results in continuity
Open holds. They stay silent when nothing was removed. List live or unsettled
work, user-taken-over threads, unknown provenance, user-created threads and
other-project items in one table with reasons. Age never grants deletion authority.
