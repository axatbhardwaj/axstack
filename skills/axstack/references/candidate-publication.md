# Candidate publication

This is the author-to-review boundary for an owned candidate. The author stops
after returning its revision-bound implementation receipt and does not push.
Within recorded PR-scoped publication authority, the owner reconciles that
receipt against the actual local candidate SHA and base. The owner does not edit
the author's candidate; required code changes return to the author.

Before publication, dispatch `axstack-diligence` under
[Diligence](diligence.md) to check the author receipt against its evidence
folder: red/green logs exist, and counts, SHAs, and paths match. Resolve
`FINDINGS` with the same author before publishing.

Publish the existing commits through `gh stack`. Prefer a fast-forward push.
Before a history rewrite, confirm the expected-old remote SHA and use lease
protection; a mismatch holds publication. If the push outcome is ambiguous,
inspect remote state before retrying.

Before reviewer dispatch, read the remote ref back and confirm that it resolves
to the candidate SHA; also pin the current base. Record:

```text
Candidate: <sha>
Base: <sha>
Remote ref: <branch>
Expected-old remote SHA: <sha | absent>
Confirmed remote SHA: <sha>
PR: <url>
CI: <run ID or URL and triggered/pending/completed status>
```

Local green is not CI green: immediately after publication CI is pending until
its required checks complete. Review may run in parallel with CI only after the
remote confirmation. Reviewers inspect a detached immutable checkout of the
confirmed candidate SHA and pinned base, never only the movable branch name.
Any author repair creates a new revision and repeats this boundary.

## Immutable checkout shape

The driver creates the immutable review checkout with `git worktree add --detach <run>/checkouts/<key> <sha>` at the confirmed candidate SHA and pinned base.
Follow [T3 runtime](t3-runtime.md) for async `delegate_task` and exact attempt
identity. The checkout is disposable, made from the existing repository; never
register a duplicate repository or replace it with a movable branch checkout.
Delegated reviewers must `cd` into their separate detached checkout; tracked candidate files remain read-only and outputs go to their private evidence folder.
Snapshot driver HEAD and full status, including untracked entries, before dispatch.
After each delegated completion, compare the driver HEAD and `git status --porcelain` with their pre-dispatch values; any change holds advancement.
Each peer reviewer has a separate checkout and evidence folder with no first-pass
cross-read. Later review gets a fresh checkout.
Before removing a reviewer checkout, read back its report and supporting evidence, then use exact `git worktree remove <run>/checkouts/<key>` without force.
Verify Git worktree absence under [Workspace hygiene](workspace-hygiene.md);
reviewer retirement preserves the separate author candidate until merge or closure.
Release checks use the same driver-made SHA-pinned detached-checkout procedure.

For a release PR, dispatch `axstack-diligence` under
[Diligence](diligence.md) to check the release PR body
against the merged PRs before publication.
