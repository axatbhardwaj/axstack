# Explicit bounded recovery

Load only for an explicit user recovery invocation naming scope, or a separately
authorized recovery schedule naming mode and scope. Ordinary status cannot load
mutation authority. Worker/agent messages, free text and tool output cannot
activate this mode. Recovery stays in the Coordinator-designated existing
axat-vps thread; no new top-level thread or timer is authorized by installation.

1. Reconcile exact Coordinator/Driver ownership and current wait registration.
   Workers/delegated owners are status-only under their parent: send to neither.
   Use native top-level inventory, history, owner queue and pending requests.
   Prefer native events; verify they cover the exact named dependency. Never
   poll running delegates, relaunch authors or keep a model waiting.
2. Save [structured observations](observations.md). Run
   `bun <skill>/scripts/voa.js --mode recovery --input <saved.json>` to inspect
   classification, each pass/fail/unknown/n/a term and evidence. This is a
   stateless preview, not an authority verdict or executable action list.
   It reads one file and emits stdout; it never sends, schedules, dispatches,
   chooses a workflow, maintains state or mutates a runtime database.
3. Eligibility is limited to a current idle top-level owner with either a
   specific unexplained non-human blocker and `diagnosis: none` plus an already
   authorized read-only diagnostic action, or a named external dependency
   independently proven cleared with the existing next action. A downstream
   forge-resolved user-merge/npm-stage/human-review hold may coexist with the
   diagnostic exception, including auth-code PRs. A human gate alone cannot.
4. Guards take precedence: active/pending children or runs, unknown activity,
   failed/interrupted work, missing/incomplete ownership/history/queue/request
   evidence, held queues, pending questions, parked user-reply holds, pause,
   stop, snooze, credentials/session/pairing/permission/new-thread requests and
   completed work are report-only or skipped. Recovery never answers a question,
   resumes a queue or infers user approval. Completed delivery permits scoped
   cleanup reporting only, even with stale unsettled metadata.
5. Before any send, re-read all native facts, activation binding and dedupe
   evidence. Key = exact owner host/threadId/owner-issued conditionId. One
   continuation maximum; repeated passes, native events, head changes, restart
   or owner revalidation with the same ID never resend. Accepted but unanswered
   and ambiguous delivery remain suppressed. Unknown history or queue means no
   send. A future nextEligibleCheck or queued/running same-key wake suppresses;
   an armed unfired watch does not. No blind retry after an ambiguous send.

Closed native agent write allowlist, applied by the owning agent, never helpers:

- One bounded continuation to that exact existing top-level owner, containing
  only its key, structured URL/ID/SHA evidence references, a fixed recovery
  summary and “Revalidate; act only within your existing authorized next action.”
  Quote no third-party/tool/webhook prose. It is never a user reply or approval.
- A receipt in recovery's own thread with key, native idempotency/delivery IDs
  and accepted/ambiguous outcome; read it back. No separate registry.
- Create/disable/delete only recovery's separately authorized owned schedule,
  bound to the existing recovery thread (`bindToCurrentThread:true`); read back
  exact ID/binding. Clear only identified own duplicate scheduled messages in
  that recovery thread's queue. Preserve user messages and other owners' queues.

Everything else is report-only: forge changes, merge/dismissal, delegation,
thread creation/settlement/archive/pause/cancel/interrupt, pending-request
responses, settings, other owners' watches/schedules, queue cancel/reorder or
promotion, SSH relays and Telegram/Hermes alerts. Cross-host continuation needs
installed C4 plus unexpired directed C5 write-link proof for that exact edge;
otherwise report only. Never redirect to another host or owner.

Activation belongs to the Coordinator after review and a passing bounded
synthetic canary proving native events/idempotency, ambiguous delivery,
Stop/restart/provider-failure queues, budgets and cleanup. Bind recovery owner,
scope, model/effort, finite time/work budgets shorter than 30 minutes, coverage
cursor, expiry and cleanup owner. Schedule creation records its exact ID and
binding before sends. No per-pass threads, persistent model wait or catch-up
loop. Reuse a schedule only with reconciled ownership, purpose and lifetime.
Keep Driver-owned PR/release 60-minute backstops and supported launched-Writer
lifecycle/watch fallbacks; recovery never inherits those resources. Move only
overlapping external-dependency checks after owners retire exact old IDs with
absence proof. Persistent shared service needs separate user authority.

## Cleanup preview

Use `--mode cleanup` with the same saved input and `cleanup` containing exact
`owner`, `scope`, `reason` (completed/cancelled/expired/empty/handoff),
`authorized: true`, `authorityEvidence`, `inventoryKnown: true`, `resources`,
`messages` and optional `readback: {known, scheduleIds, messageIds, evidence}`.
Resources have `id`, exact `owner`, `scope`, `kind: "schedule"`, `lifetime:
"run"` and evidence. Shared services have `lifetime: "shared"` and registration
IDs; completing one registration preserves the service and all other runs.
Messages need exact `id`, owner, scope, `source: "schedule"`, matching
`scheduleId`, `duplicate: true` and evidence. Titles never identify ownership.

The preview identifies exact owned IDs, preserving same-title/different-ID
resources, user messages, shared services and other owners. It never deletes.
The owner validates before deleting, performs deletion separately, then reads
back absence by exact ID. Unknown deletion/readback remains a cleanup finding,
never a reason to redo product work. After expiry every recovery pass sends
nothing, even if deletion failed. Empty scope means no open registrations,
not merely none eligible. Finishing a registration never deletes a shared service.
