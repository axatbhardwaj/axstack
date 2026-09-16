# axstack-debug: capability to task map

Spec: docs/specs/debug.md rev 3.1 (rev 3 approved 2026-09-16, amended the
same day by user direction: Sonnet seats at xhigh), tag `spec/debug-r3.1`.
Store: repository Markdown (this file). Two stacked PRs via `gh stack`.
Author: driver session (Opus) for both PRs; authored review by
`axstack-reviewer-primary` (Sol medium) per the mixed routing table.

## Capability A — investigator roles exist in every preset

Capability: docs/specs/debug.md "Roles"
Internal task: A1 four `axstack-debug-investigator-1..4` rows per preset -> PR-A owner -> `feat/debug-roles`
Theme: role data and its counts
Size est: target band (~200 lines)
Acceptance:
- all three presets carry the four slot IDs in the same order, exact
  provider/model/effort per the spec table, notes stating no commit/push/publish,
  disposable worktree, and (where applicable) that a model repeats in a
  second seat
- `assessRoleReadiness` passes for every preset; new negative test: a null on a
  non-intentional row still fails
- role count 17 -> 21 in `orca-runtime.md`, `routing.md:16`, `README.md`,
  `docs/installation.md` (two), `docs/workflows.md`; tests `improve`,
  `orca-runtime`, `owned-support`, `owned-core`, `presets`, `review-modes`
- scenario corpora assertion agrees with 21
- spec document lands with this PR
Depends: none

## Capability B — the debug skill and its contracts

Capability: docs/specs/debug.md "Method", "Fix attempts and the ladder", "Evidence packet", "Diagnosis record", "Hand-off", "Contracts and files touched"
Internal task: B1 `skills/axstack-debug/SKILL.md` + `references/packet.md` -> PR-B owner -> `feat/debug-skill` (child of `feat/debug-roles`)
Theme: debug skill contract
Size est: target band (~700 lines including tests and corpus)
Acceptance: every structural item under spec "Acceptance evidence" (discoverable description; seven phases; loop criterion; redaction; fix-attempt definition; three rungs and triggers; plan merge rule; two-seat floor, briefs <= seats, two-receipt completion; disposable-worktree isolation with hash-verified inputs and preserved artifacts; hermetic loop; all packet fields; all record fields; repair classes; never lands a product change)
Depends: A1

Internal task: B2 shared references -> PR-B -> same worktree
Theme: routing, contracts, implement, audit touch points
Size est: small
Acceptance:
- `routing.md`: direct route for debug, explain/debug distinction, investigator IDs listed; stays < 7500 chars by condensing existing prose without semantic change; all existing routing tests green
- `contracts.md`: ordinary-diagnosis adviser rule, high-stakes/serious-risk override, configured-but-unavailable hold, receipt reuse while packet unchanged
- `axstack-implement/SKILL.md`: diagnosis record with repair class `bounded` accepted as small-change intent source; implementation slips do not increment the ledger
- `axstack-audit/SKILL.md` + `references/record.md`: `Debug:` line
- `README.md` skill list, `docs/workflows.md` skill mention
Depends: B1

Internal task: B3 tests -> PR-B -> same worktree
Theme: structural assertions and scenario corpus
Size est: small
Acceptance: `tests/workflows/debug.test.js` asserts every B1/B2 item; `tests/workflows/debug-scenarios.json` carries the 18 named cases with input, expected decision, forbidden actions; failing-first: the test file fails on the pre-B1 tree
Depends: B1, B2

Internal task: B4 behavioral evaluation receipts -> driver -> run record
Theme: observed skill decisions on the corpus
Size est: n/a (evidence, not code)
Acceptance: one evaluator session (configured role, recorded) runs the corpus against the pre-change skill set (expected: debug cases have no route) and against the post-change skill set; each receipt pins skill revision, input, expected, actual, evaluator, limitations; recorded under the run directory and summarised in the PR; if a meaningful evaluation cannot run, the distinct gap is recorded and the scoped TDD decision obtained before B3 is declared complete
Depends: B3

## Capability C — packaged and installed

Capability: docs/specs/debug.md "Acceptance evidence" last two bullets
Internal task: C1 release + install -> driver -> after both merges
Theme: distribution
Size est: small
Acceptance: `bun test` green on the integrated candidate; fixture install/check of the extracted package verifies the skill files and 21-row snapshot per preset; installed locally (both dirs) and on the VPS
Depends: A1, B1–B4 merged

## Lifecycle

| Capability | State | Evidence |
| --- | --- | --- |
| A | Todo | — |
| B | Todo | — |
| C | Todo | — |
