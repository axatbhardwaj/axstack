# T3 runtime boundary

Read immediately before role dispatch, receipt consumption, or recovery.
Axstack owns policy, role selection and evidence; T3 owns threads, runs,
delegated tasks, messaging and native schedules.

## Preflight and binding

The driver must be a T3 thread, save `orchestrator_capabilities` JSON under
the run record, and follow the advertised tool schema; discovery alone proves
neither provider readiness nor successful execution. Missing capability holds
the affected operation, without a substitute runtime. Native PR watch absence
uses the schedule fallback below.

From installed `skills/axstack/roles.json`, the driver must snapshot the selected
preset and stable role IDs, requested provider/model/class/mode/effort, resolved
ID, source and time once. Resume preserves that snapshot with no re-resolution;
changes require the user's explicit decision. Bundled presets are setup inputs.

Provider bindings must map grok→`grok` and antigravity→`antigravity`, with
canonical error-exit fallbacks codex→`codex` and claude→`claudeAgent`.
At each dispatch or launch, claude and codex must bind to the instanceId printed
by `scripts/pick-instance.js --provider <provider>`.
For dispatched roles, only error exit 1 permits fallback to the canonical instance after validating availability.
Exit 2 (no eligible provider instances) must hold the work without fallback.
Record the chosen instanceId and a pointer to saved `--json` output in the dispatch record.
Only same-provider, same-model account selection among instances of one driver
is permitted, with provider, model, class and effort rules required to remain unchanged.
An exhausted account with no eligible sibling must hold.
Dispatched roles never fail over mid-thread.

When the driver starts or resumes a run and at the start of every run-watch wake,
it runs `scripts/pick-instance.js --provider <its own provider> --json`.
Read its current binding with `t3_thread_configuration` and save picker JSON in private run evidence.
If the driver's own current instance is `excluded` for a usage limit and an eligible
same-provider sibling exists, it must switch itself via `t3_thread_configure` to the
chosen sibling instance, keeping the same provider, model and effort/options, then continue.
The driver must record from/to instance, a pointer to saved picker JSON and UTC time in `progress.md`.
If the driver's own current instance is eligible, it must stay despite headroom differences.
On exit 2 (no eligible sibling), the driver must hold under the existing rule.
On error exit 1, the driver must keep its current instance.
Driver account re-selection must configure only the calling thread and only at a turn boundary.
A turn already paused by a usage limit cannot self-recover.
The next wake or user message runs this check.

Driver self-switching is required from v0.25.1.
T3 scheduled tasks retain the creation-time instanceId for wakes and fresh-thread
passes regardless of the calling thread's current binding.
The driver must arm a run watch only after picking its account: `pick-instance.js` before `schedule_task`.
On a driver self-switch, delete and recreate its armed bound run watch with the
same prompt, cadence and binding on the new instance.

Every scheduled automation pass runs `scripts/pick-instance.js --provider <its own provider> --json`
at pass start, including fresh-thread review-manager passes.
Scheduled passes follow the driver's eligibility and stay rules: an eligible own instance stays,
exit 1 keeps the current instance and exit 2 holds.
If a scheduled pass's own current instance is `excluded` and an eligible same-provider sibling exists,
it must switch itself via `t3_thread_configure` to the chosen sibling instance,
keeping the same provider, model and effort/options.
On a scheduled pass self-switch in a review-manager lane, only the owner-of-record, after lane reconciliation
and the duplicate check, must delete and recreate its own schedule with the same
prompt, cadence and binding on the chosen instance.
On any other scheduled pass self-switch, delete and recreate its own schedule with
the same prompt, cadence and binding on the chosen instance only after `list_scheduled_tasks`
confirms no replacement for that schedule on the chosen instance already exists.
If a replacement for that schedule on the chosen instance already exists, any other scheduled pass must skip recreation.
For a review-manager self-switch, only the owner-of-record must update the recorded
`axstack-owner` binding's instanceId to the chosen instance after verifying unchanged
provider/model/effort/options with `t3_thread_configuration` and attaching the picker
switch receipt, before the admission binding comparison.
For each schedule replacement, read back old absence and new presence using `list_scheduled_tasks`.
For each schedule replacement, record old/new scheduledTaskId, from/to instance,
picker JSON pointer and UTC time in the `progress.md` or durable activation/continuity record.
Retain the recorded schedule's title and enabled state and use a fresh stable creation `clientRequestId`.
An uncertain replacement holds affected work: preserve its native receipts for reconciliation.
A scheduled pass already running on an exhausted account cannot recover.
Account switches must happen before exhaustion at the picker's near-limit cutoff.

Map `modeId` to `runtimeMode:full-access` and effort
to `options:[{id,value}]`. Stored permission intent is neither effective parity
nor a security boundary.

A preset model must be used as given.

`modelClass` must resolve to the newest matching catalog ID for that provider:
codex `gpt-<N>-<class>`, claude `claude-<class>-<N>-<N>`. Use
`scripts/resolve-models.js --provider <provider> --capabilities <path> (--class <class> | --model <model>) --effort <effort>`
with the saved capabilities JSON path;
a missing or malformed catalog holds resolution.
Model catalog resolution retains the canonical instance IDs above.

