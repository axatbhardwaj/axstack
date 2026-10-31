# Fleet nonwriter dispatch and receipts (C3a)

This contract joins C1 recommendation and C2 sampling to native T3 execution.
It does not deploy a routing switch. Read [T3 runtime](t3-runtime.md) and the
[selector schema](fleet-route-schema.md). The driver owns all native calls,
records and forge actions. Helpers validate explicit saved inputs only: no
network, clock, dispatch, retry, merge, retained state or aggregate permission grant.
Synthetic evidence can pass binding checks; helpers cannot authenticate it.

## Observe before selecting

1. Record installed Axstack and both T3 versions, directed origin/target link,
   explicit time, exact reviewed config bytes/digest and installed role snapshot.
   Map each environmentId to its configured hostId. Hosts, environments, projects,
   threads and paths are distinct namespaces. Never reuse origin project/thread IDs
   or filesystem paths on a destination by assumption.
2. On origin call `t3_environment_links`; preserve raw output and expiry/access.
   On each eligible destination use forwarded `t3_environment_read`,
   `t3_project_list` (all pages), `t3_project_read` for the actual project and
   `orchestrator_capabilities({environmentId})`. Preserve exact catalog bytes and
   SHA-256. Observe repository identity/workspaceRoot and actual required session
   access there. Authentication occurs on that session host; copy no credentials.
   Discovery is not proof that the provider executes. Unknown catalog, project,
   mode, options, access, link or required session excludes that destination.
3. Keep the model/effort/provider pins from the run; do not re-resolve to another
   model when quota/auth/timeout fails. Missing native `t3_thread_configuration`
   means unavailable effective fields stay unknown. Catalog runtimeModes advertise
   provider restrictions; they do not prove effective access. Native task/thread facts supply
   only the fields actually returned. A worker assertion is not native readback.
4. Normalize current driver assignments and the pending batch as below. Sample
   telemetry with C2's bounded command, then recompute C1 immediately before each
   dispatch using the collector time and current exclusions. Preserve the full
   recommendation JSON bytes and complete replayable input. Unknown inventory
   is unknown, not a claimed zero; pending lower bounds are labelled separately.

### Saved native inventory

Set optional selector input `nativeInventory` to
`{complete, observedAt, evidence, tasks, pending}`. With this field, it is the
inventory source; legacy normalized arrays remain for non-fleet callers.
`complete:true` requires the driver's complete current assignment collection,
including unsettled attempts, descendants and pending submissions. API failures,
pagination gaps, missing ownership or unreconciled launches set complete false.
The helper cannot independently prove that a caller collected every task.

Each tasks entry is `{origin:{environmentId,threadId}, clientRequestId, task,
assignmentRoot?}`. `task` is saved native task_status, with its actual taskId.
For remote tasks use remoteChild.environmentId/threadId even if childThreadId
is null. For local tasks require a nonempty childThreadId before using origin's
environment. Native childRunId is an initial observation, not a final-run pin.
Origin-qualified JSON tuple task identities avoid cross-host ID collisions.
Do not count an unrelated thread just because its ID matches on another host.

A nested entry can name `assignmentRoot:{environmentId,taskId}` for its observed
coordinator task. Both must exist on the same destination; unresolved/conflicting
roots remain unknown. One assignment counts once while any member is active.
This normalization supports evidence reconciliation; it does not enable authors.
Pending entries are `{origin:{environmentId,threadId},clientRequestId,environmentId,
taskId?}`. Update a pending entry with its returned taskId; accepted/nested/terminal
reflections count once. Ambiguous submissions remain pending until reconciled;
remove only confirmed not-submitted failures. Client identity includes the driver
thread, not just its host. Unknown native inventory emits null totals and explicit
pendingLowerBound/reasons/evidence. Balance ranking uses that pending lower bound
while reported totals remain null. Legacy C1 fixtures and 20/35/40 spread remain.

## Bind and submit once

For live use supply `input.nativeDestination` before dispatch-plan binding. Each
read envelope is `{tool,environmentId,args,observedAt,evidence,value}` where args
excludes the forwarding environmentId, and evidence points to the preserved raw
native call/result. environment/project/capabilities are read on the selected
host; links are read on origin. The capabilities envelope uses `valueText` for
exact raw catalog bytes instead of value. Project repositoryIdentity.canonicalKey
must match the requested repositoryId. If project-read identity is null/omitted,
`projectList` may carry an ordered array of `t3_project_list` read envelopes on
that same environment. Collect from cursor 0 through native nextCursor:null,
recording actual cursor/limit arguments (native defaults: 0/20, limit at most 100).
Every page must join without gaps, extra arguments or duplicate project IDs.
The selected project's ID and workspaceRoot must equal project-read; every
available canonicalKey must equal repositoryId, including when both reads have
identity. Missing identity in both, incomplete pagination and any conflict hold.

