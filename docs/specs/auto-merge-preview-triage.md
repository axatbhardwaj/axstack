# Spec: default auto-merge, revert line, PR previews, and nightly PR triage

Status: Draft rev 2 — awaiting specification approval (rev 1 at 88a3e94; adviser blockers folded). Store: this repo Markdown file.
Run: `20261006-video-takeaways`. The private run record holds the Align decisions,
the adviser receipts, and the host probe.

## Goal

The user stops being the merge bottleneck. Watched own PRs merge themselves when
the existing readiness predicate holds and the approval rule for the repository
type is met. PRs carry a revert statement, user-visible changes get a private
preview link, and a nightly job reports what needs attention.

## Settled decisions

| # | Decision |
|---|---|
| Q1 | Automatic merge, not human merge, is the default outcome of a watched own PR that meets every merge-ready term. |
| Q2 | Preview environments run on the user's VPS and are reached over the tailnet from phone and desktop. |
| Q3 | Own PRs carry a revert-readiness line in the PR description. |
| Q4 | `defi-com` (team) repositories are eligible. Their flow is feature → `dev` → `staging` → `prod`; `prod` is protected. |
| Q5 | Automatic merge is the default for `axstack-watch`, including standalone watches, with no per-run opt-in. |
| Q6 | Previews: the agent decides per PR whether a preview makes sense. First candidates are `defi-com/monorepo` and `axatbhardwaj/portfolio-site`. The nightly PR triage is included. |
| Q7 | Approval: in `solo` repositories, a current authored-review `APPROVE` from a reviewer on a different provider than the author, plus diligence `PASS`, counts as approval. In `team` repositories, one counted collaborator review counts. |
| Q8 | Eligible target: `team` repositories auto-merge only into `dev`. `solo` repositories auto-merge into any `integration` base (for Axstack, `main`; release is tag-triggered). Every other base posts a merge card and waits for the user. |
| Q9 | Review findings rated above low must be fixed before merge; low findings may stay open. |
| D1 | Excluded: CLI-proxy account pooling and residential-IP routing. It exists to evade provider detection and limits. The supported alternative is signing in to the same accounts on each of the user's machines. |
| D2 | Excluded: local CI contention handling (queueing local test runs). |
| D3 | Adviser dissent recorded: both advisers preferred keeping the user's chat reply as `solo` approval. The user chose cross-provider review (Q7). |
| D4 | Every PR of this run is merged by the user, not by itself. |
| D5 | Release: not authorized by this spec. It grants no release, npm publish, or host install authority. A later release run under `AGENTS.md` takes effect only with its own recorded authority. Preview authority covers only the preview unit and its `tailscale serve` route on the VPS. |
| D6 | Adviser blockers on rev 1 (Astra 4, Opus 8) are all accepted and folded into A, C, D, E, and the change surface. |

## Acceptance criteria

### A. Default automatic merge (`axstack-watch` §5, `axstack-implement` §6, contracts Authority, Autopilot, `AGENTS.md`)

1. Automatic merge applies only to own PRs under a chat-run watch or an authorized
   maintenance watch, including small and adopted work. Observation-only and peer
   watches never merge. The merge actor is the recorded owning thread of that watch.
   A missing or idle owner never transfers merge authority; the existing reconcile
   and explicit-transfer rules in `lifecycle.md` apply first. Workers, reviewers,
   monitors, managers, and the nightly triage never merge.
2. Approval term by approval mode:
   - `solo`: authored-review `APPROVE` from a reviewer whose provider differs from the
     author's provider, plus diligence `PASS`, both bound to the current head and base.
     No user chat reply is needed.
   - `team`: at least one counted collaborator approval as defined in watch §5 today,
     at the current head, plus the same authored review and diligence. An approval
     carries over only across a rebase whose `git patch-id --stable` of the PR diff is
     unchanged, recorded for both heads, and only while the forge still counts it
     (no dismissal, no last-push-approval rule). Fresh authored review, diligence,
     and CI are still required on the new head.
3. Eligible base: `team` → only a base named `dev` that repository docs or workflows
   show as non-production. `solo` → any `integration` base. Classification comes from
   docs and workflows, never the branch name alone; unknown means `deploying`. For a
   stack, every member's own base and the stack's final target must each be eligible,
   and every member must meet every term and exclusion.
4. Every existing watch §5 term still holds: full CI set green, mergeable, not draft,
   head/base binding, ancestry freshness, no `do-not-merge` label or chat `hold`, no
   active hold, guarded singleton merge, whole-stack-only `gh stack` merge, post-merge
   push-failure hold. `--admin` and rule bypass are never used.
5. Never auto-merged (merge card to the user instead):
   - PRs authored by anyone other than the user or the user's agents;
   - promotion PRs (`dev`→`staging`, `staging`→`prod`) and any `deploying` or unknown base;
   - release PRs;
   - PRs that change anything under `.github/`, any script or config a CI workflow
     runs, branch-protection or ruleset config, `CODEOWNERS`, `profiles/presets/*.json`,
     or Axstack merge-authority text (`contracts.md`, `autopilot.md`, `lifecycle.md`,
     `t3-runtime.md`, `axstack-watch`, `axstack-implement`, `axstack-review`,
     `diligence.md`, `AGENTS.md`);
   - PRs whose revert line is not `clean` (section B);
   - PRs with any unresolved human or bot review thread or top-level blocking comment
     (section C4).
