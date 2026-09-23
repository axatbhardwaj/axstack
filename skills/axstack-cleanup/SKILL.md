---
name: axstack-cleanup
description: When completed Orca subagent resources need bounded retirement, use axstack-cleanup after accepted settlement or for an explicitly scoped backlog.
---

# Cleanup

Run cleanup inline in the driver after accepting a worker, Task, or Run
completion, or for the exact backlog scope the user named. This skill never
dispatches a cleanup worker and never retires its current driver session.

Before any runtime action, load and follow:

- [Standing contracts](../axstack/references/contracts.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)
- [Shared routing](../axstack/references/routing.md)
- [Orca runtime boundary](../axstack/references/orca-runtime.md)
- [Private evidence archive](../axstack/references/evidence-archive.md) when
  evidence is the last removable-worktree blocker

Use the runtime-discovered Orca guides for inventory, release, terminal close,
and worktree removal. Do not embed or improvise a competing command protocol.

## Authority and scope

Inline cleanup may consider only resources owned by the accepted completion it
is processing. Backlog cleanup requires an explicit bounded selector such as a
Run, Task set, workspace set, repository, or named age window; age narrows an
inventory but never establishes eligibility. A partial inventory holds only the
resource whose identity or state is incomplete while other independently proven
resources may proceed.

Never clean a manual chat, the current driver, `user_takeover`, an active or
unknown worker, an unsettled descendant, or a resource with ambiguous ownership.
Preserve dirty or unknown files, unpushed commits, unmerged useful work,
ambiguous publication, and evidence that has not been durably preserved. Do not
force native removal, bulk-clean, override a hook failure, edit a runtime
database, or add a scheduler, daemon, or state machine.

## Reconcile each candidate

Take a fresh native inventory and bind every candidate to its exact Run, Task,
Dispatch, terminal incarnation, workspace, repository, branch, and current
liveness. Read current Git and forge state rather than trusting age, names, or a
prior receipt. Reconcile an existing cleanup claim before retrying so repeated
invocations converge instead of duplicating mutations.

Retire descendants before parents. A candidate is eligible only when all owned
Dispatches are accepted as settled, no descendant remains unsettled, native
liveness is positively known where required, and every preservation guard is
cleared. Record one decision per resource; uncertainty about one candidate does
not authorize or block unrelated candidates.

## Preserve evidence first

Classify exact evidence files individually. Save the compact cleanup decision
and identities in the private run record or another configured durable private
location outside disposable worktrees. When the evidence archive applies, use
its helper with either the existing PR identity or the non-PR Run and Task
identity; never invent a PR number. Read back the durable record and, when an
archive is used, its manifest, including hashes and exact identities, before
removing any source copy or workspace.

Archive success proves only preservation of the listed bytes. It does not prove
settlement, exit, ownership, a clean worktree, publication, or removal safety.

For a settled reviewer Dispatch, the reviewer worktree can be retired while its
PR remains open, before merge, after its report and supporting evidence are
archived privately and read back. Generated reviewer scratch is disposable
after a compact durable receipt is written outside the review worktree and read
back. Bind that receipt to the exact repository, Run,
Task, Dispatch, reviewer workspace and terminal, exact head SHA and base SHA,
review verdict, coverage and limitations, test and CI result pointers, and the
user authorization and scope for cleanup. A raw reviewer report may be discarded
after its verdict and limitations are compacted into that read-back receipt;
use the private evidence archive for the report and supporting evidence. Verify
each Dispatch archive and manifest readback independently. Preserve the separate
author candidate with useful unmerged work; reviewer cleanup never removes it.

