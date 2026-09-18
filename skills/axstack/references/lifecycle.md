# Shared lifecycle and receipts

Phases load through [Standing contracts](contracts.md).
Delegated or resumable work uses a driver-owned [Run record](run-record.md)
binding state and receipts to exact revisions.

## Roster (compact)

- Driver: current chat; owns scope, decisions, cross-PR dependencies, Linear
  mutations, and integration.
- Owner: driver owns loop PRs; `axstack-owner` only for standalone watch/review
  without live driver. It may perform PR-scoped publication within user authority. Human
  merge is default.
- Author: exactly one writer per candidate; accepted fixes return there.
  Workers launch no recursive teams.
- Reviewers: peer = two independent `axstack-reviewer-primary` and
  `axstack-reviewer-secondary` sessions with identical brief and isolated first
  pass; authored = one eligible configured reviewer from actual author
  provenance. Owner and author never review.
- Automation driver/monitor/watchdog: see [Watch health](#watch-health).
- Auditor (`axstack-auditor`): report-only; never edits, merges, activates, or
  audits itself.

Prefer parallel independent bounded work; no redundant workers.
Per [standing contracts](contracts.md), fanout is dependency/capacity-driven
with no fixed count, within host and spending limits. [PR shape](pr-shape.md)
covers theme/size; queue via `gh stack`.

## Ownership

The PR owner remains accountable for candidate, fixes, evidence, and monitoring;
peer code stays read-only. Missing or idle sessions never transfer ownership.
Owned implementation enters review through the revision-bound
[candidate-publication boundary](candidate-publication.md).

## Native handoff and resume

Preparation completion/watch expiry writes a resumable record. Ordinary resume
reconciles it, keeps the current owner, and launches no native handoff.
Only an explicit user request to transfer ownership enters this branch.

1. Reconcile the [Run record](run-record.md) with Orca Tasks, Dispatches,
   sessions, Git revisions, forge, pending receipts, and timer expiries; live
   owners and authoritative Dispatches beat stale state.
2. Load the [Orca runtime boundary](orca-runtime.md), then follow its
   version-matched runtime-owned handoff guidance. Never guess calls, paths,
   roles, or fallback models. Guide discovery does not prove capability.
3. If the required native capability is missing, report the exact setup gap and
   keep the current owner; no replacement or ownership transfer launches.
   Read-only reconciliation may continue.
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

The driver consumes native Orca completion and escalation deliveries for the
active Run. A driver turn does not end while a Dispatch is unsettled unless one
completion wait from the orchestration guide is armed (background where the
harness supports it, foreground otherwise) and re-armed on timeout; sleep or
poll loops are forbidden. An explicitly invoked phase dispatches its configured
roles through Orca and closes with the lifecycle close-out; in-chat execution
covers only ordinary reading, writing, and local checks. Heartbeat deliveries
are acknowledged with no user-facing text. Process each whole delivery before
acknowledgment and validate its Task, Dispatch, sender, authority, revisions,
and receipts before advancing the run record. Duplicate deliveries are
deduplicated by runtime identity. Healthy unchanged observations produce no
user-facing update.

Detect completed-but-unadvanced work, failed sessions, unresolved launch
receipts, and stalls through the version-matched orchestration guide. Never
duplicate a writer; idle is not complete. `input_accepted`, `turn_started`,
session liveness, delivery, and verified advancement are distinct evidence.
On `consumer_fenced`, reconcile the active coordinator rather than borrowing an
identity. Respect settlement protection including `user_takeover`.

No execution heartbeat or substitute scheduler is created by Axstack. Native
watch automation follows [Watch health](#watch-health).
Tracking grants no merge, release, model-substitution, or scope authority.

## Deadline (one rule for every owned timer)

The default 24-hour deadline covers standalone task-owned timers. Stop them at
deadline and preserve remaining work; there is no watch deadline for
automations. A PR is merge-ready only with the applicable review receipt(s) at
its exact head; green CI or tests alone never make it merge-ready. Merge-ready
differs from merged; human merges.

## Watch health

The user lifted the native-watch hold by user decision on 2026-09-16. The
driver automation is a mutating owner for its PRs; `axstack-watchdog` stays
independent and read-only. The driver every 15 minutes dispatches and exits;
the watchdog is model-free, has no gate, and records `watchdog.log`; there is
no watch deadline for automations. Build no custom scheduler and use no legacy
fallback. Details live in
[Watch runtime](../../axstack-watch/references/watch-runtime.md).

## Audit hook (close-out and meaningful checkpoints)

Audit measurement is enabled by default for every substantive run; dispatch
follows [Close-out](#close-out) or a material-deviation/repeated-repair
checkpoint. An `axstack-audit` run is excluded; it launches no children.
Load [axstack-audit](../../axstack-audit/SKILL.md). Accepted proposals
require a regression scenario and unchanged holdout checks; they change
nothing without tested independent review.

## Close-out

After PRs merge by forge state—not branch ancestry—close out: (1) settle every worker
terminal; (2) compact record with counts and denominators: user interventions,
deviations from plan, repairs; (3) `axstack-auditor` decision: settle
non-zero/requested, else `counts zero`; an unavailable auditor leaves close-out
pending, never skipped silently; (4) release merged run worktrees and branches;
close Linear tickets; (5) mark record `Archived`. `Archived` needs one each:
settlement receipt; compact record path; auditor decision plus settlement
receipt or `counts zero`; release and ticket receipts; archive timestamp. An
`active`/receipt-incomplete record is close-out pending, never done. Lookups
exempt.
