# Move Axstack to the "All Code Is Slop" meta — r14, draft

Authoritative location: `docs/specs/slop-meta.md` (repository Markdown, axatbhardwaj/axstack). Base revision: `b90d15313fbd9c6198806e6a178965e29a4effc8`.
Run: `20261115-slop-meta-improve`. Align read-back: run dir `align-readback.md` (Q1–Q12).

## Decision brief

**Problem.** Axstack fixes most recurring agent failures by adding prose. In the
month to 2026-11-15, about 60% of 122 fix commits changed only prose or prose
tests, at most two removed a failure class, skill prose grew 63% (422 KB to
689 KB, ceiling raised 7 times, 1.5% headroom left), and 67% of axat-vps tokens
went to orchestration against 3.9% to verification. Fifteen failure classes were
verified against 5,665 threads (`stage-a-summary.md`): nine confirmed, six partly.

**Why it matters.** Prose cannot be enforced, so the same failures recur:
duplicate and idle review passes, scratch strays, host-clone writes, stale PR
facts and unproven live behaviour. The talk's meta puts constraints in code and
structure first, checks second, verification third and prose last, and fixes
the inner loop before adding automation.

**Change.** Four waves. W1 repairs bad defaults and turns on static checks. W2
makes the repository the source of agent inputs and freezes prose growth. W3
makes verification real: machine receipts, a hardened review sandbox with full
toolchains that reviewers actually use, and an exact-byte image check. W4
reduces orchestration cost with in-turn fact helpers, admitted only after
re-measuring W1–W3.

**Before / after (one review pass).** Before: every 30-minute tick starts a
model thread that reconstructs "is anything new, is an owner alive, is the head
stable" from prose; the reviewer reads code because the host cannot run tests,
and writes a free-text receipt. After: the pass collects explicit inputs and runs
fact helpers before loading the full workflow; a stable-head admission check runs
before dispatch; the reviewer runs the PR's tests inside the sandbox; a host-side
capture tool writes the receipt and an inspector checks it per limitation.

**Included.** All IDs in Execution requirements (W1-*, W2-*, W3-*, W4-*).
**Excluded.** A rules ledger; a brief renderer; one helper per failure class;
reviewer or adviser seat cuts before cost data; a 70% verification-token target;
a comment ban; artifacts-only review; TLA+ or other formal methods in this run;
any new Axstack timer, daemon, runtime database, state machine or pre-model
script; migrating legacy helpers without a cost incident; Docker as a dependency
of anything except sandbox review execution; Linear.

**Risks and trade-offs.**
- W3-4 runs untrusted PR code on axat-vps, which also hosts Executor, Hermes and
  the CLIProxy hub, on rootful Docker with host listeners and tailnet access.
  W3-4's invariants are security scope (A1); any failed or unknown invariant
  prevents untrusted execution. Residual shared-kernel escape risk is accepted
  only as recorded in W3-4.
- W2-2 freezes prose ceilings, so a PR may block until it moves text into a check.
- W2-1 can surface live schedule clauses the repository would change or drop;
  each such change is a user hold (A2).
- R5 live runs cost tokens and are non-deterministic; they report, never block.
- W2-6 changes the user's global instructions fleet-wide through Haoshoku.
- W3-4's egress proxy cannot see inside HTTPS, so a malicious PR could publish
  data to an allowlisted registry. The sandbox holds only the PR repository's
  tracked files and dependencies, no host secrets, so the exposure is that
  repository's own code; this is an accepted residual risk.
- If W3-4's launcher dies or fails to clean up mid-run, its containers keep
  running until the next successful sandbox run or review-manager pass `reap`
  removes them: normally about 30 minutes while passes are healthy, with no
  upper bound if passes are missed, held or fail. Docker- and kernel-enforced
  CPU, memory, PID, storage and retained-log caps still bound them. Signal
  cleanup is best effort only.
- W3-4's launcher adds and removes packet-filter rules on axat-vps for each run;
  a launcher bug could affect host networking, bounded by the CI and ruleset checks in W3-4.
- Unverified: live schedule prompt bytes, lint/typecheck baseline, Swift on
  Linux, reviewed repositories' toolchains and private packages, Docker
  internal-network reachability on axat-vps, whether each pinned proxy and
  sidecar image starts under the non-root policy, whether a `ufw` reload leaves
  the launcher's table intact, Docker mounting a launcher-attached loop device
  as a `local` volume on axat-vps, and on-demand loop-device allocation there
  (6 of 8 preallocated devices in use; `max_loop` reads 8), T3 feasibility of
  W4-5 asks.

**Decisions needed from the user.** Approve this revision. Approval also accepts
these items that go beyond the Align read-back:
1. New user holds: live schedule clause changes or drops (W2-1); the prose
   ceiling files (W2-2); sandbox merge and activation (A1, W3-4); any change
   under the whole sandbox directory, including the host-execution clause, with
   a `pr-shape` hold term `sandbox-path` that the merge step treats as a user
   hold (W3-4c); the W3-4b adoption PR as its own user merge; seat changes (W4-6).
2. Deploying the packaged schedule prompts on axat-vps without a further
   prompt (A3, W2-1), within its deployment boundary; after W3-4 activation,
   redeploying them with the no-install and symlink clauses replaced and a
   `reap` step at review-manager pass start (W3-4b).
3. AGENTS.md amendments: helper modes (R2), the prose-ceiling user-merge rule
   (W2-2), the sandbox-containment user-merge rule (W3-4), and the Docker and
   Playwright exceptions (W3-4, W3-6).
4. D1: no numeric cap on new scripts; R3 justification instead.
5. Five T3 platform asks (W4-5) and the ≥90% sandbox-review target (measures).
6. A release and five-host reinstall after each wave that changes shipped skills (R6).
7. Q2 scope narrowed to schedules from the three packaged prompt files, compared
   against a fresh export rather than a saved one (W2-1).
8. Synthetic containment probes before every sandbox run, holding on any failure
   or unknown, and the launcher's own per-run packet-filter rules on axat-vps
   scoped to its own per-run networks (W3-4); the rollback hold when the global
   rule has changed (W2-6).
9. A host-execution ban for every peer-mode review, in any repository: its PR
   code runs only through the sandbox launcher; a held sandbox means review from
   code and CI. Axstack's own authored reviews keep their existing local checks (W3-4b).
10. Sandbox limits beyond Align's wording: run mode only on axat-vps; at most 2
    concurrent runs (more are held, not queued silently); no published ports,
    extra hosts or host environment; no host-side submodule or LFS fetch, with
    public submodules built into the image as pinned dependencies; wall-time
    enforced by the live launcher from the host; stale runs of dead launchers
    reaped before each run and at each review-manager pass start; the
    launcher's per-run dependency image file, the loop device it attaches for
    that file, and the labelled Docker volume on axat-vps, with at least one
    loop device kept free for other host users; a recorded host memory and disk budget for 2 concurrent runs; accepted residual risks:
    registry exfiltration, and a dead launcher's containers running within
    Docker- and kernel-enforced caps until the next successful run or pass
    reaps them, with no upper bound if passes fail (W3-4).
