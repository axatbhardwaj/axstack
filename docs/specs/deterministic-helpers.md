# Spec: deterministic helpers and repository readiness

Status: Approved rev 4 (2026-10-08, user "approved"; content reviewed at sha256 fbc089c3…53ce3). Store: this repo Markdown file.
Run: `20261008-cli-lessons`. The private run record holds the Align decisions,
adviser receipts and the rev 1 review findings.
Baseline: `d8c29ac`.

## Goal

Agents stop re-deriving mechanical procedure from skill prose on every run.
Deterministic steps move into small Bun scripts shipped inside the skills;
the prose shrinks to judgment, authority and a pointer to the script.
Axstack also gains an on-demand readiness check that tells the user how well a
repository supports autonomous agents, with evidence, and routes gaps to
ordinary repair PRs.

## Facts

- Packaged skills already ship six scripts under `skills/axstack/scripts/`
  (`pick-instance`, `resolve-models`, `pr-digest`, `archive-evidence`,
  `account-usage`, `sync-default`). Exit codes in use: `pick-instance` 2 = hold;
  `pr-digest` 2 = incomplete, 10 = changed since watermark.
- Packaged Markdown is 361,893 bytes against a 361,937-byte ceiling
  (`tests/workflows/prose-size.test.js:142`); the ceiling has been raised about 70 times.
- Effort option IDs are already code (`resolve-models.js:4`) and are restated
  in `skills/axstack/references/t3-runtime.md:91-134`.
- `t3_thread_launch` ignores top-level provider/model and requires
  `modelSelection {instanceId, model, options}`; no skill file mentions
  `modelSelection`. A wrong-model writer was recorded on 2026-10-06 (private run record).
- `unshare -rn` (user and network namespace) works on iobox, iobook and the Debian host running
  this run; it starts with loopback down. On these hosts `/tmp` is tmpfs, so `git clone --local`
  into scratch fails with a cross-device link error; `--no-hardlinks` works.
- Sources: the PAC talk (extract deterministic parts of skills into CLIs) and
  Factory's agent-readiness report (factory.com/news/agent-readiness).

## Decisions (from Align)

| # | Decision | Source |
| --- | --- | --- |
| D1 | Two independent tracks, each a stack in order: A1 → A2 → A3 and B1 → B2. | user Q1 |
| D2 | `merge-facts` and worktree salvage are deferred to a later run. | user Q1, advisers r2 |
| D3 | Readiness writes nothing into the assessed repository's tree or `.git`, except its own reports under `<git-common-dir>/axstack/readiness/`. | user Q2 |
| D4 | Readiness runs declared commands, not only file checks, under the guardrails in B. A scratch clone replaces the detached worktree so the source `.git` stays untouched (D3). | user Q3; driver default |
| D5 | Readiness is a lens of `axstack-improve` backed by `skills/axstack/scripts/readiness.js`; no new skill. | advisers r2 |
| D6 | No levels or 80% rule in v1; per-criterion results grouped by pillar. On demand only. | advisers r2 |
| D7 | Transcript mining stays excluded; user corrections go in the existing `Learnings` field. | Align default |
| D8 | Fleet release verification stays outside the shipped package. | Align default |

## Design

Rung 1: new modules with new interfaces; no change to ownership or data flow.

### Helper rule

One `AGENTS.md` rule for the new scripts in this spec. Existing scripts keep
their current, separately authorized behavior.

1. **Fact and plan helpers** (`dispatch-plan`, `pr-shape`, `readiness` without
   `--run`) are pure: explicit inputs and read-only `git`, `gh` or saved T3 JSON;
   output to stdout or a caller-given path; no state between calls.
2. **Writer helpers** (`run-init`, `readiness --run`) state every side effect
   in `--help` and write only those paths.
3. **All new helpers** report each term as `pass`, `fail`, `unknown` or `n/a` with
   evidence; API, pagination and permission gaps are `unknown`. They can add
   holds but never grant authority. They give no aggregate verdict; summaries
   such as pillar fractions are counts only. They never merge, dispatch, notify, schedule, retry or pick the
   next phase; only an agent calls them, inside its own turn.

