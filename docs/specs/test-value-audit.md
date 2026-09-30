<!-- Approved spec counterpart. Authoritative: https://github.com/axatbhardwaj/axstack/issues/223 rev 4 body SHA-256 5013c74db2f1c51379f98c892d3983b33122dc57ef230fd669bee7e358d7159e -->

# Spec: test-value audit (stop and remove slop tests)

Run: 20260930-test-slop-audit · Store: GitHub issue (axatbhardwaj/axstack) · Rev 4 (2026-09-30; rev 3 approved, rev 4 accepts user decisions Q4/Q5 after the pilot)

## Outcome
Axstack stops agents writing low-value tests and removes existing redundant or useless ones:
- when tests are written (implement),
- when PRs are reviewed (own and peer),
- by a weekly run that audits a repo, removes redundant/useless tests, and opens a PR the human merges. This run ships the weekly prompt; scheduling starts per repo once the user names repos and the activation canary passes.

## Settled decisions (Align)
- D1 One shared reference `skills/axstack/references/test-value.md`, loaded by `axstack-implement`, `axstack-review`, `axstack-improve`. No new skill. (Q1)
- D2 Weekly run removes redundant/useless tests and opens a PR; human merges. (Q2)
- D3 Repo list for the weekly run is deferred; build repo-agnostic, activate per repo later. (Q3)
- D4 No deletion quota, score, or numeric target. Zero candidates is a valid result. (advisers; Hutch 0.79%, simplify-diff precedent)
- D5 Campaign ledger machinery and mutation kill matrices are out of scope for now.
- D6 Pilot on axstack's own `tests/workflows/` with a repo-local prose-test rule.
- D7 Pilot found R10/F11/C0/D0. Pilot repairs its F findings. (Q4)
- D8 The weekly run also repairs F (weak assertions), not only deletes. (Q5)

## Design
`test-value.md` holds, ported and credited (OpenClaw test-audit, MIT; pstack; Pocock):
- Authoring gate: four questions (behavior protected, credible regression, why existing coverage misses it, test-only production seam?) plus the `undefined` check.
- Junk patterns: assertion-free probes; self-comparison; expected value computed by the code under test; mock or absence-only assertions; mock implements the asserted behavior; fixture asserts fixture; restates constants, config, declared flags, or type guarantees; exact source, import, or string greps of non-contract text; copied fixtures, inventories, or export lists; private predicate or call-shape duplicates of a boundary test; duplicate invocation of one contract; tests preserving test-only exports or wrappers; negative control passing for the wrong reason; name promises more than it checks.
- Bug-fix rule: a regression test must fail on pre-fix code for the intended reason, once, at the owner boundary.
- Retention bar (independent public/protocol/config/security/migration/prompt-byte contracts, observable ordering, credible regressions, cheapest independent guard; slow or static is not a deletion reason; a retained test failing on baseline is a possible bug, not a deletion).
- Marks R / F / C / D and required evidence per C/D: test location, what it can detect, remaining proof (keeper) or why obsolete, validation command.
- Deletion proof: suite green before and after on pinned base and candidate revisions. Every removed assertion's contract maps to a remaining keeper or to evidence that it is vacuous or obsolete. Each C, and each D justified by a keeper, shows that keeper going red under a targeted disposable source mutation per distinct contract, restored byte for byte. A vacuous D (assertion-free, self-comparison, expected value computed by the subject) cites the vacuity. An obsolete D cites the removed production path, spec, or history showing the contract is gone; otherwise it is reported, not deleted. Uncertain candidates are retained. Tests hidden from authoring agents (release-only tiers) are out of weekly scope. Coverage is a per-file guard only where the runner reports it and never authorizes deletion alone.
- Heuristics (`undefined` check, junk patterns) start an investigation; they are never an automatic deletion verdict.

