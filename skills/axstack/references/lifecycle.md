# Shared lifecycle and receipts

Phases load through [Standing contracts](contracts.md)' mandatory edge.
Substantive delegated or resumable work uses a driver-owned [Run record](run-record.md)
binding state and receipts to exact revisions.

## Roster (compact)

- Driver: current chat; owns scope, decisions, cross-PR dependencies, Linear
  mutations, and integration.
- Owner (`axstack-owner`): one persistent owner per PR; launches its author,
  reviewers and watches; may perform authorized PR-scoped publication within user authority.
  Human merge is default.
- Author: exactly one writer per candidate; accepted fixes return there.
  Workers launch no recursive teams.
- Reviewers: peer = two independent `axstack-reviewer-primary` and
  `axstack-reviewer-secondary` sessions with identical brief and isolated first
  pass; authored = one eligible configured reviewer from actual author
  provenance. Owner and author never review.
- Monitor/watchdog: independent read-only `axstack-monitor` and
  `axstack-watchdog` sessions on native Paseo timers.
- Auditor (`axstack-auditor`): report-only; never edits, merges, activates, or
  audits itself.

Prefer parallel independent bounded work; no redundant workers.
Per [standing contracts](contracts.md), fanout is dependency/capacity-driven
with no fixed count, within host and spending limits. [PR shape](pr-shape.md)
covers theme/size; queue via `gh stack`.

## Ownership

The PR owner remains accountable for candidate, fixes, evidence, and monitoring;
peer code stays read-only. Missing or idle sessions never transfer ownership.

## Native handoff and resume

Preparation completion/watch expiry writes a resumable record. Ordinary resume
reconciles it, keeps the current owner, and launches no native handoff.
Only an explicit user request to transfer ownership enters this branch.

1. Reconcile the [Run record](run-record.md) with Paseo sessions, Git revisions,
   forge, pending receipts, and timer expiries; live owners/sessions beat stale state.
2. Confirm both native `paseo-handoff` and its required `paseo` skill are
   discoverable in this session; only then load/follow them. Never guess calls,
   paths, profiles, or fallback models. Packaging does not prove it.
3. If either skill is missing, report the exact setup gap and keep the current
   owner. Read-only reconciliation may continue, but no replacement or ownership transfer launches.
4. Record recipient/pending receipt before launch. If uncertain, reconcile the
   actual workspace/session before retry and block duplicates.
5. Launch is not ownership. Record the recipient's explicit acceptance receipt
   before changing ownership; current owner remains accountable until then. A
   prior owner seeing a different valid accepted owner stops.

Complete record: goal, authority, intent, IDs, revisions, evidence, pending
receipts/timers, unresolved decisions, next action, and transfer ownership/gap.

## Receipts (bind each decision to evidence)

Store concise receipt references, not raw worker output, in the [Run record](run-record.md).

- Session receipt: actual agent/workspace IDs, requested provider/model and
  role; reuse on resume rather than spawn a replacement.
- Acceptance receipt: sender/recipient, accepted scope/authority, timestamp,
  and ownership session receipt.
- Review receipt: mode, applicable provenance, reviewer, SHA/base,
  verdict (`APPROVE | REQUEST_CHANGES | INCOMPLETE`), coverage, limitations and
  findings. Changed code needs a receipt for its new revision.
- Submission receipt: actual commit, review, remote confirmation; ambiguity
  requires external lookup before retry.
- Audit receipt: scope, evidenced PASS/FAIL/UNKNOWN counts/denominators and
  proposals. Only an authorized sanitized summary publishes.

## Execution tracking

One driver-owned native Paseo execution heartbeat tracks each active run. On
every tick and every completion notification, reconcile owners, authors,
pending reviews, candidate revisions, and acceptance evidence with the run
record. Verify actual session state, Git SHAs, and receipts; advance only ready,
authorized, dependency-satisfied work and record its next action. Duplicate
events are deduplicated. Healthy unchanged ticks produce no user-facing update.

Detect completed-but-unadvanced work, failed sessions, unresolved launch
receipts, and stalls; recover boundedly within existing authority. Never
duplicate a writer; idle is not complete. On resume, reconcile an existing
heartbeat before creating one. Verify existence/health through native tool
receipts and native schedule-list readback: the `create_heartbeat` return;
daemon `schedule/list` (heartbeat ID, `lastRunAt`, expiry); MCP `list_schedules`
only if it shows heartbeats. Paseo CLI `schedule inspect/ls` excludes heartbeats,
so an empty CLI listing is not evidence a heartbeat is absent. If no accessible
listing shows heartbeats, readback is unavailable: keep the `create_heartbeat`
receipt plus observed ticks as the only liveness evidence and never conclude
absence. Ambiguous creation blocks duplicates until native state is known.
Missing timer capability is a tracking gap; never claim tracking is enabled.

Evidence classes: existence is not a tick, tick is not delivery, and delivery
is not advancement. `lastRunAt` proves the timer fired, not that the
prompt was delivered or work was advanced. Advancement evidence is a run-record
transition with verified SHAs and receipts.

Stop the execution heartbeat with `delete_heartbeat` on pause, completion, or
the existing 24-hour deadline. Resume only within authority and the remaining
deadline; no silent extension. PR watch roles keep separate responsibilities
and shared deadline rules. Tracking grants no merge, release, or scope authority.

## Deadline (one rule for every owned timer)

The default 24-hour deadline covers every task-owned timer, including open-PR
monitors and watchdogs. Stop at deadline; remaining work gets a resumable
handoff, never silent renewal. Merge-ready differs from merged; human merges.

## Watch health

`axstack-monitor` and `axstack-watchdog` are independent read-only sessions on
native Paseo timers. Require handshakes. Healthy ticks are snapshots that do
not wake the driver. Deduplicate events, reconcile uncertain sends before retry,
and reuse watch state after restart.

## Audit hook (end of run and meaningful checkpoints)

Auditing defaults on for every substantive run at its end and meaningful
checkpoints such as material deviation or repeated repair. Load the bundled [audit skill](../../axstack-audit/SKILL.md)
and dispatch its auditor. An `axstack-audit` run is excluded: it writes its
record and launches no children.

The auditor reads the [Run record](run-record.md) for scope, outcomes, and
metric counts/denominators; reports evidenced PASS/FAIL/UNKNOWN; and invents no
numbers or cost. Proposals change nothing. Accepted proposals return as
tested, independently reviewed work with a regression scenario and unchanged
holdout checks. No automatic self-edit, merge, or activation. Records stay
private; publication needs separate authority.

## Idle-complete archive and retain

After required PRs merge or hand off, timers stop, and receipts verify, mark
the same [Run record](run-record.md) `Archived` in place. Preserve
scope, revisions, evidence, receipts, and expiries. Archive only idle-complete
records: never active/waiting workers, unrelated host state, or ownership merely
because it is idle.
