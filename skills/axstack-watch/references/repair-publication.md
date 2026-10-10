# Repair and publication

For authorized maintenance of an adopted own PR only. Observation-only and peer
modes stop at a report.

## 1. Repair boundary

Re-read accepted maintenance snapshot, writable ownership, publication authority,
remote head/base and feedback. Missing, stale or materially changed boundaries
hold repair; continue read-only monitoring. Return fixes to the original author
only if this run launched it and evidence permits; otherwise follow
[Feedback routing](../SKILL.md#feedback-routing) for a new adopted author.
Record defect, allowed files/actions, revision, feedback IDs and actual repair
provenance; pair review from that provenance, never historical authorship.

## 2. Reviewable candidate

The author commits the smallest in-scope repair and exact public reply bodies in
the owned worktree, keyed to feedback IDs and candidate revision. Obtain
independent review of the exact local candidate SHA and replies in an isolated
detached checkout against the pinned base before publication.
Nothing is pushed for review. Publication is held until the current authored review receipt covers
the exact new revision and base, code/replies, all six angles, applicable acceptance,
affected boundaries and exact reply identities with no unresolved material finding or urgent hold.
The authored review rule in `axstack-review` requires exactly one complete
eligible non-author/non-owner reviewer.
Record a serious-risk hold in both the run record and a durable GitHub or user-owned
conversation, preserving candidate/exact context;
only an authorized deduplicated notification sends. Publication waits for the
user's decision at that durable location and exact-input revalidation.

## 3. Revalidate immediately before publication

At final readback, confirm every input matches its reviewed value: fresh remote
head/base, feedback, reply body identity and exact revision/base. Before a history
rewrite, confirm expected-old SHA; a mismatch holds publication.

## 4. Publish idempotently

After local review and remote revalidation, publish through
[Candidate publication](../../axstack/references/candidate-publication.md)
for the adopted PR only, preserving unrelated entries. Follow
[PR chains](../../axstack/references/pr-chain.md) for scoped push and base-bound
evidence; legacy native stacks use `gh stack`.
Bind every publication operation to the exact reviewed revision, then verify the
submission receipt and remote state.
Unknown or ambiguous publication stays blocked; retry only after lookup of
remote IDs, bodies and actor proves absence.
Publication ends with either a receipt proving reviewed revision and exact replies
landed once or a recorded hold naming unmatched input and next owner.
After verified publication, follow
[PR previews](../../axstack/references/preview.md) to decide on or restart a preview.
