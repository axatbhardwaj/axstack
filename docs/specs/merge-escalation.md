# Spec: merge escalation only when blocked, risky or unproven

Status: Approved rev 5 (2026-10-08, user "approved"; content reviewed at sha256 d9bf2750…4c4a). Store: this repo Markdown file.
Run: `20261008-cli-lessons`. The private run record holds the arena notes,
the user's answers and adviser receipts.
Baseline: `f43327c`.

## Goal

The user stops pressing merge. Own PRs merge automatically once the quality
gates prove the change works. The user hears about a merge only when the run is
blocked on a person for more than an hour, when a credible serious risk needs a
decision, or when the driver cannot prove the change works by itself.

## Facts

- Watch §5 (`skills/axstack-watch/SKILL.md`) holds a fixed list of file
  categories for a user merge: `.github/`, workflow-invoked files,
  `package.json` beyond `version`/`files`, lockfiles, test-runner config,
  branch-protection or ruleset config, `CODEOWNERS`, `AGENTS.md`, non-`clean`
  revert lines, promotion, `deploying` and unknown bases. §5 also limits
  `solo` merges to `integration` bases and `team` merges to `dev`, holds
  informational human or bot comments for the user, and relays each merge
  card at once. `docs/workflows.md` mirrors the list.
- Origins: `ce3f2b0` (automatic merge with exclusions), `7bb8122`
  (`AGENTS.md` added; `docs/specs/autonomy.md` gives the reason: no agent PR
  widens its own authority), `caad602` (skill and merge-rule text made eligible).
- The last four own PRs (#371, #376, #381, #389) each changed
  `AGENTS.md` and waited for the user's merge instruction; #371 and #376 also
  had `Revert: steps`. #371 and #381 widened standing authority (a systemd
  timer exception, iobox as an install host); the user approved both.
- The authored review receipt (`skills/axstack-review/SKILL.md`) has free-text
  `Coverage:` and `Limitations:` fields, no record of a check the reviewer ran,
  and §5 says agents never rate non-agent comments.
- `pull_request` CI runs the PR's own copy of its workflows, so a PR can
  weaken the checks that gate it while CI stays green.

## Decisions

| # | Decision | Source |
| --- | --- | --- |
| D1 | A personal repository is one outside the `defi-com` organization where a complete collaborator readback lists only the user with write, maintain or admin access. Every other repository, including an incomplete or failed readback, is a work repository. | driver inference from the user's "personal solo projects" vs "work related stuff"; confirm at approval |
| D2 | In personal repositories, own PRs merge automatically when the gates pass and verification is proven, whatever files they change and whatever the base, including `.github/`, workflows, dependencies, lockfiles, `AGENTS.md`, promotion and `deploying` bases and non-`clean` revert lines. | user Q1, Q2 |
| D3 | In work repositories, own PRs merge automatically when the gates pass, verification is proven and a counted collaborator approval exists, whatever files they change, on any `integration` base (not only `dev`). | user Q3; file scope and base widening are the driver's reading, confirm at approval |
| D4 | In work repositories, promotion PRs and `deploying` or unknown bases are merged by the user on the forge. | driver default; one flippable line at approval |
| D5 | The user is pinged once when an otherwise ready PR has waited 60 minutes on another person. | user |
| D6 | A credible serious risk still holds and pings at once under the existing serious-risk rule. | user, standing contracts |
| D7 | Automatic merge needs proven verification. The driver first closes gaps itself; when it cannot, it asks the user instead of merging. | user ("if you are not sure, better to ask") |
| D8 | Only open findings above `low` and human `CHANGES_REQUESTED` hold a merge. The authored reviewer rates each non-agent comment at the head as `above low`, `low`, `addressed` or `uncertain`, and re-rates at each new head; `low` and `addressed` do not hold; an unrated, `above low` or `uncertain` item holds. A comment that arrives after the receipt is rated by a fresh review dispatch, as gap closing. Agents never resolve or dismiss non-agent items. | user Q3 ("all things addressed above low"); rater is the driver's design |
| D9 | Routine merge-ready and merged relays stop for own PRs; the user is pinged only to unblock. | user Q2 ("only ping me to unblock you") |

