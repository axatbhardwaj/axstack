# Candidate publication

This is the author-to-review boundary for an owned candidate. The author stops
after returning its revision-bound implementation receipt and does not push.
Within recorded PR-scoped publication authority, the owner reconciles that
receipt against the actual local candidate SHA and base. The owner does not edit
the author's candidate; required code changes return to the author.

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

## Automation repair exception

For an automation repair under
[Automation sessions](automations.md), the candidate is a local immutable
commit SHA in the per-PR child worktree, not a published remote ref. The
reviewer confirms that exact local SHA with `git rev-parse` in the worktree
instead of remote equality, and inspects a detached checkout of it with the
pinned base. The remote ref is expected to still be the pre-repair head; record
it as the expected-old remote SHA rather than requiring it to equal the
candidate. Remote equality is re-checked at the publication readback of the
watch skill's repair-publication reference immediately before the fast-forward
push. Ordinary workflows keep the remote confirmation above; the
exception never applies outside an automation session.
