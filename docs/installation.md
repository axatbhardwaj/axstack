# Installation

Axstack's Bun CLI installs owned chat skills plus one selected role snapshot and
checks host capabilities. T3 Code is the only supported active runtime. The CLI
does not dispatch agents, edit T3 settings, run a scheduler, or maintain a
workflow database.

Requirements: Bun >=1.3.14, Git, `gh`, the `gh stack` extension, and a running
T3 Code `0.0.46-nightly.20261003.2610` or newer. The driver is a T3 thread
with the `t3-code` MCP. See the [T3 runtime boundary](../skills/axstack/references/t3-runtime.md).
Axstack has no runtime package dependencies. Filesystem access uses Bun-backed
`node:fs` and `node:fs/promises`. The pinned archify tool is the sole external-tool
exception: installation uses Git and the network, and Bun runs its Node-oriented
code. This exception introduces no Node.js runtime requirement.

## T3 setup

Set `worktreeCleanup` to `off` for every Axstack project before dispatch;
Axstack preserves author worktrees and salvages evidence before retirement.
The driver reads back this setting via `t3_project_read` where exposed, or
records the setup limitation.

For remote and Android access on the existing tailnet, run:

```sh
t3 serve --tailscale-serve
t3 pair
```

Run `t3 serve --tailscale-serve` as a VPS user service and pair the Android
app with `t3 pair`. T3 Connect is outside this setup. Service installation,
network access, and pairing require their own authorized host checks.

Install Antigravity through T3 provider settings using its managed runtime,
then complete the user's browser sign-in before its canary. T3 uses Google's
Antigravity ACP agent (`agy_acp_server`); the IDE/`agy` CLI skill paths below
are separate installer targets and do not configure this managed runtime.
Antigravity roles receive self-contained briefs; its runtime does not read
`~/.agents/skills`. A missing runtime, sign-in, or canary holds those roles.

Grok CLI must be >=1.0.13 on desktop and VPS. T3 advertising Grok does not
prove the CLI runs. Hermes relay remains unchanged: verify native `hermes send`
and its configured home channel under recorded notification authority.

## Commands

### Install

```text
axstack install --preset <mixed|codex-only|claude-only> --bundle <dir> --skills-dir <dir> [--tools-dir <dir>] [--instructions <file>] [--claude-settings <file>|--no-claude-settings] [--harness <name>] [--force] [--yes]
```

- `--preset` is required. `codex` and `claude` are aliases for the canonical
  `codex-only` and `claude-only` names. Axstack never infers a preset from the
  harness, available tools, provider credentials, subscriptions, or quota.
- `--bundle` defaults to the package root and contains `skills/` plus
  `profiles/presets/*.json`.
- `--skills-dir` is required unless a verified harness default resolves it.
  Codex defaults to the shared `~/.agents/skills` root; an explicit override
  remains authoritative and disables automatic legacy Codex-root retirement.
- `--tools-dir` defaults to `~/.axstack/tools`. It must not overlap a skills
  root or pass through a symlink. Home writes require `--yes`, including the
  default tools directory.
- `--instructions` selects the instruction file that receives Axstack's owned
  marker block. `--harness claude` defaults to `~/.claude/CLAUDE.md`;
  `--harness codex` defaults to `$CODEX_HOME/AGENTS.md` or `~/.codex/AGENTS.md`;
  `--harness opencode` defaults to `~/.config/opencode/AGENTS.md`;
  `--harness antigravity` defaults to `~/.gemini/GEMINI.md`.
- `--harness` may resolve the documented `claude`, `codex`, `opencode`, or
  `antigravity` skill directory. Grok remains explicit-path only. OpenCode also
  reads `~/.claude/skills`, so its own directory is only needed for the owned
  routing block; Antigravity (IDE and `agy` CLI) reads `~/.gemini/config/skills`
  only.

