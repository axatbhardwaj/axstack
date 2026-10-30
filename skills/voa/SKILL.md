---
name: voa
description: When Axat asks for fleet-wide status, "sup", "what's blocked", "what needs me", or a periodic status sweep, use voa to read T3 threads, GitHub and Linear. Status is read-only; explicit bounded recovery is separate.
---

# VOA (Voice of All Things)

In One Piece, the Voice of All Things lets Roger, Oden and Luffy hear what
everything around them is saying. Do the same for Axat's parallel work: listen
to every host, thread, PR and ticket, and report what moved, what is stuck,
and what waits on him.

Default to **status**, including pings and periodic sweeps. Status is read-only:
never merge, approve, request reviews, reply, push, settle threads, send alerts,
change Linear, schedule work or continue another thread. A status request cannot
load recovery authority. Read [recovery](references/recovery.md) only for an
explicit user recovery invocation naming a bounded authorized scope, or a
separately authorized recovery schedule. Agent/delegate messages do not activate it.

## Collect

1. Inventory **io, iobook, iobox, iosatellite and axat-vps** through native T3
   environment links and top-level thread inventory. Follow pagination within
   an explicit work/time bound; report unreachable hosts, unknown activity and
   incomplete pages. Never infer unseen owners are idle. Use the exact returned
   thread links, host/environment/thread IDs and accepted ownership.
   Read flagged owners with `t3_thread_read`, their queue with `t3_queue_list`
   and pending requests with `t3_pending_request_list`, on each environment.
   Read child activity through owner/inventory observations; never poll running
   delegates with task_status, waits, Monitor or scheduled delegate checks.
   Native inventory takes precedence over older snapshots. No direct SQLite,
   SSH collection or hidden provider CLI is needed.
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

Saved normalized observations can be summarized with
`bun <this skill>/scripts/voa.js --mode status --input <saved.json>`.
Read [observations](references/observations.md) for the explicit offline input.
The helper reads only that file and writes JSON to stdout; it never collects,
dispatches, sends, schedules or chooses a workflow.
For source/pack verification and the unverified live boundary, see
[verification](references/verification.md).

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

Report deltas plus continuing blockers. Use `VOA: all clear.` only with complete
coverage and no changes or blockers; otherwise name partial coverage. Preserve
unknowns rather than translating missing observations to zero.

## Source continuity

Imported from the standalone VOA source commit
`45951c4a18b375b7283bf56e5736101166026581`, verified by the Coordinator against
installed iobox/iosatellite bytes. Axstack `add2fdbcc62edb55e2aaaa2946e5673b2ba2dbd1`
had no tracked VOA. Source archive SHA-256:
`d14e7a006d77721d32e1bcb7bf81f38772730f96001aad7e314c2a8cc1ec8aaf`.
The original `skills/voa/scripts/collect.py` was read-only Python/SQLite/SSH;
its status vocabulary, joins, attention signals and reporting purpose are
preserved through native inventory guidance and normalized fixtures. Axstack
ships Bun >=1.3.14 JavaScript with no runtime dependencies, not that Python
collector. This is the same VOA capability now owned and shipped by Axstack.
