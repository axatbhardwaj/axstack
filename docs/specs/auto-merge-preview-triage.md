# Spec: default auto-merge, revert line, PR previews, and nightly PR triage

Status: Draft rev 4 — awaiting specification approval (rev 1 88a3e94, rev 2 0e3f605,
rev 3 044ba9b; all adviser blockers folded). Store: this repo Markdown file.
Run: `20261006-video-takeaways`. The private run record holds the Align decisions,
the adviser receipts, and the host probe.

Release: not authorized this run (AGENTS.md release rule, `.github/workflows/publish.yml`; deferred, D5).

## Goal

The user stops being the merge bottleneck. Watched own PRs merge themselves when
the existing readiness predicate holds and the approval rule for the repository
type is met. PRs carry a revert statement, user-visible changes get a private
preview link, and a nightly job reports what needs attention.

## Settled decisions

User decisions use the Align question numbers; `D` rows are driver decisions.

| # | Decision |
|---|---|
| Q1 | Automatic merge, not human merge, is the default outcome of a watched own PR that meets every merge-ready term. |
| Q2 | Preview environments run on the user's VPS and are reached over the tailnet from phone and desktop. |
| Q3 | Own PRs carry a revert-readiness line in the PR description. |
| Q4 | `defi-com` (team) repositories are eligible. Their flow is feature → `dev` → `staging` → `prod`; `prod` is protected. Only PRs into `dev` auto-merge; every other base asks the user. |
| Q5 | Automatic merge is the default for `axstack-watch`, including standalone watches, with no per-run opt-in. |
| Q6 | Previews: the agent decides per PR whether a preview makes sense. First candidates are `defi-com/monorepo` and `axatbhardwaj/portfolio-site`. The nightly PR triage is included. |
| Q7 | Approval: in personal (`solo`) repositories, a cross-provider agent review is enough. In company or collaborator (`team`) repositories, another person's PR review is the green light. |
| Q7b | In `solo` repositories, automatic merge targets `main` and any other `integration` base, because every such PR is cross-reviewed (user confirmed). |
| Q10 | When a PR is raised, the driver spawns a separate watch session that keeps it up to date until it merges or closes. The user never has to invoke watch by hand. |
| U1 | Review findings rated above low must be fixed before merge; low findings may stay open (user, Align round 3). |
| D1 | Excluded: CLI-proxy account pooling and residential-IP routing. It exists to evade provider detection and limits. The supported alternative is signing in to the same accounts on each of the user's machines. |
| D2 | Deferred (driver default, user did not decide): local CI contention handling. |
| D3 | Adviser dissent recorded: both advisers preferred keeping the user's chat reply as `solo` approval. The user chose cross-provider review (Q7). |
| D4 | Every PR of this run is merged by the user, not by itself. |
| D5 | This spec grants no release, npm publish, or host install authority. A later release run under `AGENTS.md` needs its own recorded authority. Preview authority covers only the preview unit and its `tailscale serve` route on the VPS. |
| D6 | All adviser blockers on rev 1 and rev 2 are accepted and folded in. Triage time, stale threshold, preview limits, and the authority-file list are driver defaults the user may change. |

## Acceptance criteria

### A. Default automatic merge

1. Automatic merge applies only to own PRs under a chat-run watch or a standalone
   watch in authorized maintenance mode, including small and adopted work.
   Observation-only and peer watches never merge. The merge actor is the recorded
   owning thread of that watch (`axstack-owner` for a standalone watch). A missing or
   idle owner never transfers merge authority; the reconcile and explicit-transfer
   rules in `lifecycle.md` apply first. Workers, reviewers, monitors, managers, and
   the nightly triage never merge.
2. Approval term by approval mode:
   - `solo`: authored-review `APPROVE` plus diligence `PASS`, both bound to the
     current head and base. The reviewer's provider differs from every provider that
     authored or repaired commits in `merge-base..head`, from receipt-recorded
     provenance. Unknown or mixed provenance, and PRs the user wrote by hand, post a
     merge card.
   - `team`: at least one counted collaborator approval as defined in watch §5, at
     the current head, plus the same authored review and diligence. Reviews carrying
     an Axstack automation marker never count. An approval carries over only across a
     rebase whose `git patch-id --stable` of `merge-base..head` is unchanged, recorded
     for both heads, and only while the forge still counts it. Fresh authored review,
     diligence, and CI are still required on the new head. Watch §5's existing
     persistence rule for a merge-ready statement is unchanged.