For a default Codex install, Axstack first installs and verifies the canonical
`~/.agents/skills` copy. It then retires only unchanged files owned by the
legacy `$CODEX_HOME/skills/.axstack-manifest.json`. Modified, missing, unowned,
or symlinked content is preserved or refused and reported; an instruction
conflict preserves the complete legacy install. An unchanged owned Codex
`AGENTS.md` binding is transferred to the canonical manifest without changing
the instruction bytes. Other harness ownership, settings, and inert profile
provenance remain untouched. Repeated installs verify the same canonical
preset and converge without duplicate skill entries.

If retirement leaves only the legacy manifest's Claude-settings ownership,
first confirm its `files` map is empty and it has no instruction or profile
conflict. Then finish that owner with
`axstack uninstall --skills-dir "${CODEX_HOME:-$HOME/.codex}/skills" --yes`;
the settings sidecar preserves the value while any other install still owns it.

- `--claude-settings` and `--no-claude-settings` control the existing Claude
  Code subagent-default transaction. They do not configure T3 roles.
- `--force` may replace an edited owned asset; it never adopts or removes
  unrelated state.
- `--yes` confirms writes under the user's home directory. Tests use temporary
  homes and fixtures only.

Installation sparse-clones archify at the reviewed full SHA in `src/archify-pin.js`
into `<tools-dir>/archify-<sha>`. It verifies HEAD before use and keeps the
payload's licence and third-party notices. The manifest owns
`<skills-dir>/axstack-diagram/archify.json`, which records `{path, sha}`.
The adjacent `<tools-dir>/archify-<sha>.owners.json` lists its skills-root owners.
Multiple roots share one copy. Repeat installs leave unchanged files untouched.
An offline, Git-less, or failed clone still installs the skills, reports
`archify: unavailable (<reason>)`, and exits 0. An existing SHA mismatch fails.
Tests use a local repository through `AXSTACK_ARCHIFY_REPO` and never use the network.

## Role presets

The selected bundle input is one of:

```text
profiles/presets/mixed.json
profiles/presets/codex-only.json
profiles/presets/claude-only.json
```

Each has exactly `{ "version": 1, "roles": [...] }` and lists all role IDs
in the same order. Installation writes `<skills-dir>/axstack/roles.json` as
`{ "version": 1, "preset": "<selected preset>", "roles": [...] }` and records
its ownership hash like every other installed skill asset. There is no second
role store and no T3 configuration merge.

### Check

```text
axstack check [--bundle <dir>] [--instructions <file>] [--skills-dir <dir>|--harness <name>]
```

The check separates Bun/Git/`gh stack` availability, the `t3` executable and
version floor, in-session MCP readiness, and bundle validity.
The CLI labels in-session MCP readiness as "verified by driver preflight";
the driver saves `orchestrator_capabilities` and follows its advertised schema.
With an instruction target, it separately reports whether the marker block is
owned, missing, unowned, edited, or bound to a different path. Hand-written
legacy routing outside the owned block is reported for manual migration and
preserved byte for byte.

With `--skills-dir` or `--harness`, check reports the archify record path, copy
path, recorded SHA, and checked-out SHA. A missing record, missing copy, or SHA
mismatch fails the check. Chrome absence prints a warning and does not fail it.
`ARCHIFY_CHROME` selects the Chrome executable. Without it, check looks for
common Chrome and Chromium executables on PATH. A check without a skills target
probes host capabilities only.

A successful check is not provider/model availability, effective permission,
skill reload, task execution, mobile delivery, or end-to-end compatibility
proof. Those require their own runtime receipts.

### Uninstall

```text
axstack uninstall --skills-dir <dir> [--instructions <file>] [--claude-settings <file>|--no-claude-settings] [--harness <name>] [--force] [--yes]
```

Uninstall removes only unchanged Axstack-owned files whose current bytes match
the manifest. Edited, custom, unknown, and unrelated files survive. Directories
are pruned only when empty, and the target root is never removed.