## Design

Rung 1: replaces the §5 escalation rules; no new component.

### Gates (unchanged, every own PR)

The PR has a cross-provider authored `APPROVE` and a diligence `PASS` at the
exact head and base, required CI is green, and it is mergeable. Peer PRs never
merge by an agent. `--admin` and rule bypass are never used. `Auto-merge: off`,
the `do-not-merge` label and a chat hold stop the merge. npm stage approval
stays with the user.

### Proven verification (new term, every own PR)

Verification is proven when all of these hold, using receipt fields that exist:

- The authored review shows `Verdict: APPROVE`, `Coverage: COMPLETE`, a
  `Safety fact` about the change that is not `unproven`, and
  `Escalate to user: no`.
- Diligence shows `PASS` at the exact head and base.
- The review records `Final-head check: <command> -> <log path>` for a check
  the reviewer ran at the final head; the log is kept in the run's evidence folder.
- Each acceptance check has passing evidence. The source is the ticket or spec
  criteria, or the PR body for adopted and ticketless PRs. A red-to-green log
  from an earlier head in the PR's patch lineage counts only when the reviewer
  records that it still applies to the final change. When the repository has a
  `verify-<app>` skill for the changed behavior, its result is part of the evidence.
- No limitation is tagged `changed-behavior: unproven`. The reviewer tags every
  limitation that leaves the changed behavior unexercised or unverified, in
  whatever words; other limitations do not hold.
- When the PR removes or weakens a check, test-runner setting or ruleset that
  gates its own merge, the reviewer ran the base's checks against the head.

When a term fails, the driver first closes the gap itself: it runs the check,
re-dispatches the review, or returns the work to the author. Only a gap it
cannot close becomes a merge-card cause `verification not proven`, bound to the
head and base and refreshed when either changes. The card names what is
unproven, why, and the action that would settle it. The user's reply in the
driver thread or on the forge clears only that cause, and the run records it as
`user-accepted unproven: <item>`, never as a pass. For that head and base, rules 1 and 2 then treat the accepted
item as settled; every other gate and hold still applies. A new head or base
voids the acceptance. In a work repository a reply never replaces counted
collaborator approval.

### Escalation (replaces §5's exclusion list, base limits and user-merge sentence)

1. Personal repository: merge when the gates pass and verification is proven
   or its open item is user-accepted at this head and base.
2. Work repository: merge when the gates pass, verification is proven or
   user-accepted, and a counted collaborator approval exists, on an
   `integration` base. Promotion
   PRs and `deploying` or unknown bases are merged by the user on the forge.
3. Serious risk (both kinds): the existing serious-risk hold applies at once.
4. Blocked on a person: a PR is ready-except-human when every term other than
   collaborator approval, human `CHANGES_REQUESTED` and open findings from a
   person holds. Each blocker has a key: `approval:<PR>`,
   `changes:<review id>` or `comment:<comment id>`. A missing approval's clock
   starts at the first observed ready-except-human time; other clocks start at
   the later of that time and the item's forge time. A clock resets when the
   PR stops being ready-except-human or its patch-id changes; a same-patch-id
   rebase keeps it. Each key is sent at most once. After 60 minutes, send one relay
   per key: `<repo>#<n> waiting <age> on @<login|no reviewer>: <approval|changes|comment>; ready at <sha7>.`
   The check runs on existing watch wakes; no new schedule. The ping is a
   notification only: when the blocker clears, the PR merges with no reply.

The `verification not proven` card is a user-decision hold under the
Notification policy. Cards that still need the user (work promotion,
`deploying` or unknown base, `Auto-merge: off`, provenance) relay as decision holds too.
The blocked ping is a notification. Routine merge-ready and merged relays for
own PRs stop.

### Surfaces