11. The pre-merge verification run uses the exact head of an already-merged
    defi-com PR instead of an open one (W3-4).

## Decisions

Settled in Align:

| ID | Decision | Binds |
|---|---|---|
| Q1 | Keep the ban on pre-model prechecks and watchdogs (`AGENTS.md:19-20`, `automations.md:475-477`); use in-turn helpers; draft T3 asks for the user to file | W4-2, W4-5 |
| Q2 | Repository is the source of truth for Axstack-packaged schedule prompts, with a drift check | W2-1 |
| Q3 | Freeze prose ceilings; checks replace prose; any raise needs explicit user approval | W2-2 |
| Q4 | Provision all review toolchains | W3-4 |
| Q5 | One capped, recorded live T3 run per release touching affected skills; reports, never blocks | R5 |
| Q6 | Correction rule: make it a check, test or code change the same day; the rule line points to it; prose only for authority or judgement | W2-6 |
| Q7 | Toolchains run in a per-review Docker sandbox on axat-vps with no host secrets | W3-4 |
| Q8 | Playwright exact-byte image check replaces `missingImages`; unobservable means unknown | W3-6 |
| Q9 | Keep the 30-minute review-manager cadence and record it in the repository | W2-1 |
| Q10 | Full autopilot after approval within the watch predicate; stops for `ci.yml`/production config, security/auth/secrets paths and user-owned decisions | A1, A2 |
| Q11 | Axstack ships the sandbox (Bun helper + Dockerfile in the packaged skill tree, tested, installed like other helpers) | W3-4 |
| Q12 | Apply only the W2-6 global correction-rule line through Haoshoku profile sync | W2-6 |

Driver choice (accepted by approving this revision):

| ID | Choice | Binds |
|---|---|---|
| D1 | No numeric cap on new scripts; R3 justification required instead | R3 |

## Authority and holds

- **A1 Security scope.** Sandbox isolation, egress enforcement, launch policy and
  host security configuration are security scope. The order is fixed in W3-4:
  build and verify with synthetic code, then one real exact-head PR run as
  verification, then stop at merge-ready for the user; live activation (W3-4b)
  follows the user's merge. A failed or unknown containment invariant prevents
  executing untrusted code.
- **A2 User holds.** Besides the watch predicate's own holds, execution stops for
  the user at:
  - `ci.yml` and other production config (W1-5b);
  - security, auth and secrets paths, including A1;
  - any change or drop of a live schedule clause beyond verbatim import (W2-1),
    including retiring the PR-link ban (W2-7);
  - any change to the prose ceiling files (W2-2);
  - any change under the sandbox directory or to the host-execution clause, and
    the W3-4b adoption PR (W3-4, W3-4b);
  - any seat change (W4-6).
  A hold in one outcome holds only that outcome and its consumers; independent
  work continues.
- **A3 Authorized live mutations.** Deploying the packaged schedule prompts on
  axat-vps (W2-1), the one-line Haoshoku sync (W2-6), building the sandbox image
  and running its verification on axat-vps (W3-4), the launcher's own per-run
  packet-filter rules on axat-vps scoped to its own per-run networks (W3-4), the
  launcher's per-run dependency image file, the loop device it attaches for that
  file, and the labelled Docker volume on axat-vps (W3-4), and releases (R6) need no
  further permission, but follow their deployment boundaries.
- **A4 Defaults.** Own PRs auto-merge under the watch predicate, except
  migrations, auth, secrets, money paths and production config; GitHub-only
  planning; single-file ~200-line semantic commits; driver never edits candidate source.

## Cross-cutting rules

- **R1 Replace, not add.** A PR that adds a check, helper or structure for a rule
  deletes the prose and prose-pinning tests it replaces in the same PR, once the
  replacement and a real consumer cover the obligation. Prose may remain only for
  authority or judgement, stated in the PR body.
- **R2 Helper modes.** New surfaces follow the AGENTS.md helper contract with two
  modes. *Fact/plan modes* are read-only and stateless and report per-term
  pass/fail/unknown/n/a with evidence; they grant no authority and no aggregate
  verdict. *Writer modes* (scratch execution W2-4, capture W3-1, sandbox W3-4)
  declare every process, filesystem, container, network and cleanup effect in
  `--help`. No mode dispatches, schedules, retries, merges or picks a phase. New
  helpers exit 0 measured, 1 error, 2 incomplete or hold, with child-command
  status stored separately; existing protocols are preserved (readiness exit 10,
  `pr-digest.js` changed exit 10). The first helper PR (W1-7) updates AGENTS.md's
  named-helper list once to cover new helpers, keeping the existing-scripts exception.
- **R3 Extend before adding.** Prefer extending `pr-shape.js`, `readiness*.js`
  and `pr-digest.js`. A new script states in its PR why extension is not possible.
- **R4 TDD and verification.** Behaviour changes run a meaningful red first;
  structure-preserving extractions run the same characterization green before
  and after. Every helper PR runs `verify-axstack`, including pack, install into a
  temporary home and invocation from the installed location. W1-2, W1-7 and every
  later helper PR consume W1-1 merged, so no PR runs the old `/dev/null` recipe.
- **R5 Live run per release (Q5).** Starting with the first release in this run
  that changes affected skills, run one live T3 scenario against the installed
  released version, using existing manual recipes until W3 tooling exists. Record
  before launch: scenario, version, host, numeric token and time limits, one
  attempt. Record after: requested and effective settings, terminal outcome,
  stale-result control. Failure, unavailability or budget exhaustion is recorded
  in the release record and never blocks publication.
- **R6 Release.** Each wave that changes shipped skills or `src/` releases and
  reinstalls on io, iobook, iobox, iosatellite and axat-vps, verifying timers and
  drop-ins; iosatellite provisioning and closed-lid state are reported separately.
  After W2-1, the axat-vps release check also runs the W2-1 drift check on a fresh export.
- **R7 Dependencies by interface.** Each outcome lists the interfaces it consumes;
  only those gate it. A hold on one producer does not hold unrelated work.

## Execution requirements

### Wave 1 — repair defaults and turn on static checks

- **W1-1 Owned git config.** Replace `GIT_CONFIG_GLOBAL=/dev/null` in
  `.agents/skills/verify-axstack/SKILL.md:57` and `tests/installer/archify-fixture.js:7`
  with an owned regular file under the test's private temp root, and correct the
  "never host root" sentence at `.agents/skills/verify-axstack/SKILL.md:43-44`
  (agents on axat-vps run as uid 0). Add a scan test that rejects active shell and
  JavaScript assignments of `GIT_CONFIG_GLOBAL` to `/dev/null` in code, config
  and recipes, excluding `docs/` and isolated negative fixtures. Acceptance: scan
  red on base, green after; a synthetic global git write lands only in the
  private file; `/dev/null` is unchanged.
