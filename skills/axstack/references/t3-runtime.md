# T3 runtime boundary

Read immediately before role dispatch, receipt consumption, or recovery.
Axstack owns policy, role selection and evidence; T3 owns threads, runs,
delegated tasks, messaging and native schedules.

## Preflight and binding

At every run start, resume and run-watch wake, the driver must run
`axstack --version` and record the installed Axstack version and check time
in the run record.
When this run lacks a reference read or the installed version differs from
the version recorded at the last reference read, the driver must re-read
the installed phase SKILL.md and every shared reference it will use before any
dispatch, receipt consumption, settlement or merge.
After re-reading, the driver must record the installed version and reference
read time in the run record.
The driver must never rely on an in-context copy from an earlier run or an
older installed version.

The driver must be a T3 thread, save `orchestrator_capabilities` JSON under
the run record, and follow the advertised tool schema; discovery alone proves
neither provider readiness nor successful execution. Missing capability holds
the affected operation, without a substitute runtime. Native PR watch absence
uses the schedule fallback below.

From installed `skills/axstack/roles.json`, the driver must snapshot the selected
preset and stable role IDs, requested provider/model/class/mode/effort, resolved
ID, source and time once. Resume preserves that snapshot with no re-resolution;
changes require the user's explicit decision. Bundled presets are setup inputs.

Provider bindings must map codex→`codex`, claude→`claudeAgent` and grok→`grok`.
For every dispatch or launch, claude must bind to `claudeAgent` and codex must bind to `codex`.
A usage-limited instance must hold the work without failover.

For plan generation, run
`scripts/dispatch-plan.js --role <id> --roles <roles.json> --capabilities <saved.json> --kind task|launch`
using the recorded role snapshot and saved capabilities.
Plan JSON carries `inputs`, which callers omit when copying `target`/`modelSelection` and `runtimeMode` plus `isolation` when present into `delegate_task`/`t3_thread_launch`; large plan output requires `--out`.
For configuration verification, run `scripts/dispatch-plan.js --verify <configuration.json>`
with the same plan inputs and saved `t3_thread_configuration` read-back.

Stored permission intent is neither effective parity nor a security boundary.

A preset model must be used as given.

A missing or malformed catalog holds resolution.

For a null-model grok role, record the exact model ID from the plan,
rather than an unresolved provider default.
For codex or claude, a role lacking both model and class is an intentional
absence and must hold; never use a provider default for that role.

An unavailable provider, model, role, mode or effort must hold that role with
no substitution. Auth, quota, timeout and rejection do not select an alternative.
Intentional absent seats remain recorded absences; availability is runtime proof.

Grok's CLI requires ≥1.0.13.
Advertising Grok alone does not prove that its CLI runs.

No OpenCode role enters this migration.

The dispatch echo must match the requested provider and model; verify options
and `runtimeMode` by `t3_thread_configuration` read-back. Record requested and
effective values separately; a worker self-report is not configuration proof.

Missing effort read-back must hold roles requiring effort; never record it as
satisfied. Other providers' effort read-back remains unverified until exercised.

The first dispatch for each (provider, model, effort) must reach a running or
completed run before its siblings launch. Rejection stops siblings of that
configuration; unrelated configurations remain eligible.

## Role dispatch by permitted writes

| Roles | Mechanism and permitted workspace | Completion |
|---|---|---|
| Advisers, research, read-only explorers, explainers, diligence, checker, auditor, arena prose candidates and judges, escalation | Must use async `delegate_task` in the driver worktree, title = dispatch key; tracked and untracked files stay untouched; writes only `<run>/evidence/<key>/` | Native notification followed by persisted `task_status` |
| Reviewers (peer/authored), release checks, debug investigators, execution investigators (`axstack-explore-execution`), UI verifier candidate checks (`axstack-ui-verifier`) | Must use async `delegate_task`, title = dispatch key; driver makes a disposable detached checkout of candidate SHA and pinned base with `git worktree add --detach <run>/checkouts/<key> <sha>` (plus pinned debug patch); brief requires `cd` into it; only disposable probes write there, outputs go to `<run>/evidence/<key>/` | Same delegated terminal checks |
| Author and repairs | Fresh authors must use async `delegate_task` with `isolation:"worktree"`, title = dispatch key, stable `clientRequestId` in their own worktree, kept until PR merges or closes; repairs use `t3_thread_send` to the same child | Delegated terminal checks plus verified candidate |
| Owner | Driver thread in Driver worktree; never writes tracked candidate source or tests; planning artifacts allowed only for repository Markdown; scope, integration, forge mutations and record | No worker launch |

