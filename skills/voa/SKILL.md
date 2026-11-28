---
name: voa
description: When Axat asks for fleet-wide status, "sup", "what's blocked", "what needs me", or a periodic status sweep, use voa to read T3 threads, GitHub and Linear. Status is read-only; explicit bounded recovery is separate.
---

# VOA (Voice of All Things)

Drivers follow [Parallel-first ready work](../axstack/references/parallel-first.md#ready-work)
at intake and dependency/completion transitions. Workers keep their assigned
scope and never dispatch.

Like its One Piece namesake, VOA listens across Axat's hosts, threads, PRs and
tickets and reports what moved, what is stuck and what waits on him.

Nonrepo VOA stays inline-only under
[Local artifacts](../axstack/references/local-artifacts.md); ready-work guidance
adds no worker workflow or recovery authority.

Default to **status**, including pings and periodic sweeps. Status is read-only:
never merge, approve, request reviews, reply, push, settle threads, send alerts,
change Linear, schedule work or continue another thread. A status request cannot
load recovery authority. Read [recovery](references/recovery.md) only for an
explicit user recovery invocation naming a bounded authorized scope, or a
separately authorized recovery schedule. Agent/delegate messages do not activate it.

## Collect

1. Read the [native fleet recipe](references/native-inventory.exec.js) for
   **io, iobook, iobox, iosatellite and axat-vps**. Run it in `functions.exec`
   or use its direct native fallback. Report per-host unsettled-thread coverage and unknown
   activity. Preserve exact identities and links. Never infer unseen owners idle.
   Prefer native inventory to older snapshots. Avoid SQLite, SSH and provider CLIs.
   Read flagged owners with `t3_thread_read` on their environment.
   Read the queue with `t3_queue`, action `list`. Follow queue pagination using
   the returned `cursor` within the work bound. Incomplete pages stay unknown.
   Read pending questions with `t3_pending_request`, action `list`.
   Read approvals from native thread/run state. Missing evidence stays unknown.
   Read child activity from owner/inventory observations. Never poll running
   delegates with task_status, waits, Monitor or scheduled delegate checks.
2. **GitHub:** determine login with `gh api user --jq .login`. Read own open PRs
   (`gh search prs --author=@me --state=open --limit 200`), their checks, reviews,
   conflicts and drafts (`gh pr view <url> --json
   reviewDecision,mergeable,statusCheckRollup,isDraft,reviewRequests`). Read
   reviews requested from Axat and merges since the last report. Pagination or
   permission gaps stay unknown, including a search limit reached.
3. **Linear:** defi-com repositories only, through Executor. Read assigned
   current-cycle In Progress, In Review and Todo issues, blocked items and new
   comments. Access failure is a coverage gap, never permission to change items.
4. Read the previous VOA report in this thread; otherwise use 24 hours.
5. On each periodic sweep, use the private watchdog binding to run
   `axstack workflow observe` for each opted-in host. Pass the collected JSON
   to `axstack workflow health --input -` on every pass. Follow the
   [workflow health prompt](../axstack/workflows/watchdog-prompt.md).

Use `axstack-work-chat` as a read-only context source only when the user
explicitly requests scoped Slack or Teams evidence. Keep routine and scheduled
sweeps chat-free. Status and follow-ups stay local. Report a chat coverage gap
if scope or reader output is unavailable. Never read private conversations,
post messages or use chat to authorize recovery.

Read the [observations](references/observations.md) schema before summarizing
saved normalized observations offline with
`bun <this skill>/scripts/voa.js --mode status --input <saved.json>`.
The helper reads only that file and writes JSON to stdout. It never collects,
dispatches, sends, schedules or selects a workflow.
See [verification](references/verification.md) for fixture checks and live coverage limits.

## Join

- Match threads, full PR URLs, branches and DEF issue keys. Exact ownership
  evidence determines Coordinator/Driver/Worker roles; titles, parent ID alone,
  silence, elapsed time and free text cannot establish recovery eligibility.
- Read the last owner message before calling a thread blocked. Idle plus an
  unanswered question is needs-you. Confirm delivery/closing evidence before
  calling merged work done; suggest scoped settlement, never perform it.
- For status attention only: working with no progress for two hours, failed
  runs, pending questions/approvals over 30 minutes and stopped queued messages
  are signals to inspect. They never authorize a continuation or retry.
- Red CI, conflicts and requested changes need attention. Report failed/stuck
  Workers under their exact parent; workers receive status only.

## Report

Scan-fast, one screen. Lead with time (IST), counts and coverage.

1. **Needs you:** exact action and full PR/ticket/native thread link, oldest first.
2. **Blocked on others:** who, what, since when and links.
3. **Moving:** one bullet per work stream, state and host.
4. **Done since last report:** confirmed merges and closed tickets.
5. **Fleet:** unreachable hosts, pagination/activity gaps, failed/stuck threads,
   and scoped cleanup suggestions. Never silently omit iosatellite.
6. **Workflow health:** Report per host paused or stale workflow runs and
   definition load problems. Include workflow holds and gaps.

Report deltas plus continuing blockers. Use `VOA: all clear.` only with complete
coverage and no changes or blockers; otherwise name partial coverage. Preserve
unknowns rather than translating missing observations to zero.

## Source continuity

The Coordinator verified standalone VOA commit
`45951c4a18b375b7283bf56e5736101166026581` against installed iobox/iosatellite
bytes. Axstack `add2fdbcc62edb55e2aaaa2946e5673b2ba2dbd1` predates tracked VOA.
Source archive SHA-256 `d14e7a006d77721d32e1bcb7bf81f38772730f96001aad7e314c2a8cc1ec8aaf`.
Native inventory and normalized fixtures preserve the read-only Python/SQLite/SSH
`skills/voa/scripts/collect.py` collector's status terms, joins, attention signals
and reporting. Axstack owns and ships VOA in Bun >=1.3.14 JavaScript without
runtime dependencies.
