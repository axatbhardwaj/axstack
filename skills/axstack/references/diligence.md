# Diligence

Never dispatch diligence for peer review. Its code/design-only blocking bar
and bounded follow-ups are defined in [Peer mode](../../axstack-review/SKILL.md#peer-mode-colleague-pr).

## Applicable diligence gate

Use combined review only for a snapshotted small-change intent, one PR and a
non-risk-path classification. The driver decides eligibility for combined review.
The combined reviewer rechecks eligibility against the diff and review-depth risk.
A same-provider reviewer under single-provider presets makes combined review
ineligible; use separate diligence while retaining the configured review route.
The combined reviewer uses a provider that differs
from every author and repair provider. Keep the authored mode's mapped reviewer,
non-author/non-owner session independence and checkout rules.
Review-depth risk includes the [merge-risk list](../../axstack-watch/references/readiness.md),
changes to merge, dispatch or authority rules, and anything the driver or
reviewer marks as a security, data-loss or major-design concern.
These additions affect review depth only; they leave merge authority unchanged.
Separate diligence is required for substantial work, spec checkpoints, risk
paths and release reconciliation. Unknown eligibility holds the combined route;
use separate diligence pending classification.

The combined reviewer performs every applicable diligence check: scope against
intent for dropped, added or softened obligations, author evidence and red/green
logs, and PR body and commits against the diff for claims, counts, SHAs and paths.
Apply all checks and the finding rubric below, including evidence-integrity and
full-suite failure handling; this replaces a dispatch, not diligence coverage.
The combined reviewer returns `Scope: PASS|FINDINGS|UNKNOWN` bound to the exact
head and base, with observed evidence, findings and limitations in the authored
review receipt. The same reviewer returns the authored verdict and Scope status.
`APPROVE` plus `Scope: PASS` satisfies the applicable diligence gate only for
eligible work; otherwise require separate diligence `PASS` with authored approval.
`Scope: FINDINGS` returns to the same author in the same round and blocks
merge-ready. `Scope: UNKNOWN` holds merge-ready with the reason recorded for
driver disposition; a disposition never converts unknown evidence into a pass.
Every head or base change invalidates the combined receipt and requires fresh
review and Scope evidence, including unchanged-head base retargets.
A missing or stale Scope receipt never satisfies this gate.

## Separate diligence and shared checks

Read the [T3 runtime boundary](t3-runtime.md) before dispatch.
Dispatch `axstack-diligence` with async `delegate_task` in the driver worktree,
using a pinned brief and private evidence paths. Explicit non-repository
research/article diligence uses [Local artifacts](local-artifacts.md) with
local shared isolation and independently reopened sources, without a fake Git repo.
It is read-only, never authors or edits, and returns `PASS`, `FINDINGS`, or `UNKNOWN`
with locations, observed evidence, and limits. A stale or missing receipt is
not a pass. Keep its first pass independent of other reviewers and workers.

The recorded owning watch thread merges under the
[watch predicate](../../axstack-watch/SKILL.md#5-state-readiness-precisely).
Diligence never merges.

Load [Finding severity](../../axstack-review/SKILL.md#finding-severity) for the shared rubric.
Diligence returns `FINDINGS` for any `medium` or `high` mismatch except validated `Pre-existing` items.
Diligence returns `PASS` with the low and validated `Pre-existing` items listed
when only low mismatches or validated `Pre-existing` items remain.
Diligence returns `FINDINGS` to contest a `Pre-existing` tag that lacks evidence or hits an exclusion.
Keep diligence `UNKNOWN` unchanged.

For a PR, compare every changed line with the accepted intent and exclusions:
is it intended and in scope? Check that no contract, rule, or obligation was
silently weakened or dropped by rewording. Compare the PR body, commit messages,
and author receipt with the diff: numbers, IDs, versions, test counts, sizes,
paths, and stale references. Bind the result to the exact head and base.

For research, reopen cited sources for answer-changing claims before the
driver folds verified claims. For a draft spec, compare it with Align decisions
before user approval: flag anything dropped, added, or softened. For a draft spec,
check readability alongside completeness using the
[shared format](../../axstack-spec/references/format.md#readability-review).
For tickets,
map every spec acceptance item to a capability's acceptance. Before candidate
publication, check every package and integration receipt against its evidence
folder: red/green logs exist, and counts, SHAs, and paths match. This coverage
can be batched or overlap independent work; it requires no extra session per package.
For release preparation, compare the release PR body with the merged PRs.

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