Use only a named run-owned scratch prefix recorded with the Dispatch. Multiple
Dispatches in the same reviewer worktree are recovery for missed earlier
cleanup; after independent archives and readback, use per-prefix removal. Two or
more review passes in the same reviewer worktree may leave distinct prefixes;
each named run-owned scratch prefix must belong to an accepted settled Dispatch
in the Run. Require `git status --porcelain=v1 -z --untracked-files=all`
to show all dirt as untracked files inside a run-owned scratch prefix. Prove
every remaining untracked file individually belongs to one of those named
run-owned scratch prefixes; any tracked, staged, unmerged or unpushed work,
dirty source, or dirt outside them holds. Check ignored files across the whole
worktree too; unknown or ignored content holds. Validate that
the detached checkout still matches the reviewed head and check local commits
against recorded remote refs; unknown divergence holds. Validate that
the exact reviewed scratch prefix names the recorded directory inside the exact
reviewer worktree, never a repository-root target or symlink. Inspect every
descendant for symlinks, hard links, special files, unknown content, user-owned
files, or ignored files; any mismatch holds. Active or `user_takeover` terminals
also hold.

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
after the last deletion. Require final clean Git status before native
exact-workspace removal without force. Use no unresolved variable as a destructive target.
Never use `-x`, a
glob, a repository-root target, extra force, or broad clean.
This scratch decision does not waive any other preservation or native removal
guard.

## Apply distinct native operations

Treat these operations as separate decisions and receipts:

1. **Worker release.** After the matching completion is accepted, use the
   runtime guide's settled-Dispatch release operation. Release is not
   cancellation, terminal-close proof, worktree removal, or chat archival.
   Once required output is captured, a dirty or useful unmerged worktree does
   not block release of its accepted settled worker; retain the worktree under
   its own classification and receipt.
2. **Unused shell close.** Close only a positively identified unused setup
   shell with the guide's exact-terminal operation. Re-list and require exit for
   that same terminal incarnation. Never close a worker, manual, unexpected, or
   current-driver terminal through this path.
3. **Worktree removal.** Re-read Git status, branch/upstream divergence,
   unpushed commits, forge merge/publication state, children, terminals, and
   archived evidence immediately before the native exact-workspace removal.
   When archived evidence is the last dirt for one Dispatch, use the evidence
   archive helper's manifest-bound retirement operation and require an empty
   pending set. If multiple Dispatch scratch prefixes remain in one checkout,
   the helper may reject the other Dispatch's files as unclassified; after
   independently verified per-Dispatch archives and full union classification,
   use the exact per-prefix dry-run and clean above. Never unlink through prose
   or a shell loop. Verify the effective Archive Script
   provenance before native removal: an unknown or required-but-untrusted hook
   holds. Record its native outcome as `unconfigured`, `passed`, `failed`, or
   `unknown`; only `unconfigured` or trusted `passed` may advance. Account for
   branch-deletion side effects explicitly, then re-list both native workspaces
   and Git refs. Read back each remaining local review ref against its recorded
   name and tip. Any branch with unknown origin, unique commits, an active
   worktree, or a remote counterpart must be preserved. Only when provenance
   proves a ref was created for the removed reviewer checkout and its tip is
   already reachable from the preserved author candidate or confirmed remote PR
   head, permit
   exact-ref expected-old ref deletion and read back its absence. Never delete
   the author branch or use generic force. A failed or unknown hook outcome or
   uncertain response preserves the resource; never force or substitute shell
   deletion.
4. **Chat archival.** Attempt it only if the version-matched runtime guide
   advertises a distinct supported operation and the scoped chat is eligible.
   Otherwise record chat archival as unsupported. Process exit, worker release,
   terminal close, and worktree removal do not prove UI history disappeared.

Do not self-close or self-remove. Return control to the driver after recording
receipts and holds; the owner decides when its own Run may archive.

## Receipt

Report the scope and inventory denominator, then for each candidate record its
exact identity, classification (`removed`, `retained`, `held`, or `unsupported`),
the fresh evidence used, native receipt and readback, and any resume condition.
Keep settlement, worker release, terminal exit, worktree/branch effects,
evidence preservation, and chat archival as separate fields. An idempotent retry
reconciles these receipts and performs only still-pending eligible operations.
