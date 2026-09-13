---
name: axstack-handoff
description: When ownership must transfer or work must resume, use axstack-handoff to reconcile state and leave a compact record.
---

# Handoff

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)
- [Record template](references/record.md)

Independently callable. An explicit requested transfer changes the
driver only through concrete recipient acceptance: the current owner
stays accountable until the named recipient accepts. Coordinate with
the shared lifecycle directly; this skill adds the record shape, not a
new lifecycle engine.

## Record (all fields required)

Follow the [record template](references/record.md): task goal, scope,
and authority; the approved intent baseline — or peer / research mode
where no baseline applies; repo, project, workspace, and agent IDs;
exact revisions; writer ownership; verification evidence; pending
external receipts and timer expiries; and each unresolved decision with
its next owner and next action.

## Resume before replacing

Resume actual Paseo, Git, and forge state before launching replacements:
verify session liveness and ownership, compare heads and PR state, and
resolve ambiguous prior launches first. Avoid duplicate writer, watch,
or replies — re-deliver nothing already delivered.

## Compact pointers

Write compact pointers a stranger can resume from, not a transcript
dump: IDs, revisions, links, commands, and refs back to the evidence.

## Non-destructive

Never archives active or waiting workers, and never reassigns ownership
on idle alone. No global sweep of sessions or watches — touch only what
this handoff names. No new runtime database or scheduler: ownership and
timers ride the existing Paseo mechanisms named in the shared launch
reference.
