# Candidate publication

For an owned candidate, the author returns its revision-bound implementation
receipt and stops without pushing. Under recorded PR-scoped publication authority,
the owner reconciles author receipt with actual local candidate SHA/base. The owner
does not edit the candidate; code changes return to its author.

Before publication, dispatch `axstack-diligence` under
[Diligence](diligence.md) to check the author receipt against its evidence
folder: red/green logs exist, and counts, SHAs, and paths match. Resolve
`FINDINGS` with the same author before publishing.

Follow [PR chains](pr-chain.md) for recorded membership and base-bound evidence.
For ordinary PRs, use `git push origin HEAD:refs/heads/<owned branch>` and
`gh pr create` or `gh pr edit` with the actual parent or integration base.
Never use routine force push for ordinary PRs. For legacy native `gh stack`,
prefer a fast-forward push of existing commits, preserving unrelated entries.
Before a history rewrite, confirm expected-old remote SHA and use a narrowly
justified lease; a mismatch holds publication. If push outcome is ambiguous,
inspect remote state before retrying.

Before reviewer dispatch, read the remote ref back, confirm its SHA equals candidate SHA, pin
current base and refresh PR body counts and base from confirmed candidate SHA
and that base under [PR shape](pr-shape.md).
After every push, before post-push diligence or merge-ready, compare the PR body's
stated head SHA with `Confirmed remote SHA` and record `PR body head SHA: <sha or none>`.
Accept `none` for a PR body without a stated head SHA.
Accept a stated full head SHA only when it equals `Confirmed remote SHA`.
Accept a stated abbreviated head SHA only when it is a matching prefix of
`Confirmed remote SHA` with at least 7 hexadecimal characters.
Hold on a mismatched head SHA or an abbreviation shorter than 7 characters.
Leave other SHAs in the PR body unchanged.
Record:

```text
Candidate: <sha>
Base branch: <branch>
Base: <sha>
Remote ref: <branch>
Expected-old remote SHA: <sha | absent>
Confirmed remote SHA: <sha>
PR body head SHA: <sha or none>
PR: <url>
CI: <run ID or URL and triggered/pending/completed status>
```

Local green is not CI green: CI is pending after publication until required checks complete. Review may run alongside CI only after remote confirmation. Follow [Immutable checkout shape](#immutable-checkout-shape) for review.
Author repairs create new revisions and repeat this boundary.
After verified publication readback, follow
[Native PR links and watches](t3-runtime.md#native-pr-links-and-watches).

The recorded owning watch thread merges under the
[watch predicate](../../axstack-watch/SKILL.md#5-state-readiness-precisely).

## Revert line

Every own PR description must contain exactly one `Revert` line:
`Revert: clean` | `Revert: steps: <manual steps>` | `Revert: irreversible: <why>`.
Use `clean` only when a single `git revert` of the merge commit restores the
previous behaviour with CI green.
A `clean` revert leaves no data, schema, config, external, or published effect behind.
Otherwise use `steps` or `irreversible`.
Classify a release PR using the same revert criteria.
Merging a release PR publishes nothing. The later tag/publish is the irreversible
step, subject to recorded release authority and human npm stage approval.

## Immutable checkout shape

The driver creates the immutable review checkout with `git worktree add --detach <run>/checkouts/<key> <sha>` at the confirmed candidate SHA and pinned base.
Follow [T3 runtime](t3-runtime.md) for async `delegate_task`.
Bind disposable checkout to exact attempt identity.
Use the existing repository; never register a duplicate or use a movable branch.
Delegated reviewers must `cd` into their separate detached checkout; tracked candidate files remain read-only and outputs go to their private evidence folder.
Snapshot driver HEAD and full status (including untracked) before dispatch.
After each delegated completion, compare the driver HEAD and `git status --porcelain` with their pre-dispatch values; any change holds advancement.
Peer reviewers have separate checkouts/evidence without first-pass cross-read.
Later review gets a fresh checkout.
Before removing a reviewer checkout, read back its report and supporting evidence, then use exact `git worktree remove <run>/checkouts/<key>` without force.
Verify absence under [Workspace hygiene](workspace-hygiene.md); retain the author
candidate until merge/closure. Release checks use same driver-made SHA-pinned detached-checkout procedure.

For a release PR, dispatch `axstack-diligence` under
[Diligence](diligence.md) to check the release PR body
against the merged PRs before publication.