For observed T3 0.1.5 native Codex/Claude drivers, omitted provider runtimeModes
means no provider restriction: native resolveRuntimeMode and RuntimePolicy
preserve the requested mode. Bind this only with catalog runtimeMode equal to
the request, exactly one selected provider, canRunChildTask:true and an explicit
empty constraints array. Explicit mode restrictions must include the requested
mode. Unknown version/driver omission semantics, missing caller authority,
unavailable providers or restrictions hold. This is preflight support, never
proof of a child's effective mode; terminal receipts still require actual native
readback. Preserve the exact catalog bytes/digest; do not synthesize runtimeModes
or repositoryIdentity in the saved raw reads. Unknown mappings hold rather than guessing.
The pure `inspectDestination` API returns per-term pass/fail/unknown with evidence;
`dispatch-plan` holds on a failed/unknown term. This is supplied binding proof only.

Run existing dispatch-plan with the selected destination catalog, complete input,
recommendation, explicit evaluation time and config pin. Compare its target to the
independently selected host/environment/project/model/options/runtimeMode. Copy only
native supported fields, never inputs or fleetBinding. Call `delegate_task` with
that exact target, full-access, a role-labelled title, stable clientRequestId and
scope. Reviewers require native isolation:"worktree" and pinned candidate/base;
no shell-created child checkout. Other nonwriters write only their named private
evidence directory on that host. Preserve requested arguments and native response.

Record taskId on the origin plus remoteChild.environmentId/threadId. The native
remoteChild schema need not return runId: normalize it from observed task/thread
run facts, preserving the native raw response separately. Do not invent it.
Never top-level launch unless the user explicitly requested a new thread.
No agent execution through SSH; T3 forwarding is the only remote execution route.
Unknown submission/liveness blocks replacement. Reconcile the exact attempt and
clientRequestId against the native remote task before retrying; do not launch a
second task to test absence. Follow native next instructions, without polling.
Confirmed pre-submission rejection may exclude a route and trigger a new current
recommendation at the same model/permission pins; record the exclusion evidence.

## Terminal receipt

Preserve schemaVersion:1, recommendationJSON (exact bytes), configDigest,
attempt (key, exact title, clientRequestId, origin environmentId/threadId/taskId,
candidate/base SHAs), requested target/runtimeMode/isolation and native submission.
The driver's independent fleetAttempt is the expected run-record identity;
never copy it from an arriving receipt to make a comparison pass.

After native completion wakes origin, read task_status there first. Read actual
destination thread and terminal run with forwarded t3_thread_read/t3_thread_wait,
then `t3_pending_request` action list for that same thread. Save envelopes status,
thread, terminal and questions using the read format above. Preserve raw native
question output; questions.value.requests is a normalized list extracted from that
observed response, not an invented API schema. If extraction is uncertain, omit
it and keep unknown. The native tool currently advertises an opaque result shape.

Normalize remoteChild:{environmentId,threadId,runId} to the current destination run.
Task latestTerminalRunId, thread latestRunId/recentRuns ordinal, terminal runId
(and resultRun when present) and final destination message must identify that
same current completed run. Provider continuation may have a different run from
submission.childRunId; never use lexical ordering of IDs or the original summary.
Require completed/result_available/no pending children/no unanswered questions or
approval. Require exactly one AXSTACK-DONE key/candidate/report marker on both origin's
latestTerminalSummary and the destination's final current-run agent message.
A completion marker may be followed by the T3
`PR <url>, head <sha>, checks and reviews <state>` trailer. Other trailing text
or additional AXSTACK markers keep the receipt held.
Old summary, null local child, idle, silence and completed turns with live children
remain incomplete. Failed/cancelled/interrupted/waiting never succeed.

Evidence is `{hostId,environmentId,path}` with an absolute destination path.
For isolated review include checkout with those fields, candidate/base and readback:
`{hostId,environmentId,path,candidate,base,evidence}` from exact-SHA checks there.
Never infer local file existence from a remote absolute path.
Requested settings remain separate from effective native status.providerInstanceId,
model/options and thread.providerInstanceId/model/runtimeMode. Missing effective
options or mode is unknown and holds required verification, except for the bounded
T3 0.1.5 initial remote-launch join below.

