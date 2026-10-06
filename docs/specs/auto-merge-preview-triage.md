# Spec: default auto-merge, revert line, PR previews, and nightly PR triage

Status: Draft rev 1 — awaiting specification approval. Store: this repo Markdown file.
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
| D4 | The PR that implements this change is merged by the user, not by itself. |

## Acceptance criteria

### A. Default automatic merge (`axstack-watch` §5, `axstack-implement` §6, contracts Authority, Autopilot, `AGENTS.md`)

1. An own PR under any authorized watch (chat-run or standalone) is merged by the single
   recorded merge actor when every term below holds. The merge actor is the chat-run
   driver, or the standalone watch owner when no live driver owns the PR. Workers,
   reviewers, monitors, and managers never merge.
2. Approval term by approval mode:
   - `solo`: authored-review `APPROVE` from a reviewer whose provider differs from the
     author's provider, plus diligence `PASS`, both bound to the current head and base.
     No user chat reply is needed.
   - `team`: at least one counted collaborator approval as defined in watch §5 today,
     at the current head. An approval carries over only across a rebase whose patch-id
     is unchanged; any content change needs a fresh approval.
3. Eligible base: `team` → only a base named `dev` that repository docs or workflows
   show as non-production. `solo` → any `integration` base. Base classification still
   comes from docs and workflows, never the branch name alone; unknown means `deploying`.
4. Every existing watch §5 term still holds: full CI set green, mergeable, not draft,
   head/base binding, ancestry freshness, no `do-not-merge` label or chat `hold`, no
   active hold, guarded singleton merge, whole-stack-only `gh stack` merge, post-merge
   push-failure hold. `--admin` and rule bypass are never used.
5. Never auto-merged (merge card to the user instead): PRs authored by anyone other
   than the user or the user's agents; promotion PRs (`dev`→`staging`, `staging`→`prod`)
   and any `deploying` or unknown base; release PRs; PRs that change CI workflow files,
   branch-protection or ruleset config, CODEOWNERS, or Axstack's merge-authority text;
   PRs whose revert line is not `clean` (section B).
6. A watch can be told `Auto-merge: off` for a run or PR; the merge card then waits
   for the user as today.
7. The only change from today for a merge card is that it is posted only for the
   cases in A5 and A6, and for anything A2 or A3 does not cover.

### B. Revert line

1. Every own PR description contains one line:
   `Revert: clean` | `Revert: steps: <manual steps>` | `Revert: irreversible: <why>`.
2. `clean` means a single `git revert` of the merge commit restores the previous
   behaviour with CI green and no data, schema, config, external, or published effect
   left behind. Otherwise `steps` or `irreversible` applies. Release PRs are
   `irreversible`.
3. The authored reviewer checks the line against the diff; a wrong or missing line
   is a finding rated at least medium.

### C. Review severity

1. Each review finding is rated `high`, `medium`, or `low` on one shared rubric:
   `high` = correctness, security, data-loss, or contract defect with real impact;
   `medium` = material behaviour, test, or maintainability defect; `low` = polish
   that does not change behaviour.
2. The reviewer rates; an uncertain rating rounds up; only diligence may raise a
   rating; nobody lowers one.
3. `medium` and `high` block `APPROVE` and must be fixed and re-reviewed. `low`
   findings do not block; the owner records them in one follow-up issue linked
   from the PR.
4. The "every review thread addressed" term becomes "no unresolved finding above
   low and no effective blocking review". Agents never resolve or rate threads
   opened by humans; a repository rule that requires conversation resolution
   still applies.

### D. PR previews

1. For each own PR, the owner decides whether a preview makes sense: the repository
   documents a runnable dev-server command (in `AGENTS.md` or its README) and the PR
   changes something user-visible. If either is missing, no preview, and the PR says
   nothing about one.
2. The preview runs on the VPS from the PR head as a time-limited systemd user unit
   with CPU and memory caps. It listens on loopback only and is exposed with
   `tailscale serve` on one port per preview. Tailscale Funnel is never used.
3. At most two previews run per host. The URL and the served head SHA are written
   in the PR description and the run record.
4. The preview stops when the PR merges or closes, when the watch ends, or when its
   time limit expires. A changed head restarts it on the new head.
5. Company repositories use only dev or test environment values; production secrets
   are never used for a preview.
6. UI verification (`axstack-ui-verifier`) may use the preview URL; the preview
   does not replace it.

### E. Nightly PR triage

1. One native T3 `schedule_task` runs nightly per configured repository set. It reads
   all open PRs authored by the user and reports, in one message to the driver
   thread: merge-ready, blocked (with the blocking term), stale (no activity for
   7 days), and the top three to act on.
2. It is read-only: no merges, comments, labels, or pushes.
3. It sends a relay message only under the recorded Notification policy, at most
   once per night.

## Exclusions

- CLI proxy, account pooling, IP routing (D1).
- Local CI contention handling (D2).
- Automatic merge of promotion, release, or `deploying`-base PRs.
- Automatic merge of other people's PRs, even when watched.
- Previews on any host other than the VPS, public previews, or production data.
- Quota-driven scheduling or model routing.

## Risks accepted

- With `solo` cross-provider approval, two agents can miss the same defect while
  CI is green. Spec approval becomes the user's main checkpoint.
- A head guard does not atomically guard base freshness; concurrent merges remain a
  small race, held by the post-merge push-failure rule.
- Preview code runs under the same VPS user as the agents. Tests already do, so the
  added risk is small, but it is not isolated.

## Change surface

`skills/axstack/references/contracts.md`, `skills/axstack/references/autopilot.md`,
`skills/axstack-watch/SKILL.md` and references, `skills/axstack-implement/SKILL.md`,
`skills/axstack-review/SKILL.md`, `skills/axstack/references/ui-verification.md`,
a new preview reference, `AGENTS.md`, `docs/workflows.md`, `README.md`, and
prose-contract tests under `tests/workflows/`.
