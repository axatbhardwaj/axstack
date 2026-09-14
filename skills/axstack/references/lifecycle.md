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
  `axstack-watchdog` roles, activated through native Orca automations only when
  the accepted role-pinning and bounded-expiry contract is supported.
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
active Run. Process each whole delivery before acknowledgment and validate its
Task, Dispatch, sender, authority, revisions, and receipts before advancing the
run record. Duplicate deliveries are deduplicated by runtime identity. Healthy
unchanged observations produce no user-facing update.

Detect completed-but-unadvanced work, failed sessions, unresolved launch
receipts, and stalls through the version-matched orchestration guide. Never
duplicate a writer; idle is not complete. `input_accepted`, `turn_started`,
session liveness, delivery, and verified advancement are distinct evidence.
On `consumer_fenced`, reconcile the active coordinator rather than borrowing an
identity. Respect settlement protection including `user_takeover`.

No execution heartbeat or substitute scheduler is created by Axstack. Native
watch automation is separately held under [Watch health](#watch-health).
Tracking grants no merge, release, model-substitution, or scope authority.

## Deadline (one rule for every owned timer)

The default 24-hour deadline covers every task-owned timer, including open-PR
monitors and watchdogs. Stop at deadline; remaining work gets a resumable
handoff, never silent renewal. Merge-ready differs from merged; human merges.

## Watch health

The accepted policy keeps `axstack-monitor` and `axstack-watchdog` independent
and read-only, with quiet healthy snapshots, deduplicated actionable events,
restart reconciliation, and one shared deadline. Current native Orca
automations expose a provider but cannot pin model, effort, or permission, and
cannot prove the accepted bounded expiry. Hold activation and the complete
migration claim; create no schedule, use no legacy fallback, and build no custom
scheduler. Core supervised work may continue. Details live in
[Watch runtime](../../axstack-watch/references/watch-runtime.md).

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
