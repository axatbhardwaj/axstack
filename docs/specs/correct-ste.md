# Spec: correct, STE-inspired writing, performance checklist, audit follow-ups

Status: Draft rev 1 (2026-10-04), awaiting user approval. Store: this repo Markdown file.
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
| Q1 | Scope as listed below. Auditor proposals are built directly, not run through `axstack-correct`. A pilot of `axstack-correct` on raw history is optional and blocks nothing. |
| Q2 | When packaged prose grows past the prose-size ceiling, each PR raises the ceiling by the exact amount and records the reason in the test comment. |
| A1 | `axstack-correct` is user-invoked only. Audit may suggest it and never runs it. No transcript reads, daemon, scheduler, database, or auto-run. |
| A2 | Writing guidance is "STE-inspired", compact, and applies only to newly written or materially revised output. It never rewrites existing prose and never alters exact identifiers, quotes, or safety and prompt-byte contracts. |
| A3 | The performance checklist applies only to performance claims. Audit already covers counts. |
| B | Brainstorm (Rung 1, four candidates, no judges): a thin `axstack-correct` skill plus one audit clause. Grafts: recurrence `UNKNOWN` without pointers and `runtime: advisory` labels (Astra); distinct SHAs or PR numbers per occurrence and a check that each enforced rule's path exists (Grok). |

## Design (`axstack-correct`)

```text
Usage: /axstack-correct ["<correction>"] [runs=<ids> | last=<N>]
Shape: skills/axstack-correct/SKILL.md (compact) + one audit clause. Reads run records
       (Decisions, deviations, Learnings, FAILED receipts, audit proposals), a bounded
       git log window, and PR reviews named in those records. Writes a report only.
Binding: user-invoked; a class needs >=2 occurrences with distinct SHA or PR pointers,
         otherwise recurrence UNKNOWN and the class stays open; ladder = remove the copied
         pattern > script or helper error that names the fix > brief or receipt template >
         bun test > prose; each rule is labelled shipped or runtime; fixes go through a
         small-change intent and axstack-implement; the "Enforced rules" table in the target
         repo's AGENTS.md changes only in the PR that adds its check.
Flow + failure: a runtime class gets only a test-level fix -> a later audit records it
         again -> correct reports "enforcement failed" and relabels the row runtime.
We accept: one more compact skill for cross-run recurrence, which audit (one run) cannot see.
Rejected: audit-only mode (breaks audit's one-run boundary); a skill that implements fixes
         itself (skips author, review, and human merge); an installer-managed rules block
         (wrong owner); Axstack-only scope (any repo with run records can use it).
Open: none.
```

## Capabilities

| # | Capability | Content |
|---|---|---|
| C1 | Cleanup command | `workspace-hygiene.md` and every brief template use `rm -r` on the validated literal path instead of `rm -rf --` (auditor B2). |
| C2 | STE-inspired writing | One compact shared reference: one instruction per sentence, short sentences, active voice, condition before the step, defined terms, no slashes for "and or". Loaded by skills that write reports, PR bodies, briefs, and read-backs. |
| C3 | Performance checklist | One compact reference based on Gregg's seven questions (limiter, tuning, limits, errors, reproducibility, relevance, work happened). Loaded by debug, improve, and review only for performance claims. |
| C4 | `axstack-correct` | The Design above. The audit clause: a rule that is already covered but recurred is never an "already-covered no-op"; audit records it as recurred and suggests `axstack-correct` (covers auditor A-P3). |
| C5 | Audit follow-ups | (a) Close-out records one row per acceptance check with evidence or a user-accepted hold, plus the reason for each driver-elected repair (A-P2, B3). (b) `pr-digest.js` reports commit SHAs in a PR body that differ from the head (A-P5). (c) Diligence keeps full test output for any full-suite run and reports an unattributed failure as UNKNOWN, with no forced reruns (B1). (d) The spec checkpoint names the draft revision each adviser receipt covers (A-P1). |
| C6 | Pilot (optional) | After C4 merges, run `axstack-correct` on raw history and compare its classes with the auditor reports. Report only; blocks nothing. |

## Acceptance

1. `/axstack-correct` is installed as a skill. Its text binds every line of the Design `Binding`. Prose-contract tests fail when a binding is removed or inverted and survive rewording.
2. The audit skill states that a covered rule that recurred is not a no-op and suggests `axstack-correct` without running it. A test fails when this is removed or inverted.
3. No packaged skill or reference prescribes `rm -rf`. A test fails if one reappears.
4. The STE-inspired reference exists, is loaded by the skills that write reports, PR bodies, briefs, and read-backs, and keeps the exact-text exemptions.
5. The performance checklist exists and is loaded by debug, improve, and review for performance claims only.
6. Close-out in `lifecycle.md` requires the per-acceptance-check table with repair-election reasons.
7. `pr-digest.js` flags a body SHA that differs from `headRefOid`. A bun test replays a recorded stale body and fails before the change.
8. `diligence.md` requires full-suite output to be kept and allows UNKNOWN for an unattributed failure.
9. The spec skill's checkpoint names the revision each adviser receipt covers.
10. `bun test` is green with TMPDIR under `/tmp`. Each PR records any prose-size ceiling raise and its reason.
11. Release `v0.23.0` is published and installed on desktop and VPS (release decision held for the user).

## Exclusions

- Auditor A-P4 (probe classes up front): one occurrence; it stays a candidate for `axstack-correct`.
- Auditor B4 (size-exception record exists in `pr-shape.md`) and B5 (one-off release renumber).
- Running `axstack-correct` on its own proposals as the build method; transcript reading; auto-run; linters; a full ASD-STE100 dictionary; explainer videos; `/recall`.
- Rewriting existing skill prose for style.
- Changes to the installer-managed instruction block or to user-owned global instruction files.

## Authority requested at approval

- Release: AGENTS.md "Cut a release" rule and `.github/workflows/publish.yml`; hosts desktop (io) and VPS (axat-vps); tag and install after the user merges or approves the merge of the release PR; the user approves the npm stage.
- Host mutation: installing the released package on both hosts.
