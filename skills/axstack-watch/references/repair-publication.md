# Repair and publication

Read this only for authorized maintenance of an adopted own PR. Observation-only
and peer modes stop with a report before this branch.

## 1. Confirm the repair boundary

Re-read the accepted maintenance snapshot, writable ownership, publication
authority, remote head/base and feedback. A missing, stale or materially changed
boundary holds repair while read-only monitoring continues. Return fixes to the
original author only if this run launched it and evidence permits. Otherwise
follow [Feedback routing](../SKILL.md#feedback-routing) for a new adopted author.
Record defect, allowed files/actions, revision, feedback IDs and actual repair
provenance; pair review from that provenance, never historical authorship.

## 2. Produce a reviewable candidate

The author commits the smallest in-scope repair and exact public reply bodies,
keyed to feedback IDs and candidate revision, in the owned worktree. Obtain an
independent review of the exact local candidate SHA in an isolated detached
checkout against the pinned base, including replies, before publication.
Nothing is pushed for review. The current authored review receipt covers code/replies, all six angles,
applicable acceptance and affected boundaries under the authored review rule in
`axstack-review`; exactly one complete eligible non-author/non-owner reviewer is
required. Material findings or urgent holds block
publication. Serious risk preserves candidate/context and the durable hold;
only an authorized deduplicated notification sends. Publication waits for the
user's decision at that durable location and exact-input revalidation.

## 3. Revalidate immediately before publication

Confirm fresh remote head/base, feedback, reply body identity and the exact reviewed
revision/base. Before a history rewrite, confirm the expected-old SHA; a mismatch
holds publication. Every input must match its reviewed value at final readback.

## 4. Publish idempotently

After local review and remote revalidation, publish through
[Candidate publication](../../axstack/references/candidate-publication.md)
for the adopted PR only, preserving unrelated stack entries. Follow
[PR chains](../../axstack/references/pr-chain.md) for scoped push and base-bound
evidence; legacy native stacks use `gh stack`.
Verify a remote receipt proving the reviewed revision and exact replies landed
once. Unknown send outcome requires lookup of remote IDs, bodies and actor
before retry; retry only after proving absence. Remain blocked while publication is ambiguous
with unmatched input and next owner recorded.
After verified publication, follow
[PR previews](../../axstack/references/preview.md) to decide on or restart a preview.
