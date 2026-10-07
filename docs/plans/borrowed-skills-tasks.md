# Ticket map: borrowed skills — perf loop, audit environment lens, proof standards

Spec: `docs/specs/borrowed-skills.md` approved rev 3 @ `47e66b9`.
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
```

T0 (driver, planning artifacts): the spec and this map, at the bottom of the
stack.

Excluded per spec: verification-skill generator, git-guardrails hook, eval
blinding, already-covered items, release.
