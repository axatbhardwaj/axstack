# Orca PR automations — specification

Status: draft for Fable review; decisions Q1–Q4 settled by the user on
2026-09-16. Nothing is enabled until one manual run, the dedup and expiry
checks, and the effective-model check pass.

## Purpose and boundary

Two native Orca automations keep the user's GitHub pull requests moving without
a human in the loop, on the VPS, using the installed Axstack skills. Orca owns
scheduling, sessions, retries, and run history. Axstack owns policy, the run
record, and evidence. There is no systemd timer, external scheduler, custom
controller, or relay plugin.

Escalation to the user is the exception, not the default. It goes through the
`axstack-relay` skill (native one-way `hermes send` to the `telegram` home
channel) only when the escalation gate says so.

## Identity and scope

- **Self** is `gh api user --jq .login` on the VPS, resolved at the start of
  every run and never hardcoded.
- **Own PR**: an open PR authored by self. Babysitting has the same authority
  the user has at the keyboard: repair, test, commit, push to the PR branch.
- **Peer PR**: an open PR where self is officially review-requested, or where a
  PR comment @-mentions self asking for a response. Unsolicited reviews never
  happen.
- **Discovery** covers every repository the account can see, via GitHub search
  (`author:@me`, `review-requested:@me`, `mentions:@me`), so the gate can still
  surface a request from any repo.
- **Mutation allowlist**: repair pushes and review comments are performed only
  in allowlisted repositories, initially `axatbhardwaj/axstack`. A PR outside
  the allowlist is recorded and, if it meets an escalation criterion, escalated;
  it is never mutated.
- Prohibited everywhere: force-push, rebase, merge, close, `APPROVE`,
  `REQUEST_CHANGES`. A need for any of these becomes a recorded hold.

## Automation A — driver (every five minutes)

- Trigger: cron `*/5 * * * *`, timezone `Asia/Kolkata`, dedicated existing VPS
  worktree, `--reuse-session`, provider `claude`, model Opus, effort medium.
- Precheck (no model): resolve self, run the three GitHub searches, compare the
  result set (PR number, head SHA, latest review-request and mention event IDs)
  with the run record's processed-event cursor. Exit non-zero when nothing
  changed, so no session is launched on quiet ticks.
- Run: for each changed PR
  - own PR → `axstack-watch` on the exact head SHA; failing checks or actionable
    review feedback produce a repair candidate that is pushed to the PR branch,
    then reviewed (below) before the watch continues;
  - peer PR → two isolated `axstack-review` passes (`axstack-reviewer-primary`,
    `axstack-reviewer-secondary`) on the exact head SHA, published as one
    `COMMENT` review after the gate;
  - every reviewer brief ends with a required field
    `Escalate to user: yes | no — criterion — reason`, judged against the three
    criteria below. Reviewers do not read each other's findings.
- Gate: after both reviewers settle, spawn `axstack-auditor` (Luna max in the
  mixed and codex-only presets, Sonnet xhigh in claude-only) with the
  instruction to act as the escalation gate. It reads both verdicts and the
  candidate, and returns exactly `escalate` or `proceed`. Reviewer "yes" is
  input, not a veto; the gate decides. `escalate` sends one `hermes send`
  message naming the PR, the criterion, both reviewers' reasons, and the hold,
  and records the hold. `proceed` lets the run continue.
- Escalation criteria (only these): a security concern; a permanent on-chain
  state change; an architectural change in approach.
- Watch window: 24 hours per own PR from first observation, ending early on
  merge or close. Expiry records a resumable handoff and stops silently; it is
  not an escalation by itself.

## Automation B — watchdog (hourly)

- Trigger: `hourly`, same worktree, separate session, `axstack-watchdog` role,
  read-only.
- Verifies Automation A's run history and the run record: last successful tick,
  stuck or repeatedly failed runs, duplicated event handling, reused-session
  fallback, and an effective model different from the requested one.
- A finding is passed to the same gate; the watchdog itself never sends and
  never mutates GitHub.

## Run record

The Axstack run record in the worktree (`references/run-record.md` shape)
stores, per PR: processed event IDs, exact head and base SHAs, review receipts
per SHA, gate decisions, `hermes send` `message_id` receipts, watch deadline,
and holds. Orca run history remains the authoritative log of sessions and
outcomes; the record is derived progress, never authority.

Dedup rule: an event ID or a review receipt for an unchanged head SHA is never
processed twice. Notifications dedup on (PR, criterion, head SHA).

## Safety holds

- Session reuse fell back to a fresh session, or `launch.effective` differs
  from `launch.requested`: mutation pauses for that run, the fact is recorded,
  and the gate decides whether to escalate.
- GitHub API errors leave the PR state unknown; nothing is pushed or published
  on unknown state.
- A hold is cleared only by a later run observing the condition resolved, or by
  the user in the Orca conversation. Silence never clears a hold.

## Acceptance before enabling

1. Both automations exist disabled on the VPS Orca runtime with the settings
   above.
2. One manual run of A on a synthetic own PR shows: precheck skip on a quiet
   tick, a launched session whose effective model is Opus, one watch receipt,
   and a run-record update.
3. A second manual run on the same state performs no duplicate work.
4. A manual run with a forced 24-hour-old first observation records the
   handoff and stops.
5. One manual run of B reports the healthy state without sending.
6. A synthetic reviewer verdict marked `Escalate: yes — security` reaches the
   gate; `escalate` produces exactly one `hermes send` receipt, `proceed`
   produces none.

Only then are both automations enabled.
