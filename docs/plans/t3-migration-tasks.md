# Ticket map: Axstack Orca → T3 Code migration

Spec: T3 Code migration rev 4, `docs/specs/t3-migration.md` @ `a91f547` (tag `spec/t3-migration-r4`).
Store: repository Markdown (this file). Run: `20261003-t3code-migration`.
Stack: `gh stack`. Base is `main`. Each task is one PR and builds on the one before it. Authors work in Orca worktrees (Q4).

## Rules

- Every one of the 83 Orca-bearing files (`git grep -il orca -- ':!docs/specs' ':!docs/plans'` at `3407293`) has exactly one primary owner, listed below.
- Another PR may make a named secondary edit to a file it does not own. This happens only when a test assertion or link would otherwise go red.
- Assertions about README and `docs/` content are changed only in T7, which edits those docs. Before T7, earlier PRs leave those assertions alone.
- Assertion follows text: whichever PR changes asserted text also updates that assertion, as a secondary edit to a test it may not own. This applies to any test file, inventory or not. Each PR is green on its own.
- `orca-runtime.md` readers are repointed to `t3-runtime.md` in the PR that rewrites the asserted rule. T5b repoints every reader that remains before it deletes the file.
- A file is deleted only in the PR that also updates every test and link that reads it.
- `tests/workflows/prose-size.test.js`: T1 raises the aggregate ceiling to cover `t3-runtime.md` while `orca-runtime.md` still exists, with the driver acceptance recorded in the file comment. T5b lowers it again after the deletion. Always-loaded files (`contracts`, `lifecycle`, `routing`) stay under 24,530 B, or the owning PR records a driver acceptance. Every PR's acceptance includes prose-size green.
- Behavior changes go red then green. Structure-preserving slices are green before and after. Prose-contract tests must fail when their rule is removed or inverted, and must survive rewording.

## Capabilities

| Capability | Tasks | Spec acceptance covered |
|---|---|---|
| C1 T3 runtime contract (dispatch, binding, receipts, lifecycle, cleanup, recovery) | T1, T2, T3 | AC2 (scenario tests), AC4 |
| C2 Review manager and watch on T3 scheduled tasks | T4, T9 (canary) | AC2 (manager rules, bound-watch scenario), AC9 (canary) |
| C3 Phase skills, routing and presets on T3 | T5a, T5b | AC4 (links), AC6 |
| C4 Installer validates T3 and reroutes instructions | T6 | AC5 |
| C5 Docs and the no-active-Orca guard | T7 | AC3, AC10 (docs) |
| C6 Live gate, release and host cutover | T8, T9 | AC1, AC2 (live), AC7, AC8, AC9, AC10 |

## Tasks

```text
Spec: rev 4 @ a91f547
Capability: C1  Internal task: T1 add t3-runtime reference -> author (axstack-author) -> Orca worktree t3m-t1
Theme: new shared reference skills/axstack/references/t3-runtime.md (role->mechanism table, provider
       binding + model rule, effort ids, receipts AXSTACK-DONE/FAILED/QUESTION, key/branch encoding,
       completion order, duplicate-launch recovery, post-launch wait, question resume, run watch,
       worktreeCleanup preflight, no daemon/DB/scheduler, verification/repair/replacement, delegated
       isolation porcelain check, run-record fields) carrying forward every runtime-agnostic rule of
       orca-runtime.md (TMPDIR 0700 evidence guard, confirm brief once and never answer trust/permission
       prompts, permission prompt or safety refusal = hold, exactly one writer, reviewer evidence folders)
       + tests/workflows/t3-runtime.test.js + tests/workflows/t3-recovery-scenarios.json with the runtime
       AC2 paths: lost launch response, silent provisioning failure, writer death after the driver
       idles, stale completion, child question and resume
Secondary edits: tests/workflows/prose-size.test.js (aggregate ceiling, recorded acceptance)
Size est: 700-1100 (additive; no inventory files)
Acceptance: each binding rule and each runtime AC2 scenario has a prose-contract test that fails when
       removed or inverted and survives a paraphrase holdout; prose-size green; bun test green
Depends: none
```

```text
Capability: C1  Internal task: T2 resolve models from T3 catalog; retire trust-path -> author -> t3m-t2
Theme: model binding
Primary files: skills/axstack/scripts/trust-path.js (delete), tests/workflows/trust-path.test.js (delete),
       tests/workflows/model-classes-contract.test.js, tests/workflows/optional-seats.test.js
       + skills/axstack/scripts/resolve-models.js (--provider, capabilities-JSON reader, model rule,
       model:null roles) and its tests
Secondary edits: automations.md:37, orca-runtime.md:124, routing.md:20,24 (trust-path and transcript
       read-back lines), run-record.test.js:139 (trust-path reference)
Size est: 500-900
Acceptance: resolve-models.js resolves codex/claude classes and model:null roles from a saved
       capabilities fixture and holds on missing values (red then green); no trust-path reference remains
       in the AC3 paths (excluding docs/specs, docs/plans); prose-size green; bun test green
Depends: T1
```