- **W1-2 Token gate success line.** Consumes: W1-1 merged. `check-staged-file-tokens.js`
  prints one stdout success line. Acceptance: a test asserts the line; failure
  output unchanged. The line is not counted as execution proof.
- **W1-3 home-guard cwd.** `tests/installer/home-guard.test.js` runs its CLI calls
  with a fixture cwd; remove the `.gitignore` entries hiding `.bun/` and
  `relative/`. Acceptance: `git status --porcelain --ignored` is identical before
  and after the suite.
- **W1-4 Driver-bound IDs.** `skills/axstack-review/references/review-receipt.md`
  stops asking workers for T3 task, thread or run IDs; the driver records them
  from the dispatch return. Acceptance: a test fails if the template asks workers
  for those IDs; the replaced prose is deleted (R1).
- **W1-5a Lint and typecheck baseline.** Fix current lint and type errors, widen
  `jsconfig.json` to `skills/axstack/scripts`, and record any remaining exclusion
  by file, rule and reason. Auto-merges. Acceptance: `bun run lint` and
  `bun run typecheck` pass locally; new or worsened violations in scope fail.
- **W1-5b CI static checks.** `.github/workflows/ci.yml` installs dev dependencies
  from the frozen lockfile and runs `lint` and `typecheck`. Hold: production
  config, merge-ready for the user (A2). Blocks no other outcome. Acceptance: a
  seeded lint violation and a seeded type error in a `skills/axstack/scripts`
  file each fail CI at the tested head and pass after removal.
- **W1-6 Prose-contract harness.** Add a fixture suite for
  `tests/workflows/prose-contract.js` reproducing known false reds and survivors
  (e.g. `/settled/i` matching "unsettled"), fix them, fix `pr-proof.test.js`, and
  replace the six local `checkRule` copies with the shared one. Acceptance:
  historic survivor fixtures red before, green after; legitimate rewordings pass.
- **W1-7 Cost baseline.** Consumes: W1-1 merged. Add read-only `usage-split.js`
  (R2 fact mode) and the R2 AGENTS.md amendment. It records interval, ten merged
  PR identities, usage snapshot digest, role mapping, cache/input/output
  accounting, known-rate proxy versus billed cost and per-PR attribution coverage;
  shared or unattributed usage is reported separately and missing values as
  unknown. Acceptance: a sanitized fixture pins numeric expected results and
  tolerance before implementation; the run's token-split table is reproduced
  within that tolerance.

### Wave 2 — repository owns inputs; freeze prose

- **W2-1 Canonical schedule prompts (Q2, Q9).** Consumes: nothing.
  1. Develop against synthetic committed fixtures and temporary homes; live
     exports stay in the run directory and are never committed.
  2. Scope: schedules created from the three packaged prompt files
     (`skills/axstack/references/review-manager-prompt.md`, `pr-triage-nightly.md`,
     `test-audit-weekly.md`). Run-watch schedules and user-owned schedules are
     out of scope. Take a read-only export on axat-vps; record schedule IDs,
     prompt, cadence, enabled state, export time and hash.
  3. Import live-only clauses verbatim into the packaged prompt files after a
     private-name check. Any change or drop of a live clause is a user hold (A2).
  4. Write a policy artifact recording, per imported clause, the source export
     hash and, for review admission, the head-age threshold, clock semantics and
     pending-check treatment, separately for admission and submission. If no
     authoritative policy exists, the artifact says so and only the dependent
     policy (W4-4) holds.
  5. Set the review-manager cadence to 30 minutes at every site:
     `automations.md:53`, `lifecycle.md:196`, `README.md:124-125`,
     `docs/host-operations.md:46-47` and `:102`,
     `tests/workflows/pr-managers-lifecycle.test.js:51`,
     `tests/workflows/isolated-manager-passes.test.js:87-88`,
     `tests/workflows/pr-managers.test.js:175-183` and
     `tests/workflows/tracking.test.js:27`. Watch backstops that use the same
     number are unchanged. A test fails on any remaining hourly review-manager
     statement in shipped files.
  6. Add a drift check comparing a fresh export with packaged bytes plus declared
     host bindings; a stale, incomplete or unavailable export reports unknown,
     never pass.
  7. Deploy: re-read immediately before mutation (a concurrent difference holds),
     apply only reviewed prompt and cadence changes, preserve unrelated fields,
     keep an owned before-snapshot and rollback, read back effective state.
  Acceptance: drift check fails on an edited prompt, a cadence mismatch and an
  unavailable export; the policy artifact exists with every imported clause;
  post-deploy read-back passes.
- **W2-2 Prose freeze (Q3).** Move the ceilings into
  `tests/workflows/prose-budget.json` frozen at the base values (700,000
  aggregate bytes, 45,000 always-loaded bytes), preserving the measured
  populations and vendored exclusions. `prose-size.test.js` reads the file; delete
  the round-step raise rule and changelog; keep "contract text is never trimmed
  to fit". Repository AGENTS.md gains one operating rule: in this repository a PR
  that changes `tests/workflows/prose-budget.json` or
  `tests/workflows/prose-size.test.js` stops at merge-ready for the user.
  Acceptance: the test fails above the ceiling; a test fails if the raise rule
  returns; a test reading AGENTS.md fails if the merge-ready rule is removed or inverted.
- **W2-3 Pointers replace duplicated prose.** Replace the provider-binding prose
  at `skills/axstack/references/t3-runtime.md:40-41` with a pointer to
  `resolve-models.js`, plus any other passage listed in the PR where code owns the
  rule. Acceptance: a test asserts each listed pointer resolves and the replaced
  text is absent; helper tests green; aggregate bytes fall.
- **W2-4 Scratch wrapper (R2 writer).** Creates a private owned 0700 root
  outside the real HOME when TMPDIR is absent or unsafe, writes an owner stamp,
  and runs a command with cwd and TMPDIR set to declared children. `plan` reads
  only caller-declared roots, reports ownership and unknowns, and never deletes.
  It is not filesystem containment; absolute paths and HOME remain the caller's
  responsibility, and `--help` says so. Replace the TMPDIR recipe prose and its
  pinning tests (R1). Acceptance: a command honouring cwd/TMPDIR leaves the
  outside inventory unchanged; unsafe and symlinked roots are rejected.
- **W2-5 Rendered PR proof.** `pr-shape.js` gains a proof mode rendering the PR
  Proof block (files, lines, commits, head, base) and checking a body against the
  live head. Acceptance: stale head, changed base or edited counts fail.
