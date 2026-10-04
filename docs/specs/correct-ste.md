# Spec: correct, STE-inspired writing, performance checklist, audit follow-ups

Status: Draft rev 4 (2026-10-04), awaiting user approval. Store: this repo Markdown file.
Run: `20261004-correct-ste`. The private run record holds the adviser receipts, the
brainstorm candidates and scores, and the proposal inventory.

## Goal

Agents stop repeating the same mistakes across Axstack runs. Axstack gains a user-invoked way to
find repeated mistake classes and fix each one at the strongest available level. Agent-written
reports and PR bodies get easier to read. Performance claims get checked before anyone trusts them.
The open auditor proposals that have a confirmed gap on `main` get fixed.

## Settled decisions

| # | Decision |
|---|---|
| Q1 | Scope as listed below. Auditor proposals with a confirmed gap are built directly, not run through `axstack-correct`. A pilot of `axstack-correct` on raw history is optional and blocks nothing. The cleanup fix (C1) lands first. |
| Q2 | When packaged prose grows past a prose-size ceiling, each PR raises that ceiling by the exact amount and records the reason in the test comment. |
| A1 | `axstack-correct` is user-invoked only. Audit may suggest it and never runs it. No transcript reads, daemon, scheduler, database, or auto-run. |
| A2 | Writing guidance is "STE-inspired", compact, and applies only to newly written or materially revised output, including new packaged prose. It never rewrites existing prose and never alters exact identifiers, quotes, or safety and prompt-byte contracts. |
| A3 | The performance checklist applies only to performance claims. Audit already covers counts. |
| B | Brainstorm (Rung 1, four candidates, no judges): a thin `axstack-correct` skill plus one audit clause. Grafts: recurrence `UNKNOWN` without pointers and the `runtime: advisory` label, never "impossible to repeat" (Astra); one incident counts once however many records mention it, and a distinct incident pointer per occurrence (run id + attempt or file:line, SHA, or PR or review URL) is necessary but not sufficient (Grok, Astra, Opus); a path-existence test for each enforced rule, as a rule inside the skill (Grok). This spec creates no `## Enforced rules` table, so that test lands with the first table row in a later fixing PR. |

## Design (`axstack-correct`)

```text
Usage: /axstack-correct ["<correction>"] [runs=<ids> | last=<N, default 10>]
Shape: skills/axstack-correct/SKILL.md (about 1.5 KB) + one audit clause. Reads run
       records (Decisions, deviations, Learnings, FAILED receipts, audit proposals), a
       git log window bounded by those runs, and PR reviews named in them. Records the
       selected runs and git bounds; reports inaccessible evidence. Writes a report only;
       never edits, dispatches, or merges; reads no transcripts.
Binding: user-invoked; a class needs >=2 distinct incidents, each with a pointer (run id +
         attempt or file:line, SHA, or PR or review URL); one incident echoed in several records counts once;
         missing pointers -> recurrence UNKNOWN and the class stays open. Ladder: remove
         the copied pattern > script or helper error that names the fix > brief or receipt
         template > bun test > prose. Each rule is labelled `shipped` (a check fails in CI
         on the mistake itself) or `runtime: advisory` (only audit can observe it); a
         prose-contract test alone leaves a rule `runtime: advisory`. Fixes go through a small-change
         intent and axstack-implement. An `## Enforced rules` table in the target repo's
         AGENTS.md changes only in the PR that adds its check; the PR that adds the first
         row also adds a test that fails when a row's enforcement path disappears.
Flow + failure: a `shipped` row's check did not stop recurrence -> a later run records the
         mistake again -> correct reports `enforcement failed` and proposes relabelling the
         row `runtime: advisory`; changing AGENTS.md stays a separately reviewed PR.