Uninstall drops that skills root from archify's owners file. It removes the copy
only when no owners remain, HEAD matches the recorded SHA, and
`git status --porcelain --ignored` is empty. Otherwise it keeps the copy and
reports why, even with `--force`. A pin bump or a changed `--tools-dir` releases
the old copy through the same guard. Installation clones into a temporary sibling
and renames it into place. A later owner or manifest write failure restores
ownership and removes only a copy created by that installation. Older manifests
without an archify record still load.

## Owned instruction block

The deterministic `<!-- axstack:begin v1 -->` / `<!-- axstack:end -->` block
contains the target-derived Axstack entry path and model-free routing prose. It
also routes every subagent, delegated worker, reviewer, and cross-harness dispatch
through the `t3-code` MCP. It forbids harness-native subagent tools. The current
T3 thread is the driver; read-only roles use async `delegate_task`, while authors
use `t3_thread_launch` in their own SHA-pinned worktrees. The standing block
authorizes writer launch; it grants no push, merge, release, or host mutation.
The [runtime reference](../skills/axstack/references/t3-runtime.md) owns the dispatch
and receipt protocol.

Create, update, repeated install, check, and uninstall preserve every byte and
the file mode outside the markers. The manifest binds the canonical instruction
path and exact block hash while retaining older file/profile hash semantics.
Uninstall removes only an unchanged owned block plus the recorded separator;
the instruction file itself remains. Edited or unowned blocks, malformed or
duplicate markers, symlinks, concurrent edits, and legacy Haoshoku routing text
are preserved or refused with an explicit report. Combined failures roll back
skills, instruction bytes and modes, Claude settings, and manifest state; any
failed recovery is reported as incomplete.

`axstack install` exits with status 1 when the selected instruction block is in
conflict and was preserved, so scripts can detect that routing was not
installed. A clean or idempotent install exits 0; preserved edits to ordinary
owned skill files keep their existing non-failing install semantics.

## Safety and ownership behavior

The complete bundle is validated before writes:

- every skill directory contains a real `SKILL.md`;
- bundle and destination symlink/escape checks pass;
- each preset is a real JSON file with version 1, a non-empty `roles` array,
  the filename's selected identity supplied by the caller, and the same role-ID
  set as its peers;
- every role has valid preserved fields, while the mixed checker,
  `axstack-research-web-google`, `axstack-research-x`, and both arena candidate launch-by-agent-id
  routes explicitly permit `model: null`;
  in each single-provider preset, the unavailable adviser and round-2 seat
  explicitly permit `model: null`, as do both cross-provider research routes
  and both arena candidate seats;
- obsolete runtime configuration flags fail before mutation with migration
  guidance.

Reinstalls are idempotent. Unknown files are never silently overwritten or
adopted. Edited owned files keep their previous ownership baseline unless
`--force` explicitly replaces them. Owned files the bundle no longer ships
are stale: a pristine stale copy (on-disk bytes still match the manifest
hash) is deleted, dropped from the written manifest, and reported as
`removed`; an edited or already-missing stale copy is left alone, keeps its
manifest hash, and stays reported as `stale`. Only manifest-owned paths are
ever deleted, through the same ownership-hash guard uninstall uses. The stale
plan is validated read-only before any write, and each deletion re-checks
its target through that guard immediately before removal, so a copy edited
during the run is preserved rather than deleted. Partial failures restore overwritten files, restore removed stale
files with their prior bytes and mode,
remove files created by that run, restore Claude settings/sidecar state, and
leave the prior manifest intact. An incomplete rollback reports exact manual
recovery needs.

Manifest validation covers version, owned file shape, safe relative paths, and
symlink rejection. The role snapshot is ordinary owned data. Invalid or edited
destination roles are preserved and reported rather than treated as permission
to rewrite them.

## Role behavior after installation