- **W2-6 Correction rule (Q6, Q12).**
  - `axstack-audit` learning candidates propose a code, structure or check fix
    for a recurring mechanical class before an instruction change; AGENTS.md
    states the same default. `axstack-correct` is already code-first and is unchanged.
  - The user's global rule becomes exactly: "When I correct the same thing
    twice, make it a check, test or code change that day; the rule line here
    points to that check. Keep prose only for authority or judgement."
  - Develop against fixtures and temporary homes. Deploy through the Haoshoku
    profile source as a scoped one-line patch: record source revision and
    destinations; immediately before writing, compare the source and each
    destination with the reviewed before-state; apply only the patch to the
    verified current state; an unexpected difference or unreachable host holds
    that destination only; keep a before-snapshot as evidence; read back.
  - Rollback reverses only this run's rule patch after a fresh read, preserving
    unrelated current bytes and the installer-owned block. If the rule no longer
    matches the value this run applied, rollback holds that destination; it never
    restores a whole-profile snapshot over current edits.
  Acceptance: audit test fails on inversion; a fixture that changes an unrelated
  line after planning makes deployment refuse the stale write and keep that
  line; a fixture that adds an unrelated line after deployment keeps it through
  rollback, and a changed rule makes rollback refuse; every reached host has the
  new line, no other diff and an unchanged installer-owned routing block.
- **W2-7 Retired terms.** Generalize `workflow-retirement.test.js` to read one
  retired-terms data file. Retire the "read-only symlink" advice under the Align
  W2 scope. Retire the PR-link ban wording only after its W2-1 user hold is
  answered. Redeploy under W2-1 step 7 after any retirement. Acceptance: test
  fails when a retired term appears in shipped files.

### Wave 3 — verification reach

- **W3-1 Capture CLI (R2 writer).** Consumes: none. Extract command capture from
  `readiness-run.js` (`runCommand`, line 21) into a shared module plus a
  `check-run.js` adapter. Versioned receipt schema binds repository or PR,
  requested head and base, source identity before and after execution, argv,
  cwd, tool version and sandbox image digest where used. Dirty source is
  rejected unless an exact snapshot is declared. Receipts are written outside any
  untrusted writable mount. Captured exit is distinct from proof sufficiency:
  silence is valid; timeout, spawn failure or truncation cannot close a term
  needing the missing evidence. Acceptance: readiness characterization identical
  before and after; negative fixtures for changed head, base or source, wrong
  repository, missing identity, altered log, timeout and interruption.
- **W3-2 Evidence inspector (R2 fact).** Consumes: W3-1 schema. Emits one term per
  stable limitation ID with accepted proof kinds and fail/unknown rules; it
  cannot grant review or merge authority. Acceptance: sanitized PRs #643 and #645
  fail as regressions; #644 and #646 are evaluated as unchanged holdouts with
  expected per-item results after the rules are fixed; sibling closure cannot
  close another item.
- **W3-3 Wire receipts into review.** Consumes: W3-1, W3-2. Review and
  verification templates cite capture receipts instead of hand-written exits and
  hashes; delete the replaced prose (R1). Acceptance: template tests; one real
  review completes end to end with the inspector passing.
