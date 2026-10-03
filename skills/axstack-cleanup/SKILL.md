---
name: axstack-cleanup
description: When completed T3 threads and worktrees need bounded retirement, use axstack-cleanup after accepted settlement or for an explicitly scoped backlog.
---

# Cleanup

Run cleanup inline in the driver after accepting a worker task or run
completion, or for the exact backlog scope the user named. This skill never
dispatches a cleanup worker and never retires its current driver session.

Before any runtime action, load and follow:

- [Standing contracts](../axstack/references/contracts.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)
- [Shared routing](../axstack/references/routing.md)
- [T3 runtime](../axstack/references/t3-runtime.md)
- [Workspace hygiene](../axstack/references/workspace-hygiene.md) for settlement, salvage, and driver-start sweep
- [Private evidence archive](../axstack/references/evidence-archive.md) when
  evidence is the last removable-worktree blocker

Use project-scoped T3 thread inventory, `git worktree list --porcelain` and run
records. Preflight requires `worktreeCleanup` off via `t3_project_read` where
exposed, or a recorded setup limitation. Follow the runtime schema, never invent
an alternate command protocol.

## Authority and scope

Inline cleanup may consider only resources owned by the accepted completion it
is processing. Driver-start orphan sweeps follow the guarded cross-run sweep in
[Workspace hygiene](../axstack/references/workspace-hygiene.md). Backlog
cleanup requires an explicit bounded selector such as a
project, run, task set, checkout set, repository, or named age window; age narrows an
inventory but never establishes eligibility. A partial inventory holds only the
resource whose identity or state is incomplete while other independently proven
resources may proceed.

Never clean a user-created thread, the current driver, a user-taken-over thread, an active or unknown worker, an unsettled descendant, or a resource with ambiguous ownership.
Preserve unknown files, unmerged author work, ambiguous publication, and evidence that has not been durably preserved.
Do not force removal, bulk-clean, edit a runtime database, or add a scheduler,
daemon or state machine. Report other projects' resources; never touch them.

## Reconcile each candidate

Take a fresh native inventory and bind every candidate to its exact projectId, attempt key, taskId/childThreadId/childRunId
or threadId/runId, checkout path, repository, branch, and current
liveness. Read current Git and forge state rather than trusting age, names, or a
prior receipt. Reconcile an existing cleanup claim before retrying so repeated
invocations converge instead of duplicating mutations.

Retire descendants before parents. A candidate is eligible only when all owned
tasks and runs are accepted as settled, no descendant remains unsettled, native
liveness is positively known where required, and every preservation guard is
cleared. Record one decision per resource; uncertainty about one candidate does
not authorize or block unrelated candidates.

## Preserve evidence first

Classify exact evidence files individually. Save the compact cleanup decision
and identities in the private run record or another configured durable private
location outside disposable worktrees. When the evidence archive applies, use
its helper with either the existing PR identity or the non-PR run and task
identity; never invent a PR number. Read back the durable record and, when an
archive is used, its manifest, including hashes and exact identities, before
removing any source copy or workspace.

Archive success proves only preservation of the listed bytes; it does not prove settlement, liveness, ownership, a clean worktree, publication, or removal safety.

For a completed non-author worktree with useful local content, follow the
[Workspace hygiene](../axstack/references/workspace-hygiene.md) salvage path
before removal; a verified bundle changes preservation classification, not
native ownership or liveness. Keep an author worktree until its PR merges or closes.

For a settled reviewer task, its checkout can be retired while the PR remains open, before merge, after its report and supporting evidence are archived privately and read back.
Generated reviewer scratch is disposable after a compact durable receipt is
written outside the review checkout and read back. Bind it to projectId,
repository, attempt key, taskId/childThreadId/childRunId, checkout path, exact head
SHA and base SHA, review verdict, coverage and limitations, test and CI result
pointers, user authorization and cleanup scope. A raw reviewer report may be
discarded after its verdict and limitations are compacted into that read-back
receipt; use the private evidence archive for the report and supporting evidence.
Evidence already outside the checkout needs no copy; read it back. Verify each
task archive and manifest readback independently. Preserve the separate author
candidate with useful unmerged work; reviewer cleanup never removes it.

