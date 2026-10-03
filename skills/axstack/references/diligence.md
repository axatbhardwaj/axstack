# Diligence

Read the [T3 runtime boundary](t3-runtime.md) before dispatch.
Dispatch `axstack-diligence` with async `delegate_task` in the driver worktree,
using a pinned brief and private evidence paths.
It is read-only, never authors or edits, and returns `PASS` or `FINDINGS`
with locations, observed evidence, and limits. A stale or missing receipt is
not a pass. Keep its first pass independent of other reviewers and workers.

For a PR, compare every changed line with the accepted intent and exclusions:
is it intended and in scope? Check that no contract, rule, or obligation was
silently weakened or dropped by rewording. Compare the PR body, commit messages,
and author receipt with the diff: numbers, IDs, versions, test counts, sizes,
paths, and stale references. Bind the result to the exact head and base.

For research, reopen cited sources for answer-changing claims before the
driver folds verified claims. For a draft spec, compare it with Align decisions
before user approval: flag anything dropped, added, or softened. For tickets,
map every spec acceptance item to a capability's acceptance. Before candidate
publication, compare the author receipt with its evidence folder: red/green
logs exist, and counts, SHAs, and paths match. For release preparation, compare
the release PR body with the merged PRs.

`FINDINGS` identifies a mismatch for the driver to resolve at the owning phase;
it does not edit the artifact or create another review round by itself.