3. Eligible base: `team` → only `dev`, and only when repository docs or workflows show
   it is non-production. `solo` → `main` or any other `integration` base (Q7b).
   Classification comes from docs and workflows, never the branch name alone; unknown
   means `deploying`. For a `gh stack`, only the bottom member's base must be
   eligible; each other member's base must be the next-lower member's branch at its
   reviewed head. Every member must meet every other term and exclusion. Reviewed
   members are never retargeted to become eligible.
4. Every existing watch §5 term still holds: full CI set green, mergeable, not draft,
   head/base binding, ancestry freshness, no `do-not-merge` label or chat `hold`, no
   active hold, guarded singleton merge, whole-stack-only `gh stack` merge, post-merge
   push-failure hold. `--admin` and rule bypass are never used.
5. Never auto-merged (merge card to the user instead):
   - PRs authored by anyone other than the user or the user's agents;
   - promotion PRs (`dev`→`staging`, `staging`→`prod`) and any `deploying` or unknown base;
   - release PRs;
   - PRs that change anything under `.github/`, a file a workflow step invokes by path,
     the package manifest or lockfile, test-runner config, branch-protection or ruleset
     config, or `CODEOWNERS`. Test sources stay eligible;
   - PRs that change Axstack merge-authority text. Examples, not a closed list:
     `contracts.md`, `autopilot.md`, `lifecycle.md`, `routing.md`, `role-roster.md`,
     `t3-runtime.md`, `diligence.md`, `profiles/presets/*.json`, `axstack-watch`,
     `axstack-implement`, `axstack-review`, and `AGENTS.md`;
   - PRs whose revert line is not `clean` (section B);
   - PRs held under section C4.
6. A watch can be told `Auto-merge: off` for a run or PR; the merge card then waits
   for the user.
7. A merge card is posted for every case in A2, A5, and A6 that does not qualify.
   The user's reply to a card authorizes the merge actor to merge under the guarded
   path, as today.

### B. Revert line

1. Every own PR description contains one line:
   `Revert: clean` | `Revert: steps: <manual steps>` | `Revert: irreversible: <why>`.
2. `clean` means a single `git revert` of the merge commit restores the previous
   behaviour with CI green and no data, schema, config, external, or published effect
   left behind. Otherwise `steps` or `irreversible` applies. Release PRs are
   `irreversible`.
3. The authored reviewer checks the line against the diff and records it in the
   review receipt; a wrong or missing line is a finding rated at least medium.

### C. Review severity

1. Each review and diligence finding is rated `high`, `medium`, or `low` on one shared
   rubric: `high` = correctness, security, data-loss, or contract defect with real
   impact; `medium` = material behaviour, test, or maintainability defect, a softened
   or dropped obligation, or an evidence-integrity mismatch (SHAs, counts, missing
   red/green logs); `low` = polish that does not change behaviour.
2. The reviewer rates; an uncertain rating rounds up; only diligence may raise a
   rating; nobody lowers one.
3. `medium` and `high` block `APPROVE` and must be fixed and re-reviewed. Diligence
   returns `FINDINGS` for any `medium` or `high` mismatch and `PASS` with the low
   items listed when only `low` mismatches remain; `UNKNOWN` is unchanged. `low`
   findings do not block, and their follow-up issue does not gate merge. The owner
   records them in one follow-up issue in the repository's tracker (GitHub Issues,
   or Linear for `defi-com`) linked from the PR.
4. Only comments and threads whose IDs are recorded in an agent receipt count as
   agent-authored. Every other review thread, review body, or top-level comment,
   from a human or a bot, holds automatic merge and posts a merge card until a human
   resolves or dismisses it. Agents never rate, resolve, or dismiss those. An
   always-commenting review bot therefore blocks auto-merge until the user clears
   its threads. Agent-authored threads with only `low` findings may stay open. A
   repository rule requiring conversation resolution still applies.

### D. PR previews

1. A preview runs only when the run's T3 host is the VPS. On any other host the
   owner records "no preview: run host is not the VPS" and continues.
2. For each own PR, the owner decides whether a preview makes sense: the base branch
   documents a runnable dev-server command (in `AGENTS.md` or its README) and the PR
   changes something user-visible. The command is read from the base, never from the
   PR head. If either is missing, there is no preview.
3. The owner starts the preview from an isolated checkout of the PR head as a systemd
   user unit with `RuntimeMaxSec=4h`, `MemoryMax=2G`, and `CPUQuota=200%`, using only
   repository-documented dev or test environment sources. After start, the owner
   confirms the process listens only on loopback and the `tailscale serve` target is
   `127.0.0.1:<port>`; otherwise it tears down and records "no preview: not
   loopback-only". Tailscale Funnel is never used.
4. Setup reports missing prerequisites (systemd user lingering, Tailscale operator
   rights) as "no preview" and never changes them or any unrelated host service or
   configuration.
