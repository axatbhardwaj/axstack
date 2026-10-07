# Ticket map: borrowed skills — perf loop, audit environment lens, proof standards

Spec: `docs/specs/borrowed-skills.md` approved rev 5 @ `716a673` (rev 3 @ `47e66b9` for T0-T4).
Store: repository Markdown (this file). Run: `20261007-borrow-skills`.
Stack: one linear `gh stack` on `main`, because each task may raise the same
`prose-size.test.js` ceilings. Each task is one PR. Authors work in their own
T3 worktrees; the driver publishes. Own PRs merge under the watch predicate.

## Rules

- Every PR runs full `bun test` with TMPDIR under `/tmp`; a ceiling raise is
  only the measured bytes, recorded in the test comment (AC11).
- Every added rule gets a prose-contract test that fails on removal or
  inversion and survives rewording (AC11).
- A ceiling raised in one PR is recomputed in every PR above it after a repair.
- Paraphrased text credits its source with a pinned URL and license (AC12).

## Capabilities

| Capability | Tasks | Spec acceptance |
|---|---|---|
| Planning artifacts | T0 | lands the approved spec and this map |
| CA Performance loop | T1, T2 | AC1-AC6, AC11, AC12 |
| CB Audit environment lens | T3 | AC7-AC9, AC11, AC12 |
| CC Proof standards | T4 | AC10, AC11, AC12 |
| CD Verification skill | T5, T6 | AC13-AC19, AC11, AC12 |

## Tasks

```text
Spec: rev 3 @ 47e66b9
Capability: CA Performance loop
Internal task: T1 perf-loop.md + phase load points -> axstack-author -> own worktree
Theme: shared performance loop reference loaded by debug/improve/implement
Size est: medium
Acceptance: AC1 (loop steps incl. freeze, harness sensitivity, target/noise/budget,
  mantras, noise-gated keep, revert+record rejected, one commit per win, harness
  change invalidates, hold on insensitive harness, stop at target/budget, report);
  AC2 (one writer); AC4 (debug/improve/implement roles, regression and
  optimization routes both tested); AC11; AC12
Depends: T0

Capability: CA Performance loop
Internal task: T2 axstack-perf skill + registration -> axstack-author -> own worktree
Theme: model-invocable router skill and its listings
Size est: small
Acceptance: AC3 (skill exists, model-invocable, loads perf-loop.md, routes
  regression/discovery/change, no extra workflow); AC5 (bundle, structural,
  README contracts, routing.md "make X faster", docs/workflows.md, listed as a
  routed skill); AC6 (usage line, target/noise/budget as acceptance checks);
  AC11; AC12
Depends: T1

Capability: CB Audit environment lens
Internal task: T3 audit §5 environment lens -> axstack-author -> own worktree
Theme: axstack-audit proposal scope and environment lens
Size est: small
Acceptance: AC7 (optional lens; field 3 "skill or environment change"; targets;
  §6 parity; repeats stay with correct); AC8 (existing check unwired/broken
  first; deterministic over prose for mechanical rules); AC9 (added read-only
  inputs at audited revision; no transcripts; UNKNOWN without pointer; no
  automatic edit; delivery path unchanged); AC11; AC12
Depends: T2

Capability: CC Proof standards
Internal task: T4 ui-verification proof standards -> axstack-author -> own worktree
Theme: four proof standards in ui-verification.md
Size est: small
Acceptance: AC10; AC11; AC12
Depends: T3

Spec: rev 5 @ 716a673
Capability: CD Verification skill
Internal task: T5 axstack-verify skill (create mode) + registration -> axstack-author -> own worktree
Theme: model-invocable verification skill with create mode, routing guard and listings
Size est: medium
Acceptance: AC13 (model-invocable, two modes, single-behavior requests route to an
  existing verify-<app> skill or ui-verification.md delegation); AC14 (create:
  repository reading, harness reuse, .agents/skills/verify-<app>/ layout with
  Launch/Doctor/Drive/Evidence/Cleanup/Helpers and features/ map with an index and
  the top 3-5 user features, after reading surface, run, drive, observe and isolate;
  relative
  .claude/skills symlink, executable documented helpers, name+description
  frontmatter only); AC15 (one executed e2e proof: launch, doctor, drive one mapped
  feature, capture evidence, clean up, confirm evidence survives; a bounded exception recorded on
  the TDD line, AC11 tests for axstack-verify itself and red/green for helper logic
  still required, author drives non-browser only, browser via ui-verification.md
  with feature file path, discovery + relative-helper checks in Claude Code and
  Codex); AC17 safety (no product/build fixes, private evidence, owned 0700 TMPDIR
  outside HOME, loopback, no production secrets, literal cleanup, peer PR recipe
  from base run on candidate with served SHA, preserve existing skills and resolve
  collisions); AC16 create-mode half (doctor before each drive, retry once after a
  drift fix, clean up after failed attempts, evidence survives cleanup); AC19 (listings, pinned pstack credit, MIT); AC11; AC12
Depends: T4

Capability: CD Verification skill
Internal task: T6 maintain mode + stack integration -> axstack-author -> own worktree
Theme: maintain mode and use-when-present integration in implement and ui-verification
Size est: medium
Acceptance: AC16 (index hygiene, source read per feature, live drive of every
  mapped feature with doctor-before-drive, drift/harness/regression
  classification, regressions to the driver then axstack-debug and never fixed in
  docs, omitted entry
  points and unreachable prerequisites reported separately, incomplete coverage
  never clean, clean/changed (one PR)/blocked outcomes, no parallel wave, no schedule,
  retry once after a drift fix, cleanup after failed attempts, surviving
  evidence); AC18 (implement §5 and ui-verification.md use a present skill for
  affected behavior, mapped-feature changes update the feature file in the same
  PR, missing skill -> Unverified line suggestion only, broken recipe never waives
  acceptance, tool-neutral browser recipes); AC11; AC12
Depends: T5
```

T0 (driver, planning artifacts): the spec and this map, at the bottom of the
stack.

Excluded per spec: git-guardrails hook, eval blinding, already-covered items.
Release: standing authority (run `20261007-autonomy`, AQ1) after all PRs merge.