Exit codes for new scripts: 0 ok (including failed criteria), 1 error,
2 hold or incomplete, 10 regression against a baseline (readiness only).
Each new script supports `--help`, which lists its flags.

### Track A: extraction

- **A1 `dispatch-plan.js`.** Before building, record the dispatch tool-call
  count and elapsed time from two or three recent runs in the run record.
  Usage:
  `bun scripts/dispatch-plan.js --role <id> --roles <roles.json> --capabilities <path> --picker <picker.json> --kind task|launch`
  prints the exact `delegate_task` `target` + `runtimeMode`, or the
  `t3_thread_launch` `modelSelection` + `runtimeMode`. It spawns
  `resolve-models.js` for model and effort (its exit 1 maps to exit 2 hold, passing
  its stderr through) and takes the instance from the
  picker JSON. `--verify <configuration.json>` compares a
  `t3_thread_configuration` read-back with the plan (provider, picker-chosen
  instance, model, options, runtimeMode) and prints `MATCH` or each mismatched
  field (exit 2). It never re-resolves a recorded role snapshot.
  `t3-runtime.md` replaces its restated mapping and payload rules with
  pointers; the prose-contract tests for that text are retargeted to script tests.
- **A1 also:** the helper rule in `AGENTS.md`, and a test that every
  `scripts/<new>.js --flag` cited in packaged prose appears in that script's `--help`.
- **A2 `run-init.js`.** Usage: `bun scripts/run-init.js --slug <slug> [--date YYYYMMDD]`
  derives `<git-common-dir>/axstack/runs/<date>-<slug>[-n]/`, renders the
  compact template read from `run-record.md` (single source), creates
  `evidence/`, and creates an owned 0700 scratch directory under the system
  temp directory (never under `$HOME`). It prints the paths as JSON. It never
  selects an existing run and exits 1 outside a Git repository. `run-record.md` replaces its path-derivation steps with a pointer.
- **A3 `pr-shape.js`.** Usage: `bun scripts/pr-shape.js --base <ref> --head <ref>`
  prints merge-base, total additions and deletions, renames, binary count, and
  two disclosed buckets: lockfiles (fixed list of lockfile names) and generated
  files (only paths marked `linguist-generated` in `.gitattributes`). Each
  number carries its reproducing command. It never subtracts buckets or judges
  cohesion; formatter-only changes stay a manual disclosure. `pr-shape.md`
  replaces its measuring steps with a pointer.

### Track B: readiness

- **B1 `readiness.js`.** Usage:
  `bun scripts/readiness.js --repo <path> [--rev <sha>] [--baseline <report.json>] [--run] --out <path>`.
  `--out` must resolve under `<git-common-dir>/axstack/readiness/` of the
  assessed repo, with no symlinks; other paths exit 1.
- **Revision basis:** all criteria read the committed revision (`--rev`,
  default `HEAD`) through git object reads, never the working tree. Git reads
  use `--no-optional-locks`. The report header records repo identity (sorted root commit SHAs
  of the revision plus normalized origin URL, empty when there is no `origin`), the
  revision, whether the working tree was dirty, observation time, a separate
  observation time for `gh` settings reads, and script and criteria versions.
- **Output** per criterion: `id`, pillar, status `pass|fail|unknown|n/a`, kind
  `configured|executed`, evidence, reason. A settings gap the user must fix in
  the forge has reason `needs admin`. Pillar fractions summarize as passes over
  criteria that are not n/a (for example `Testing 2/3`); unknown and n/a counts stay visible.
