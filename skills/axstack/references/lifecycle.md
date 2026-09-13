# Shared lifecycle and receipts

Phases load this directly or through the mandatory edge in
[Standing contracts](contracts.md). Substantive delegated or resumable work
uses the [Run record](run-record.md), whose driver-owned ledger binds lifecycle
state and receipts to exact revisions.

## Roster (compact)

- Driver: current chat. Owns run scope, decisions, cross-PR dependencies,
  Linear mutations, and integration.
- Owner (`axstack-owner`): one persistent owner per PR. Launches its author,
  reviewers, monitor, and watchdog; may perform authorized PR-scoped
  publication within user authority. The human merges by default.
- Author: exactly one writer per candidate at a time. Accepted fixes return to
  the original author. Workers launch no recursive teams.
- Reviewers: exactly two independent final reviewers (Sol + Opus), receiving
  the same brief and no first-pass cross-read.
- Monitor/watchdog: independent read-only Opus medium sessions on native Paseo
  timers.
- Auditor (`axstack-auditor`): report-only evidence collection. It never edits,
  merges, activates, or audits itself.

Prefer useful parallel work by independent subagents with bounded tasks and no
redundant workers; keep one writer per candidate and the default two active PRs.

## Ownership

The PR owner remains accountable for candidate, fixes, evidence, and monitoring.
Peer code stays read-only. A missing or idle session never transfers ownership.

## Native handoff and resume

Axstack stores resumable state. Preparation completion and watch expiry write a
resumable record; ordinary resume reconciles it. These cases keep the current
owner and launch no native handoff. Only an explicit user request to transfer
ownership enters the native `paseo-handoff` branch below.

1. Reconcile the [Run record](run-record.md) with Paseo sessions, Git revisions,
   forge state, pending receipts, and timer expiries. Actual live owners and
   sessions win over stale record state.
2. For an explicit user-requested ownership transfer, confirm that both native
   `paseo-handoff` and its required `paseo` skill are
   discoverable in the current session. Only then load them and
   follow their instructions. Axstack neither copies their procedure nor
   guesses commands, paths, profiles, or fallback models. Packaging does not
   prove current-session discoverability.
3. If either skill is missing, report the exact setup gap and keep the current
   owner. Safe read-only reconciliation, investigation, and run-record updates
   may continue, but no replacement or ownership transfer launches.
4. Record the intended recipient and pending launch receipt before launch. If
   the result is uncertain, reconcile the actual workspace/session before
   retrying; keep duplicate writers, watches, replies, and deliveries blocked.
5. A launched recipient is not yet the owner. Record the recipient's explicit
   acceptance receipt, then change the Driver/Owner field. Until acceptance,
   the current owner remains accountable. A prior owner that observes a
   different valid accepted owner stops.

A resumable record is complete when it points to goal, authority, intent, IDs,
revisions, evidence, pending receipts/timers, unresolved decisions, and next
action. A transfer record also points to accepted ownership or the retaining gap.

## Receipts (bind each decision to evidence)

Store concise receipt references in the [Run record](run-record.md), not raw
worker output.

- Session receipt: actual agent/workspace IDs, requested provider/model, and
  role. Reuse it on resume rather than spawning a replacement.
- Acceptance receipt: named sender and recipient, accepted scope/authority,
  timestamp, and the session receipt taking ownership.
- Review receipt: reviewer, candidate SHA, verdict
  (`APPROVE | REQUEST_CHANGES | INCOMPLETE`), coverage, limitations, and
  findings. Changed code needs a refreshed receipt for its new revision.
- Submission receipt: actual commit parameter, consolidated review, and remote
  confirmation. On ambiguity, look up external state before retrying.
- Audit receipt: scope, PASS/FAIL/UNKNOWN evidence with counts and denominators,
  plus improvement proposals. Only an authorized sanitized summary publishes.

## Deadline (one rule for every owned timer)

The default 24-hour deadline applies to every task-owned timer, including
still-open PR monitors and watchdogs. Stop them at the deadline; remaining work
gets a resumable handoff, never silent renewal. Merge-ready is distinct from
merged; the human merges by default.

## Watch health

Monitor and watchdog are independent read-only Opus medium sessions on native
Paseo timers. Require verified handshakes. Healthy ticks are snapshots that do
not wake the driver. Deduplicate events, reconcile uncertain sends before
retry, and reuse watch state after restart.

## Audit hook (end of run and meaningful checkpoints)

Auditing is enabled by default for every substantive run. At run end and useful
checkpoints such as material deviation or repeated repair, load the bundled [audit skill](../../axstack-audit/SKILL.md)
and dispatch the auditor. An `axstack-audit` run is excluded: it writes its
record and launches no children.

The auditor collects read-only evidence against the [Run record](run-record.md):
scope, outcomes, and metric counts with denominators. It reports
PASS/FAIL/UNKNOWN with evidence and never invents numbers or cost. Proposals
change nothing by themselves; each accepted proposal returns as tested,
independently reviewed work with a regression scenario and unchanged holdout
checks. There is no automatic self-edit, merge, or activation. Raw records
remain private; publication needs separate authority.

## Idle-complete archive and retain

After required PRs are merged or handed off, owned timers are stopped, and
receipts are verified, mark the same [Run record](run-record.md) `Archived` in
place. Preserve scope, revisions, evidence, receipts, and timer expiries. Only
archive idle-complete task records: never active/waiting workers or unrelated
host state, and never ownership merely because it is idle.
