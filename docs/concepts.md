# Concepts

Axstack provides engineering instructions and evidence conventions. T3 Code
provides the active runtime. Start with [getting started](getting-started.md);
use [guides](guides.md) to choose a journey and [workflows](workflows.md) for policy.

## Driver thread

Your current T3 conversation is the driver. It owns scope, coordination,
integration and forge actions. Workers return evidence to it; one author writes
each candidate in an isolated worktree. A different idle thread does not inherit
ownership. Explicit transfer requires a recorded recipient acceptance.

## Phases

The delivery path is Align → Spec → Tickets → Implement → Review → Watch.
Align settles what to build; Spec records an approved baseline; Tickets makes
that baseline executable. Implement builds and repairs; Review assesses an exact
revision; Watch reconciles PR state. You can enter directly for research,
explanation, peer review or a bounded codebase review.

## Small and substantial work

A small, clear one-PR change starts from your request or selected issue. The
driver snapshots its acceptance checks and exclusions as a small-change intent.
Substantial work needs an approved spec and matching ticket map before a build.
An unsettled material design question goes through Align. Ordinary sequential
test and implementation steps do not turn a small change into substantial work.

## Roles and presets

A role is a named responsibility such as author, reviewer or adviser. A preset
assigns those roles to provider, model class, effort and permission intent.
Choose `mixed`, `codex-only` or `claude-only` explicitly at installation.
The installer writes the selected preset and complete role table to
`<skills-dir>/axstack/roles.json`. The driver snapshots it for a new run, resolves
exact models from saved T3 capabilities, and reuses the snapshot on resume.
The running conversation supplies the driver model; presets have no driver role.

See [Role presets](workflows.md#role-presets) for the role table. Installing a
preset does not demonstrate that its providers can authenticate or execute.

## Holds

A hold stops affected work when authority, scope, provider availability or
required evidence is missing. A serious risk stops the dependent dangerous
action. The driver records the reason and resume condition. Waiting, silence or
a tool's acceptance response does not prove completion.

## Run record

A substantive or resumable run has a private `progress.md` beneath the absolute
Git common directory. The driver alone writes its decisions, owners, exact
revisions and evidence pointers. It is a derived record: T3 state, Git, forge
state and approved scope remain authoritative. Credentials and private prompts
do not belong in it.

## T3 runtime boundary

Delegation uses the `t3-code` MCP. Use async `delegate_task` for every role, including authors with
`isolation:"worktree"` in their own SHA-pinned worktrees.
Every top-level launch, including an author fallback, requires an explicit user request.
Use `t3_thread_launch` for those explicitly authorized launches; preserve existing
accepted authorization within its exact scope.
Use `t3_thread_launch` as a rare author fallback only when
worktree isolation is unavailable and record each use in the run record. Configuration read-back,
run receipts and revision-bound completion are separate from capability
discovery. Read the [runtime contract](../skills/axstack/references/t3-runtime.md)
immediately before dispatch, receipt consumption or recovery.

## Provider bindings

Claude binds to T3 instance `claudeAgent`; Codex binds to `codex`.
Grok binds to `grok`.
A usage-limited instance holds the work without failover.
See [Provider bindings](../skills/axstack/references/t3-runtime.md#preflight-and-binding).