### T3 0.1.5 initial remote receipt

The remote `readRemoteTask` emitter omits options and returns null childRunId and
latestTerminalRunId. Preserve those raw omissions/nulls. A current family shell
is current thread metadata, not an immutable settings record for an older run.
Never use it to authorize a continuation from an origin summary lacking a run ID.

For the sole initial remote run, optional receipt `nativeFamily` can corroborate
settings and run identity. The driver acquires `orchestration.getThreadFamily`
with exact `{threadId}` on the actual destination using an authenticated native
RPC read with `orchestration:read` scope. This is metadata access, not agent
execution or an alternate worker launch path. Record host/environment identity,
authenticated acquisition provenance, exact request/result, and independently
observed server version. Do not execute an agent through SSH/CLI to obtain it.
Temporary read sessions require their authorized lifecycle and revocation; never
put tokens/tickets into evidence. This contract grants no auth/session authority.

The envelope is `{tool:"orchestration.getThreadFamily",transport:"t3-native-rpc",
environmentId,serverVersion:"0.1.5",args:{threadId},observedAt,evidence,value}`.
`value` is the unmodified native `{snapshotSequence,threads}` response. Retain
raw bytes separately, including any diagnostic/revocation trailer; parse only
the JSON response into a separate file. Never rewrite the raw response as JSON.
The version must also match selected destination versions; observe the family
after thread/wait and no later than receipt evaluation. Missing provenance holds.

Require a unique child with the selected project, exact title/current run,
provider/model/options/mode and delegatedFrom origin environment/thread. Every
returned family member must explicitly have idle/completed status, null active
run/request, zero pending guest input and an empty pendingBackgroundTasks array.
Unknown or live descendants hold even when remote status claims no pending child.

The fallback requires native thread runCount:1, exactly one recentRuns row at
ordinal:1, null local child IDs/childRunIds on status/submission, null origin
latestTerminalRunId, and identical origin/destination final text. Existing
current-run, completed terminal, marker, question and host/path checks still
apply. Explicit status options or run IDs cannot be overwritten by family facts.
T3 remote launch forwards the accepted explicit model selection and uses it for
both thread creation and the initial message; this is the source-backed scope
of the join. More runs or missing counts/ordinals hold. Later continuations need
actual result-run/per-run settings provenance; repeated matching markers or
current family settings are insufficient. Complete native statuses retain their
existing run-ID path. Saved inputs cannot authenticate their own provenance.

`inspectFleetReceipt(receipt,{attempt,recommendation,recommendationJSON,now})`
returns terms, never authority. Existing dispatch-plan --verify can additionally
consume fleetAttempt/fleetReceipt in its saved envelope; save --out to retain
full receiptTerms. Legacy configuration-only MATCH checks supplied configuration,
not native completion. Stable receipt-* / destination-* terms identify the exact
hold and evidence; unknown means incomplete. A passing receipt is no merge grant.

## Retrieval and retirement

The driver retrieves the exact host-qualified report/artifacts and verifies digest
and byte readback on origin before accepting them. For a reviewer, verify candidate
HEAD and pinned base commit on the destination, then verify transported commit IDs
on origin if commits are needed. SSH may transport artifacts/commits or telemetry;
it never invokes agents or bypasses T3 access. Keep origin and destination paths
separately qualified in the run record; verify exact SHA/base, not branch names.

Remote reviewer retirement is driver-only through axstack-cleanup: re-read the
exact destination thread/run/ownership, preserve archive plus digest on origin,
read it back, settle the owned child there and verify settled:true. Retire only
its recorded T3-created disposable checkout after candidate/base, terminal state
and ownership checks. Unknown liveness, changed SHA, user takeover or uncertain
ownership preserves the resource and holds its cleanup. Validate exact literal
path/realpath/owner/no symlink before deletion; validation must succeed in a
separate sequential call before deletion. Preserve unknown ignored artifacts.
Never delete a shared root, use globs/age sweeps or treat an origin path as remote.
Authors stay until merge/close; driver alone owns forge links/watch/publication.

Remote author coordinator is DISABLED after the checkpoint-ref pilot failure;
no C3b pilot or waiver here. Local isolated authors remain eligible even overloaded.
See [Fleet verification](fleet-verification.md) for later authorized C3/C6 live
coverage. C4/C6 personal policy, deployment and live routing are unverified here.
