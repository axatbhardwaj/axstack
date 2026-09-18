# Orca runtime boundary

Read this immediately before using Orca for a role dispatch, handoff, delivery,
settlement, or recovery. Ordinary local reading and writing do not load it.
Axstack owns policy, role selection, and evidence; Orca owns Run, Task,
Dispatch, session, worktree, messaging, settlement, and scheduling state.

## Discover the runtime-owned guides

Resolve one Orca executable for the session and reuse it. Prefer
`ORCA_CLI_COMMAND` when set, then the checkout's `orca-dev` when
`ORCA_DEV_REPO_ROOT` is set, the Linux-safe `orca-ide` outside managed
terminals, and otherwise `orca`. If the selected executable fails, report that
exact gap; never switch binaries silently.

Before supervised work, load the selected executable's version-matched
`skills get orchestration --json` and `skills get orca-cli --json` guides.
Follow returned schemas and their named conditional references rather than
copying their command procedures into Axstack. Missing guide discovery is a
setup gap. It does not authorize legacy runtime use or an Axstack dispatcher,
daemon, scheduler, database, or escalation engine.

## Bind the configured role

Read `roles.json` from the installed shared root `skills/axstack/`. The installed
shape is `{ "version": 1, "preset": "<name>", "roles": [...] }`. Bundled
profiles are setup inputs shaped as
`{ "version": 1, "roles": [...] }`. A new run records the selected preset and
all 24 role rows once. An active run keeps the exact snapshot until the user
explicitly changes it.

Select the requested role by stable ID. A missing or null model holds only that role;
never launch a provider default. Validate provider, model, and effort
against the guide and actual launch capability. Stored `modeId` and other
permission fields are conservative intent, not proof of effective permission
parity or a security boundary. Requested settings, input acceptance, effective
settings, and completed work are separate evidence. An unsupported or
unavailable value holds affected work for the user's decision without fallback.
The single-provider preset's null adviser is intentional installation data, not
readiness failure; because Align and Spec require both adviser receipts, either
null adviser still holds those phases. The current chat is the driver and has
no role row in any preset.

## Supervise one authoritative attempt

For supervised work, use the orchestration guide's native Run, Task, and
Dispatch flow. Reconcile existing attempts first. Bind the approved spec or
small-change intent, brief, authority, role snapshot, worktree, base, and
candidate to the Task; preserve the returned
Task, Dispatch, terminal, agent, and worktree identities. Exactly one Dispatch
may write a candidate at a time.

A worker worktree carries the lineage of the work it serves. Create it with
`--parent-worktree` naming the candidate's worktree, so a reviewer, repair, or
child-task checkout appears under the candidate it belongs to instead of as an
unrelated top-level row. `--no-parent` is only for unrelated, independent work
with no parent context, never a review or repair of an existing candidate. When
a worktree was created with the wrong lineage, correct it in place with
`worktree set --parent-worktree`; that is metadata and does not disturb a
running worker. Lineage is presentation and reconciliation state, never
authority: it grants nothing, and a correct parent never substitutes for the
Task, Dispatch, and receipt evidence above.

An `input_accepted` stage proves only that input reached the terminal. Require
`turn_started` plus runtime/session inspection before treating the agent as
started, and verify the requested role independently before trusting its work.
A workspace trust, hook review, permission, authentication, or model prompt is
a visible hold. Never answer a trust or permission prompt on the worker's
behalf. Preserve the attempt and use only the runtime guide's inspection and
recovery procedure; reconcile before retry so no duplicate writer starts.

## Consume, settle, and recover

Process a whole delivery before acknowledgment. Accept `worker_done` only when
its sender, Task, and Dispatch match the expected active attempt; then verify
the candidate revision and evidence before advancing Axstack's derived record.
A valid completion for an older Dispatch never completes a newer Dispatch.
Duplicate messages are deduplicated by their runtime identity.

On `consumer_fenced`, stop consuming under that identity. Reconcile the active
coordinator and delivery through the runtime guide; never bypass the fence,
forge a sender, borrow a terminal identity, or partially acknowledge the
delivery. Settlement is also runtime-owned: reuse, retain, or release a settled
terminal only through the guide. A `user_takeover` result requires retention;
do not close, release, reuse, or send commands to that terminal as cleanup.

Contact loss, silence, idle state, or an absent status never proves exit or
transfers authority. Ordinary restart and resume reconcile the same owner,
author, Task, Dispatch, worktree, revisions, and pending receipts. Authorized
repairs return to the same author when its session and evidence remain usable;
uncertainty holds replacement rather than creating a second writer.

## Transfer ownership explicitly

Distinguish supervised workers from a full ownership handoff. Only the user's
explicit transfer request enters this branch. Record the intended recipient,
exact scope, revisions, authority, and pending request before following the
runtime-owned `orca-cli` handoff procedure.

Input acceptance or turn start is launch evidence, not ownership. Validate an
explicit recipient acceptance against the intended request, session, scope,
candidate/base, and authority before changing ownership. Until then the current
owner remains accountable. After a valid acceptance, record it, transfer only
the accepted authority, and have the prior owner stop. Ordinary resume keeps
the current owner and never launches a handoff.

The runtime step is complete only when its real receipts are recorded with
their limitations. Those receipts grant no merge, release, publication, model
substitution, host-configuration, or scope authority.
