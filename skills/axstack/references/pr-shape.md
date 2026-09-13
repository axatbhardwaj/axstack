# PR shape

## Measure
Measure the full PR from its actual PR base with:
```sh
git diff -M --numstat $(git merge-base <base> <head>)..<head>
```

A stacked child uses its parent branch; a root PR uses its actual target branch.
`main` is only an example; repositories may target `develop` or a release branch.
Total additions + deletions over all files. Disclose moves detected by `-M`;
report binaries by count and purpose, never estimated lines. Disclose generated,
lockfile, and formatter-only bulk buckets alongside the total.

The full total controls the level: ≤2000 is the target. The 2001–2500 rationale
band requires only a recorded cohesion rationale, with no split-attempt record.
The >2500 exception band requires the full exception record below. Bulk may
support either rationale only with a reproducible recorded command. Never
automatically subtract bulk or shift bands; silent exclusion is forbidden; no file-count hard metric.

## Theme
One behavior or component may include the callers, tests, types, docs, and
migrations that must change together to stay green and reviewable.
This is not a folder restriction. Unrelated themes split even under the target.
Smaller cohesive PRs are encouraged; no padding.

## Exception band
The driver attempts a reasonable split first. If each tried split materially
compromises atomicity, green state, or independent reviewability, or inseparable
reproducible bulk dominates, record and proceed autonomously within the approved
spec. The mandatory record includes the full total, bulk buckets with their
reproducible command, measured head and base, split attempts tried, and why each
fails on atomicity, green state, or reviewability. “Already written,” deadlines,
and rebase pain are not reasons.
Size alone never requires user approval. Review verifies the measurement and
whether the stated split failure is real under angle 6, not the number itself.
Missing rationale blocks approval; weak rationale returns to the author through
the normal split/rework loop, never to the user. Escalate only for an existing
material-scope, security, downtime, data-loss, major-design-risk, or unavailable-model hold.