- **W3-4 Review sandbox (Q4, Q7, Q11; security scope A1).** Consumes: W3-1.
  - *Inventory first.* A read-only inventory of the reviewed repositories:
    toolchain and version, registries, private packages, required services. The
    required toolchain inventory, image contents and registry allowlist are
    frozen from it before any smoke test. Every required entry must pass its
    smoke test; a failed or unavailable required entry keeps W3-4 incomplete as
    an open provisioning obligation. Only the agreed Swift-on-Linux limitation,
    private-package restrictions and per-PR non-registry downloads may remain as
    recorded limitations.
  - *Packaging.* Bun launcher with no npm runtime dependencies and a Dockerfile
    in the packaged skill tree with relative asset lookup. Docker is an explicit
    prerequisite only for sandbox review execution on axat-vps; install, check
    and all other helpers work without Docker. The same PR adds the Docker
    exception to AGENTS.md Interfaces, and one AGENTS.md operating rule naming
    the sandbox directory in the packaged skill tree, which holds every launcher
    source file (argv construction, source export, mounts, environment, cleanup),
    the registry allowlist and proxy configuration, sidecar image list, launch
    policy, Dockerfile, probe set and per-run probe gate, together with their
    tests and the W3-4b host-execution clause: a PR changing any of them stops at
    merge-ready for the user; a test fails if that rule is removed or inverted or
    if the named directory does not exist. The host-execution clause lives as a
    file inside the sandbox directory and is included by reference from the
    review brief and packaged prompt. The `sandbox-path` hold term is delivered
    by W3-4c. `plan` mode prints the exact `docker` argv and every packet-filter
    rule the run would install, and both are unit-tested in CI, including a test
    that every launcher-owned rule matches only that run's own interfaces, so no
    rule can match other host traffic. Base, proxy and sidecar images are pinned
    by digest.
  - *Per-run containment proof.* Before every run, the launcher runs the
    synthetic denial probes against that run's own containers and network
    profiles; untrusted code runs only after all pass. No probe result is reused
    across runs. A failed, erroring or unknown probe holds the run. Probe targets
    are enumerated at run time, not read from a stored list: every listening
    socket and address of axat-vps, each bridge gateway, every container address
    on other Docker networks and the tailnet peers, plus fixed targets (arbitrary
    HTTPS, direct IP, link-local metadata, and resolution of an external name and
    a tailnet name over UDP and TCP). A failed or incomplete enumeration is
    unknown and holds the run. Probe results are recorded in the run's host-side receipt.
  - *Concurrency.* At most 2 concurrent sandbox runs; a further request exits 2
    as a hold and the review records the limitation, so per-container limits
    bound the host total.
  - *Host binding.* Run mode executes only on the approved host, axat-vps,
    checked against a fixed host identity kept in the sandbox directory. On any
    other host run mode exits 2 before it creates any container, network, volume,
    image or packet-filter rule, and the review records the W3-4b limitation.
    `plan` mode stays available everywhere. Adding a host is a change under the
    sandbox directory and a new user decision.
  - *Source.* A host-side owned export of the tracked files at the requested
    commit, excluding `.git`, ignored and untracked files, dependency trees,
    sockets and special files, never following links outside the export, and
    never fetching submodules or LFS objects on the host. Public submodules are
    inventoried dependencies built into the image at pinned commits, fetched as
    content only without running any of their scripts; a private
    submodule or a PR that changes a submodule link is a recorded limitation. Only
    this export is mounted read-only; tests run in a private writable copy.
  - *Launch policy (fixed by the launcher, no caller override).* Non-root user,
    read-only root filesystem with owned writable tmpfs, all capabilities
    dropped, no-new-privileges, default seccomp, isolated PID namespace; no
    privileged mode, host namespaces, devices, Docker socket, host home,
    `~/.config`, `~/.ssh`, 1Password, CLIProxy, Executor or Hermes files,
    published ports, extra hosts, or any host environment: container variables
    are literal values from a fixed list in the launcher, never passed through
    from the host and never named by the caller or the PR. Effective policy and image digest are
    recorded. Sidecars follow the same policy.
  - *Network profiles.* Fetch: dependencies install on an internal Docker network
    whose only egress is an allowlisting proxy with the inventoried registry
    allowlist. The proxy is the only container attached to a network with a
    route off the host. Host packet-filter rules, independent of the proxy
    process, restrict that egress network to public destinations: loopback,
    RFC 1918, 100.64.0.0/10, link-local, ULA and every address of axat-vps are
    dropped for IPv4 and IPv6. The host accepts no new connection from any
    per-run network (fetch, service or egress), and nothing is forwarded from the
    fetch or service network to any destination outside its own subnet. The
    launcher owns these rules in one launcher-owned table whose every rule is
    matched to that run's own network interfaces, installs them before any
    container starts on those networks, confirms they are still present at
    cleanup, removes them only after every owned container is confirmed gone,
    declares them in `--help` and changes no other firewall state. The proxy uses
    a fixed public resolver, not the host's tailnet resolver. The per-run probes
    also run from the proxy's network position with the proxy process bypassed.
    The proxy carries HTTPS to allowlisted registries as opaque tunnels and
    cannot restrict methods inside them; publishing data to an allowlisted
    registry is the accepted residual risk stated in the brief.
    Wall-time is enforced from the host, with no host timer or daemon: the live
    launcher process stops and removes every owned container of its run
    (workload, proxy and sidecars) when the wall-time limit plus a grace period
    passes. Every container keeps the non-root, all-capabilities-dropped launch
    policy above; no in-container init changes user or capabilities. A run is
    live while its launcher process (recorded by PID and start time in the run
    label) exists; an unreadable liveness record is treated as live and holds
    the next run. Before each run, and before counting concurrent runs, the
    launcher removes owned containers, networks, volumes and rules of earlier
    runs whose launcher is not live; it never touches a live concurrent run. A
    `reap` writer mode does only that reaping, matching objects by the launcher's
    own label only (never other containers such as earlier `axstack-rev-pr*`
    ones), and is host-bound like run mode; the review-manager pass runs it at
    its start (W3-4b). If the launcher dies or fails to clean up, its containers
    keep running until the next successful run or `reap` removes them: normally
    about one pass interval while passes are healthy, but a missed, held or
    failed pass extends it with no upper bound. The Docker- and kernel-enforced
    limits below still bound them, and this gap is an accepted residual risk
    stated in the brief. The launcher attempts cleanup on SIGTERM, SIGINT and
    SIGHUP and sets wall-time plus grace below the calling tool's command
    timeout; this is the best-effort graceful path only, because a harness may
    background a timed-out command without signalling it or follow SIGTERM with
    an uncatchable kill within seconds.
    The proxy checks every resolved destination and redirect over IPv4 and IPv6.
    Dependencies are fetched into a private per-run dependency volume: the
    launcher creates a fixed-size filesystem image file in its own owned
    directory, named after the run label, attaches it to a loop device itself
    (Docker's `local` driver does not attach loop devices), and registers that
    device as a labelled Docker `local` volume of type ext4 mounted
    `nosuid,nodev`, so Docker performs the mount, the kernel enforces its size,
    its contents persist from the fetch container to the test container (which
    mounts it read-only), and the launcher itself mounts nothing on the host.
    Before attaching, the launcher checks that at least one further loop device
    stays free or allocatable after its own; otherwise the run holds. Before the
    fetch or test command starts, a launcher-fixed check in each container
    confirms that the dependency directory is that capped filesystem; otherwise
    the run holds. Cleanup and `reap` remove the owned containers, then the
    labelled volume, then detach only a loop device whose backing file is that
    run's image file in the owned directory, then delete that image file; they
    never detach any other loop device or remove a file the launcher did not
    create. A failed attach or a leftover owned loop device holds further runs. Test: `--network none`; when a declared sidecar is needed, the test
    container joins only a per-run internal service network with no proxy
    attachment. Sidecar images come from a fixed list in the repository pinned by
    digest; a PR never names an image, Dockerfile or compose file. A needed
    non-registry download or private credential is reported as a limitation,
    never answered with wider egress or injected credentials.
  - *Limits and cleanup.* Finite CPU, memory, PID, writable-storage and output
    limits for every container, each enforced by Docker or the kernel, never by
    the launcher process: CPU, memory and PIDs through cgroup flags, with
    `--memory-swap` equal to `--memory` so no swap is used; the private writable copy as a size-capped tmpfs
    inside the memory limit; the dependency volume as the fixed-size image file
    above; every `VOLUME` an image declares (for example a database sidecar's
    data directory) covered by a size-capped tmpfs so nothing lands on host disk
    uncapped; retained output through a per-container `local` log driver with a
    fixed max size and one file, which caps stored logs by rotation but does
    not stop the container; restart policy `no`. Wall-time is enforced by the
    live launcher as above. The `plan` test asserts that the summed caps of 2
    concurrent runs fit a recorded host memory and disk budget for axat-vps. Owned containers, networks, caches and
    volumes are removed on success, failure, timeout or cancellation; cleanup
    uncertainty holds further runs; unrelated Docker state is never pruned.
  - *Receipt.* The host-side W3-1 capture writes the receipt; nothing inside a
    container can write it.
  - *Toolchains.* Node + pnpm, Go, Python, JVM, Terraform, and Swift where a
    Linux toolchain exists; versions and per-toolchain availability recorded.
  - *Residual risk.* Shared-kernel container escape is recorded as accepted
    residual risk; no fallback to running on the host.
  - *Order.* CI unit and `plan` tests → image build on axat-vps → containment
    probes with synthetic code only → all pass → one verification run on the
    exact head of an already-merged defi-com PR → merge-ready hold for the user
    (A1) → live activation (W3-4b). Every later run, including the verification
    run, passes its own per-run probes first.
  Acceptance: an allowed registry fetch succeeds; in every container and network
  mode used (fetch, test without network, test with sidecar network) probes are
  denied for arbitrary HTTPS, direct IP, the host bridge and gateway, every
  axat-vps listener and every container address on other Docker networks
  (enumerated at run time), tailnet addresses, link-local metadata, IPv6 and a
  redirect from an allowed endpoint; from the proxy's network position with the
  proxy process bypassed, tailnet peers, the host's addresses and private ranges
  are unreachable, and removing the packet-filter rule makes that run's probes
  hold; a declared sidecar is reachable in the sidecar profile; planted checkout
  secrets, a Docker socket, escaping symlinks and forbidden launch options all
  fail; a secret planted in the launcher's own environment, a caller-requested
  variable and a caller-requested published port are absent from every
  container; self-bounded payloads for a fork bomb, memory hog, output flood,
  timeout and a disk fill in both the writable copy and the dependency volume
  are each contained by their limit (the output flood by retained-log rotation
  and wall-time termination) and cleaned up; outside the launcher-owned
  table, the only ruleset differences during a run are the rules Docker itself
  adds for that run's own networks, each naming one of those networks'
  interfaces or subnets; before and after the run the ruleset outside the owned
  table is identical; after cleanup that run's owned rules are absent while a
  concurrent run's rules are untouched; no launcher action changes a base
  chain's default policy (CI test); reaping a stale run leaves a live concurrent
  run untouched; a workload that ignores signals still ends at the limit because
  the live launcher stops its container from the host; the started process in
  every container runs as a non-root user with empty capability sets (per-run
  probe); killing the launcher mid-run leaves objects that the next run reaps,
  including the proxy and sidecars, before the concurrency count; a proxy and a
  sidecar past the limit are stopped by the live launcher; with the launcher
  killed mid-run, retained logs stay within their rotation cap, a disk fill in
  the writable copy, the dependency volume and a sidecar's declared volume each
  stays within its cap, host disk use outside them is unchanged, and the next
  `reap` removes the run's objects; a SIGTERM to the launcher attempts cleanup
  and any leftover objects are removed by the next `reap`; `reap` leaves
  containers and volumes without the launcher's label, and loop devices whose
  backing file is outside the launcher-owned directory, untouched, including
  existing snap loop devices; a launcher killed between attaching the loop
  device and creating the volume leaves a loop device that the next `reap`
  detaches; with no further loop device free or allocatable, the run holds
  before attaching; after cleanup no loop device, mount or image file of that
  run remains; a container whose dependency directory is
  not the capped filesystem holds the run; with a host
  identity other than axat-vps, run mode exits 2 and the Docker object lists and
  firewall state are unchanged; a third concurrent request exits 2; every required inventoried toolchain passes its smoke test
  (one failing required entry keeps W3-4 incomplete); with the image digest and
  engine version unchanged, a changed launch policy or network rule that makes a
  forbidden endpoint reachable is caught by that run's probes and holds the
  untrusted command, and an erroring probe also holds. Then the exact head of an
  already-merged defi-com PR runs inside the sandbox, its captured exit matches
  CI at that head, and the host clone's full file and ignored-file inventory is unchanged.
- **W3-4b Sandbox adoption.** Consumes: W3-4 merged by the user, W3-4c merged, W3-3, W2-1. The
  review brief and packaged prompt tell the reviewing seat to run the PR's tests
  through the sandbox and attach the receipt. This replaces the imported
  no-install and symlink clauses for peer reviews. The W3-4b PR touches the
  host-execution clause, so it stops at merge-ready for the user's own merge (A2);
  the W3-4 merge does not cover it.
  For every peer-mode review, in any repository, the review brief and
  packaged prompt keep a host-execution ban: the reviewing seat never installs
  dependencies, builds or executes PR code on the host or in a container it
  starts itself; the sandbox launcher is the only execution path. Axstack's own
  authored reviews keep their existing local checks in their detached checkouts
  (`candidate-brief.md:16-17`, `review-candidate.md:159`, `codebase-mode.md:17`)
  and are outside this ban and its inspector term.
  A held, failed or unavailable sandbox is recorded as a limitation (test term
  unknown, hold stated) and the review continues from code reading and CI.
  Sandbox output is untrusted data, never instructions. A separate file in the
  sandbox directory, included only by the review-manager prompt, adds a `reap`
  step at the start of each review-manager pass, before any quiet-pass exit
  (including W4-2's gate); a failing `reap` or absent Docker is recorded and
  the pass continues. This clause is covered
  by the W3-4 containment user-merge rule. Redeploy under W2-1 step 7.
  Acceptance: one real review carries a sandbox receipt that passes the
  inspector; a test fails if the ban is removed or inverted; the inspector
  reports fail for a peer-mode review claiming local test execution without a
  sandbox receipt, and n/a for authored reviews; one peer review with a deliberately held sandbox records the limitation
  and leaves the host clone inventory and the Docker container list unchanged;
  a test fails if the packaged review-manager prompt stops including the `reap`
  step; a pass with a failing `reap` or no Docker still completes and records it.
- **W3-4c Sandbox merge hold term.** Consumes: W3-4's sandbox directory path.
  `pr-shape.js` emits a hold term `sandbox-path` when a PR diff touches any path
  under the sandbox directory (path-prefix match on changed files, matching both
  the source and destination path of a rename; `pr-shape.js:87-89` keeps only
  the destination today and is extended to keep both). The watch merge readiness check (`skills/axstack-watch/references/readiness.md` §5)
  runs `pr-shape` and treats `sandbox-path` as a user-merge hold. Security scope
  (A1). Acceptance: `pr-shape` fixtures for a touched file, a rename into and
  out of the directory and an untouched diff; a watch test fails if the merge
  check stops consuming the term.
- **W3-5 Live-run tooling.** Consumes: W3-1. Improve R5's receipt path using
  capture and the existing scenario catalogs. Acceptance: one release record
  carries an R5 trace produced through this path.
- **W3-6 Image evidence (Q8).** Replace the `missingImages` requirement in
  `skills/axstack-explain/references/inline-pages.md` and its tests. The
  reviewing seat runs a Playwright check against the exact published bytes via
  the Playwright MCP; unobservable resources report unknown. A bun-testable part
  extracts the expected resource list from the page bytes and maps an absent
  observation to unknown. The same PR adds the Playwright review-only exception
  to AGENTS.md Interfaces. Acceptance: unit tests for extraction and the unknown
  mapping; one review shows a broken image failing and a good page passing.
- **W3-7 Activation canary.** Either execute the four canary outcomes in
  `automations.md:455-465` on explicitly owned test schedules with cleanup and
  restored state, or retire the canary requirement and its activation references
  together. Deleting the unverified-status sentence (`:478`) alone is neither.
  Never interrupt real owners or disable a production schedule for this.

### Wave 4 — orchestration after re-measure

- **W4-1 Re-measure gate.** Consumes: W1-7, W3-3. Before any W4 implementation,
  rerun the W1-7 method on comparable post-W1–W3 work and record adoption,
  capture versus reconstruction cost, and limitations. The measurement is
  evidence, not a helper-issued verdict or savings target.
- **W4-2 In-turn quiet gate (Q1).** Consumes: W4-1, W2-1. The pass's first
  decision step, after collecting explicit inputs and before loading the full
  workflow, emits facts: complete eligible-PR discovery, repository and lane
  identity, native thread and descendant readbacks, prior-pass state,
  watermarks, timestamps and pending work; it reuses `pr-digest.js` only for PR
  comparison. The driver applies the existing quiet, full and hold rules. Unknown
  discovery means full reconciliation; unknown ownership forbids competing
  admission. Delete each prose obligation only once covered (R1). Acceptance:
  fixtures for a new PR outside the previous list, stale or future timestamps,
  missing watermark, nonterminal child, unresolved hold, user-only hold,
  pagination failure and unknown ownership.
- **W4-3 Lane-owner facts (R2 fact).** Consumes: W4-1. Reports whether an earlier pass or its
  review job is live from a thread-list snapshot; truncated snapshot reports
  unknown and preserves the hold. Acceptance: fixtures for live, settled,
  resumed usage-limited and truncated cases.
- **W4-4 Review admission facts (R2 fact).** Consumes: W4-1 and the W2-1 policy artifact.
  A new `pr-fresh` helper reports open, non-draft, pinned head, head age and
  pending checks; the driver applies the recorded policy; it runs before dispatch
  and before submission. Acceptance: fixtures just below, at and above the
  head-age threshold; known pending, successful and failed checks; head move,
  base change, merged and draft; absent or malformed policy reports unknown with
  the expected per-term facts.
- **W4-5 Platform asks (Q1).** Ready-to-paste requests to T3 for single-flight
  schedules, a native pre-model predicate, worker-visible task IDs, writable-root
  containment and a provider self-switch guard. Acceptance: texts delivered to
  the user, who chooses where to file.
- **W4-6 Seat sizing.** Consumes: W4-1. A matched-task trial of unique findings
  per reviewer and adviser seat. Report only; any seat change is a user hold (A2).

## Success measures

| Metric | Baseline (2026-11-15) | Target |
|---|---|---|
| Prose bytes; raises per month | 689,351; 7 | Falling; 0 without user approval |
| Static checks in CI | 0 | 2 (after W1-5b merge) |
| Live-only Axstack schedule rules | 5+ named | 0 |
| Host-clone writes; scratch strays | ~50; 27 | 0 in 30 days after W3-4b |
| Peer reviews running real tests | ~50% read code + CI only | ≥90% of reviews whose toolchain is in the frozen required inventory, measured from W3-4b activation |
| Packets with incomplete closure | 2 of 4 sampled | 0 of 4 |
| Live traces per affected release | 0 | 1 (R5) |
| Quiet / duplicate pass share | ~50% / ~15% | Reported at W4-1; no fixed target |

Measurement: the run's final report names the recount command (the run's Stage A
recount scripts or `usage-split.js`), its due date and that the user triggers it;
no schedule is added.

The plan is wrong if: strays continue with the wrapper in use (needs platform
containment), bytes rise under the freeze (growth is authority text), recurrence
does not fall after W1–W2, or capture costs exceed the reconstruction it saves.

## Evidence and history

- Source evidence: run `20261115-slop-meta-improve`. Key files: `final-report.md`,
  `stage-a-summary.md`, `evidence/stage-c-claude/synthesis.md` (sha256 8f6fb9fd…),
  `evidence/stage-c-codex/synthesis.md` (sha256 db4c2ccd…).
- Design sketch (Rung 2, from Stage C):

```text
Usage: for a correction, climb: delete -> restructure -> reuse a check -> new check -> prose
Shape: W1 repair -> W2 repo owns inputs, freeze prose -> W3 verification reach -> W4 orchestration after re-measure
Binding: R1 replace-not-add; R2 helper modes; R7 interface dependencies; no new runtime
Flow + failure: correction -> highest feasible rung -> red test -> fix -> prose deleted; a skipped rung is justified in the PR
We accept: quiet passes stay model-started until T3 ships single-flight or a pre-model predicate
Rejected: rules ledger, brief renderer, helper-per-class, pre-model script, seat cuts before data
Open: live prompt bytes, lint baseline, Swift availability, registry coverage, T3 feasibility
```

- r1 receipts (sha256 9a086710…): advisor-codex DISAGREE; advisor-claude
  AGREE-WITH-CHANGES; diligence Scope FAIL. All high and medium addressed in r2.
- r2 receipts (sha256 cc7d9ce1…): advisor-codex AGREE-WITH-CHANGES (N1 sidecar
  network, R1 Haoshoku concurrency, R2 admission policy producer); advisor-claude
  AGREE-WITH-CHANGES (R1–R5, N1–N4); diligence Scope PASS with 8 medium. r3
  addresses all: sandbox network profiles, sidecar list, probes per mode,
  read-only root, inventory, order and adoption (W3-4, W3-4b); Haoshoku fresh
  pre-write comparison (W2-6); W2-1 scope, policy artifact and cadence sites;
  PR-link ban hold (W2-7, A2); AGENTS.md prose-ceiling rule (W2-2); AGENTS.md
  Docker and Playwright exceptions (W3-4, W3-6); W1-1 ordering and root sentence
  (R4); restored auth/secrets stop and auto-merge exceptions (A2, A4); observable
  W2-3; measurement line; explicit beyond-Align list in the brief.
- r3 receipts (sha256 7bfdddce…): advisor-codex AGREE-WITH-CHANGES (R1 rollback,
  N2 toolchain support); advisor-claude AGREE-WITH-CHANGES (M1 cadence sites, M2
  containment protection and proof freshness); diligence Scope PASS (M1 cadence
  sites, M2 beyond-Align list, M3 dependency path). r4 addresses all: scoped
  rollback (W2-6); frozen required toolchain inventory (W3-4, measures); nine
  cadence sites plus test (W2-1); sandbox containment user-merge rule and probe
  freshness (W3-4, A2); per-run dependency volume (W3-4); beyond-Align items 6–7
  and W3-4b redeploy (brief); W4-3/W4-4 consume W4-1.
- r4 receipts (sha256 cd66b278…): advisor-codex AGREE-WITH-CHANGES (N3 stale
  containment proof); advisor-claude AGREE; diligence Scope PASS (lows). r5
  replaces probe reuse with per-run synthetic probes (W3-4), names exact paths
  and adds proxy config, probe set and probe gate to the AGENTS.md containment
  rule, adds brief item 8, aligns the limitation list, and corrects Q1 wording.
- r5 receipts (sha256 e71cbf08…): advisor-codex AGREE; advisor-claude AGREE;
  diligence Scope PASS; escalation-fable (high-stakes, fresh session) DISAGREE
  with F1–F5. r6 adds: host-execution ban after adoption (W3-4b); host
  packet-filter egress enforcement below the proxy, probed from the proxy
  position (W3-4, A3, brief 8); run-time probe target enumeration (W3-4);
  user-merge rule over the whole sandbox directory plus a `pr-shape` hold term
  (W3-4, A2); no host environment or published ports (W3-4); and Fable's
  recommendations on limit acceptance tests, an already-merged PR as the
  verification subject, untrusted output, no host-side submodule/LFS fetch and
  a concurrency cap.
- r6 receipts (sha256 4014883c…): advisor-codex AGREE; advisor-claude
  AGREE-WITH-CHANGES (M1 bounded firewall rules and self-bounded payloads, M2
  ban scope, M3 submodules); diligence Scope PASS (M1 verification subject, M2
  ban scope, M3 brief coverage, M4 W3-4b merge); escalation-fable fresh session
  DISAGREE (F1 host binding, F2 firewall over every per-run network). r7 adds:
  host binding to axat-vps; host-input and forward rules over all per-run
  networks in one launcher-owned table, printed by `plan`, before/during/after
  ruleset check, presence confirmed at cleanup; fixed public resolver;
  independent wall-time and orphan reaping; images pinned by digest; ban scoped
  to peer mode; public submodules as pinned image dependencies; W3-4b as its own
  user merge; concurrency cap 2; `sandbox-path` hold term consumed by the watch
  merge step; verification subject aligned; brief items 1 and 8–11.
- r7 receipts (sha256 c145b788…): escalation-fable fresh session AGREE;
  advisor-codex AGREE-WITH-CHANGES (M1 ruleset check vs Docker's own rules);
  advisor-claude AGREE-WITH-CHANGES (N1 same); diligence Scope PASS (M1
  `sandbox-path` owner, M2 wall-time mechanism). r8: ruleset acceptance allows
  only Docker's own rules for the run's networks; W3-4c owns the hold term and
  its watch consumption; wall-time enforced inside the image with stale-run
  reaping that never touches live runs; ban scope "every peer-mode review, in
  any repository"; CI test that owned rules match only per-run interfaces;
  submodules fetched as content only; proxy read methods only with recorded
  exfiltration residual; brief items 9–10 updated.
- r8 receipts (sha256 4b2ed516…): escalation-fable fresh session AGREE;
  advisor-codex AGREE; advisor-claude AGREE-WITH-CHANGES (M1 proxy method limit
  unenforceable over HTTPS, M2 workload can stop its in-image timer); diligence
  Scope PASS (M1 wall-time for proxy and sidecars and launcher-crash tests, M2
  exfiltration risk undisclosed). r9: drops the proxy method limit and states
  the registry-exfiltration residual in the brief's Risks and item 10; wall-time
  enforced by a root init in every owned container plus the live launcher from
  the host; liveness by launcher PID and start time; launcher-kill, timer-kill
  and stale-reap acceptance; per-run rule cleanup and base-chain policy CI test;
  W3-4b consumes W3-4c; rename source path kept; brief item 1 cites W3-4c; host
  firewall risk added to Risks.
- r9 receipts (sha256 3de32fda…): advisor-codex AGREE-WITH-CHANGES,
  advisor-claude AGREE-WITH-CHANGES, diligence Scope PASS and escalation-fable
  DISAGREE, all on one point: a root init that drops privileges cannot run under
  the non-root, all-capabilities-dropped launch policy. r10 takes the option
  that keeps the launch policy: no in-container init; wall-time enforced by the
  live launcher from the host; per-run probe that every started process is
  non-root with empty capabilities; unreadable liveness holds; reaping before
  the concurrency count; the dead-launcher gap disclosed in Risks and item 10.
- r10 receipts (sha256 c47e1a48…): escalation-fable fresh session AGREE;
  advisor-codex AGREE; advisor-claude AGREE-WITH-CHANGES (P1 limits have no
  stated enforcer; Docker logs uncapped on axat-vps); diligence Scope PASS (M-1
  proxy and sidecar stop at limit dropped from acceptance). r11: every limit
  enforced by Docker or the kernel (cgroups, size-capped tmpfs, `local` log
  driver with max size, restart `no`); `reap` writer mode run at each
  review-manager pass start; signal cleanup and wall-time below the calling
  tool's timeout; acceptance for proxy and sidecar stop, killed-launcher caps
  and SIGTERM cleanup; Unverified adds image start under non-root and `ufw`
  reload; garbled proxy sentence fixed.
- r11 receipts (sha256 4c0b2e3f…): escalation-fable fresh session AGREE;
  advisor-claude AGREE; advisor-codex AGREE-WITH-CHANGES (M1 log rotation does
  not stop a container, M2 one-interval bound overstated); diligence Scope PASS
  (M-1 `reap` step unowned, M-2 tmpfs cannot carry dependencies between
  containers). r12: retained-log rotation stated as a storage cap, flood
  contained by rotation plus wall-time; recovery worded as next successful run
  or pass with no upper bound when passes fail; signal cleanup best effort
  (harness may background or hard-kill); dependency volume as a fixed-size
  loop-mounted image file; image-declared volumes covered by capped tmpfs;
  swap equals memory; `plan` asserts a 2-run host memory and disk budget;
  `reap` label-scoped and host-bound, owned by W3-4b's clause file with tests;
  brief items 2 and 10 and Risks updated.
- r12 receipts (sha256 4ab7bf71…): escalation-fable fresh session AGREE;
  advisor-codex AGREE; advisor-claude AGREE; diligence Scope PASS (M-1 loop
  mount not covered in authority, cleanup, acceptance or Unverified). r13:
  Docker performs the loop mount as a labelled `local` ext4 loop volume, so
  the launcher mounts nothing on the host; per-container check that the
  dependency directory is the capped filesystem; cleanup and `reap` remove the
  labelled volume and owned image file only, never unlabelled loop devices;
  A3, brief item 10 and Unverified name the image file and loop volume;
  `--memory-swap` equals `--memory`; the `reap` step lives in its own file
  included only by the review-manager prompt and runs before any quiet-pass exit.
- r13 receipts (sha256 5945f506…): escalation-fable fresh session DISAGREE and
  advisor-codex and advisor-claude AGREE-WITH-CHANGES, all on one point:
  Docker's `local` driver does not attach loop devices (verified against the
  docker-v29.8.2 source and a kernel mount probe); diligence Scope PASS (M-1
  loop-device exhaustion). r14 (Fable's paste-ready text): the launcher
  attaches its own loop device and Docker mounts it `nosuid,nodev`; ownership
  by backing file in the launcher-owned directory; cleanup order containers,
  volume, owned loop device, image file; a pre-attach check keeps one loop
  device free or allocatable; A3, brief item 10 and Unverified updated. User
  chose (Q13) to keep iterating the spec to full agreement.
- r14 receipts: pending. Approval: pending.
- Change log: r1 first draft; r2–r4 incorporate review findings of the prior revision.
