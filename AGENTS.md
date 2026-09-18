# Axstack

## Operating rules

- Use Orca as the only active runtime. Route every delegated worker, reviewer,
  or cross-harness dispatch through Orca orchestration, never native subagents.
- Keep the current chat as driver. Let it own scope, coordination, integration,
  and forge mutations; keep each worker within its assigned files.
- Keep exactly one writer per candidate. Return source fixes to that author.
- Use the phase skills under `skills/axstack*/SKILL.md`; keep shared references
  under `skills/axstack/references/`.
- Select one explicit preset from `profiles/presets/mixed.json`,
  `profiles/presets/codex-only.json`, or `profiles/presets/claude-only.json`.
  Let the installer generate the installed `skills/axstack/roles.json` snapshot.
- Do not add an Axstack daemon, scheduler, runtime database, workflow state
  machine, or programmatic escalation gate.
- Use `gh stack` for dependent PRs. Workers do not push, submit, merge, publish,
  or release; the human merges by default, bottom-up for a stack.

## Engineering

- Keep changes simple and modular. Follow KISS, YAGNI, and SOLID.
- Use strict TDD for behavior changes: run a meaningful check red before the
  implementation, then record green evidence. Do not count missing modules or
  unrelated setup failures as behavioral red.
- For accepted structure-preserving work, run the same characterization check
  green before and after; do not manufacture a red.
- Run tests with `bun:test`. Keep installer tests under `tests/installer/` and
  workflow tests under `tests/workflows/`; prose-contract tests may read skill
  Markdown directly.
- Never edit live home configuration during development. Use temporary homes
  and fixtures.
- Keep coherent commits around 200 lines when practical and use semantic
  commit messages.
- Treat `docs/specs/` and `docs/plans/` as historical baselines, not standing
  instructions for the current task.
- Cut a release with `chore(release): vX.Y.Z`, run the tag-triggered
  `.github/workflows/publish.yml`, then reinstall and verify it on desktop and
  VPS under separately applicable release and host-mutation authority.

## Interfaces

- Target Bun >=1.3.14 JavaScript with no runtime dependencies. Use only the
  narrow Bun-backed `node:fs` and `node:fs/promises` built-in exception; do not
  introduce a Node.js runtime contract.
- Keep installer surfaces in `src/`, `bin/`, `package.json`, and
  `tests/installer/`.
- Keep workflow surfaces in `skills/`, `profiles/`, `tests/workflows/`,
  `docs/workflows.md`, `docs/installation.md`, and `README.md`.
- Keep packaged skills self-contained with relative references.
