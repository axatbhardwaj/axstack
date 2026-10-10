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
  Exception: allow one opt-in systemd user timer `axstack-default-sync` running
  a stateless script that rewrites only T3 `defaultModelSelection`.
  The timer has no workflow state. The script launches no agent.
- Use ordinary PR chains under [PR chains](skills/axstack/references/pr-chain.md);
  preexisting native stacks retain `gh stack`. Workers do not push, submit, merge, publish,
  or release. For own PRs, automatic merge is the default under the
  [watch predicate](skills/axstack-watch/SKILL.md#5-state-readiness-precisely).
  The recorded owning watch thread merges; excluded PRs follow its card and
  user-merge rules. Standalone authorized maintenance, small, and adopted work
  use the same predicate. User merges are bottom-up for a stack.
- In this repository, an agent driver may merge a Dependabot GitHub Actions PR only when all hold:
  author is `dependabot[bot]`, branch is `dependabot/github_actions/*`, and only `.github/workflows/` files change (including old and new rename paths);
  every changed `uses:` SHA pin resolves to the release tag the PR claims, verified via the GitHub API, and every tag ref is a release tag; for each changed action, the claim is the version named in the PR title, body or commit message.
  A release tag is a published GitHub Release tag, or its `vN`/`vN.N` major/minor alias resolving to the same commit.
  The `ci` workflow has run at the head and every check at the head has completed successfully (at least one check; none pending, failed or cancelled); merge with `gh pr merge <n> --merge --match-head-commit <sha>`.
  Otherwise leave the PR for the user. If either claim or tag cannot be determined or verified, leave the PR for the user.
  This is not a watch merge: watch §5 and the peer rules do not apply; these guards are the whole merge authority.

## Engineering

- Keep changes simple and modular. Follow KISS, YAGNI, and SOLID.
- Only the new helpers `dispatch-plan`, `pr-shape`, `readiness` and `run-init`
  follow this rule; the existing six scripts retain their behavior.
  Fact and plan helpers (`dispatch-plan`, `pr-shape`, `readiness` without `--run`)
  use explicit inputs, read-only `git`/`gh` or saved T3 JSON, output to stdout
  or a caller-given path, and keep no state between calls.
  Writer helpers (`run-init`, `readiness --run`) disclose every side effect in
  `--help` and write only those paths. All new helpers report each term as
  `pass`, `fail`, `unknown` or `n/a` with evidence. API, pagination and
  permission gaps are `unknown`. Helpers can add holds but never grant
  authority or an aggregate verdict; summaries are counts only.
  Only agents call these helpers within their own turn; helpers never merge,
  dispatch, notify, schedule, retry or pick the next phase.
  Each new helper supports `--help`, which lists its flags.
  New helper exit codes: 0 ok (including failed criteria), 1 error,
  2 hold or incomplete, 10 regression (readiness only).
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
  `src/`, release and reinstall on `io` (desktop), `iobook` (laptop, SSH alias),
  `iobox` (agent box, SSH as `xzat@iobox`) and `vps` (SSH alias).
  A docs-only run does not release.
- Cut a release with `chore(release): vX.Y.Z`, run the tag-triggered
  `.github/workflows/publish.yml`, then reinstall and verify it on io, iobook,
  iobox and VPS only under release and host-mutation authority recorded for that run.
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
