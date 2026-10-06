# Autopilot

This reference applies to authorized engineering-delivery runs. The original
driver remains the sole run-record writer and phase router in the same chat;
phase completion is not a native ownership handoff. Explicit planning-only,
read-only, stop-after-phase, observation-only, and peer requests retain their
selected boundary. A status question such as "what's left" is observation,
not a mode change.

## Advance and hold

Advance only after the finishing phase returns its completed identity (a
small-change intent, approved spec, matching ticket map, merge-ready or merged
state) and no hold affects the next action. Record each hold's reason, owner,
scope, and resume condition. Run-wide holds for authority, scope, cancellation,
or run-spanning serious risk stop the run. A task, PR, resource, or operation hold
blocks only its dependants; continue independent authorized work. Unclear impact
holds the potentially affected work until its boundary is resolved. For example,
tracker access, adviser or arena-seat availability, CI-wait timeout, readiness
UNKNOWN, dismissed approval, wake or cleanup uncertainty, single-provider routing,
an existing tag or version, and failed publish hold the work that needs them.
Diligence FINDINGS during implement
follow its §6 repair route; at spec, tickets, or release preparation the driver
resolves them before advancing, and only a recorded hold pauses autopilot.

Record `Autopilot: on | paused (<hold>; resume: <condition>) | off (cancelled
<ts>)` and the next step in `Next:`. Keep `on` for scoped holds
while independent work proceeds; use `paused` when no authorized action can
advance. A user answer to the hold resumes affected work after reconciliation;
silence does not.
The driver records each verified `Autopilot:` transition in the private run
record, which remains authoritative.
Awaiting human spec approval records `Autopilot: paused (spec approval; resume:
human approval)` as a decision hold eligible under the Notification policy.

## Phase sequence

- Small: small-change intent read-back, with Align only when unclear, then
  implement, watch in maintain mode, merge under the watch §5 predicate.
  An opted-in Align refinement is part of read-back.
- Substantial: Align, spec draft with advisers and diligence, human spec
  approval at gate 1, tickets with diligence, implement, watch in maintain mode,
  merge-ready, merge under the watch §5 predicate. An opted-in Align refinement
  is part of gate 1.

Do not seek another phase-start instruction after a completed identity.
Spec approval is always the human's decision. Audit self-improvement PRs follow
the same merge predicate.
For own PRs, automatic merge is the default under the
[watch predicate](../../axstack-watch/SKILL.md#5-state-readiness-precisely).
The recorded owning watch thread is the merge actor, including `axstack-owner`
for authorized standalone maintenance and small or adopted work.
Managers, workers, reviewers, monitors, and nightly triage never merge.
Observation-only and peer watches never merge.
Apply watch §5's approval, base, exclusions, and merge-card rules.
A stack follows its guarded whole-stack rule.
User merges are bottom-up for a stack.

## Own PR publication into maintain watch

When any Axstack phase publishes an own PR, after verified publication readback
the driver arms one chat-run watch in authorized maintain mode or joins the existing watch.
This covers implement, small change, debug repair, improve, and adopted-PR maintenance.
Explicit user stop-after-publication and observation-only requests prevail.
Never require a manual `axstack-watch` invocation.
The driver remains the single owner and sole run-record writer.
Never create a per-PR session or an ownership hand-off.
Read the [T3 runtime boundary](t3-runtime.md) and use its bound
`schedule_task` wake (`everyMs:600000`), recording the scheduledTaskId.
Follow [Native PR links and watches](t3-runtime.md#native-pr-links-and-watches)
alongside that bound schedule.
An explicitly adopted PR joins only with its maintenance snapshot.
The original driver alone routes work; one author writes each
candidate. Until a PR is merge-ready, wakes feed implement §6 step 4. After
merge-ready, watch §5 maintenance repairs feedback, rebases when the base moves,
keeps CI green, and checks approvals without re-requesting human review.

Maintain is the default mode for run-created PRs.
End the chat-run watch only when every watched PR is merged or closed,
launched work is settled, and the run's release step is settled or not applicable,
or the user cancels.
A required PR closed without merging is incomplete scope; it does not make the run release-eligible.
Keep its decision hold and wake until the user resolves scope or cancels.
The chat-run watch never expires or waits for re-authorization while PRs remain open.
Follow [Chat-run watch runtime](../../axstack-watch/references/watch-runtime.md#chat-run-watch)
for quiet cadence and native schedule re-arming.
Run Close-out after the watch ends, subject to its existing acceptance conditions.

## Release and install, when applicable

Detect applicability once at Align or spec time. Record `Release: <AGENTS.md
file:line + tag-triggered workflow path + named install hosts> | not applicable
(<reason>)`. The predicate is an AGENTS.md release rule naming an existing
tag-triggered workflow. A partial match is not applicable and its reason is
noted. Install hosts come only from explicit targets; an absent host list is a
decision hold, not permission to infer hosts. A missing install host list at
Align or spec time is a decision hold before release authority is presented.

Show the `Release:` line in the spec for human approval at gate 1, or the
small-change intent read-back. Copy that decision to `Authority:` in the run
record.
This authority is per run and never carries over to another run or repository.
The small-change intent read-back names the existing Release and host-mutation
authority and explicit hosts; silence cannot fill a missing authority or target.

After all required feature PRs merge, open one release PR. Default to a patch
version, or minor if a `feat` commit landed since the last tag. This normal run
PR gets authored review and diligence of its body against merged PRs, reaches
merge-ready, then waits for human merge. Once the forge confirms that merge,
tag and wait for the staged publish. Human npm stage approval is a decision
hold: agents never run `npm stage approve`. A wake verifies the registry reports
the expected package and version. Install on the named hosts, verify version
and roles, then run Close-out last with release and install receipts and the
installed version.

An existing version or tag, failed publish, pending approval, uncertain
registry result, missing host access, or failed install verification is a
resumable hold, never success. Tagging, publishing, installation, and host
mutation require the recorded per-run authority and their existing checks.

## Resume, cancel, and notify

At every entry (user message, wake, compaction, or new chat), reconcile the
owner, authoritative attempt, approved revision, PR membership, uncertain
tags, wakes, publications, and completed receipts under lifecycle and
run-record before advancing. Only the original driver advances. Wakes do not
reset attempt budgets and do not grant approvals. Cancel sets `Autopilot: off`,
stops new actions, and ends the watch under watch §6 with guarded settlement.
Cancellation does not cancel a running author run by inference; let it
report, then settle that exact attempt under lifecycle guards without new
publication.

Follow [Provider bindings](t3-runtime.md#preflight-and-binding) for driver account re-selection on start, resume and run-watch wakes.

Use the run's recorded Notification policy through `axstack-relay`.
Decision holds, including spec and npm approval, are always eligible. Across
implementation and release, merge-ready and merged notifications together are
capped at two per run; deduplicate by purpose and revision. Healthy ticks stay
quiet. A failed or uncertain delivery preserves the underlying hold. A relay
message is only a notification, never authority to approve, merge, or publish.