We accept: one more compact skill for cross-run recurrence, which audit (one run) cannot see.
Rejected: audit-only mode (breaks audit's one-run boundary); a skill that implements fixes
         itself (skips author, review, and human merge); an installer-managed rules block
         (wrong owner); Axstack-only scope (any repo with run records can use it).
Open: none.
```

## Capabilities

| # | Capability | Content |
|---|---|---|
| C1 | Scratch cleanup command | `workspace-hygiene.md:17` uses `rm -r` on a validated literal owned scratch path inside the evidence folder, TMPDIR, or worktree, not `rm -rf --` (auditor B2). A whole worktree is still removed only with `git worktree remove`; `evidence-archive.md` states that its "no shell recursive deletion" rule covers removing a whole worktree, not owned scratch inside it. `tests/workflows/workspace-hygiene.test.js:121` changes in the same PR; line 122 (allowed targets) stays. |
| C2 | STE-inspired writing | One compact reference: one instruction per sentence, short sentences, active voice, condition before the step, defined terms, no slashes for "and or". Linked once from `contracts.md` for all user-facing output (reports, PR bodies, briefs, read-backs). |
| C3 | Performance checklist | One compact reference based on Gregg's seven questions (limiter, tuning, limits, errors, reproducibility, relevance, work happened). Loaded by debug, improve, and review only for performance claims. |
| C4 | `axstack-correct` | The Design above, plus routing entry, README, `docs/workflows.md`, and structural tests. The audit clause: a rule that is already covered but recurred is never an "already-covered no-op"; audit records it as recurred and suggests `axstack-correct` (source: audit Learning (a) of run `20261004-brainstorm-skill`). |
| C5 | Audit follow-ups | (a) Close-out records one row per acceptance check with evidence or a user-accepted hold, plus the reason for each driver-elected repair; the table template lives in `run-record.md`, `lifecycle.md` gets one clause (A-P2, B3). (b) `candidate-publication.md` adds `PR body head SHA: <sha or none>` to the publication record. `none` (the body states no head SHA) passes. A stated head SHA, full or an abbreviation of at least 7 characters, must match `Confirmed remote SHA` after every push before diligence or merge-ready; a mismatch holds. Other SHAs in a body are untouched (A-P5). (c) Diligence keeps full output of every full-suite run; an unattributed failure is UNKNOWN, never PASS, and the driver records its disposition; an observed failure still fails the suite; no reruns are required (B1, as narrowed in Align). (d) The spec checkpoint names the draft revision each adviser receipt covers; a receipt on an older revision with changed text holds approval (A-P1). (e) A run-record Learning that contradicts a shipped rule becomes a finding on the owning PR before merge-ready (A-P3). |
| C6 | Pilot (optional) | After C4 merges, run `axstack-correct` on raw history and compare its classes with the auditor reports. Report only; blocks nothing. |

Each accepted auditor proposal (C1, C5a-e) carries its auditor's regression scenario and holdout check into its PR, as the audit hook requires.

## Acceptance

1. `skills/axstack-correct/SKILL.md` is installed and binds every Design `Binding` line plus the Shape safety lines (report only; never edits, dispatches, or merges; no transcripts; selected bounds recorded). Prose-contract tests fail on removal or inversion of each and survive rewording. Tests cover four scenarios: one incident echoed in two records counts once; a class with a missing pointer reports recurrence UNKNOWN; a `shipped` row followed by a recorded recurrence reports `enforcement failed`, proposes `runtime: advisory`, and leaves AGENTS.md unchanged; a passing prose-contract test alone never certifies agent behaviour as enforced. Routing, README, and `docs/workflows.md` list it; structural tests count it.
2. The audit skill states that a covered rule that recurred is not a no-op and suggests `axstack-correct` without running it. A test fails when this is removed or inverted.
3. `workspace-hygiene.md` prescribes `rm -r` on a validated literal owned scratch path. No packaged skill or reference prescribes `rm -rf`. `evidence-archive.md` scopes its rule to worktrees. Tests fail on regression of each.
4. The STE-inspired reference exists, `contracts.md` links it once for user-facing output, and its text keeps the exact-text exemptions and prospective scope.
5. The performance checklist exists and is linked from debug, improve, and review for performance claims only.
6. `run-record.md` holds the close-out acceptance table template with repair-election reasons; `lifecycle.md` Close-out requires it.
7. `candidate-publication.md` records `PR body head SHA` after every push: `none` passes; a stated full SHA or a prefix of at least 7 characters must match `Confirmed remote SHA`; a mismatch holds. Tests cover absent, matching full, matching abbreviated, and mismatched values, and fail when the rule is removed or inverted.
8. `diligence.md` requires full-suite output to be kept, reports an unattributed failure as UNKNOWN (never PASS), and requires the driver to record its disposition.
9. The implement merge-ready step treats a run-record Learning that contradicts a shipped rule as a finding on the owning PR. A test fails when this is removed or inverted.
10. The spec skill's checkpoint names the revision each adviser receipt covers and holds approval on a stale receipt with changed text.
11. Every rule added in C1-C5 has a prose-contract test that fails on removal or inversion and survives rewording; exact-text safety lines may be pinned exactly.
12. `bun test` is green with TMPDIR under `/tmp`. Each PR records any prose-size ceiling raise and its reason.
13. A release is published and installed on desktop and VPS after the user's release decision; the version follows the existing minor rule (a `feat` lands).

## Delivery order

One linear `gh stack`, because each PR may touch the same prose-size ceiling line:
C1 -> C5a + C5d -> C5b + C5c + C5e -> C2 -> C3 -> C4 skill and tests -> C4 audit clause, routing and docs -> release. Ceilings are recomputed above any repaired PR.

## Exclusions

- Auditor A-P4 (probe classes listed up front): one recorded incident and no rule gap; it stays an open candidate for `axstack-correct`. Excluding it never waives a newly evidenced defect.
- Auditor B4 (a size-exception record already exists in `pr-shape.md`) and B5 (one-off release renumber).
- Running `axstack-correct` on its own proposals as the build method; transcript reading; auto-run; linters; a full ASD-STE100 dictionary; explainer videos; `/recall`.
- Rewriting existing skill prose for style.
- Changes to the installer-managed instruction block or to user-owned global instruction files (they are not Axstack's rules registry).

## Authority requested at approval

- Release: AGENTS.md "Cut a release" rule and `.github/workflows/publish.yml`; hosts desktop (io) and VPS (axat-vps); tag and install after the user merges or approves the merge of the release PR; the user approves the npm stage.
- Host mutation: installing the released package on both hosts.
