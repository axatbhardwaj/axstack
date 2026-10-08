# PR shape

## Measure
Actual PR base:
```sh
bun scripts/pr-shape.js --base <base> --head <head>
```
JSON: SHAs, merge-base, full totals, renames, binaries and two buckets, with commands.

A stacked child uses its parent branch; a root PR uses its actual target branch.
`main` is only an example; repositories may target `develop` or a release branch.
Disclose moves detected by `-M`;
report binaries by count and purpose, never estimated lines. Disclose generated,
lockfile, and formatter-only bulk buckets alongside the total.

Flag totals above 2500 changed lines as informational only.
Never automatically subtract bulk from the full total; silent exclusion is forbidden; no file-count hard metric.
Disclose each bulk bucket with a reproducible recorded command.
There is no universal safe LOC limit or fixed token percentage.

## Theme
One behavior or component may include the callers, tests, types, docs, and
migrations that must change together to stay green and reviewable.
This is not a folder restriction. Unrelated themes split regardless of size.
Smaller cohesive PRs are encouraged; no padding.

## PR body

Every own PR description must contain exactly one `Revert` line.
Follow [Revert line](candidate-publication.md#revert-line) for its format and classification.

## Review and decisions
Size alone must never block review, reject a PR, require split attempts or
cohesion/exception rationale, or hold approval.
Review the actual footprint, complexity, and required context, incrementally when needed.
Approval requires sufficient review coverage.
Report INCOMPLETE when required coverage is missing.
Routine shape decisions remain autonomous driver decisions within approved scope;
size alone never requires user approval.
Escalate only for an existing material-scope, security, downtime, data-loss,
major-design-risk, or unavailable-model hold.