- `skills/axstack-watch/SKILL.md` §5: replace the exclusion list, the
  `solo`/`team` base limits, the comment-hold scope (including "agents never
  rate"), the immediate card relay, the team-reply line that clears an
  ineligible base, and the user-merge sentence with the rules above; add the
  proven-verification term.
- `skills/axstack-review/SKILL.md` authored receipt template and brief:
  `Coverage: COMPLETE | INCOMPLETE`, a `changed-behavior: unproven` tag per
  limitation, `Final-head check: <command> -> <log path>`, a `Safety fact`
  about the change, and a rating (`above low`, `low`, `addressed`,
  `uncertain`) for each non-agent comment at the head.
- `skills/axstack-watch/SKILL.md` §4 and `skills/axstack-relay/SKILL.md`:
  add `verification not proven` as a user-decision hold, add the blocked ping
  as a notification-only category, and drop the merge-ready and merged
  milestones for own PRs.
- `docs/workflows.md`: mirror §5.
- Tests: `tests/workflows/default-auto-merge.test.js` and related merge-rule
  tests move from file categories to these rules.
- Outside this spec: the Notifications text in the user's global instruction
  files (`~/.claude/CLAUDE.md`, `~/.claude-alt/CLAUDE.md`, `~/.codex/AGENTS.md`,
  `~/.codex-alt/AGENTS.md`) is updated after release only if the user approves
  that line separately.

## Acceptance

Each item is a prose-contract test that fails when the rule is removed or
inverted and survives rewording.

1. D1: a `defi-com` repository, an extra writer, or an incomplete readback
   classes as work.
2. D2: a personal PR changing `AGENTS.md`, `.github/` or a lockfile, on a
   `deploying` base, or with `Revert: steps`, merges when the gates pass and
   verification is proven.
3. D3/D4: a work PR changing `.github/` or `AGENTS.md` merges with a counted
   collaborator approval; without it, it does not; a work promotion or
   `deploying`-base PR goes to the user.
4. D5: the ping fires after 60 minutes, once per key, with
   `@<login|no reviewer>`, including a missing approval with no review
   requested and two simultaneous blockers; a same-patch-id rebase does not
   re-send; a new key does; approval after the ping merges with no reply;
   losing and regaining readiness or a patch change restarts the 60-minute
   clock, and a key already sent is not sent again.
5. D6: serious risk still holds at once.
6. D7: each proven-verification term, when missing, stops the merge; a gap the
   driver can close does not relay; an unclosable gap posts a head-bound card;
   a reply clears only that cause and is recorded as accepted, not passed,
   then the PR merges if every other gate holds; a reply never waives
   `APPROVE`, diligence `PASS` or green CI; a new head or base voids the
   acceptance; in a work repository a reply does not replace approval; a
   self-weakening check needs the reviewer's base-check run; an applicable
   `verify-<app>` result is required.
7. D8: a reviewer-rated `low` or `addressed` comment does not hold; an
   `above low`, unrated or `uncertain` item, or a human `CHANGES_REQUESTED`,
   does; a late comment triggers a fresh rating, not a ping; agents never
   resolve or dismiss it.
8. The review receipt template carries `Coverage: COMPLETE | INCOMPLETE`, the
   `changed-behavior: unproven` tag, `Final-head check`, a change safety fact
   and comment ratings.
9. D9: no routine merge-ready or merged relay is sent for an own PR.
10. Peer PRs, `--admin`, `Auto-merge: off`, `do-not-merge`, chat holds and npm
   approval tests still pass unchanged.
11. `docs/workflows.md`, §4 and the relay categories match §5. The prose-size
   ceiling is set to the measured size, with no unrelated rewording.

## Exclusions

- Changes to review, diligence or CI gates beyond the proven-verification term
  and the receipt fields and comment ratings named in Surfaces.
- A new scheduler, daemon or per-repo policy file.
- Merging peer PRs, bypassing rulesets, or approving npm stages.
- Changes to the release or install flow.