- **Criteria v1** (fixed list in code; JavaScript/TypeScript repositories;
  other stacks report `unknown (unsupported stack)`):
  - Docs: `AGENTS.md` exists; `CLAUDE.md` is a symlink to `AGENTS.md` or contains `@AGENTS.md`.
  - Style: linter config; formatter config; `tsconfig.json` has `strict: true`
    (n/a without TypeScript); pre-commit hook config.
  - Build/Env: lockfile committed; toolchain pin (`.tool-versions`,
    `mise.toml`, `.nvmrc`, `engines`, or devcontainer); `build` script passes (executed).
  - Testing: test files exist; `test` script passes (executed); `lint` or
    `typecheck` script passes (executed); `.agents/skills/verify-*/SKILL.md` present.
  - Governance/Security: a workflow with a `pull_request` trigger has a `run:`
    step invoking the package manager's test script (parsed with `Bun.YAML`);
    default-branch protection or ruleset requires status checks (`gh`);
    Dependabot, Renovate or CodeQL config; no tracked `.env*` or private-key files.
  - Not evaluated in v1: CODEOWNERS, observability, code quality, per-app scope.
- **Declared commands:** only the `package.json` scripts named `build`,
  `test`, `lint` and `typecheck`, run through the package manager its lockfile
  identifies; Yarn classic reports `unknown (unsupported package manager)`.
  Commands mentioned only in prose report `unknown (prose-declared; not run)`.
  No lockfile makes executed criteria `unknown (no lockfile)`; lockfiles of more
  than one package manager make them `unknown (ambiguous lockfile)`; nothing runs.
  Script presence is read from the committed `package.json` first: a missing
  `build` script is `n/a` and a missing `test` script is `fail`, with or without
  `--run` and before lockfile checks. The
  lint/typecheck criterion runs whichever of the two scripts exist: `pass` only
  if all pass, `fail` if any fails or neither exists.
- **Baseline:** a regression is `pass` → `fail` on the same criterion id under
  the same criteria version and repo identity; it exits 10 and names each
  criterion. Other transitions (to `unknown` or `n/a`, added or removed
  criteria) are listed as changes, not regressions. A missing, unreadable,
  foreign-repo or other-version baseline reports `comparison unavailable` and exits 2;
  the report is still written, without a comparison.
- **`--run` guardrails.** `--run` executes repository code. It is not a
  sandbox: the networked install can still read on-disk credentials such as
  `~/.config/op` or `~/.ssh`. The lens therefore passes it only for
  repositories the user owns or has authorized, recorded in the run record.
  - Clones with `git clone --no-hardlinks --no-checkout` into an owned 0700 scratch
    directory outside `$HOME`, then checks out the revision. Every git call
    sets `core.hooksPath=/dev/null`. The source checkout and its `.git` are untouched.
  - Every command it starts, the install and each declared script, runs with
    an allowlisted environment (`PATH`, `LANG`, `CI=1`, `HOME` and `TMPDIR` set
    to scratch), closed stdin, a per-command timeout, and a capped log.
  - Installs dependencies once with the lockfile's frozen install
    (`bun install --frozen-lockfile`, `npm ci`, `pnpm install --frozen-lockfile`,
    `yarn install --immutable`), recorded as its own step. Network is allowed
    only for this step. An install failure makes executed criteria `unknown (install failed)`.
  - Declared scripts run without network when `unshare -rn` is available,
    with loopback brought up inside the namespace first; otherwise the header records `network: not isolated`.
  - On timeout, kills the whole process group. Removes the scratch clone in
    every outcome; a failed removal is reported with its path.
  - Records argv, exit code, duration and log path per command in the
    report's evidence folder next to `--out`: `--out` must end in `.json`, and
    the folder is that path without the suffix.
  - Without `--run`, executed criteria report `unknown (not run)`.
- **B1 lens:** `axstack-improve` gains a short Readiness lens: run the script,
  save the report as `<git-common-dir>/axstack/readiness/<UTC>-<rev>.json`,
  pass the previous report explicitly as `--baseline`, and return ranked gaps.
  Testing and dev-environment gaps route to `axstack-verify`; others to
  `axstack-implement`, one PR per coherent repair. `needs admin` gaps go to
  the user. No repair without authority.
- **B2 dogfood:** run on axstack with `--run`, save the report under
  `.git/axstack/readiness/`, list the gaps in the run record, and propose
  repair PRs for the gaps the user authorizes.