6. A watch can be told `Auto-merge: off` for a run or PR; the merge card then waits
   for the user as today.
7. A merge card is posted for every case in A5 and A6 and for any base or approval
   that A2 and A3 do not cover. Its user reply rule is unchanged.

### B. Revert line

1. Every own PR description contains one line:
   `Revert: clean` | `Revert: steps: <manual steps>` | `Revert: irreversible: <why>`.
2. `clean` means a single `git revert` of the merge commit restores the previous
   behaviour with CI green and no data, schema, config, external, or published effect
   left behind. Otherwise `steps` or `irreversible` applies. Release PRs are
   `irreversible`.
3. The authored reviewer checks the line against the diff and records it in the review
   receipt; a wrong or missing line is a finding rated at least medium.

### C. Review severity

1. Each review and diligence finding is rated `high`, `medium`, or `low` on one shared
   rubric: `high` = correctness, security, data-loss, or contract defect with real
   impact; `medium` = material behaviour, test, or maintainability defect, or a
   softened or dropped obligation; `low` = polish that does not change behaviour.
2. The reviewer rates; an uncertain rating rounds up; only diligence may raise a
   rating; nobody lowers one.
3. `medium` and `high` block `APPROVE` and must be fixed and re-reviewed. Diligence
   returns `FINDINGS` for any `medium` or `high` mismatch and `PASS` with the low
   items listed when only `low` mismatches remain; `UNKNOWN` is unchanged. `low`
   findings do not block; the owner records them in one follow-up issue in the
   repository's tracker (GitHub Issues, or Linear for `defi-com`) linked from the PR.
4. Agents never rate, resolve, or dismiss threads or comments opened by humans or
   bots. Any unresolved human or bot thread or top-level blocking comment holds
   automatic merge and posts a merge card. Agent-opened threads with only `low`
   findings may stay open. A repository rule that requires conversation resolution
   still applies.

### D. PR previews

1. A preview runs only when the run's T3 host is the VPS. On any other host the
   owner records "no preview: run host is not the VPS" and continues.
2. For each own PR, the owner decides whether a preview makes sense: the repository
   documents a runnable dev-server command (in `AGENTS.md` or its README) and the PR
   changes something user-visible. If either is missing, there is no preview.
3. The owner starts the preview from an isolated checkout of the PR head as a systemd
   user unit with `RuntimeMaxSec=4h`, `MemoryMax=2G`, and `CPUQuota=200%`. It listens
   on loopback only and is exposed with `tailscale serve` on one port per preview.
   Tailscale Funnel is never used. Unrelated host services are never touched.
4. At most two previews run per host; a third waits until a slot frees and the PR
   says "preview queued".
5. The URL and the served head SHA are recorded in the run record and the driver
   thread. They go in the PR description only for private repositories.
6. Teardown removes both the unit and its `tailscale serve` route, and reads back that
   neither remains. It runs when the PR merges or closes, when the watch ends, or when
   the unit's time limit stops it (an `ExecStopPost` step removes the route). A
   changed head restarts the preview on the new head. A failed teardown is a hold
   with a recorded receipt.
7. Every preview uses only dev or test environment values; production secrets are
   never used, in any repository.
8. UI verification (`axstack-ui-verifier`) may use the preview URL; the preview does
   not replace it.

### E. Nightly PR triage

1. One unbound native T3 `schedule_task` (`bindToCurrentThread:false`), following the
   weekly test-audit pattern, runs nightly at 02:00 Asia/Kolkata over a recorded
   repository set. Its schedule ID, prompt, and repository set are recorded once;
   setup reads existing schedules first and never creates a duplicate.
2. Each run reads all open PRs authored by the user and reports in its own T3 thread:
   per PR the forge state (CI, reviews, mergeable, unresolved threads) or `UNKNOWN`,
   stale PRs (no activity for 7 days), and the top three to act on. It never
   declares a PR merge-ready.
3. It is read-only: no merges, comments, labels, pushes, or relay messages.

## Exclusions

- CLI proxy, account pooling, IP routing (D1).
- Local CI contention handling (D2).
- Automatic merge of promotion, release, or `deploying`-base PRs.
- Automatic merge of other people's PRs, even when watched.
- Previews on any host other than the VPS, public previews, or production data.
- Quota-driven scheduling or model routing.
- Relay messages from the nightly triage.

## Risks accepted

- With `solo` cross-provider approval, two agents can miss the same defect while
  CI is green. Spec approval becomes the user's main checkpoint.
- A head guard does not atomically guard base freshness; concurrent merges remain a
  small race, held by the post-merge push-failure rule.
- Preview code runs under the same VPS user as the agents. Tests already do, so the
  added risk is small, but it is not isolated.

## Change surface

Every file that states the human-merge default or the merge predicate:
`skills/axstack/references/contracts.md`, `autopilot.md`, `lifecycle.md`,
`t3-runtime.md`, `diligence.md`, `candidate-publication.md`, `pr-shape.md`,
`test-audit-weekly.md`, `ui-verification.md`; `skills/axstack-watch/SKILL.md` and
references; `skills/axstack-implement/SKILL.md`; `skills/axstack-review/SKILL.md`;
`skills/axstack-audit/SKILL.md`; `skills/axstack-relay/SKILL.md`; a new preview
reference and a new triage prompt reference; `AGENTS.md`, `docs/workflows.md`,
`README.md`; and prose-contract tests under `tests/workflows/`.