A `model:null` role lacking a class must use the first model listed for its
provider in saved capabilities only for grok and antigravity (launch-by-agent-id
providers); record the exact ID, rather than an unresolved provider default.
Antigravity must hold when saved capabilities advertise zero models.
For Antigravity, first-listed selection must use the first model ID ending in `-<effort>` because its model ID encodes effort.
No matching effort suffix holds resolution for Antigravity.
For Antigravity, pass no effort option; effort read-back uses the model ID suffix.
For codex or claude, a role lacking both model and class is an intentional
absence and must hold; never use a provider default for that role.

An unavailable provider, model, role, mode or effort must hold that role with
no substitution. Auth, quota, timeout and rejection do not select an alternative.
Here alternative means a provider or model substitution, excluding the bounded
same-provider, same-model account selection above.
Intentional absent seats remain recorded absences; availability is runtime proof.

Codex effort must use option ID `reasoningEffort`.

Claude effort must use option ID `effort`.

Grok effort must use `reasoningEffort` and exclude `max`; its CLI requires ≥1.0.13.
Advertising Grok alone does not prove that its CLI runs.

OpenCode effort must use `variant` (no OpenCode role enters this migration).

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
| Advisers, research, read-only explorers, explainers, diligence, checker, auditor, monitor, arena prose candidates and judges, escalation | Must use async `delegate_task` in the driver worktree, title = dispatch key; tracked and untracked files stay untouched; writes only `<run>/evidence/<key>/` | Native notification followed by persisted `task_status` |
| Reviewers (peer/authored), release checks, debug investigators, execution investigators (`axstack-explore-execution`), UI verifier candidate checks (`axstack-ui-verifier`) | Must use async `delegate_task`, title = dispatch key; driver makes a disposable detached checkout of candidate SHA and pinned base with `git worktree add --detach <run>/checkouts/<key> <sha>` (plus pinned debug patch); brief requires `cd` into it; only disposable probes write there, outputs go to `<run>/evidence/<key>/` | Same delegated terminal checks |
| Author and repairs | Must use `t3_thread_launch` with `{type:worktree, baseRef:<SHA>, branch:<encoded branch>, startFromOrigin:false}` in their own worktree, kept until PR merges or closes | Writer sends a receipt to the driver; driver verifies terminal run and candidate |
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

`baseRef` must always be a commit SHA, never a branch name; T3 renames its
`t3code/*` branches. Pin base and candidate before dispatch.

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

Launched writer completion must require terminal `t3_thread_wait` on that run,
then candidate checks: non-empty diff, clean tree and named red/green logs.
A receipt message alone counts only as progress; it can precede terminal state.

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

For a lost launch response the driver must use fully paginated `t3_thread_list`
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

For `AXSTACK-QUESTION` the driver must answer once using `t3_thread_send` to
the `childThreadId`, record the returned resumed runId, then
`t3_thread_wait(childThreadId, runId, timeoutMs:600000)`, re-armed by the run
watch. Persist status again and accept only `latestTerminal*` with
`latestTerminalRunId` newer than the question run (recorded run ordering, not
lexical ID order), terminal success and matching receipt key/SHA. The original
summary stays stable; no notification is assumed for a resumed result.

A repair must use `t3_thread_send(writerThreadId, mode:queue)` to the same
author in the same attempt and worktree; pin the new candidate revision.

A replacement after terminal failure must use `a<n+1>`, a new branch and title;
the failed attempt's branch is kept until salvage. Unknown liveness holds
replacement; reconcile the old writer before admitting another.

With an unsettled launched thread, the driver turn must end only while a bound
`schedule_task` with `bindToCurrentThread:true`, `everyMs:300000` is armed and
its ID recorded. Each wake must reconcile all unsettled runs, including a
writer that died without sending; failed runs hold incomplete work. The watch
inherits the driver model/workspace and adds no runtime of Axstack's own.

Once nothing remains unsettled the driver must `delete_scheduled_task` for the
run watch and use `list_scheduled_tasks` to read back its absence; an uncertain
delete preserves the hold and recorded ID.

## Native PR links and watches

After verified publication readback or adoption of an own PR, the driver calls
`link_pull_request` with the full PR URL for every layer of a `gh stack`.
Before finishing PR work, including watch end or Close-out, the driver calls
`list_thread_pull_requests` and links every missing run PR.
Never link unrelated PRs.

For every watched own PR in chat-run or standalone adopted maintenance, when
available the driver calls `watch_pull_request` for T3 wakes on check completion,
new comments from others, or branch conflicts, then ends the turn.
Never poll or keep a model active between native PR wake events.
When T3 reports it stopped watching a PR, the next wake re-checks the PR and
calls `watch_pull_request` again.
This includes a stop after T3 could not read the PR for 15 minutes.
Route native PR wake events through watch §4 and the unchanged §5 readiness predicate.

If `watch_pull_request` is unavailable, fall back to the bound 5-minute schedule
and `scripts/pr-digest.js` without a hold.
Keep the schedule cadence unchanged while a native PR watch is active,
including the existing 7-day quiet relaxation.
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

`worktreeCleanup` must be `off` for every Axstack project. Preflight reads it
with `t3_project_read` where exposed; otherwise record a limitation pointing
to the documented installation setup step. Automatic worktree deletion cannot
replace evidence readback and salvage.

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
