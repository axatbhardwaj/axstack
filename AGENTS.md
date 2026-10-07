# Axstack

## Operating rules

- Use T3 Code as the only active runtime.
- Route every delegated worker, reviewer, or cross-harness dispatch through the
  `t3-code` MCP, never native subagents.
- Keep the current T3 thread as driver. Let it own scope, coordination, integration,
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
  or release. For own PRs, automatic merge is the default under the
  [watch predicate](skills/axstack-watch/SKILL.md#5-state-readiness-precisely).
  The recorded owning watch thread merges; excluded PRs follow its card and
  user-merge rules. Standalone authorized maintenance, small, and adopted work
  use the same predicate. User merges are bottom-up for a stack.

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
- Run full `bun test` with `TMPDIR` set to an owned 0700 directory outside
  `$HOME`; installer fixtures refuse home paths.
- A prose-contract test of a semantic instruction must fail when the instruction
  is removed or inverted and survive rewording; exact-text safety, exact prompt-byte,
  or public-key contracts are exempt.
- Never edit live home configuration during development. Use temporary homes
  and fixtures.
- Keep coherent commits around 200 lines when practical and use semantic
  commit messages.
- Treat `docs/specs/` and `docs/plans/` as historical baselines, not standing
  instructions for the current task.
- Standing release and install authority: when a run changes shipped skills or
  `src/`, release and reinstall on `io` (desktop) and `vps` (SSH alias).
  A docs-only run does not release.
- Cut a release with `chore(release): vX.Y.Z`, run the tag-triggered
  `.github/workflows/publish.yml`, then reinstall and verify it on desktop and
  VPS only under release and host-mutation authority recorded for that run.
  Merge the release PR under the watch predicate. The human approves the npm
  stage; agents never run `npm stage approve`.

## Interfaces

- Target Bun >=1.3.14 JavaScript with no runtime dependencies. Use only the
  narrow Bun-backed `node:fs` and `node:fs/promises` built-in exception; do not
  introduce a Node.js runtime contract.
- Permit an installer network and Git step only for archify.
  Run this Node-oriented tool with Bun.
  Keep this exception limited to archify.
- Keep installer surfaces in `src/`, `bin/`, `package.json`, and
  `tests/installer/`.
- Keep workflow surfaces in `skills/`, `profiles/`, `tests/workflows/`,
  `docs/*.md`, and `README.md`.
- Keep packaged skills self-contained with relative references.