5. At most two previews run per host; a third waits until a slot frees.
6. The preview is recorded as `Preview: <url> @ <served-sha>`, labelled as the served
   revision and distinct from the PR head SHA, in the run record and the driver
   thread. It and any "preview queued" note go in the PR description only for
   private repositories, and are updated or removed after a restart or teardown.
7. Teardown removes both the unit and its `tailscale serve` route and reads back that
   neither remains. It runs when the PR merges or closes, when the watch ends, or when
   the time limit stops the unit (an `ExecStopPost` step removes the route). A changed
   head restarts the preview on the new head. A failed teardown is a hold with a
   recorded receipt.
8. Production secrets are never used for a preview, in any repository.
9. UI verification (`axstack-ui-verifier`) may use the preview URL; the preview does
   not replace it.

### E. Nightly PR triage

1. One unbound native T3 `schedule_task` (`bindToCurrentThread:false`), following the
   weekly test-audit pattern, runs nightly at 02:00 host time over a recorded
   repository set. The host timezone, schedule ID, prompt, and repository set are
   recorded in a durable location outside any run record, so Close-out does not
   remove it. Setup reads existing schedules first and never creates a duplicate.
2. Each run reads all open PRs authored by the user and reports in its own T3 thread:
   per PR the forge state (CI, reviews, mergeable, unresolved threads) or `UNKNOWN`,
   stale PRs (no activity for 7 days), and the top three to act on. It never declares
   a PR merge-ready.
3. It is read-only: no merges, comments, labels, pushes, relay messages, dispatched
   work, or launched threads.

### F. Automatic watch session per PR

1. When any Axstack phase publishes an own PR (or the bottom member of a new
   `gh stack`), the driver, after verified publication readback, launches one new
   standalone watch session for that PR or stack in authorized maintenance mode. No
   manual `axstack-watch` invocation is needed. Later members of the same stack join
   that stack's session.
2. The session runs as `axstack-owner` in its own T3 thread. The user's standing
   request (Q10) is the explicit transfer request: the driver hands over ownership
   through the runtime-owned T3 transfer route, and ownership moves only after the
   session's acceptance receipt names the PR, head, scope, and authority. Until then
   the driver stays the owner. A failed or unconfirmed handover is a hold.
3. The session keeps the PR current: rebases when the base moves, routes review
   feedback to the PR's author for repair, keeps CI green, and applies section A.
   It never writes candidate source itself; the one-writer rule is unchanged.
4. The session ends when its PRs merge or close, or when the user cancels. It
   replaces the standalone 24 h expiry for driver-spawned sessions; a PR with no
   activity for 7 days pauses the session with one notification under the recorded
   Notification policy, and the user resumes it.
5. Exactly one watch session exists per PR or stack. Before launch, the driver
   searches existing T3 threads by the exact dispatch key and never launches a
   duplicate. The chat-run watch in the driver thread is replaced by this session for
   run-created PRs.

## Exclusions

- CLI proxy, account pooling, IP routing (D1).
- Local CI contention handling (D2).
- Automatic merge of promotion, release, or `deploying`-base PRs.
- Automatic merge of other people's PRs, even when watched.
- Previews on any host other than the VPS, public previews, or production data.
- Quota-driven scheduling or model routing (existing contract).
- Relay messages from the nightly triage (user's no-heartbeat notification rule).

## Risks accepted

- With `solo` cross-provider approval, two agents can miss the same defect while
  CI is green. Spec approval becomes the user's main checkpoint.
- A head guard does not atomically guard base freshness; concurrent merges remain a
  small race, held by the post-merge push-failure rule.
- Preview code runs under the same VPS user as the agents. Tests already do, so the
  added risk is small, but it is not isolated.

## Change surface

Every file that states the human-merge default, the merge predicate, or reviewer
pairing: `skills/axstack/references/contracts.md`, `autopilot.md`, `lifecycle.md`,
`routing.md`, `role-roster.md`, `t3-runtime.md`, `diligence.md`, `automations.md`,
`candidate-publication.md`, `pr-shape.md`, `test-audit-weekly.md`,
`ui-verification.md`; `skills/axstack-watch/SKILL.md` and references;
`skills/axstack-implement/SKILL.md`; `skills/axstack-review/SKILL.md`;
the watch-arming text in `autopilot.md` and `skills/axstack-watch/references/`;
`skills/axstack-audit/SKILL.md`; `skills/axstack-relay/SKILL.md`; a new preview
reference and a new triage prompt reference; `AGENTS.md`, `docs/workflows.md`,
`README.md`; and prose-contract tests under `tests/workflows/`.