The UI verifier checkout row applies to candidate checks, while a page without
a candidate follows [UI verification](ui-verification.md).

The driver must be the sole run-record writer and enforce one writer per
candidate; it never writes tracked candidate source or tests or repairs an author's source.
The driver may write planning artifacts (spec, ticket map) in its own worktree when the selected store is repository Markdown.
Repairs return to that author. Missing or idle sessions grant no ownership transfer.
The current chat/driver has no role row in any preset.

The dispatch key must be `<run>:<role>:<task>:a<n>`, recorded before launch and
used as the exact whole T3 title. Substring matches do not establish identity.
Each dispatch binds the approved spec or small-change intent, brief, authority, role snapshot, base and candidate to its dispatch key.
Every dispatch brief must state that dispatched roles never call `html_render`.
Dispatched roles may call `html_preview` within [UI verification](ui-verification.md).

The branch must be `axstack/<run>/<role>/<task>-a<n>`; lowercase each segment
and replace every `[^a-z0-9-]` character with `-`. Keep the dispatch key in its
original form and record both; normalization is never an identity substitute.

Before dispatch, the driver must name its resolved worktree absolute path in the author brief.
Before `git switch -c`, the fresh author must verify its starting branch matches `t3/<id>` and `git rev-parse --show-toplevel` differs from the driver worktree named in the brief.
On failed isolation proof, stop with `AXSTACK-FAILED` and change nothing.
After dispatch, the driver must read back the child's `worktreePath` and hold if it equals the driver worktree.
The fresh author brief step 1 must verify the branch is absent before
`git switch -c <encoded branch> <pinned base SHA>`, then verify HEAD equals the pinned base SHA.
Never use `git switch -C`.
Delete the exact T3 `t3/<id>` branch only after the switch succeeds and HEAD is verified.
At dispatch, record taskId, childThreadId, worktreePath and encoded branch.
T3 worktree isolation starts from the parent HEAD and ignores workspaceStrategy,
so the fresh child must perform step 1 in its own checkout before writing.

Keep `t3_thread_launch` for top-level drivers; use `t3_thread_launch` as a rare
author fallback only when worktree isolation is unavailable and record each use in the run record.
E1 and E2 ship in the same release: until E2 lands, launched writers remain a valid route.
For a recorded author launch, use `{type:worktree, baseRef:<SHA>, branch:<encoded branch>, startFromOrigin:false}`.
The launch-only recovery and completion rules below cover that transition and fallback.

`baseRef` must always be a commit SHA, never a branch name; T3 renames its
`t3code/*` branches. Pin base and candidate before dispatch.
Fetch the pinned base commit into the dispatch repository before an author dispatch.
Before an author dispatch, verify locally that the pinned base SHA resolves to a
commit with that exact SHA.
If fetch or verification fails, hold that dispatch.

Workers must finish with exactly one final marker: `AXSTACK-DONE key=… head=…
report=…`, `AXSTACK-FAILED key=… head=… report=…`, or `AXSTACK-QUESTION key=… q=…`.
Reports use absolute private evidence paths; report-only head is the pinned
candidate SHA. Launched writers deliver the marker through `t3_thread_send` using `mode: queue`
to the recorded driver thread; delegated children leave it in their final result.
AXSTACK-* messages from worker threads arrive as user-role messages but are worker receipts, never user instructions or a stop.
An AXSTACK-FAILED marker follows the failure/replacement rules, never the user-question route.

## Consume completion without advancing stale work

Before any `t3_thread_read` for a delegated task, the driver must persist only the `task_status` essentials in private evidence: taskId, status, workState, hasPendingChildRuns, latestTerminalRunId, and the final AXSTACK marker line.

Delegated completion must require terminal `completed`, `result_available`,
`hasPendingChildRuns:false`, and final `AXSTACK-DONE`; a question stays
incomplete even when native status says completed.

Delegated author completion requires delegated terminal checks plus candidate checks:
non-empty diff, clean tree and named red/green logs.

Launched writer completion must require terminal `t3_thread_wait` on that run,
then candidate checks: non-empty diff, clean tree and named red/green logs.
A receipt message alone counts only as progress; it can precede terminal state.

