# Deterministic helpers and readiness execution map

Spec: `docs/specs/deterministic-helpers.md` Approved rev 4 @ `2eb68d0`
(content SHA-256 fbc089c330467e3f522010f43819d8a2051ccc5eb8d40e637f01739dba453ce3).
Store: repo Markdown. Writers: `axstack-author` (codex, sol class, high), one
writer per task, launched worktrees. Track A and Track B are independent
stacks on `main`; tasks inside a track stack in order. Writers read the spec
with `git show 2eb68d0:docs/specs/deterministic-helpers.md` (shared object store).
Both tracks touch the prose-size ceiling in `tests/workflows/prose-size.test.js`:
each PR recomputes it at rebase on current `main`; Track A merges first when
both are ready. The A1b flag-sync test discovers new scripts generically, so it
covers A2, A3 and B1c once both tracks are on `main`.

Capability: T0. Spec and map land on `main`
Internal task: T0 -> driver -> branch `axstack/20261008-cli-lessons/spec`
Theme: planning artifacts (spec + this map)
Size est: small (docs only)
Acceptance: spec and map on `main` at the approved content
Depends: none (A1a and B1a do not wait for it)

Capability: A1. Dispatch plans come from a script, not prose
Internal task: A1a -> axstack-author -> worktree `helpers-a1a` (base main)
Theme: `skills/axstack/scripts/dispatch-plan.js` and its `--verify` mode
Size est: medium (script, fixtures, tests)
Acceptance: spec 1, 2 (baseline measurement recorded by the driver before dispatch), 3; `--help` lists every flag; spawns `resolve-models.js`, maps its exit 1 to exit 2 and passes its stderr through (tested)
Depends: none

Internal task: A1b -> axstack-author -> worktree `helpers-a1b` (stacked on A1a)
Theme: helper rule in `AGENTS.md`, prose flag-sync test, `t3-runtime.md` pointer replacing restated mapping
Size est: small-medium (prose deletion, retargeted tests, ceiling lowered)
Acceptance: spec 4, 5, 14 (A1 part)
Depends: A1a

Capability: A2. Run records start from a script
Internal task: A2 -> axstack-author -> worktree `helpers-a2` (stacked on A1b)
Theme: `skills/axstack/scripts/run-init.js`; `run-record.md` path steps become a pointer
Size est: small
Acceptance: spec 1, 6, 14 (A2 part)
Depends: A1b

Capability: A3. PR shape is measured by a script
Internal task: A3 -> axstack-author -> worktree `helpers-a3` (stacked on A2)
Theme: `skills/axstack/scripts/pr-shape.js`; `pr-shape.md` measuring steps become a pointer
Size est: small
Acceptance: spec 1, 7, 14 (A3 part)
Depends: A2

Capability: B. Repository readiness report
Internal task: B1a -> axstack-author -> worktree `readiness-b1a` (base main)
Theme: `skills/axstack/scripts/readiness.js` static criteria, report, baseline and `--out` rules
Size est: medium-large (criteria, fixture repos, tests)
Acceptance: spec 1, 8 (static clauses: configured criteria, n/a without TypeScript, unsupported stack, no lockfile, ambiguous lockfile, missing `build`/`test` without `--run`), 9 (static run), 11, 12; `--help` lists every flag; `--out` symlinks rejected; git reads use `--no-optional-locks`; header carries identity, dirty flag, both observation times and versions. Clarifications: status order is stack check, script presence, prose-declared, lockfile, then `unknown (not run)`; `--out` must end in `.json` for static runs too (exit 1 tested); pillar fraction excludes n/a, all-n/a renders `0/0` (tested); repo identity with several roots and with no `origin` (tested)
Depends: none

Internal task: B1b -> axstack-author -> worktree `readiness-b1b` (stacked on B1a)
Theme: `readiness.js --run` execution guardrails
Size est: medium (runner, process-group control, fixtures)
Acceptance: spec 1, `--help` lists every new flag, 8 (with `--run`: executed pass/fail, missing `build`/`test` with `--run`, lint passing + typecheck failing = fail), 9 (`--run`), 10. Clarifications: isolation counts as available only when a one-time probe of `unshare -rn` plus loopback up succeeds (missing `ip` means `network: not isolated`); the localhost/outbound fixture skips with a reason when isolation is unavailable and never touches the real network; Yarn Berry detected by `__metadata:` in `yarn.lock`, otherwise classic gives `unknown (unsupported package manager)` (tested)
Depends: B1a

Internal task: B1c -> axstack-author -> worktree `readiness-b1c` (stacked on B1b)
Theme: Readiness lens in `axstack-improve`
Size est: small (at most 1,000 prose bytes, ceiling raised by exact delta)
Acceptance: spec 14 (lens part); lens follows the spec B1-lens bullet (run the script, save as `<git-common-dir>/axstack/readiness/<UTC>-<rev>.json`, pass the previous report as `--baseline`, ranked gaps, testing/dev-env gaps to `axstack-verify`, others to `axstack-implement` one PR per repair, `needs admin` to the user, no repair without authority); lens states `--run` only for user-owned or authorized repos and that it is not a sandbox (on-disk credentials, writes outside scratch)
Depends: B1b

Internal task: B2 -> driver -> no PR (run evidence only); repairs become later authorized PRs
Theme: dogfood readiness on axstack
Size est: n/a
Acceptance: spec 13
Depends: B1c merged and released
