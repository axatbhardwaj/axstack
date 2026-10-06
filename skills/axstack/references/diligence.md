# Diligence

Read the [T3 runtime boundary](t3-runtime.md) before dispatch.
Dispatch `axstack-diligence` with async `delegate_task` in the driver worktree,
using a pinned brief and private evidence paths.
It is read-only, never authors or edits, and returns `PASS`, `FINDINGS`, or `UNKNOWN`
with locations, observed evidence, and limits. A stale or missing receipt is
not a pass. Keep its first pass independent of other reviewers and workers.

Load [Finding severity](../../axstack-review/SKILL.md#finding-severity) for the shared rubric.
Diligence returns `FINDINGS` for any `medium` or `high` mismatch.
Diligence returns `PASS` with the low items listed when only low mismatches remain.
Keep diligence `UNKNOWN` unchanged.

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

Retain the full output of every full-suite run as a named log in the dispatch's
private evidence folder.
For an unattributed full-suite failure, report `UNKNOWN` and return the failure to the driver.
Never report `PASS` for an unattributed full-suite failure.
The driver records the disposition of each full-suite failure in the run record.
Report an attributed failure with its retained output normally.
An observed full-suite failure still fails the suite, including when attributed or reported `UNKNOWN`.
No reruns are required.

`FINDINGS` identifies a medium or high mismatch for the driver to resolve at the owning phase;
it does not edit the artifact or create another review round by itself.