```text
Capability: C1  Internal task: T3 T3 lifecycle, hygiene, cleanup, recovery scenarios -> author -> t3m-t3
Theme: lifecycle and workspace hygiene on T3
Primary files: skills/axstack/references/lifecycle.md, workspace-hygiene.md, evidence-archive.md,
       candidate-publication.md, skills/axstack-cleanup/SKILL.md, tests/workflows/cleanup.test.js,
       workspace-hygiene.test.js, workspace-hygiene-scenarios.json, workspace-hygiene-passes.test.js,
       review-checkout.test.js, tracking.test.js, tracking-scenarios.json, diligence-repair.test.js,
       owned-support.test.js
New: AC2 scenarios that attach to T3-owned files, added to t3-recovery-scenarios.json: delegated
       reviewer isolation (review-checkout) and cleanup with unmerged or ignored content (cleanup,
       workspace-hygiene). Spec PR4 named all AC2 scenarios; under the primary-owner rule each scenario
       goes with the PR that owns its rule's file (T1 runtime, T3 hygiene, T4 watch).
Secondary edits (assertion-follows-text): owned-core.test.js:398 (lifecycle), workspace-hygiene.test.js
       assertions on routing/run-record/SKILL.md stay untouched until T5a; implement-loop,
       codebase-review, tracking assertions on lifecycle/hygiene text
Size est: 1200-1900
Acceptance: its AC2 scenario tests fail when each rule is removed or inverted; the cleanup order,
       sweep ownership and worktreeCleanup readback rules are present and tested; always-loaded
       lifecycle stays under cap or acceptance recorded; prose-size green; bun test green
Depends: T2
```

```text
Capability: C2  Internal task: T4 T3 scheduled review manager and watch -> author -> t3m-t4
Theme: review manager and watch
Primary files: skills/axstack/references/automations.md, review-manager-prompt.md,
       test-audit-weekly.md, skills/axstack-watch/SKILL.md, skills/axstack-watch/references/watch-runtime.md,
       tests/workflows/manager-stall.test.js, isolated-manager-passes.test.js, pr-managers.test.js,
       pr-manager-scenarios.json, chat-run-watch.test.js, chat-run-watch-scenarios.json,
       test-audit-weekly.test.js, watch-retirement.test.js
New: bound-watch wake and verified deletion scenario in t3-recovery-scenarios.json (AC2)
Secondary edits (assertion-follows-text): owned-core.test.js:236 (watch SKILL), tests reading
       automations.md/watch-runtime.md
Size est: 1200-1900
Acceptance: the lane binding/readback, full-page inventory hold, missing-ordering hold, duplicate pass
       read-only note, earliest-pass-with-evidence rule, growth limit -> schedule disable, and
       predecessor retirement rules are present, each with a failing-when-removed test; the chat-run
       watch uses a bound T3 schedule; the bound-watch AC2 scenario fails when removed; prose-size
       green; bun test green
Depends: T3
```

```text
Capability: C3  Internal task: T5a migrate phase skills, routing, presets -> author -> t3m-t5a
Theme: phase entry points and shared routing (orca-runtime.md still present, unreferenced by skills
       and references after T5a)
Primary files: SKILL.md for align, audit, debug, explain, implement, improve, relay, research, review,
       spec, tickets (11); skills/axstack/references/routing.md, run-record.md, contracts.md,
       autopilot.md, diligence.md, ui-verification.md; AGENTS.md; profiles/presets/*.json (notes only);
       tests/workflows/align-arena.test.js, align-grilling-scenarios.json, autopilot.test.js,
       autopilot-repair.test.js, codebase-review.test.js, diligence.test.js, implement-loop.test.js,
       owned-audit.test.js, pending-repairs.test.js, presets.test.js, relay-scenarios.json,
       review-modes.test.js, routing-scenarios.json, run-record.test.js, scope-identity.test.js
Secondary edits (assertion-follows-text): structural.test.js:174 (contracts.md), workspace-hygiene.test.js
       assertions on routing/run-record/SKILL.md, every test reading these files
Size est: 1500-2000
Acceptance: the 11 SKILL.md bodies plus routing/contracts/run-record/autopilot/diligence/ui-verification
       reference t3-runtime.md, not orca-runtime.md; the relay fallback is the T3 driver thread;
       ui-verification uses preview_* tools; presets keep 32 role ids and every note mentioning Orca,
       the TUI or agy now names T3 (including mixed.json:119,128,281,290); always-loaded routing/contracts under cap
       or acceptance recorded; prose-size green; bun test green
Depends: T4
```

