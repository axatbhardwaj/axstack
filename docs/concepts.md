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

Delegation uses the `t3-code` MCP. Read-only roles use `delegate_task`; authors
use `t3_thread_launch` with their own pinned worktrees. Configuration read-back,
run receipts and revision-bound completion are separate from capability
discovery. Read the [runtime contract](../skills/axstack/references/t3-runtime.md)
immediately before dispatch, receipt consumption or recovery.

## Account selection

Before each Claude or Codex dispatch or launch, the driver runs
`bun skills/axstack/scripts/pick-instance.js --provider claude|codex`.
The picker selects the enabled account of that provider's T3 driver with the
highest tier-weighted headroom. Save its `--json` output in private evidence
and record the chosen instance ID. `--settings <path>` overrides
`~/.t3/userdata/settings.json`.

For known usage, the score equals `(100 − max known window utilization) × tier weight`.
For unknown utilization, the score equals the tier weight alone.
The maximum uses the known utilization windows; an unavailable window is not
assumed to be empty.

| Provider / tier | Weight |
| --- | --- |
| Claude Max 20x: `default_claude_max_20x` | 4 |
| Claude Max 5x: `default_claude_max_5x` | 1 |
| Codex: `pro` | 4 |
| Codex: `prolite` | 1 |

For an unknown tier, the weight equals 1.
An account with any window at ≥95% or a reported limit reached is excluded.
Accounts with missing credentials are skipped.
Usage is cached for five minutes. Failed requests use stale usage when present,
otherwise a tier-only unknown score. Codex's plan is unknown until a successful
usage response, so an uncached failed Codex request has weight 1.

Exit 0 prints the selected instance or JSON.
For dispatched roles, only error exit 1 permits fallback to the canonical instance after validating availability.
The canonical instances are `codex` and `claudeAgent`.
Exit 2 (no eligible provider instances) must hold the work without fallback.
If the driver's own current instance is eligible, it must stay despite headroom differences.
On error exit 1, the driver must keep its current instance.
At a turn boundary, an excluded driver with an eligible same-provider sibling
switches its own calling thread and records the change. Provider, model, class
and effort remain fixed. Dispatched roles never fail over mid-thread.
See [Provider bindings](../skills/axstack/references/t3-runtime.md#preflight-and-binding)
for schedule rebinding and the [policy carve-out](workflows.md#automatic-merge-boundaries).

## Account selection environment

`XDG_CACHE_HOME` selects the cache directory; the default is `~/.cache`.
The usage cache lives at `<cache-dir>/axstack/usage.json`.
`AXSTACK_CLAUDE_USAGE_URL` is a test-only endpoint override for Claude usage.
`AXSTACK_CODEX_USAGE_URL` is a test-only endpoint override for Codex usage.
Local tests use loopback endpoints; these variables are not provider setup steps.