The runtime reads `roles.json` from the installed shared root `skills/axstack/`.
A new run records the selected preset plus all role IDs. Class rows resolve
at run start; each role snapshot records class, exact ID, source, and time.
An active run and resume reuse that snapshot after a later preset install unless
the user explicitly changes it and accepts the resulting evidence invalidation.

The `mixed` and `claude-only` presets assign `axstack-auditor`,
`axstack-research-requirements`, `axstack-research-code`, `axstack-research-web`,
`axstack-explore-execution`, and `axstack-monitor` to the Claude Sonnet class at high effort.
The `codex-only` assignments for these roles are unchanged.
The three `-sol` pair seats for auditor, research-code, and explore-execution
use Sol high in `mixed` and `codex-only`; `claude-only` records intentional
absences. The paired seats run independently on one brief and the driver
reconciles their findings.

The mixed checker and `axstack-research-web-google` have provider
`antigravity`; mixed `axstack-research-x` has provider `grok`. All three use
`model: null` with notes authorizing their agent-ID routes; T3 resolves Grok's
exact model from the first entry for that provider in saved capabilities.
For Antigravity `model:null` roles, select the first listed model whose ID ends
with `-<effort>` from saved capabilities and record its exact ID.
Missing effort-suffix matches hold resolution for Antigravity, including empty
model catalogs. The single-provider presets configure the checker and keep
both cross-provider research routes as intentional absences. Their
unavailable adviser and round-2 seat remain explicit same-provider
`model: null` roles, which do not make installation unready;
Align and Spec still hold until both Astra and Opus can return independent
receipts. Every brainstorm runs a light arena across configured families.
Use judges only for Rung 2 hard-to-reverse choices: round 1 needs Opus; round 2,
if invoked, needs escalation Fable and Astra; a required seat that is unavailable
holds that round. The current chat drives on whatever
model runs it; no preset carries a driver role. Every other missing, invalid, unsupported, or unavailable role value holds only
the affected work. Codex and Claude class resolution reads the saved T3 capabilities catalog via
`skills/axstack/scripts/resolve-models.js --provider`; missing or malformed
catalogs hold. A preset model is used as given; class rows resolve to the newest
matching catalog ID. Resume retains the recorded snapshot without re-resolution.
Rejection, timeout, quota, and auth failures hold; no subscription inference,
quota routing, or alternative-model retry applies.

`modeId` and similar permission fields remain conservative declared intent.
They do not prove effective T3 `runtimeMode`, sandboxing, or permission parity.
Requested provider/model/effort, input acceptance, effective session settings,
and completed behavior are separate evidence classes. Follow the runtime
reference for provider option IDs and configuration read-back.

## Claude Code subagent default

The preserved Claude-settings feature manages only
`env.CLAUDE_CODE_SUBAGENT_MODEL = "opus"` when its existing ownership and
availability conditions allow. It does not change the main conversation,
select an Axstack role, force built-in agents, or configure T3.

Axstack merges that one key and preserves all unrelated settings and environment
values. A pre-existing value is preserved and never adopted. Missing Claude,
`--no-claude-settings`, or an unconfirmed home write produces a documented skip.
New settings and ownership files use mode `0600`; existing modes survive.
Malformed JSON, symlinks, or a conflicting saved path fail before mutation.

Ownership remains per key and shared across skill roots through the existing
`.axstack-settings.json` sidecar. A later installation can join ownership
without rewriting the value. Uninstall drops one root and removes the key only
when the last owner leaves and the value remains unchanged. A user edit always
survives.

## Harness skill locations

| Harness | Default directory | Status |
| --- | --- | --- |
| Claude | `~/.claude/skills` | documented upstream |
| Codex | `~/.agents/skills` | documented upstream |
| OpenCode | `~/.config/opencode/skills` | documented upstream |
| Antigravity IDE / `agy` CLI | `~/.gemini/config/skills` | documented upstream |
| Grok | explicit `--skills-dir` only | auto-discovery unverified |

Prefer explicit paths and current upstream CLI guidance. Installing files does
not prove that a running harness reloaded them.