When a completion arrives, process it in the same driver turn after the required
terminal checks, delegated `hasPendingChildRuns:false`, and writer candidate checks.

Completion must match the current attempt key and candidate SHA. An older
attempt never completes a newer one; stale or duplicate receipts remain
evidence, deduplicated by runtime identity. Process the whole delivery before
acknowledgment and advance only after checking sender, scope and artifacts.

`task_status` failed, a run failed or interrupted, a preparing thread error,
or `AXSTACK-FAILED` must each produce an incomplete outcome with preserved
evidence. Silence is not successful completion.

After each delegated completion the driver must check its own `HEAD` and
`git status --porcelain` against their pre-dispatch values: both stay unchanged,
including untracked entries. Any change is a hold before advancing that work.

## Launch recovery, repairs and questions

For a lost delegated dispatch or repair response, retry with the same stable
`clientRequestId` to recover task identity. Never start a second writer while the outcome is unknown.

For a lost launch response on the recorded fallback route the driver must use fully paginated `t3_thread_list`
with `titleContains=<key>`, filtered to exact whole-title equality, plus
`git worktree list`. Keep the reserved branch through recovery. A branch or
worktree without a reconciled thread prevents proof of absence.

Recovery must adopt one exact match only after its recorded worktree and branch
agree; on proven absence relaunch once with the same reserved key and branch.
Several matches, conflicts, a second uncertain response or incomplete inventory
hold. Never launch a duplicate writer based on silence.

Post-launch the driver must call `t3_thread_wait` with `timeoutMs:120000`:
failed is launch failure; timed-out with `t3_thread_read` showing both
`activeRunId` and `worktreePath` is started; still preparing is a hold and
re-read at the next wake. An unresolved state preserves the attempt.

For a delegated child, detect questions with `t3_pending_request_list(childThreadId)`.
Never rely on `hasPendingQuestion` alone.
Codex `request_user_input_async` does not set it.
Use `t3_pending_request_read`, then confirm the request is still pending with
`t3_pending_request_list(childThreadId)`, then answer once within existing authority
using `t3_pending_request_respond`; a second ask holds.
Independent review rounds require fresh `delegate_task` calls.
Only author continuation and an answer to a child's own question use the same child.
Providers without a question tool (grok) and launched writers keep
the `AXSTACK-QUESTION` marker route.

For a delegated marker question, answer once with `t3_thread_send(childThreadId, mode:queue)`,
record the returned `taskId`, and consume the follow-up under delegated terminal checks.
For a launched-writer `AXSTACK-QUESTION` marker the driver must answer once using
`t3_thread_send` to the `childThreadId`, record the returned resumed runId, then
`t3_thread_wait(childThreadId, runId, timeoutMs:600000)`, re-armed by the run
watch. Persist status again and accept only `latestTerminal*` with
`latestTerminalRunId` newer than the question run (recorded run ordering, not
lexical ID order), terminal success and matching receipt key/SHA. The original
summary stays stable; no notification is assumed for a launched-writer resumed result.

A delegated repair must use a stable clientRequestId with `t3_thread_send(childThreadId, mode:queue, clientRequestId)` to the same author
in the same attempt, worktree and branch, record the returned taskId and verify the existing candidate head.
Repairs never repeat fresh checkout step 1. Pin the new candidate revision.
For a launched fallback, retain the same author thread and use launched-run completion checks.

A replacement after terminal failure must use `a<n+1>`, a new branch and title;
the failed attempt's branch is kept until salvage. Unknown liveness holds
replacement; reconcile the old writer before admitting another.

