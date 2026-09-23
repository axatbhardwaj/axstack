# Repair and publication

Read this only for authorized maintenance of an adopted own PR. Observation-only
and peer modes stop with a report before this branch.

## 1. Confirm the repair boundary

Re-read the accepted maintenance snapshot, writable ownership, publication
authority, remote head and base, and current feedback. Route an accepted fix to
the original author session only when the run itself launched that session and
evidence permits. Record the repair author's actual provenance before
selecting the reviewer, because the authored-review pairing follows the actual
provenance of the repair, never the PR's historical author. A missing,
stale, or materially changed boundary holds the repair while read-only
monitoring continues.

Record the exact defect, allowed files and actions, current revision, feedback
IDs, and actual author without expanding scope. If actual author information is
unknown, mixed, or unsupported and cannot establish an eligible configured
reviewer, report that exact gap and ask the user; do not assume an author from
the importing owner or orchestrator.

## 2. Produce a reviewable candidate

The author prepares the smallest in-scope repair and the exact public reply
bodies, each keyed to its feedback ID and bound to the candidate revision.
The candidate is committed locally in the owned worktree. Obtain an
independent review of the exact local candidate SHA in an isolated detached
checkout against the pinned base, including the exact reply bodies, before
publication; nothing is pushed for review. Both code and
reply bodies receive the one complete eligible non-author/non-owner review
required by the authored review rule in `axstack-review`.

Publication stays held until the current authored review receipt covers the
exact new revision and base, all six angles, applicable acceptance, the reply
body identities, and every affected boundary, with no unresolved material
finding or urgent hold. A serious-risk escalation preserves the local candidate
and exact context, records the hold in the run record and a durable GitHub or
user-owned conversation, and sends only an authorized deduplicated notification.
Publication remains held until the user decides at that durable location and
all exact inputs are revalidated.

## 3. Revalidate immediately before publication

Confirm fresh remote head and base, feedback freshness, reply body identity,
and the exact revision covered by the mode-required review receipt. Before a history
rewrite, confirm the expected-old SHA; a mismatch holds publication.

All publication inputs must still match their reviewed values at the final
readback.

## 4. Publish idempotently

After the local review and final remote revalidation, publish through `gh stack`
for the adopted PR only, preserving unrelated stack entries.
Bind the operation to the exact reviewed revision, then verify the submission
receipt and remote state.

If the send outcome is unknown, inspect remote IDs, bodies, and actor before any
retry. Remain blocked while the outcome is ambiguous; retry only after
confirming the intended operation is absent.

Publication ends with a remote receipt proving that the reviewed revision and
exact replies landed once, or a recorded hold naming the unmatched input and
next owner.
