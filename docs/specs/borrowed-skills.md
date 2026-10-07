# Spec: borrowed skills — perf loop, audit environment lens, proof standards

Status: Draft rev 1 (2026-10-07). Store: this repo Markdown file.
Run: `20261007-borrow-skills`. The private run record holds the Align decisions
and adviser receipts.

Release: not authorized this run.

## Goal

Adopt the useful ideas from pstack (`cursor/plugins/pstack`), Matt Pocock's
skills (`mattpocock/skills`) and HumanLayer (`humanlayer/humanlayer`) that
Axstack does not already cover. Keep each change small and inside existing
phase boundaries.

## Settled decisions

| # | Decision |
|---|---|
| Q1 | Adopt three items: a measured performance loop, an environment lens in audit, and proof standards in UI verification. Defer the verification-skill generator. |
| Q2 | Matt Pocock's `retro` becomes an optional environment lens in `axstack-audit` §5, not a new skill and not part of `axstack-correct`. |
| Q3 | One shared reference, `skills/axstack/references/perf-loop.md`, loaded by `axstack-debug`, `axstack-improve` and `axstack-implement`. |
| Q4 | Add a thin user-invoked `axstack-perf` skill as the named entry point. It loads `perf-loop.md` and routes; it owns no separate workflow. |
| D1 | Accepted adviser points: frozen workload and harness sensitivity, target plus noise criterion plus finite attempt budget, rejected experiments recorded, unwired or broken guardrails checked before new checks are proposed, no transcript reading in audit. |
| D2 | Rejected from pstack: parallel per-hypothesis writers (breaks one writer per candidate) and mandatory minimum iteration counts. |

## Acceptance criteria

### A. Performance loop

1. `skills/axstack/references/perf-loop.md` exists and states, as one ordered
   loop:
   - freeze the workload, command and environment before the baseline, and
     prove the harness can detect a change;
   - capture a baseline and vet every number with `performance-checklist.md`;
   - set a target, a noise criterion, and a finite attempt budget;
   - try the performance mantras in order, cheapest first: don't do it; don't
     do it again; do it less; do it later; do it when they're not looking; do
     it concurrently; do it cheaper; stop when an earlier mantra meets the
     target;
   - verify one change at a time; behavior checks are green before and after
     each change; record each rejected experiment with its number;
   - one commit per accepted win; a changed harness invalidates earlier
     comparisons;
   - report baseline, post-change number, delta and artifact path; report an
     unmet target as unmet.
2. `perf-loop.md` keeps one writer per candidate and names no parallel writers.
3. `skills/axstack-perf/SKILL.md` exists, is user-invoked
   (`disable-model-invocation: true`), loads `perf-loop.md`, and routes:
   a regression to `axstack-debug`, optimization discovery to
   `axstack-improve`, an accepted change to `axstack-implement`. It defines no
   additional workflow, role or runtime.
4. `axstack-debug`, `axstack-improve` and `axstack-implement` each load
   `perf-loop.md` only for performance work. `axstack-improve` stays
   report-only and ranks performance candidates in mantra order.
5. `axstack-perf` appears in the bundle, structural and README contracts,
   `routing.md` (a "make X faster" request routes to it) and
   `docs/workflows.md`, matching how other user-invoked skills are listed.

### B. Audit environment lens

6. `axstack-audit` §5 adds an optional environment lens. A proposal may target
   the environment, not only a skill: navigation pointers, automated checks,
   coding-standard placement for review, steering-file bloat and no-op
   instructions, tool economy, and information access.
7. Before proposing a new check, the auditor reports whether an existing check
   is unwired or broken. A mechanical rule prefers a deterministic check over a
   prose rule.
8. The lens reads only the evidence audit already permits (no transcripts). A
   finding without a run-record or evidence pointer is `UNKNOWN`. The lens
   makes no automatic edit and keeps the existing proposal fields and delivery
   path.

### C. Proof standards

9. `skills/axstack/references/ui-verification.md` adds proof standards: drive
   the real user path; capture the action, the resulting state and side
   effects; verify dry-run claims by observing what they skip; keep evidence
   after cleanup.

### All

10. Each behavior change has a prose-contract test under `tests/workflows/`
    that fails when the instruction is removed or inverted and survives
    rewording; full `bun test` passes.
11. Each borrowed idea credits its source with a pinned URL and license where
    text is paraphrased.

## Exclusions

- Verification-skill generator and maintainer (pstack
  `create-verification-skill`, `maintain-verification-skill`). Revisit when at
  least two audited runs rediscover launch steps or leave proof `UNKNOWN`.
- Matt Pocock `git-guardrails-claude-code` hook (live config, programmatic gate).
- pstack `eval` blinding rules (later).
- Already covered: `benchmark-checklist` (`performance-checklist.md`),
  `blast-radius`, `correct`, `technical-writing`/`wait-what` (`ste-writing.md`),
  `triage` (`pr-triage-nightly.md`), `validate_plan` (diligence plus
  implement evidence), `research_codebase` (`axstack-explain`), handoff and
  resume (run record), `wayfinder` (align plus tickets), `reflect`,
  `test-value`, `iterate_plan`, `local_review`, `founder_mode`, `ralph_*`.
- No release, npm publish or host install.

## Design

Rung 1. No new runtime, role, schedule or state. `axstack-perf` is a router
over existing phases; `perf-loop.md` is shared prose. Usage:
`/axstack-perf make the deploy step faster; target -30%`.