Use only a named run-owned scratch prefix recorded with the attempt. Multiple
tasks in the same reviewer worktree are recovery for missed earlier
cleanup; after independent archives and readback, use per-prefix removal. Two or
more review passes in the same reviewer worktree may leave distinct prefixes;
each named run-owned scratch prefix must belong to an accepted settled task
in the run. Require `git status --porcelain=v1 -z --untracked-files=all`
to show all dirt as untracked files inside a run-owned scratch prefix. Prove
every remaining untracked file individually belongs to one of those named
run-owned scratch prefixes; any tracked, staged, unmerged or unpushed work,
dirty source, or dirt outside them enters the salvage check above or holds.
Check ignored files across the whole worktree too; classified ignored non-cache content enters the verified salvage path, while unknown content holds. Validate that
the detached checkout still matches the reviewed head and check local commits
against recorded remote refs; unknown divergence holds. Validate that
the exact reviewed scratch prefix names the recorded directory inside the exact
reviewer worktree, never a repository-root target or symlink. Inspect every
descendant for symlinks, hard links, special files, unknown content, user-owned
files, or ignored files; any mismatch holds. Active or user-taken-over threads also hold.

For each prefix, list the exact scoped path and all descendants with their
types, confirm each belongs to generated reviewer scratch, and record that
inventory. For each prefix, perform an exact-path dry-run and exact-path deletion
separately. Dry-run the exact scoped path from the reviewer worktree root with
`git clean -nd -- <exact reviewed scratch prefix>`
with the concrete reviewed relative prefix substituted for the angle-bracket
notation. Compare its sole target to the classified directory; an empty,
partial, or different result holds. Immediately before each deletion, including
each next deletion, re-read the compact receipt, complete Git status with
whole-worktree dirt and ignored files, every remaining prefix inventory, and
native ownership and liveness. Compare these reads against the expected
post-deletion state: previously deleted proven prefixes and their files are
absent, while remaining classified prefixes and outside content still match.
Only unexpected changes hold. Then run
`git clean -fd -- <same exact prefix>` with the identical concrete path, record
that path and outcome, and repeat for the next proven prefix. Recheck clean Git status
after the last deletion. Require final clean Git status before exact `git worktree remove <path>` without force. Use no unresolved variable as a destructive target.
Never use `-x`, a glob, a repository-root target, extra force, or broad clean.
This scratch decision does not waive any other preservation or native removal
guard.

## Apply distinct native operations

Follow [Workspace hygiene](../axstack/references/workspace-hygiene.md)'s exact
cleanup order: settled descendants, evidence readback, salvage dirty or ignored
non-cache content, thread archive, exact worktree removal without force, then
local-only branch retirement. Treat each as a separate decision and receipt:

1. **Thread archival.** Require accepted matching completion and terminal run
   evidence for the exact task or run, with no pending descendants. Use
   `t3_thread_organize` archive for that exact eligible thread. Retain an author
   thread and worktree until PR merge or closure. Metadata archive does not prove
   process exit, worktree removal or evidence preservation.
2. **Worktree removal.** Immediately re-read Git status, ignored files,
   branch/upstream divergence, unpushed commits, forge merge/publication state,
   descendants, native ownership/liveness and preserved evidence. When archived
   evidence is the last dirt for one task, use the evidence archive helper's
   manifest-bound retirement operation and require an empty pending set. For
   multiple task scratch prefixes, independently verify archives and full union
   classification, then use the exact per-prefix dry-run and clean above. Never
   unlink through prose or a shell loop. Run exact `git worktree remove <path>`
   without force; re-list native threads and `git worktree list --porcelain` to
   verify archival and worktree absence separately. No native Archive Script is
   part of this Git path; unknown removal hooks or safety prompts hold.
3. **Branch retirement.** Read back each remaining local ref's recorded name and
   tip. Unknown origin, unique commits, active worktrees or a remote counterpart
   preserve it. Only provenance proving a run-owned local-only ref for the removed
   checkout and a tip reachable from a preserved candidate, verified salvage ref
   or confirmed remote PR head permits exact `git branch -d <branch>`; no force.
   Read back absence; refusal or uncertainty holds the ref.
   Never delete the author branch or use generic force.

Do not self-archive or self-remove. Return control to the driver after recording
receipts and holds; the owner decides when its own run may archive.

## Receipt

Report the scope and inventory denominator, then for each candidate record its
exact identity, classification (`removed`, `retained`, `held`, or `unsupported`),
the fresh evidence used, native receipt and readback, and any resume condition.
Keep settlement, terminal run evidence, thread archival, worktree/branch effects,
evidence preservation, and chat archival as separate fields. An idempotent retry
reconciles these receipts and performs only still-pending eligible operations.
