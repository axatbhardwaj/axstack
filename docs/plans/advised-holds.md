# Advised holds: ticket map

Spec: https://github.com/axatbhardwaj/axstack/issues/488 rev 5 (body sha256
932c56b02ef710323300d3cf5ebfd9b0cd367351602756a8813c77957e0b492d); counterpart
docs/specs/advised-holds.md.
Store: repository Markdown.

Every task follows strict TDD for prose contracts: a test that fails when its
rule is removed or inverted runs red before the skill edit, then green. Existing
tests named here are updated, not deleted, and keep removal-or-inversion red.
`bun run test:all` passes at each PR head.

## C1 Advised holds

Capability: docs/plans/advised-holds.md#c1 "Advised holds"
Internal task: T1 -> launched writer (axstack-author) -> branch axstack/20261019-advised-holds/axstack-author/t1-advised-holds-a1, based on the commit that adds this map
Theme: one `Advised holds` contract in `skills/axstack/references/contracts.md` plus pointers from watch (§4 holds, verification card, merge card), implement (step 4 `held`), review (urgent escalation) and autopilot (advance and hold); the Fable carve-out at contracts' Fable rule
Size est: medium (one new contract section, four short pointers, one new test file, two updated tests)
Acceptance: spec acceptance 1 and 4.1-4.7, scope 1.
- Contract carries the criterion (two or more agent-executable paths; criterion governs; never-advised list exhaustive and judged by the hold's cause, including review-manager pass holds), steps, precedence, card lines, authority, availability and wait, reuse, no-loop and serious-risk rules.
- High-stakes: an unresolved Astra/Fable split shows both options marked `high-stakes: no AGREE`; the user's pick is the explicit user decision and the driver's pick never counts as AGREE (Opus spec r5 O4).
- Fable carve-out sentence at contracts' Fable rule, scoped to holds and step-backs that are not high-stakes.
- Pointers in watch, implement, review and autopilot reference the contract without copying it.
- New tests cover scenarios 4.1-4.7; `fable-escalation.test.js:31` and `autopilot-repair.test.js:70` updated.
Depends: none

## C2 Pre-existing findings

Capability: docs/plans/advised-holds.md#c2 "Pre-existing findings"
Internal task: T2 -> launched writer (axstack-author) -> branch axstack/20261019-advised-holds/axstack-author/t2-pre-existing-a1, based on the commit that adds this map (parallel with T1)
Theme: the `Pre-existing` disposition across review (finding severity, authored rules, peer mode, receipt), diligence and watch §5
Size est: medium (review, diligence and watch edits, one new test file, several updated tests)
Acceptance: spec acceptance 3 and 4.9-4.11, scope 3.
- Reference revision (run `Source base`; merge-base for adopted and peer PRs), evidence bar, exclusions, sweep-before-disposition, reviewer-only tagging, diligence contest.
- Authored: exceptions to "medium and high block" and "fix and re-review every medium or high finding"; diligence `PASS` lists validated items; follow-up issue keeps severity; watch §5 agent threads on validated items do not hold merge while conversation resolution, non-agent ratings, human `CHANGES_REQUESTED` and failed checks stay in effect.
- Peer: first review only; never blocks except serious security, data-loss or funds; at most two drafts for changed files and direct callers/callees in one trailing block; other items on one `Also pre-existing:` line; one read-only tracker search per draft; the only exceptions to "never ask the author for ... a process decision" and "peer notes have no follow-up issue required".
- Receipt gains the `Pre-existing:` line; known gaps recorded.
- New tests cover scenarios 4.9-4.11; updated: `review-severity.test.js:41-42, 45-51, 52-58, 65-68, 106`, `peer-review.test.js:30-31, 45-46, 162-163`, `merge-boundary.test.js:63`.
Depends: none

## C3 Round-3 step-back

Capability: docs/plans/advised-holds.md#c3 "Round-3 step-back"
Internal task: T3 -> launched writer (axstack-author) -> branch axstack/20261019-advised-holds/axstack-author/t3-step-back-a1, based on main after T1 and T2 merge
Theme: implement step 4 step-back and the run-record `PR membership` round count
Size est: small-medium (implement step 4, run-record template field, one new test file, updated tests and one fixture)
Acceptance: spec acceptance 2 and 4.4 (step-back part), 4.8, scope 2.
- Trigger, both seats, adviser brief, four conditions, fresh same-role reviewer and diligence receipts, no rating changes, durable count, lineage, start state, no second extension, falls-to-user list, independent-hold card.
- Clarifications within rev 5 (Opus spec r5): an unavailable step-back seat follows 2.2 and 2.7 (O1); a record "predates the field" when its `Runtime` line names an Axstack version below 0.46.0, and a newer entry missing the field counts as `used` (O2); after an independent hold clears, recheck the 2.4 conditions and reuse unchanged advice (O3).
- Updated: `review-convergence.test.js:19`, `implement-loop.test.js:24`, `diligence-repair.test.js:31-32`, fixture `implement-loop-evaluator-inputs.json:59`.
Depends: T1, T2

## C4 Release, reinstall and verification (driver)

Capability: docs/plans/advised-holds.md#c4 "Release, reinstall and verification"
Internal task: R1 -> launched writer (axstack-author) for `chore(release): v0.46.0`; driver merges under the watch predicate, runs the tag-triggered publish workflow and reinstalls under standing AGENTS.md authority
Theme: release mechanics and host install
Size est: small (version bump and release notes) plus host steps
Acceptance: spec acceptance 5 and 6, scope 4.
- `verify-axstack` Workflow contracts and Package contents pass at each PR's final head; Install/check/version on each host after release.
- Release PR merged under the watch predicate; publish workflow run; the human approves the npm stage; `axstack --version` reports 0.46.0 on io, iobook, iobox and vps.
Depends: T3

## Exclusions (from the spec, untouched by this map)

- `REVIEW.md`, finding vote filter, incident evals and circuit breakers.
- Live home configuration, including any `CLAUDE.md` alert line.
- The peer cap panel, the high-stakes contract, non-agent comment ratings and the severity rubric.
- No new script, state store, daemon or programmatic gate.
