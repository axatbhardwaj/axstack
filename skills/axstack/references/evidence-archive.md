# Private evidence archive

Use this only when local review or coordinator evidence is the last reason a
finished automation-owned worktree cannot be retired. It archives evidence; it
never decides that a terminal or worktree is safe to remove and never performs
native cleanup.

## Eligibility

First prove the exact repository, PR, 40-character head SHA, Task/Dispatch,
workspace, terminal incarnation, automation ownership, descendant settlement,
and liveness from current native state. A manual chat, `user_takeover`, an
active or unknown task terminal, an unsettled descendant, unpushed commits,
dirty source, ambiguous publication, or an unknown file remains protected.

Classify each evidence file explicitly. Do not equate a dirty worktree with
disposable evidence, archive a whole worktree, or copy source changes as a way
to authorize deletion. Evidence may be archived while unrelated protected state
continues to block cleanup.

## Archive and verify

Choose a configured absolute private archive root outside every disposable
worktree and outside public Orca artifacts. The root must be owned for this
purpose and inaccessible to group/other users. From the installed `axstack`
skill directory, run:

```sh
bun scripts/archive-evidence.js \
  --source-root <absolute-worktree-or-evidence-root> \
  --archive-root <absolute-private-archive-root> \
  --repo <owner/repository> --pr <number> --head <40-character-sha> \
  --dispatch <exact-dispatch-id> \
  --file <classified-relative-file> [--file <classified-relative-file> ...]
```

The helper refuses path escapes, symlinks, non-private archive directories,
identity changes, and existing content that does not verify. It copies only the
listed regular files, writes them with private permissions, hashes their exact
bytes, and emits a JSON receipt containing the archive directory, manifest path,
manifest hash, and file count. Repeating the same command verifies the immutable
archive and returns the same receipt; it does not overwrite it.

Record the receipt plus the exact repo/PR/head/Task/Dispatch/workspace/terminal
identities in durable lane continuity, then read the continuity and archive
manifest back before cleanup. If either readback differs or is unavailable,
preserve the worktree.

## Native retirement

Retire descendants before their parent. For each positively identified unused
setup shell, use the native exact-terminal close operation, then re-list native
state and require exit proof for that exact terminal incarnation. A task
terminal, manual chat, unexpected terminal, failed close, or uncertain exit
remains protected.

After receipt and continuity readback, if the only remaining Git dirt is the
verified archived untracked evidence, compare its current bytes with the
manifest again and unlink only those exact regular evidence files individually.
Never remove tracked or unknown files, directories, or any path whose hash now
differs. Re-read Git and native state; any remaining or uncertain dirt holds
retirement.

Only then use the version-matched Orca guide's native worktree cleanup operation
with the exact workspace identity. Never use shell recursive deletion and never
treat archive success as ownership, settlement, exit, or cleanup proof. Record
and verify native absence before advancing continuity; failure or uncertainty
preserves the resource.
