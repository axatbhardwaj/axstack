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
state) and the run record has no open hold. A hold from any phase stops the run:
record its reason, owner, and resume condition, then take no dependent action.
That covers tracker access, adviser or arena-seat availability, diligence
FINDINGS when the phase records a hold, CI-wait timeout, readiness UNKNOWN,
dismissed approval, wake or cleanup uncertainty, single-provider routing, an
existing tag or version, and failed publish. Diligence FINDINGS during implement
follow its §6 repair route; at spec, tickets, or release preparation the driver
resolves them before advancing, and only a recorded hold pauses autopilot.

Record `Autopilot: on | paused (<hold>; resume: <condition>) | off (cancelled
<ts>)` and the next step in the private run record. A user answer to the hold
resumes after reconciliation; silence does not.
Awaiting human spec approval records `Autopilot: paused (spec approval; resume:
human approval)` as a decision hold eligible under the Notification policy.

## Phase sequence

- Small: Align read-back, small-change intent, implement, watch in maintain
  mode, human merge. An opted-in Align refinement is part of read-back.
- Substantial: Align, spec draft with advisers and diligence, human spec
  approval at gate 1, tickets with diligence, implement, watch in maintain mode,
  merge-ready, human merge. An opted-in Align refinement is part of gate 1.

Do not seek another phase-start instruction after a completed identity.
Spec approval is always the human's decision. Every PR merge is the human's,
including a release PR and each PR in a stack, bottom-up.

## Implement into maintain watch

When implement publishes the run's first PR, arm exactly one `axstack-watch`
chat-run in authorized maintain mode. Use the 10-minute harness wake, with the
existing Orca fallback when unavailable. Later run PRs join after verified
publication readback; an explicitly adopted PR joins only with its maintenance
snapshot. The original driver alone routes work; one author writes each
candidate. Until a PR is merge-ready, wakes feed implement §6 step 4. After
merge-ready, watch §5 maintenance repairs feedback, rebases when the base moves,
keeps CI green, and checks approvals without re-requesting human review.

Maintain is the default mode for run-created PRs. End the chat-run watch when
every watched PR is merged or closed and the run's release step is settled or
not applicable, or when the user cancels. Expiry is a recorded stop with
resumable state, never a silent renewal. A required PR closed without merging
is incomplete scope; it does not make the run release-eligible. On wake expiry
record `Autopilot: paused (wake expired; resume: user reauthorizes a wake)` and
notify under the recorded Notification policy when user action is needed.

## Release and install, when applicable

Detect applicability once at Align or spec time. Record `Release: <AGENTS.md
file:line + tag-triggered workflow path + named install hosts> | not applicable
(<reason>)`. The predicate is an AGENTS.md release rule naming an existing
tag-triggered workflow. A partial match is not applicable and its reason is
noted. Install hosts come only from explicit targets; an absent host list is a
decision hold, not permission to infer hosts. A missing install host list at
Align or spec time is a decision hold before release authority is presented.

Show the `Release:` line in the spec for human approval at gate 1, or the small
work Align read-back. Copy that decision to `Authority:` in the run record.
This authority is per run and never carries over to another run or repository.
The small-work Align read-back names the existing Release and host-mutation
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
owner, authoritative Dispatch, approved revision, PR membership, uncertain
tags, wakes, publications, and completed receipts under lifecycle and
run-record before advancing. Only the original driver advances. Wakes do not
reset attempt budgets and do not grant approvals. Cancel sets `Autopilot: off`,
stops new actions, and ends the watch under watch §6 with guarded settlement.
Cancellation does not cancel a running author Dispatch by inference; let it
report, then settle that exact Dispatch under lifecycle guards without new
publication.

Use the run's recorded Notification policy through `axstack-relay`.
Decision holds, including spec and npm approval, are always eligible. Across
implementation and release, merge-ready and merged notifications together are
capped at two per run; deduplicate by purpose and revision. Healthy ticks stay
quiet. A failed or uncertain delivery preserves the underlying hold. A relay
message is only a notification, never authority to approve, merge, or publish.
