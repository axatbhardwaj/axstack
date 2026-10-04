# Ticket map: correct, STE-inspired writing, performance checklist, audit follow-ups

Spec: `docs/specs/correct-ste.md` approved rev 4 @ `047caa4` (tag `spec/correct-ste-r4`).
Store: repository Markdown (this file). Run: `20261004-correct-ste`.
Stack: one linear `gh stack` on `main`, because each task may raise the same prose-size ceiling. Each task is one PR. Authors work in their own T3 worktrees; the driver publishes. Humans merge.

## Rules

- Every PR runs full `bun test` with TMPDIR under `/tmp` and records any prose-size ceiling raise with its exact amount and reason in the test comment (Q2).
- Every rule added in C1-C5 gets a prose-contract test that fails on removal or inversion and survives rewording; exact-text safety lines may be pinned exactly (AC11).
- Each auditor-derived task (T1-T3) carries its auditor's regression scenario and holdout into the PR.
- A ceiling raised in one PR is recomputed in every PR above it after a repair.

## Capabilities

| Capability | Tasks | Spec acceptance |
|---|---|---|
| C1 Scratch cleanup command | T1 | AC3, AC11, AC12 |
| C5 Audit follow-ups | T2, T3 | AC6, AC7, AC8, AC9, AC10, AC11, AC12 |
| C2 STE-inspired writing | T4 | AC4, AC11, AC12 |
| C3 Performance checklist | T5 | AC5, AC11, AC12 |
| C4 `axstack-correct` | T6, T7 | AC1, AC2, AC11, AC12 |
| Release | T8 | AC13 |
| C6 Pilot (optional) | T9 | none (report only) |
| Planning artifacts | T0 | lands the approved spec and this map (bottom of the stack; not a spec capability) |

## Tasks

```text
Spec: rev 4 @ 047caa4
Capability: planning  Internal task: T0 spec + ticket map -> driver -> driver worktree (branch axstack/20261004-correct-ste/spec)
Theme: planning artifacts only (docs/specs/correct-ste.md, docs/plans/correct-ste-tasks.md)
Size est: ~215 lines docs
Acceptance: files match the approved revision; bun test green
Depends: none
```

```text
Capability: C1  Internal task: T1 rm -r for owned scratch -> axstack-author -> own worktree
Theme: cleanup command
Size est: XS (~20-40)
Acceptance: AC3 — workspace-hygiene.md:17 prescribes `rm -r` on a validated literal owned scratch path inside evidence, TMPDIR, or worktree; no packaged skill or reference prescribes `rm -rf`; evidence-archive.md scopes "no shell recursive deletion" to removing a whole worktree; tests/workflows/workspace-hygiene.test.js:121 updated (line 122 unchanged); tests fail on regression of each. Auditor B2 scenario + holdout.
Depends: T0
```

```text
Capability: C5  Internal task: T2 close-out acceptance table + spec receipt revision -> axstack-author -> own worktree
Theme: run-record close-out and spec checkpoint evidence
Size est: S (~80-140)
Acceptance: AC6 — run-record.md holds the close-out table template (one row per acceptance check: evidence or user-accepted hold; reason for each driver-elected repair); lifecycle.md Close-out requires it in one clause. AC10 — axstack-spec checkpoint names the revision each adviser receipt covers and holds approval on a stale receipt with changed text. Tests per AC11. Auditor A-P2/B3 and A-P1 scenarios + holdouts.
Depends: T1
```

```text
Capability: C5  Internal task: T3 PR-body head SHA, diligence logs, learning-vs-rule finding -> axstack-author -> own worktree
Theme: publication and review evidence integrity
Size est: S (~100-160)
Acceptance: AC7 — candidate-publication.md records `PR body head SHA: <sha or none>` after every push; `none` passes; a full SHA or prefix >=7 chars must match `Confirmed remote SHA`; mismatch holds; the check runs after every push before diligence or merge-ready; other SHAs in a body are untouched; tests cover the no-head-SHA value (`none`, AC7 "absent"), matching full, matching abbreviated, mismatched. AC8 — diligence.md keeps full-suite output, reports an unattributed failure as UNKNOWN (never PASS), driver records its disposition, an observed failure still fails the suite, no reruns required. AC9 — implement merge-ready treats a run-record Learning that contradicts a shipped rule as a finding on the owning PR. Tests per AC11. Auditor A-P5, B1, A-P3 scenarios + holdouts.
Depends: T2
```

```text
Capability: C2  Internal task: T4 STE-inspired writing reference -> axstack-author -> own worktree
Theme: writing guidance
Size est: S (~60-120)
Acceptance: AC4 — compact reference (one instruction per sentence, short sentences, active voice, condition before step, defined terms, no slash for "and or"); contracts.md links it once for user-facing output; text keeps exact-text exemptions and prospective scope (new or materially revised output only). Tests per AC11.
Depends: T3
```

```text
Capability: C3  Internal task: T5 performance checklist -> axstack-author -> own worktree
Theme: performance-claim vetting
Size est: S (~60-120)
Acceptance: AC5 — compact reference with Gregg's seven questions; linked from axstack-debug, axstack-improve, axstack-review for performance claims only. Tests per AC11.
Depends: T4
```

```text
Capability: C4  Internal task: T6 axstack-correct skill + tests -> axstack-author -> own worktree
Theme: new report-only skill (Design sketch in spec)
Size est: M (~150-220)
Acceptance: AC1 — skills/axstack-correct/SKILL.md binds every Design Binding line and the Shape safety lines (report only; never edits, dispatches, merges; no transcripts; bounds recorded); tests for the four scenarios (duplicate incident counts once; missing pointer -> recurrence UNKNOWN; shipped row + recorded recurrence -> `enforcement failed`, proposes `runtime: advisory`, AGENTS.md unchanged; prose-contract test alone never certifies enforcement); skill-count tests updated in the same PR (tests/workflows/bundle-discovery.test.js:7-12, tests/workflows/run-record.test.js:145, tests/workflows/structural.test.js:51-71). Tests per AC11. Named failure (Design Flow + failure) is the third scenario.
Depends: T5
Split note: if the skill text plus tests exceed the band, routing/docs already sit in T7.
```

```text
Capability: C4  Internal task: T7 audit clause + routing + docs -> axstack-author -> own worktree
Theme: integrate axstack-correct
Size est: S (~60-120)
Acceptance: AC2 — axstack-audit states a covered rule that recurred is not an "already-covered no-op" and suggests axstack-correct without running it (test fails on removal or inversion). AC1 tail — routing.md direct route, README skill table (tests/workflows/readme-contract.test.js:21 updated), docs/workflows.md list axstack-correct. Tests per AC11.
Depends: T6
```

```text
Capability: Release  Internal task: T8 chore(release) -> axstack-author -> own worktree; tag/publish/install -> driver
Theme: release
Size est: XS (2 lines)
Acceptance: AC13 — after the user's release decision: minor bump (feat lands) in package.json + tests/installer/package.test.js; release PR body diligence vs merged PRs (required by candidate-publication.md, not an added scope); user merges or approves merge; tag; publish.yml success; user approves npm stage; install + verify on io and axat-vps.
Depends: T1-T7 merged
```

```text
Capability: C6  Internal task: T9 pilot run of axstack-correct on raw history -> driver (inline skill) -> no worktree
Theme: optional validation, report only
Size est: n/a
Acceptance: none; compare classes with the two auditor reports; blocks nothing.
Depends: T8 installed
```

## Lifecycle state

| Capability | State |
|---|---|
| C1, C2, C3, C4, C5, Release | Open |
| C6 | Optional |
