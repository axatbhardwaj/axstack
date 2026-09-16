# Orca PR automations — skill-alignment evidence

Scope: PR #38 repair after the authored review (REQUEST_CHANGES: one blocker,
five major) against spec `docs/specs/orca-automations.md` rev 32304f4 and task
T2 of `docs/plans/orca-automations-tasks.md`. Base of the repair:
`8be6196` (PR head `b36c4c3` merged with the spec branch at `611004d`).
Date: 2026-09-16.

This file records behavior-level RED → GREEN receipts per scenario, in the
shape of the r2-evaluator pattern (`tests/workflows/r2-evaluator-inputs.json`
plus the compatibility evidence file): commands and trimmed outputs, no
transcripts. Every assertion binds an input condition to its required outcome
(a transition) inside one sentence or one scenario case, not a bare keyword.

## Method

Each item followed strict TDD in one commit: the failing test was written and
run first (RED), the contract text was changed, the test was re-run (GREEN),
then the full suite ran (`bun test`, 0 fail) before the commit. The
incremental captures below are the outputs of those runs.

Reproducible whole-repair check, run once at the end:

```sh
# RED: final tests against the pre-repair tree
git archive 8be6196 | tar -x -C <scratch>/pre
cp tests/workflows/{automation-contracts,automations,presets,owned-core,review-modes}.test.js <scratch>/pre/tests/workflows/
(cd <scratch>/pre && bun test tests/workflows/{automation-contracts,automations,presets,owned-core,review-modes}.test.js)
# -> 17 fail (every test listed under "Test" below, except the later rev-2 docs test), 25 pass
# GREEN: same tests on the repaired head
bun test
# -> 284 pass, 0 fail
```

## Per-scenario receipts

Scenario ids are those of `tests/workflows/automation-scenarios.json` (version
2). "Test" names the deterministic cross-file check in
`tests/workflows/automation-contracts.test.js` unless another file is given.

| Scenario | Finding | Test | RED (before text change) | GREEN (after) | Commit |
| --- | --- | --- | --- | --- | --- |
| `push-before-gate`, `repair-review-admission` | Sol 1 (blocker) | `sol-1` | `no match /Ordinary[^.]*remote confirmation/`; candidate-publication had only the remote-equality rule — a conforming reviewer stops before the receipt the gate needs. 0 pass, 1 fail. | 1 pass, 0 fail (17 expect calls) | `f27f3d2` |
| `adopted-own-pr-author` | Sol 2 | `sol-2`; `owned-core: authorized repairs use original author…` | `watch: continuity must be scoped` — `/run itself launched/` absent; owned-core still required the unconditional original-author rule. 22 pass, 2 fail. | 24 pass, 0 fail | `0eda329` |
| `watchdog-health-finding` | Sol 3 | `sol-3`; `presets: monitor/watchdog notes…` | `no sentence matches /driver is the automation session itself/`; preset monitor note matched `/driver automation\|mutating owner\|pushes/`. 7 pass, 2 fail. | 9 pass, 0 fail (497 expect calls) | `1c6225d` |
| `proceed-with-blocking-finding`, `serious-risk-precedence` | Sol 4 | `sol-4` | `no sentence matches /credible serious risk/` in automations.md and the review skill — no precedence rule existed. | 12 pass, 0 fail | `6c6a6b9` |
| `escalate-holds-publication` | Sol 5 | `sol-5`; `automations: docs/workflows.md has an Automations section…` | `workflows: one token` — `/exactly one token[^.]*escalate or proceed/` absent; the section said "publishes only after … `escalate` or `proceed`". 9 pass, 3 fail. | 12 pass, 0 fail | `6c6a6b9` |
| `external-pr-record-only` | rev-2 (T2) | `rev-2 discovery` | `no sentence matches /Outside the allowlist/`; reference still said "still receives report-only review". 10 pass, 4 fail. | 14 pass, 0 fail | `1008667` |
| `due-deadline-wake`, `expired-pr-skipped` | rev-2 (T2) | `rev-2 precheck and tick` | `no sentence matches /due control work/`; no `pending.json`, no `due` log value, no deadline recheck before publication. | 14 pass, 0 fail | `1008667` |
| `unavailable-gate-hold`, `watchdog-health-finding` | rev-2 (T2) | `rev-2 identity and watchdog` | `no sentence matches /Before any repair or publication/`; no thresholds, no occurrence id, no "cannot be escalated through itself". 7 pass, 2 fail. | 9 pass, 0 fail | `54d6cf5` |
| (review skill) | rev-2 (T2) | `rev-2 review exception` | `toContain` failed: Standalone-owner / Authorized-submission exception wording absent. | 9 pass, 0 fail | `54d6cf5` |
| `push-before-gate` (docs) | rev-2 (T2) | `rev-2 docs` | `no sentence matches /gh stack publication does not apply to automation repairs/`. 9 pass, 1 fail. | 10 pass, 0 fail | `docs(workflows)` commit below |
| all eleven cases | Sol 6 | `automation scenarios: bounded cases…` (`automations.test.js`) | `expect(received).toBe(expected)` — corpus version 1 with five cases; the per-case transition assertions had no cases to bind. 6 pass, 1 fail. | 7 pass, 0 fail | `41532b2` |

Trimmed outputs are quoted from the `bun test` runs at each step; the full
suite was 0 fail at every commit (276 → 284 tests).

## What each check proves and does not prove

- Proves: the installed contract text now carries the transition each
  finding named, in the same rule sentence, across every file the finding
  cited (candidate-publication, review, watch, repair-publication,
  watch-runtime, lifecycle, routing, docs/workflows, three presets, the
  automations reference), and the stale contradictory wording is absent.
- Proves: the scenario corpus binds each case's input facts to its required
  and forbidden outcomes, and the deterministic test rejects a corpus that
  drops or weakens any of them.
- Does not prove: agent behavior. A fresh evaluator run of the eleven cases
  against the pushed head, in a new session after the candidate freezes,
  remains the independent step of the r2 pattern and is not included here.
  Structural checks verify declared policy, not runtime execution; VPS
  acceptance 1–8 of the spec is separate work (tasks T6–T8).
