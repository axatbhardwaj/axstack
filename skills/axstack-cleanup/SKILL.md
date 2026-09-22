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
force, bulk-clean, override a hook failure, edit a runtime database, or add a
scheduler, daemon, or state machine.

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
identity; never invent a PR number. Read back both the durable record and the
archive manifest, including hashes and exact identities, before removing any
source copy or workspace.

Archive success proves only preservation of the listed bytes. It does not prove
settlement, exit, ownership, a clean worktree, publication, or removal safety.

For a settled merged run whose forge merge is confirmed, generated reviewer
scratch is disposable after a compact durable receipt is written outside the
review worktree and read back. Bind that receipt to the exact repository, Run,
Task, Dispatch, reviewer workspace and terminal, exact head SHA and base SHA,
review verdict, coverage and limitations, test and CI result pointers, and the
user authorization and scope for cleanup. Keep the reviewer report and any
unique evidence needed to support its verdict; use the private evidence archive
for unique evidence whose exact bytes must survive. Raw reproducible probes and
logs need not be archived solely to retire a completed review worktree.

Classify each proposed scratch file against its recorded owner and purpose.
Never treat dirty source, unmerged or unpushed work, unknown or user-owned files,
or active or `user_takeover` terminals as disposable scratch. For an otherwise
eligible candidate, make an exact-path dry-run listing each proposed file and
directory expected to be empty afterward for removal; check the paths are inside
the owned reviewer worktree, regular files or directories as expected, and
neither symlinks, hard links, nor unclassified content. Re-read the durable
receipt, Git status, native ownership and liveness, and each path immediately
before any unlink. Remove only the same validated files by nonrecursive
exact-path unlink, then remove only listed empty directories; stop on a mismatch.
Never use a glob, recursive command, force, or broad clean. Record the removed
paths and re-read Git status before native worktree removal. This scratch
decision does not waive any other preservation or native removal guard.

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
   When archived evidence is the last dirt, use the evidence archive helper's
   manifest-bound retirement operation and require an empty pending set; never
   unlink through prose or a shell loop. Verify the effective Archive Script
   provenance before native removal: an unknown or required-but-untrusted hook
   holds. Record its native outcome as `unconfigured`, `passed`, `failed`, or
   `unknown`; only `unconfigured` or trusted `passed` may advance. Account for
   branch-deletion side effects explicitly, then re-list both native workspaces
   and Git refs. A failed or unknown hook outcome or uncertain response preserves
   the resource; never force or substitute shell deletion.
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
