# Private evidence archive

Use this only when local review or coordinator evidence is the last reason a
finished T3-owned worktree cannot be retired. It archives evidence; it
never decides that a thread or worktree is safe to remove and never performs
native cleanup.

## Eligibility

Follow [T3 runtime](t3-runtime.md). First prove exact projectId, attempt key,
repository, PR or run/task identity, 40-character head SHA, threadId/runId or
taskId/childThreadId/childRunId, checkout path, ownership, descendant settlement
and liveness from current native state. A user-created or user-taken-over thread,
an active or unknown run, an unsettled descendant, ambiguous publication, or an
unknown file remains protected. Completed non-author
worktrees with dirty source or unpushed commits use the
[Workspace hygiene](workspace-hygiene.md) salvage path before removal; this
archive helper never treats source changes as evidence-only cleanup.

Classify each evidence file explicitly. Do not equate a dirty worktree with
disposable evidence, archive a whole worktree, or copy source changes as a way
to authorize deletion. Evidence may be archived while unrelated protected state
continues to block cleanup.

## Archive and verify

Choose a configured absolute private archive root outside every disposable
worktree and outside public artifacts. The root must be owned for this
purpose and inaccessible to group/other users. From the installed `axstack`
skill directory, run:

```sh
bun scripts/archive-evidence.js \
  --source-root <absolute-worktree-or-evidence-root> \
  --archive-root <absolute-private-archive-root> \
  --repo <owner/repository> --pr <number> --head <40-character-sha> \
  --dispatch <exact-native-run-id> \
  --file <classified-relative-file> [--file <classified-relative-file> ...]
```

For a supervised resource without a PR identity, replace `--pr <number>` with
`--run <exact-native-run-id> --task <exact-native-task-or-thread-id>`.
Pass the delegated childRunId or launched runId to `--dispatch`, never the colon-separated attempt key.
For non-PR archives use that same native run ID for `--run` and the delegated
taskId or launched writer threadId for `--task`. Record the full attempt key and
its native identity mapping in the durable receipt; helper identity labels add
no runtime. The two identity forms are
mutually exclusive; never invent a PR number. Existing PR archives retain their
path, manifest bytes, and receipt interface.

The helper refuses path escapes, symlinks, non-private archive directories,
identity changes, and existing content that does not verify. It copies only the
listed regular files, writes them with private permissions, hashes their exact
bytes, and emits a JSON receipt containing the archive directory, manifest path,
manifest hash, and file count. Repeating the same command verifies the immutable
archive and returns the same receipt; it does not overwrite it.

Record the receipt plus the exact repo/PR or run/task/head/attempt/checkout/thread/run
identities in durable lane continuity, then read the continuity and archive
manifest back before cleanup. If either readback differs or is unavailable,
preserve the worktree.

For a reviewer checkout with another task's scratch, archive and read back
each task's complete file set independently. The installed helper's retire
operation may reject another task's scratch as unclassified dirt. After
full union classification and verified per-task archives, use
[axstack-cleanup](../../axstack-cleanup/SKILL.md)'s exact per-prefix dry-run and
clean recovery; never force, use a broad target, or treat archive success as
removal authority.

## Native retirement

Retire descendants before their parent under [Workspace hygiene](workspace-hygiene.md).
Require terminal run evidence and read back private receipts before thread archival.
Use `t3_thread_organize` archive only for an eligible exact thread; metadata
archival does not remove a Git worktree or authorize evidence deletion.

After receipt and continuity readback, invoke the same installed helper with
the same identity and complete `--file` set, plus the recorded manifest hash:

```sh
bun scripts/archive-evidence.js \
  --source-root <absolute-worktree-or-evidence-root> \
  --archive-root <absolute-private-archive-root> \
  --repo <owner/repository> --pr <number> --head <40-character-sha> \
  --dispatch <exact-native-run-id> \
  --file <classified-relative-file> [--file <classified-relative-file> ...] \
  --operation retire --manifest-hash <recorded-64-character-sha256>
```

Use the corresponding `--run` and `--task` identity for a non-PR archive. The
retirement operation independently verifies the immutable private archive, its
exact identity and complete file set, the caller-recorded manifest hash, the
exact Git top-level and HEAD, and every remaining source file. It refuses
tracked, staged, or unclassified dirt; changed bytes; unsafe or overlapping
roots; symlinks; hard links; and non-regular files. It applies exact unlinks only
to matching listed files and never removes directories.

Record the retirement receipt's `removed`, `alreadyAbsent`, and `pending` file
sets. A repeat invocation reconciles already absent files without changing the
manifest. A partial or failed invocation preserves the archive; resolve its
exact hold and retry the same operation until `pending` is empty. The verified
multiple-task recovery above uses only axstack-cleanup's exact per-prefix
path. Never replace either path with a shell loop, broad deletion, force, or a
waiver.

Re-read Git and native state after successful evidence removal. Any remaining or
uncertain dirt holds worktree removal. Settlement, liveness/no-writer proof,
useful-work and publication checks, evidence classification, and removal
authority remain driver decisions; archive or retirement success proves none of
them.

Before archival and exact Git worktree removal, verify any effective removal
hook provenance.
An unknown removal hook or a required hook whose provenance is not trusted holds removal; preserve the worktree.

After preservation and salvage checks, archive the exact eligible T3 thread
with `t3_thread_organize`, then remove its exact recorded checkout path using
`git worktree remove <path>` without force. Verify absence with
`git worktree list --porcelain`; retire only eligible local-only branches with
`git branch -d` under workspace hygiene. Never use shell recursive deletion or
treat archive success as ownership, settlement, liveness or cleanup proof.
Failure or uncertainty preserves the resource.