Consumers:
- Implement: authors apply the gate to every new or changed test; a test failing the gate is not added.
- Review: under existing angles, test hunks (added, changed, removed) are checked against the reference, and for removed tests the named keepers are inspected; peer mode stays report-only.
- Improve: a test-audit lens marks every test declaration in the bounded scope R/F/C/D (completeness floor instead of a quota), reports reviewed and eligible counts, and returns C/D with evidence; accepted C/D batches go to Implement as structure-preserving work (same-check green before/after), through its normal independent review.
- Weekly: a packaged scheduled prompt (beside `automations.md`) runs Improve's test-audit lens on one owner-boundary scope, then Implement on proven C/D only, and opens at most one PR per week after independent review. Rules:
  - Scope: next boundary derived from the last test-audit PR (no cursor file or state); never re-propose candidates from a closed unmerged test-audit PR.
  - Skip the week while a test-audit PR is still open.
  - Red or flaky baseline, overlap with live Orca work (existing Orca worktree/Run ownership on the same paths), or zero proven candidates: publish nothing, report only.
  - Published diff touches test files only: deletions, consolidations, and F repairs. An F repair must pass on the base and go red when its contract's instruction or code is removed or inverted (targeted disposable mutation, restored byte for byte); it never weakens or loosens an assertion. Forbidden: skip/only/xfail, snapshot rewrites, coverage-threshold, CI, or line-cap edits. Non-test paths byte-identical to base after mutation restore.
  - Workers never push; the driver opens the PR; the human merges. Notify per the run's Notification policy (decision park, merge-ready, serious-risk hold); never progress.
  - Activation (later, per repo) records the repo and path allowlist, a finite budget, standing edit and PR-open authority, and passes the `automations.md` native canary. This run creates no automation.

## Acceptance
- A1 `test-value.md` exists with gate, junk patterns, retention bar, marks, evidence fields, deletion proof, OpenClaw MIT notice, and paraphrased pstack/Pocock credits.
- A2 Implement, Review, and Improve each link the reference at the stated point; review covers added, changed, and removed test hunks; peer mode stays report-only.
- A3 Improve's lens marks every declaration in scope and routes proven C/D to Implement as structure-preserving.
- A4 Weekly prompt file exists, is repo-agnostic, and states every weekly rule above; docs/workflows.md explains activation. Prompt-contract checks cover: red/flaky baseline, overlap, open test-audit PR, and zero proven candidates each publish nothing; forbidden edits are listed. No automation is created; no claim of weekly runtime behavior before an activation canary.
- A5 AGENTS.md gains the local prose-test rule: a prose-contract test of a semantic instruction must fail when the instruction is removed or inverted and survive rewording; exact prompt-byte or public-key contracts are exempt.
- A6 Pilot on one boundary (done: R10/F11/C0/D0, no deletions), `tests/workflows/improve.test.js` and its peers it duplicates: R/F/C/D marks for every declaration in scope, proven C/D removed, a unique prose or config contract and any ambiguous candidate shown retained, suite green before and after, ending at a reviewed merge-ready PR. Zero justified deletions is an acceptable result.
- A8 Pilot repairs the 11 F findings: each repaired test goes red on removal or inversion of its instruction and survives rewording (A5); suite green; ends at a reviewed merge-ready PR.
- A7 New tests this run adds obey A5 and the gate: a few contract tests per PR, not one per bullet.

## Exclusions
- No new skill, role, daemon, scheduler, or state; no Axstack-created automation (activation is later and per repo).
- No deletion quota or score; no mutation-matrix tooling; no full campaign ledger.
- Test-only production-seam removal: reported, not changed, in the weekly run.
- No changes to other repos in this run.

## Plan (PRs, stacked with gh stack; coherent batches, ~200 lines preferred)
1. test-value reference + Implement and Review wiring (A1, A2 part, A7).
2. Improve test-audit lens + AGENTS.md prose rule + docs (A2 rest, A3, A5).
3. Pilot on the `improve` boundary (A6), then its F repairs (A8).
4. Weekly prompt + activation docs, informed by the pilot (A4).


