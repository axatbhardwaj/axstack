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

Load only the selected executable's version-matched guides needed by the
operation through `skills get orchestration --json`,
`skills get orca-cli --json`, and `skills get orca-linear --json`.
`orchestration` owns Run, Task,
Dispatch, messaging, supervision,
settlement, and recovery. `orca-cli` owns worktrees, terminals, automations,
handoffs, and artifact publication; load its named conditional reference at
the matching action gate. `orca-linear` owns Linear issue reads and writes.
Follow returned schemas and current command help rather than copying their
procedures into Axstack. Guide discovery does not prove runtime support for a
particular operation: preflight that operation and report an advertised gap.
Missing discovery never authorizes legacy runtime use, a silent integration or
store fallback, or an Axstack dispatcher, daemon, scheduler, database, or
escalation engine.

Orca artifacts publish public-by-link output. They are not private evidence
storage and must never receive private evidence by default; sharing requires
explicit publication authority and the `orca-cli` publishing reference.

## Bind the configured role

Read `roles.json` from the installed shared root `skills/axstack/`. The installed
shape is `{ "version": 1, "preset": "<name>", "roles": [...] }`. Bundled
profiles are setup inputs shaped as
`{ "version": 1, "roles": [...] }`. A new run records the selected preset and
all 24 role rows once. An active run keeps the exact snapshot until the user
explicitly changes it.

Select the requested role by stable ID. A missing or null model holds only that role;
never launch a provider default. Launch-by-agent-id routes for which Orca exposes no
`--model` override (today: `grok`, `antigravity`) record `model: null` with an explicit note and are
launchable; the run record snapshots the model the TUI reports. Validate provider, model, and effort
against the guide and actual launch capability. Stored `modeId` and other
permission fields are conservative intent, not proof of effective permission
parity or a security boundary. Requested settings, input acceptance, effective
settings, and completed work are separate evidence. An unsupported or
unavailable value holds affected work for the user's decision without fallback.
The single-provider preset's null adviser is intentional installation data, not
readiness failure; because Align and Spec require both adviser receipts, either
null adviser still holds those phases. The current chat is the driver and has
no role row in any preset.

## Materialize checkouts as worktrees of the registered repo

Every reviewer, release, or worker checkout is `ORCA worktree create --repo
id:<repoId> ...` under the repo Orca already registers. `ORCA repo add` is a
one-time import of a new repository; running it on a clone of a registered
repo creates a second top-level repo record, so it never materializes a
checkout. See [Candidate publication](candidate-publication.md) for the
detached immutable review checkout.

## Supervise one authoritative attempt

For supervised work, use the orchestration guide's native Run, Task, and
Dispatch flow. Reconcile existing attempts first. Bind the approved spec or
small-change intent, brief, authority, role snapshot, worktree, base, and
candidate to the Task; preserve the returned
Task, Dispatch, terminal, agent, and worktree identities. Exactly one Dispatch
may write a candidate at a time.

Create a worker worktree with `--parent-worktree` naming the candidate's
worktree when both are in the same repository; see
[Readable sidebar](workspace-hygiene.md#readable-sidebar) for naming, status,
and parentage at dispatch. `--no-parent` is for unrelated work with no parent
context. Where supported, correct wrong lineage in place with
`worktree set --parent-worktree`. Lineage is presentation, never authority: it
grants nothing and cannot replace Task, Dispatch, and receipt evidence.

Every reviewer gets a separate Orca child worktree parented to the candidate.
Keep that reviewer's probes and private evidence in its separate private
per-Dispatch run folder under [Workspace hygiene](workspace-hygiene.md), with no
first-pass cross-read. Untracked files never prove a worktree disposable.

An `input_accepted` stage proves only that input reached the terminal. Require
`turn_started` plus runtime/session inspection before treating the agent as
started, and verify the requested role independently before trusting its work.
A workspace trust, hook review, permission, authentication, or model prompt is
a visible hold. Never answer a trust or permission prompt on the worker's
behalf. A permission prompt or provider safety refusal is a held, incomplete
outcome, never consent or completion. Never bypass or retry it through another
model. Preserve the attempt and its evidence, then use only
the runtime guide's inspection and recovery procedure; reconcile before any
authorized retry so no duplicate writer starts.

## Reviewer workspaces and evidence

Give each reviewer a separate Orca-managed child worktree under the candidate's
worktree, including report-only reviews and rechecks; never share the author's
checkout or another reviewer's checkout. A later review gets a fresh Orca-managed
child worktree after the prior settled review's evidence and cleanup are
reconciled. Use the runtime-owned worktree guide,
not a raw Git worktree or temporary clone. Before dispatch, verify a detached
checkout of the exact candidate SHA and the pinned base in that child.

Name the private `<run dir>/evidence/<dispatch>/` folder in the brief and
completion receipt. Keep tracked candidate files read-only and peer folders
isolated. Scope `TMPDIR` to that 0700 folder for owned commands where supported.
Before use or temporary-file cleanup, validate that its real path equals or
is inside the recorded run evidence folder, is not a symbolic link, and matches the recorded
Dispatch owner. Worktree-local temporary paths use the same guards against
their recorded worktree and owner. Remove only an exact validated owned
path, with no glob or parent-root deletion; never wipe a general cache.
Uncertain temporary paths are preserved for reconciliation.
Before removing a reviewer worktree, read back its report and supporting
evidence from the private run evidence folder and record their paths. Files
already there need no archive step; the private evidence archive applies only
to legacy in-worktree evidence. Incidental caches are not evidence.
A settled reviewer Dispatch can be
cleaned before PR merge through [axstack-cleanup](../../axstack-cleanup/SKILL.md)
only after its classification, readback, and removal guards pass. Preserve
active or unknown review evidence and unique evidence whose bytes must survive;
uncertain ownership or evidence holds. Terminal release alone is not permission
to discard evidence or remove the worktree.

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
terminal only through the guide. A genuine `user_takeover` result requires
retention; do not close, release, reuse, or send commands to that terminal as
cleanup. Apply only the recorded
repair Dispatch ID exception in [Workspace hygiene](workspace-hygiene.md).

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
