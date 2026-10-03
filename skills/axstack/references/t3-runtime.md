# T3 runtime boundary

Read immediately before role dispatch, receipt consumption, or recovery.
Axstack owns policy, role selection and evidence; T3 owns threads, runs,
delegated tasks, messaging and native schedules.

## Preflight and binding

The driver must be a T3 thread, save `orchestrator_capabilities` JSON under
the run record, and follow the advertised tool schema; discovery alone proves
neither provider readiness nor successful execution. Missing capability holds
the affected operation, without a substitute runtime.

From installed `skills/axstack/roles.json`, the driver must snapshot the selected
preset and stable role IDs, requested provider/model/class/mode/effort, resolved
ID, source and time once. Resume preserves that snapshot with no re-resolution;
changes require the user's explicit decision. Bundled presets are setup inputs.

Provider bindings must map codex→`codex`, claude→`claudeAgent`, grok→`grok`,
antigravity→`antigravity`. Map `modeId` to `runtimeMode:full-access` and effort
to `options:[{id,value}]`. Stored permission intent is neither effective parity
nor a security boundary.

A preset model must be used as given.

`modelClass` must resolve to the newest matching catalog ID for that provider:
codex `gpt-<N>-<class>`, claude `claude-<class>-<N>-<N>`. Use
`scripts/resolve-models.js --provider` with the saved capabilities JSON path;
a missing or malformed catalog holds resolution.

A `model:null` role lacking a class must use the first model listed for its
provider in saved capabilities only for grok and antigravity (launch-by-agent-id
providers); record the exact ID, rather than an unresolved provider default.
Antigravity must hold when saved capabilities advertise zero models.
For codex or claude, a role lacking both model and class is an intentional
absence and must hold; never use a provider default for that role.

An unavailable provider, model, role, mode or effort must hold that role with
no substitution. Auth, quota, timeout and rejection do not select an alternative.
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
| Reviewers (peer/authored), release checks, debug investigators, execution investigators (`axstack-explore-execution`), UI verifier (`axstack-ui-verifier`) | Must use async `delegate_task`, title = dispatch key; driver makes a disposable detached checkout of candidate SHA and pinned base with `git worktree add --detach <run>/checkouts/<key> <sha>` (plus pinned debug patch); brief requires `cd` into it; only disposable probes write there, outputs go to `<run>/evidence/<key>/` | Same delegated terminal checks |
| Author and repairs, code-arena writers | Must use `t3_thread_launch` with `{type:worktree, baseRef:<SHA>, branch:<encoded branch>, startFromOrigin:false}` in their own worktree, kept until PR merges or closes | Writer sends a receipt to the driver; driver verifies terminal run and candidate |
| Owner | Driver thread in Driver worktree; never writes tracked files; scope, integration, forge mutations and record | No worker launch |

The driver must be the sole run-record writer and enforce one writer per
candidate; it never writes tracked files or repairs an author's source.
Repairs return to that author. Missing or idle sessions grant no ownership transfer.
The current chat/driver has no role row in any preset.

The dispatch key must be `<run>:<role>:<task>:a<n>`, recorded before launch and
used as the exact whole T3 title. Substring matches do not establish identity.
Each dispatch binds the approved spec or small-change intent, brief, authority, role snapshot, base and candidate to its dispatch key.

The branch must be `axstack/<run>/<role>/<task>-a<n>`; lowercase each segment
and replace every `[^a-z0-9-]` character with `-`. Keep the dispatch key in its
original form and record both; normalization is never an identity substitute.

`baseRef` must always be a commit SHA, never a branch name; T3 renames its
`t3code/*` branches. Pin base and candidate before dispatch.

Workers must finish with exactly one final marker: `AXSTACK-DONE key=… head=…
report=…`, `AXSTACK-FAILED key=… head=… report=…`, or `AXSTACK-QUESTION key=… q=…`.
Reports use absolute private evidence paths; report-only head is the pinned
candidate SHA. Launched writers deliver the marker through `t3_thread_send`
to the recorded driver thread; delegated children leave it in their final result.

## Consume completion without advancing stale work

The driver must persist `task_status` in private evidence before any
`t3_thread_read` for that delegated task; save the whole response before
consuming or expanding its result.

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
`schedule_task` with `bindToCurrentThread:true`, `everyMs:600000` is armed and
its ID recorded. Each wake must reconcile all unsettled runs, including a
writer that died without sending; failed runs hold incomplete work. The watch
inherits the driver model/workspace and adds no runtime of Axstack's own.

Once nothing remains unsettled the driver must `delete_scheduled_task` for the
run watch and use `list_scheduled_tasks` to read back its absence; an uncertain
delete preserves the hold and recorded ID.

## Evidence, prompts and authority

Put the [Safe-deletion rule](workspace-hygiene.md#safe-deletion) in every worker brief.
Name the private `<run>/evidence/<key>/` folder in the brief and completion receipt.

Before use or temporary cleanup, commands must scope `TMPDIR` to a 0700 owned
folder whose real path equals or is inside the recorded run evidence folder,
has no symlink, and matches the dispatch owner. Apply equivalent guards to
worktree-local paths. Uncertain paths are preserved for reconciliation.

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
or expanded scope authority. Human merges by default.
