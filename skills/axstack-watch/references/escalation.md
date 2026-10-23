### Escalation

Personal PRs merge when the gates pass and verification is proven or
user-accepted at this head and base. Personal PRs on any base, including
promotion, `deploying` and unknown bases, are eligible under the watch predicate.
Work PRs merge when the gates pass, verification is proven or user-accepted,
and a counted collaborator approval exists, on an `integration` base.
Work promotion PRs and `deploying` or unknown bases are merged by the user on
the forge. The existing serious-risk hold applies at once to both personal and
work PRs.
Personal and work PRs remain eligible whatever files they change, subject to the
[risky-path hold](readiness.md#5-state-readiness-precisely), including
`.github/`, workflow-invoked files, package.json, lockfiles, test-runner config,
branch-protection or ruleset config, `CODEOWNERS`, `AGENTS.md`, and non-clean
revert lines such as `Revert: steps`.

For a legacy native `gh stack`, only the bottom member's base must be eligible.
Each other member's base must be the next-lower member's branch at its reviewed head.
Every member must meet every other term.
A legacy native stack holds until every member of its approved plan (the ticket map or the
adopted stack's recorded members) is published.
Reviewed legacy native-stack members are never retargeted to become eligible.

Never auto-merge PRs authored by anyone other than the user or the user's agents.
Test sources stay eligible.
Axstack skill and merge-rule text are eligible under the watch predicate.
Changes to package.json are eligible under the watch predicate.
Release PRs are eligible under the watch predicate.
Read the rollback declaration whose line starts with `Revert:`
at line start in the PR description.
A quoted format inside a bullet never counts as the declaration.
`--admin` and rule bypass are never used.
`Auto-merge: off` for a run or PR makes the merge card wait, and it waits for the user.
A risky-path hold blocks automatic merge.

Post a merge card for every nonqualifying approval, base, verification, off,
or risky-path case.
Follow [Advised holds](../../axstack/references/contracts.md#advised-holds) for eligible merge-card causes.
Bind it to the PR head and base SHA; list CI, authored review and diligence at
those SHAs, counted collaborator approvals and bot votes with each vote's SHA
and stale flag, and the causes holding this merge.
A card that needs the user's decision (work promotion or work deploying/unknown
base, `Auto-merge: off`, risky-path, provenance, or an unclosable verification gap)
is a decision hold raised in the T3 driver thread, and the driver ends its turn
parked on the decision.
Revalidate the current head and base; the reply clears only its bound cause.
Person-wait cards follow the clock below.
A changed head or base requires a refreshed card.
For an own PR on an `integration` base, the user's reply to the card authorizes
the merge actor to merge under the guarded path, subject to the exceptions below.
In `solo` mode the user's merge-card reply authorizes the guarded merge of
user-written PRs or PRs with unknown or mixed provenance.
Only an explicit user "merge this" for this PR at the exact head and base SHA
clears the risky-path hold and authorizes the merge actor under the guarded path.
A new head or base re-applies the hold.
In `team` mode a reply never replaces counted collaborator approval.
A reply can clear auto-merge turned off; verification acceptance follows the
head-and-base-bound rule above. It never clears an ineligible work base or a
reviewer-rated `above low` finding. A user reply never clears a comment rating hold.
Peer PRs are merged by the user on the forge,
and the card only reports readiness.
Work promotion, deploying-base and unknown-base cards only report readiness.
User merges are bottom-up for a stack.