## Acceptance

1. Each new script has `bun:test` behavior tests with fixtures, written red first.
2. A1: before building, the run record holds the dispatch baseline measurement.
3. A1: for each provider in the fixture catalog, `dispatch-plan` output equals
   the hand-built payload, and launch output uses `modelSelection`. A
   picker-selected sibling instance is accepted. Wrong effort, model,
   runtimeMode or instance, a missing read-back field, and an unavailable role
   each give exit 2 with the field named.
4. A1: the prose-interface test fails when a cited flag is removed from a
   script's `--help`.
5. A1: `t3-runtime.md` no longer restates effort IDs or payload assembly; its
   retargeted tests pass; the prose-size ceiling is lowered in that PR.
6. A2: paths are under the git common dir; slug validation rejects separators;
   a collision gets a suffix; it exits 1 outside a Git repository; the scratch dir is 0700 and outside `$HOME`; the
   rendered template matches the `run-record.md` section.
7. A3: numbers match `git diff -M --numstat` on fixtures with renames,
   binaries, unusual filenames, a stacked base, lockfiles and
   `linguist-generated` paths.
8. B1: on fixture repos, each criterion yields its expected status, including
   n/a without TypeScript, `unknown (unsupported stack)` for a non-JS repo,
   `unknown (no lockfile)`, `unknown (ambiguous lockfile)`, a missing `build`
   (n/a) and `test` (fail) script with and without `--run`, and lint passing
   with typecheck failing (fail).
9. B1: after a static run and after a `--run` run, the source repo's
   `git status --porcelain --ignored`, HEAD, index and a byte manifest of
   tracked, untracked and ignored files are unchanged; only the `--out`
   report and its evidence folder are new.
10. B1 `--run` fixtures: a hanging script ends as `fail (timeout)` with no
    surviving process; a hanging `postinstall` ends the install as `unknown
    (install failed)` with no surviving process; a prose-only command never
    runs; an env-printing script and an env-printing `postinstall` show no
    variable outside the allowlist and a scratch `HOME`; the clone works from a
    linked worktree into scratch on a filesystem with a different device
    (skipped with a reason when the host has none); a test script that serves
    and connects on localhost passes under isolation while an outbound
    connection fails; scratch is 0700 and
    outside `$HOME`; a fixture with a dependency
    installs from its lockfile; a failing install gives `unknown (install
    failed)`; scratch is removed after success, timeout and error; argv, exit
    code, duration and log path are recorded.
11. B1: a `gh` permission gap gives `unknown`; a missing protection gives
    `fail` with reason `needs admin`.
12. B1: a pass → fail regression exits 10 and names the criterion; pass →
    unknown is a change with exit 0; missing, foreign-repo and other-version
    baselines exit 2 with `comparison unavailable`; `--out` outside the
    readiness folder exits 1; a `comparison unavailable` run still writes its report.
13. B2: a saved axstack report exists under `.git/axstack/readiness/` and its
    gaps are listed in the run record.
14. Extraction PRs A1–A3 each delete the prose they replace and do not grow
    packaged prose. The B1 lens adds at most 1,000 bytes, with the ceiling
    raised by its exact delta.

## Exclusions

- `merge-facts`, worktree salvage or retirement helpers (later run).
- Changes to the six existing scripts.
- Readiness levels, scores, waivers, per-app scope, non-JS stacks, scheduled
  runs, CI integration, dashboards, and pointing the audit environment lens at readiness.
- Any file written into an assessed repository's tree or `.git` other than the readiness reports.
- Running commands other than the four declared script names and the frozen
  install; network outside the install step where isolation is available;
  forge settings mutation.
- Transcript mining; a new run-record field.
- Fleet release verification inside `skills/`.
- Changes to the watch merge predicate or review policy.

## Open evidence

- `unshare -rn` availability on io and axat-vps is unverified; without
  it, `--run` reports `network: not isolated`.
- Readiness coverage beyond JavaScript/TypeScript is not attempted.