## Runtime preflight and schedules

At an action boundary, load the packaged [T3 runtime reference](../skills/axstack/references/t3-runtime.md)
and save the actual `orchestrator_capabilities` JSON. Missing capability holds
the affected operation. Provider/model routing, Linear documents through the
executor MCP, and live schedule behavior need separate preflights.

Installation creates no production schedule and adds no custom scheduler.
After verified publication readback of every own PR from any Axstack phase,
the driver arms or joins its chat-run watch.
Explicit stop-after-publication and observation-only requests still apply.
A bound T3 schedule resumes the driver every 10 minutes by default.
The run record holds the schedule ID and driver thread.
The chat-run watch never expires or waits for re-authorization while PRs remain open.
The chat-run watch ends only when all watched PRs merge or close, launched work
is settled, and release is settled or not applicable, or the user cancels.
A required PR closed without merging keeps its decision hold and wake.
Follow [Chat-run watch runtime](../skills/axstack-watch/references/watch-runtime.md#chat-run-watch)
for native lifetime re-arming and quiet cadence changes on the recorded schedule ID.
Missing schedule capability holds
activation. Delete the schedule by its exact ID and verify absence with
`list_scheduled_tasks` when the watch ends; uncertainty preserves the hold.
The optional review manager uses an unbound 15-minute T3 schedule and requires
its separate native canary before activation. Installed guidance does not prove
live behavior. See [Review manager](../skills/axstack/references/automations.md).

## Historical migration

Older releases installed Paseo profiles and used Paseo for execution. Those
profile records are inert historical manifest provenance after upgrade: they
do not trigger configuration reads, writes, path-binding refusal, readiness
checks, uninstall mutation, runtime fallback, or timer cleanup. Preserve them
for audit and report the explicit migration path.

The next ordinary upgrade without `--force` removes pristine retired
`axstack-handoff` and `axstack-docs` copies directly: they are deleted,
dropped from the manifest, and reported as removed, while retaining edited
or already-missing retired copies of axstack-handoff and axstack-docs as
recorded, preserved stale entries. The
retired `axstack-driver` row leaves `roles.json` on the next install because
that file is rewritten as one owned snapshot. A --force uninstall/install
cycle remains only for discarding edited copies you have decided to abandon;
edited, custom, and unknown assets otherwise survive. `axstack-explain`
supersedes the old docs route. Full ownership transfer uses the T3 runtime
contract and still requires explicit recipient acceptance.

Do not mutate live historical configuration during development or migration
tests. Host cutover, old-timer cleanup, release installation, and global cleanup
need separate authority and verified backups.

## Examples

```sh
axstack install --preset mixed --bundle ./bundle --skills-dir /tmp/ax-skills --tools-dir /tmp/ax-tools --instructions /tmp/AGENTS.md
axstack install --preset mixed --bundle ./bundle --skills-dir /tmp/ax-skills --tools-dir /tmp/ax-tools --instructions /tmp/AGENTS.md
axstack check --bundle ./bundle --skills-dir /tmp/ax-skills --instructions /tmp/AGENTS.md
axstack uninstall --skills-dir /tmp/ax-skills --instructions /tmp/AGENTS.md
```

The second install should report no changes. These scratch examples do not
activate T3 threads or schedules.

## Rollback

Use the recorded host-mutation authority and verified backups for these steps:

1. Reinstall `axstack@0.20.31` (v0.20.31) on desktop and VPS.
2. Restore the backed-up `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` global instructions on both hosts.
3. Set the recorded T3 manager schedule to `enabled:false` and verify the disabled state.
4. Delete every armed run watch by its recorded schedule ID and verify absence.
5. Stop and disable the `t3 serve` user service on the VPS.
6. Re-enable the Orca automation and verify its enabled state.

Orca stays installed for one week after the VPS canary; keep its automation disabled,
rather than deleting it, after the T3 canary passes. Do not uninstall it during
that retention window.