```text
Capability: C3  Internal task: T5b delete orca-runtime and its tests -> author -> t3m-t5b
Theme: removal
Primary files: skills/axstack/references/orca-runtime.md (delete), tests/workflows/orca-runtime.test.js
       (delete; surviving checks folded into t3-runtime.test.js), orca-native-contracts.test.js (delete,
       T3 equivalents), orca-native-scenarios.json (delete), orca-scenarios.json (delete)
Secondary edits: every remaining reader of orca-runtime.md: cleanup.test.js:56,101,112,
       workspace-hygiene.test.js:38,187,198, review-checkout.test.js:12, tracking.test.js:26,36,
       owned-support.test.js:99, manager-stall.test.js:15, pr-managers.test.js:80,95,
       model-classes-contract.test.js:17,28,45, optional-seats.test.js:69, structural.test.js:153,302-310,
       341-348, owned-core.test.js:53, presets.test.js:359; docs/workflows.md:131 (link repoint only;
       assertions stay in T7); t3-runtime.test.js (folded checks and orca-native-contracts T3
       equivalents); prose-size.test.js (lower the aggregate ceiling, recorded acceptance)
Size est: 700-1000 (mostly deletions)
Acceptance: orca-runtime.md and orca-runtime.test.js are deleted and no reference to the file
       `orca-runtime.md` remains in the AC3 paths (excluding docs/specs, docs/plans; the T6 probe name
       `orca-runtime` in src/ and tests/installer/ is removed in T6);
       prose-size green with the lowered ceiling; bun test green
Depends: T5a
```

```text
Capability: C4  Internal task: T6 installer validates T3 and reroutes instructions -> author -> t3m-t6
Theme: installer
Primary files: src/capabilities.js, src/instructions.js, bin/axstack.js, package.json,
       tests/installer/capabilities.test.js, instructions.test.js, package.test.js,
       orca-migration.test.js (renamed legacy-runtime-migration.test.js)
Size est: 600-1100
Acceptance: t3 presence + nightly floor by version and date (an older same-version nightly fails);
       MCP readiness reported as "verified by driver preflight"; no Orca probes; generated block
       routes via T3 with the standing writer-launch authorization; hand-written Orca lines reported,
       not edited; the `orca-runtime` probe name is gone; temporary homes; prose-size green; bun test
       green
Depends: T5b
```

```text
Capability: C5  Internal task: T7 docs + no-active-Orca structural guard -> author -> t3m-t7
Theme: docs and guard
Primary files: README.md, docs/installation.md, docs/workflows.md, tests/workflows/structural.test.js,
       owned-core.test.js, readme-contract.test.js
Secondary edits: README/docs assertions in chat-run-watch, pr-managers, watch-retirement, presets,
       diligence, model-classes-contract, scope-identity, autopilot-repair, align-arena, tracking,
       and non-inventory tests reading README/docs (tracker-stores, relay-discovery, debug, r2-repairs)
Size est: 700-1300
Acceptance: the structural check fails on active Orca content or file names under the AC3 scope,
       with only the named exemptions; installation doc covers T3 setup, worktreeCleanup off,
       Antigravity runtime + sign-in, Grok >= 1.0.13, Tailscale pairing, and the six rollback steps
       (reinstall v0.20.31; restore both global-instruction backups on both hosts; manager schedule
       enabled:false; delete armed run watches; stop and disable the t3 serve service; re-enable the
       Orca automation) plus one-week Orca retention;
       `git grep -il orca -- ':!docs/specs' ':!docs/plans'` lists only exempt files; prose-size green;
       bun test green
Depends: T6
```

```text
Capability: C6  Internal task: T8 live gate on desktop -> driver (T3 driver thread)
Theme: verification
Size est: n/a (no PR unless fixes; fix PRs stack on T7)
Acceptance: AC1 matrix: all 13 skills complete one live run from a T3 driver thread on the mixed
       preset, T3 version and installed Axstack main SHA recorded; each skill with configured roles
       dispatches them through T3; the matrix shows codex, claudeAgent and grok dispatches; relay and
       cleanup run inline; antigravity's 3 roles count only after runtime install + user sign-in + a
       canary, otherwise a recorded hold the user accepts; AC2 live exercise of each recovery path
Depends: T7 merged
```

```text
Capability: C6  Internal task: T9 release v0.21.0 and host cutover -> driver
Theme: release
Acceptance: release PR (chore(release): v0.21.0) lists the six rollback steps and one-week Orca
       retention; tag publish; human npm stage approval; on BOTH hosts: installed version, roles and
       both skill dirs (~/.claude/skills, ~/.agents/skills) verified, Grok CLI >= 1.0.13, global
       ~/.claude/CLAUDE.md and ~/.codex/AGENTS.md backed up then rewritten to route via T3 preserving
       defi-com-only Linear via executor, GitHub specs elsewhere and Notion via executor, with readback
       from a T3 Claude thread and a T3 Codex thread; VPS: T3 nightly, t3 serve --tailscale-serve user
       service, Android app paired, lane project, schedule, canary (overlap, real PR, killed
       predecessor, limit -> disable), Orca automation disabled with readback, Notion prompt backup
       updated, Hermes delivery verified including AXSTACK_RUN_DIR for a T3 run
Depends: T8
```

## Lifecycle state

| Capability | State |
|---|---|
| C1–C6 | Open |
