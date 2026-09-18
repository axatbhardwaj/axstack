# implement-loop: capability to task map

Spec: docs/specs/implement-loop.md rev 5 (approved 2026-09-19; both advisers
AGREE on rev 5), tag `spec/implement-loop-r5`. Store: repository Markdown
(this file). Three stacked PRs via `gh stack` on PR #106
(`axatbhardwaj/driver-operating-rules`). Routing preset `mixed`: authors
`axstack-author` (Codex Sol medium); authored review by
`axstack-reviewer-secondary` (Claude Opus medium) per the routing table; the
driver (current chat) owns every PR, publishes, and holds the run-level wait.
PR3 is delivered through the loop it introduces (spec A6); this file is the
task/PR map D3 reads.

## Capability A — the installer accepts a shared root without a router

Capability: spec D1 (installer, instruction block)
Internal task: A1 `src/installer.js` SKILL.md rule exempts the exact name
`axstack`; `src/instructions.js` first line "invoke the matching `axstack-*`
skill directly" -> PR1 owner (driver) -> worktree `implement-loop-pr1`
(child of `driver-operating-rules`)
Theme: installer bundle contract for the shared root
Size est: target band (~150 lines)
Acceptance:
- new behavior test, red first: a bundle whose `axstack/` lacks `SKILL.md`
  installs; a bundle whose `axstack-x/` lacks it fails (spec A1)
- `tests/installer/instructions.test.js`, `instruction-cli.test.js` expect the
  new first line; `orca-migration.test.js` fixtures unchanged and green
- installed directory-set assertion (spec A3) added here or in PR2
- `docs/specs/implement-loop.md` and this file land with this PR
- `bun test` green
Depends: none (base = #106 head)

## Capability B — the router is gone and every pointer follows

Capability: spec D1 (delete), D2 (identity pointers)
Internal task: B1 delete `skills/axstack/SKILL.md`; implement §1 gap sentence;
contracts.md lifecycle-load exception names relay; pointers in
`axstack-align/SKILL.md:164`, routing.md "Direct later phase", README.md:71,
docs/workflows.md (incl. :54-57 roles.json location), docs/specs/v1.md:198,
orca-runtime.md:25 -> PR2 owner (driver) -> worktree `implement-loop-pr2`
(child of pr1)
Theme: router removal and pointer retargeting
Size est: target band (~200 lines, mostly deletions)
Acceptance:
- entry-file absence assertions red first (spec A1), then green
- tests retargeted: `scope-identity.test.js`, `owned-core.test.js:59,276,429`
  + entry-routes test removed, `structural.test.js:51,72`,
  `bundle-discovery.test.js` (13 -> 12), `automations.test.js:466`,
  `relay-discovery.test.js:48,56`, `pending-repairs.test.js:55`
- spec A2 grep empty over skills, src, tests, README.md, docs/workflows.md
- spec A3 directory-set assertion green
- `bun test` green
Depends: A1

## Capability C — implementation loops until merge-ready

Capability: spec D3, G1
Internal task: C1 `skills/axstack-implement/SKILL.md` opening + §5 stop rule
replaced, §6 loop (states, one run-level wait + one bounded forge check wait
per revision, same-author repairs, repair cap 3, CI-wait exhaustion -> held
with resume condition, immediate serious risk, boundary/resume, done);
routing.md G1 sentence; lifecycle roster sentence (driver = owner of loop
PRs); `src/instructions.js` loop clause -> PR3 owner (driver) -> worktree
`implement-loop-pr3` (child of pr2)
Theme: the implement loop contract
Size est: target band (~200 lines)
Acceptance:
- loaded-text regression test (spec A4) red first, then green
- `tests/workflows/implement-loop-evaluator-inputs.json` with cases (i) CI
  wait exhausted -> held, (ii) REQUEST_CHANGES -> same-author repair ->
  republish -> re-review -> merge-ready, plus one unchanged holdout; driver
  evaluates in a fresh agent session against old text before the edit and new
  text after; both receipts recorded in the PR as agent evidence (spec A1)
- named-set word count <= 6,800 recorded (spec A5)
- implementation note (Fable, non-blocking): the CI-exhaustion hold's ping
  says "checks pending, resume when green", not "decision needed"
- `bun test` green
Depends: B1

## Release (after C1 merges; separately authorized host mutation)

- `chore(release): vX.Y.Z` per AGENTS.md; push tag; publish workflow
- update VPS automation `8c1e0fdf` "Axstack PR driver" prompt and
  docs/plans/pr-automations-prompts.md:37 to load contracts.md + automations.md
  directly (spec Release step); then reinstall on desktop `io` and VPS
- record spec A3 manual catalog check (Claude Code + Codex on `io`, versions),
  A6 checkpoint pointer, and A7 (one clean scheduled VPS driver run)
- lifecycle Close-out for run `20260918-driver-trace-improvements`

## Lifecycle state

| Capability | State | Evidence |
| --- | --- | --- |
| A | pending | — |
| B | pending | — |
| C | pending | — |
