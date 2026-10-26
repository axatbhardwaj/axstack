# PR shape

## Measure
Actual PR base:
```sh
bun scripts/pr-shape.js --base <base> --head <head>
```
JSON: SHAs, merge-base, total = additions + deletions over all files, renames, binaries, buckets and commands.

Use a stacked child's parent branch or a root PR's actual target branch.
`main` is an example, as are `develop` and release branches.
Disclose moves detected by `-M`;
report binaries by count and purpose, never estimated lines. Disclose generated,
lockfile, and formatter-only bulk buckets alongside the total.

Flag totals above 2500 changed lines as informational only.
Never automatically subtract bulk from the full total; silent exclusion is forbidden; no file-count hard metric.
Disclose each bulk bucket with a reproducible recorded command.
There is no universal safe LOC limit or fixed token percentage.

## Peer sync proof

Run `pr-shape.js --base <base> --head <head> --source <source>`.
The sync term grants no authority.
Sync is eligible only for a user-recorded pair `<repo>: <source> -> <base>`
in the manager durable record, or user-named for manual review.
The head repo must equal the base repo.
Source S is a fetched base-repo ref with its SHA recorded.
Resolve B/H/S to base/head/source commit SHAs.
Pass requires B <= H and either H <= S or both B <= S and equal H/S trees.
Use `git merge-base --is-ancestor` for <= and `git rev-parse <sha>^{tree}` for trees.
Ancestor exit 1 means fail, other Git errors or missing objects mean unknown,
and absent `--source` means n/a. Preserve the helper's commands and SHAs.
On sync pass, use no reviewer dispatch and submit nothing, record `sync skip`
with event identity for dedupe, and leave the PR for the user.
Sync fail or unknown takes ordinary review.

## Theme
One behavior or component may include the callers, tests, types, docs, and
migrations that must change together to stay green and reviewable.
This is not a folder restriction. Unrelated themes split regardless of size.
Smaller cohesive PRs are encouraged; no padding.

## PR body

Open every own PR description with the problem in plain words from the user's
request, then the fix.
Do not lead with an implementation inventory.
Use a title that explains why the change matters.
For repository title conventions, check recently merged PRs.

End the description with `Created with <model> in <harness>`.
Include the author and subagent models that wrote code.
Use the model name the harness reports.
If the model is unknown, name the harness without guessing a model.

Open real PRs, never drafts, so review bots run.
If `gh pr create` fails because the GraphQL rate limit is exhausted, use REST:
`gh api repos/<owner>/<repo>/pulls -f title=... -f head=... -f base=... -F body=@<file>`.

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