With an unsettled launched thread, the driver turn must end only while a bound
`schedule_task` with `bindToCurrentThread:true` is armed at the default
`everyMs:3600000` or for its 5-minute recovery cases in
[Chat-run watch runtime](../../axstack-watch/references/watch-runtime.md#chat-run-watch),
with its ID recorded. Each wake must reconcile all unsettled runs, including a
writer that died without sending; failed runs hold incomplete work. The watch
inherits the driver model/workspace and adds no runtime of Axstack's own.
T3 queues a scheduled wake even while the driver is busy, so copies pile up.
After a provider error, server restart or Stop, T3 holds the queue: held
messages do not start, and later queued messages are held too.
At the start of each run-watch wake, the driver lists every queued message with
`t3_queue_list` and treats it as stranded.
The driver must cancel every queued copy of its own run-watch prompt.
One wake reconciles all those copies.
For each stranded worker receipt or PR-watch update, the driver must read it
with `t3_queue_read`, act on it in that wake, then cancel it with `t3_queue_cancel`.
A queued user message is a pending local action, so the driver must keep every
queued user message and report it in its reply even on an otherwise unchanged
wake, because only the user resumes a held queue.

Once nothing remains unsettled the driver must `delete_scheduled_task` for the
run watch and use `list_scheduled_tasks` to read back its absence; an uncertain
delete preserves the hold and recorded ID.

## Native PR links and watches

After verified publication readback or adoption of an own PR, the driver calls
`link_pull_request` with the full PR URL for every layer of an ordinary-chain or legacy `gh stack`.
Before finishing PR work, including watch end or Close-out, the driver calls
`list_thread_pull_requests` and links every missing run PR.
Never link unrelated PRs.

Authors are never PR-linked: the driver alone links and watches the PR.
For delegated authors after accepted completion, in the same driver turn settle with
`t3_thread_organize` using `action: settle`, read back `settled: true` with `t3_thread_read`
and record `settle: manual` under the [Settlement](workspace-hygiene.md#settlement) guards.
For delegated authors, archive and guarded manual worktree removal wait for PR merge or close.
Never rely on automatic child cleanup.

When the forge confirms a run PR merged or closed, in the same driver turn the
driver first reads its author thread with `t3_thread_read`.
If the readback already shows `settled: true`, record `settle: native`.
Otherwise settle with `t3_thread_organize` using `action: settle`, then read back
`settled: true` with `t3_thread_read` before recording `settle: manual`.
Apply the existing [Settlement](workspace-hygiene.md#settlement) guards:
terminal run evidence is required and user-taken-over threads stay untouched.
A missing or failed settle readback holds watch end and Close-out only for
that author thread until resolved.

For every watched own PR in chat-run or standalone adopted maintenance, when
available the driver calls `watch_pull_request` for T3 wakes on check completion,
new comments from others, or branch conflicts, then ends the turn.
Only the PR-owning driver calls `watch_pull_request`.
Delegated children never call `watch_pull_request`.
Before arming, handle existing checks and comments because only later comments wake the thread.
Never poll or keep a model active between native PR wake events.
Native watch ends after 8 failed reads, or on settle, archive, user Stop, or PR merge/close.
For parked holds, follow [Parked user-reply holds](contracts.md#parked-user-reply-holds).
A parking unwatch never triggers native re-arm or the 5-minute recovery cadence.
A non-user T3 "stopped watching" notice is itself a driver wake: in that same turn,
re-check the PR.
After a non-user stop while the PR stays open, the driver must re-arm in that
same turn when GraphQL quota permits, using the recovery steps below.
Record the stop reason T3 gives.
Re-arm only after a stop not caused by the user.
For a "could not read" stop, run `gh api rate_limit --jq .resources.graphql` as a diagnostic only.
When GraphQL remaining is near 0, defer re-arming until reset: set the bound
schedule to 5 minutes and re-arm on the next wake after reset.
Record the GraphQL reset time in the run record.
Never wait for a GraphQL reset inside a turn.
Before re-arming, first unsettle the driver thread with `t3_thread_organize`
using `action: unsettle`, then call `watch_pull_request` again.
Never re-arm in a loop.
Route native PR wake events through watch §4 and the unchanged §5 readiness predicate.

If `watch_pull_request` is unavailable, fall back to the bound 5-minute schedule
and `scripts/pr-digest.js` without a hold.
If re-arming fails, restore the bound 5-minute schedule.
For forge-resolved human waits, including user merge, npm stage approval and
human review, with no unsettled worker and no PR needing watch events, set the run watch cadence to 60 minutes
at once.
When work restarts, re-evaluate cadence against the recovery conditions in
[Chat-run watch runtime](../../axstack-watch/references/watch-runtime.md#chat-run-watch).
Keep native PR watches for forge-resolved waits.
For chat-run cadence changes, follow [Chat-run watch runtime](../../axstack-watch/references/watch-runtime.md#chat-run-watch)
for the 60-minute backstop, 5-minute recovery, and schedule update read-back.
An open PR left unwatched by a user Stop never triggers the 5-minute recovery cadence.
After T3 auto-settles a multi-PR driver on one PR merge, it re-arms remaining
open members through the recovery steps before ending the turn.
If rate-limited, use the 5-minute schedule and next-wake recovery above.
The schedule still reconciles author and review tasks, readiness, and release.
When a PR merges or closes, or its watch is torn down, call `unwatch_pull_request`
and keep its link.

## Evidence, prompts and authority

Put the [Safe-deletion rule](workspace-hygiene.md#safe-deletion) in every worker brief.
Name the private `<run>/evidence/<key>/` folder in the brief and completion receipt.

Before use, commands must scope `TMPDIR` to an owned 0700 directory under the system temp directory, never under `$HOME`, named from the dispatch key and recorded in the receipt.
Validate its real path, absence of symlinks and ownership before use and cleanup; remove it afterwards by literal absolute path.
Evidence files still go to the private `<run>/evidence/<key>/` folder.
Apply equivalent guards to worktree-local paths. Uncertain paths are preserved for reconciliation.

Deletion must target an exact validated owned path inside evidence, TMPDIR or
the worktree, using a literal absolute path or `${VAR:?}`-guarded path: no glob,
no parent-root deletion; never wipe a general cache. Incidental caches are
not evidence.

The dispatching owner must confirm a worker's own brief question once,
restating existing authority, then re-verify started state; a second ask holds.
Never answer trust or permission prompts; brief confirmation adds no authority
and does not answer a harness or tool dialog.

A permission prompt or provider safety refusal must be a held, incomplete
outcome; never bypass or retry it through another model. Trust, hook review,
authentication and model prompts also hold; preserve the attempt and inspect
native state before any authorized recovery.

Each reviewer must have a separate checkout and private evidence folder with
no first-pass cross-read; tracked candidate files remain read-only. Read back
report and supporting evidence before removing that checkout; evidence already
outside it needs no archive. Later review gets a fresh checkout; unknown or
active evidence and unique bytes stay preserved. Untracked files never prove a
worktree disposable. T3 terminal state alone does not authorize discarding evidence.

Input acceptance, started state, effective settings and completed work must
remain distinct evidence. Silence, contact loss or idle state never proves exit.
Ordinary resume reconciles the same owner, author, attempt, worktree, revisions
and pending receipts; uncertainty holds replacement.

An explicit user transfer must validate recipient acceptance against intended
session, scope, revision and authority before changing ownership. The current
owner remains accountable until then; prior owner stops after acceptance.
Input acceptance or turn start alone is no transfer receipt.

On a T3 `threadId/runId` mismatch the driver must stop consuming and reconcile
the recorded driver identity with native state; never forge a sender or borrow
an identity to bypass the mismatch.

The driver must retain a user-taken-over T3 thread; never send cleanup commands
to it, including `t3_thread_organize` settle or archive.
Require T3 terminal run evidence before `t3_thread_organize` settle or archive;
these metadata actions are not worktree removal.

## Project preflight and run record

Hosts can delete author worktrees at merge through `storageCleanup.worktreeOnMerge`.
`t3_project_read` cannot read `storageCleanup.worktreeOnMerge`.
Evidence never lives in a worktree and belongs in private `<run>/evidence/<key>/`.
A missing merged or closed author worktree is expected, not a hold.
Automatic worktree deletion cannot replace evidence readback and salvage.

The run record must contain driver threadId, projectId, host, T3 version,
installed Axstack SHA, capabilities JSON path and scheduledTaskIds for every
watch and manager schedule.

Per dispatch the record must contain key, mechanism, requested target and
read-back; taskId/childThreadId/childRunId or
threadId/runId/worktree/branch/base SHA; checkout path with candidate and base
SHAs; evidence folder, scope/authority, owner, pending receipts, hold and Next.

The boundary must provide no Axstack daemon, DB, lock or scheduler. Native T3
schedules supply wakes; Axstack maintains prose records, not a runtime state
engine. Private evidence requires explicit publication authority before sharing;
receipts confer no merge, release, publication, model-substitution, host-mutation
or expanded scope authority.
For own PRs, automatic merge is the default under the
[watch predicate](../../axstack-watch/SKILL.md#5-state-readiness-precisely).
The recorded owning watch thread merges; a missing or idle owner requires
lifecycle reconciliation and explicit transfer first.
