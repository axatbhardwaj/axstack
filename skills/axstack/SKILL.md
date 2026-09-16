---
name: axstack
description: When routing an engineering run through Axstack, use axstack to select the applicable phase and scope identity.
---

# Axstack entry

Route the current request to one Axstack phase with the right scope identity.
The current chat remains the driver; Orca owns runtime orchestration.

For an explicit relay message or transport test, use
[axstack-relay](../axstack-relay/SKILL.md) directly. No engineering scope
identity or decision workflow is needed for that send. The same skill handles
urgent or blocking notifications under an explicit standing instruction.

## Route the request

1. Classify the request with [Shared routing](references/routing.md). Direct
   research, explanation, improvement discovery, peer-review, adopted-watch,
   and handoff routes need no spec
   ceremony. Only an explicit user-requested ownership transfer can use the
   capability-gated native route in
   [Lifecycle and receipts](references/lifecycle.md#native-handoff-and-resume),
   not an Axstack handoff phase. Preparation completion, watch expiry, and
   ordinary resume update or reconcile the run record without launching it.
2. For new engineering work, validate scope identity before invoking any phase.
   Record `small`, `substantial`, or `unclear` plus a brief reason, then apply the
   [proportional scope identity](references/routing.md#proportional-scope-identity).
   A small clear change proceeds from its snapshotted small-change intent.
   Substantial work proceeds only from an approved spec and matching ticket
   map. Clarify unclear size before dispatch.
3. Only after validation passes, invoke exactly the selected phase. A directly
   invoked later phase starts there and must pass its own identity check. When
   substantial work lacks an approved spec or matching ticket map, return that
   exact gap, name `axstack-align` as the next route, and stop the current
   invocation; do not invoke align, spec, or tickets. Apply the same stop to a
   mismatched or invalidated identity. Never admit work that a deeper phase
   would reject.

The route is settled when one applicable phase is named with its valid scope
identity, or the exact preparation/setup gap is reported with affected work
held.

## Load at the action boundary

- Every independently called phase loads [Standing contracts](references/contracts.md),
  which requires lifecycle and audit loading before action.
- Before an actual Axstack role dispatch, delivery, settlement, or handoff, load
  [Orca runtime](references/orca-runtime.md). Ordinary reading, writing, and
  local checks do not require launch discovery.
- Substantive delegated or resumable work uses the
  [Local run record](references/run-record.md).
- When the current session is an Orca PR automation (driver or watchdog), load
  [Automation sessions](references/automations.md) before any discovery,
  review, gate, or mutation.
- When review escalation or watch notification is eligible and the brief has a
  `Notification policy`, use the optional
  [axstack-relay](../axstack-relay/SKILL.md); otherwise keep notification in
  the current Orca conversation.

## Lifecycle

This is a phase map, not an automatic dispatch sequence.

1. `axstack-align` settles substantial scope and decisions.
2. `axstack-spec` creates the single user-approved execution baseline.
3. `axstack-tickets` maps capabilities, tasks, and dependencies, then
   preparation stops with a resumable handoff.
4. `axstack-implement` produces owned candidates with strict TDD.
5. `axstack-review` gives peer PRs the two configured independent same-brief
   reviewer roles; authored PRs get one complete eligible non-author/non-owner
   review based on actual author provenance and the routing snapshot.
6. `axstack-watch` monitors within the shared deadline and hands off remaining
   work.
7. The human merges by default, bottom-up for a stack. Review approval never
   grants merge authority.

Autonomous progress, model holds, serious-risk handling, mutation authority,
and the one-host ownership contract live in
[Standing contracts](references/contracts.md). Load only the selected phase
and the references its action requires.
