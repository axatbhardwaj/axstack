# Installation

Axstack's Bun CLI installs owned chat skills plus one selected role snapshot and
checks host capabilities. Orca is the only supported active runtime. The CLI
does not dispatch agents, edit Orca settings, run a scheduler, or maintain a
workflow database.

Requirements: Bun >=1.3.14, Git, `gh`, the `gh stack` extension, and a running
Orca whose version-matched `orchestration` and `orca-cli` guides are available.
There are no runtime dependencies. Filesystem access uses Bun-backed `node:fs`
and `node:fs/promises`; no other Node runtime contract is introduced.

## Commands

### Install

```text
axstack install --preset <mixed|codex-only|claude-only> --bundle <dir> --skills-dir <dir> [--instructions <file>] [--claude-settings <file>|--no-claude-settings] [--harness <name>] [--force] [--yes]
```

- `--preset` is required. `codex` and `claude` are aliases for the canonical
  `codex-only` and `claude-only` names. Axstack never infers a preset from the
  harness, available tools, provider credentials, subscriptions, or quota.
- `--bundle` defaults to the package root and contains `skills/` plus
  `profiles/presets/*.json`.
- `--skills-dir` is required unless a verified harness default resolves it.
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
- `--claude-settings` and `--no-claude-settings` control the existing Claude
  Code subagent-default transaction. They do not configure Orca roles.
- `--force` may replace an edited owned asset; it never adopts or removes
  unrelated state.
- `--yes` confirms writes under the user's home directory. Tests use temporary
  homes and fixtures only.

## Role presets

The selected bundle input is one of:

```text
profiles/presets/mixed.json
profiles/presets/codex-only.json
profiles/presets/claude-only.json
```

Each has exactly `{ "version": 1, "roles": [...] }` with the same 21 stable
role IDs. Installation writes `<skills-dir>/axstack/roles.json` as
`{ "version": 1, "preset": "<selected preset>", "roles": [...] }` and records
its ownership hash like every other installed skill asset. There is no second
role store and no Orca configuration merge.

### Check

```text
axstack check [--bundle <dir>] [--instructions <file>] [--skills-dir <dir>|--harness <name>]
```

The check separates Bun/Git/`gh stack` availability, resolved Orca executable,
runtime readiness, required runtime-owned guide discovery, and bundle validity.
With an instruction target, it separately reports whether the marker block is
owned, missing, unowned, edited, or bound to a different path.
It must honor Orca's executable-resolution rules, including the Linux screen
reader name collision, and must not switch binaries after a failed resolution.

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

## Owned instruction block

The deterministic `<!-- axstack:begin v1 -->` / `<!-- axstack:end -->` block
contains the target-derived Axstack entry path and model-free routing prose. It
also routes subagents, delegated workers, reviewers, and cross-harness work
through Orca's `orca` CLI and forbids harness-native subagent delegation.

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
- every role has valid preserved fields, while the mixed checker and the
  unavailable adviser in each single-provider preset explicitly permit
  `model: null`;
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

The runtime reads `roles.json` relative to the actually loaded `axstack` skill.
A new run records the selected preset plus all 21 role rows. An active run keeps
that snapshot after a later preset install unless the user explicitly changes
it and accepts the resulting evidence invalidation.

The mixed checker has `model: null`; checker dispatch is held and never inherits
a provider default. The single-provider presets configure the checker. Their
unavailable adviser remains an explicit same-provider `model: null` role, which
does not make installation unready; Align and Spec still hold until both Astra
and Fable can return independent receipts. The current chat drives on whatever
model runs it; no preset carries a driver role. Every other missing, invalid, unsupported, or unavailable role value holds only
the affected work. There is no model substitution, subscription inference, or
quota routing.

`modeId` and similar permission fields remain conservative declared intent.
They do not prove the effective Orca launcher mode, sandboxing, or permission
parity. Requested provider/model/effort, input acceptance, effective session
settings, and completed behavior are separate evidence classes.

## Claude Code subagent default

The preserved Claude-settings feature manages only
`env.CLAUDE_CODE_SUBAGENT_MODEL = "opus"` when its existing ownership and
availability conditions allow. It does not change the main conversation,
select an Axstack role, force built-in agents, or configure Orca.

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
| Codex | `$CODEX_HOME/skills` (default `~/.codex/skills`) | documented upstream |
| OpenCode | `~/.config/opencode/skills` | documented upstream |
| Grok | explicit `--skills-dir` only | auto-discovery unverified |

Prefer explicit paths and current upstream CLI guidance. Installing files does
not prove that a running harness reloaded them.

## Runtime guide discovery

The installed Axstack bundle does not own or copy Orca's guides. At an action
boundary, the skill resolves one Orca executable and loads that binary's
version-matched `orchestration` and `orca-cli` guides. Automation guidance is
loaded only for the watch branch. Missing discovery is a setup gap, not a reason
to fall back or invent commands.

Native watch activation is currently held: provider selection exists, but
model, effort, permission, and bounded-expiry support do not preserve the
accepted contract. Installation creates no production schedule and adds no
custom scheduler.

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
supersedes the old docs route. Full ownership transfer uses Orca's runtime-owned
handoff guidance and still requires explicit recipient acceptance.

Do not mutate live historical configuration during development or migration
tests. Host cutover, old-timer cleanup, release installation, and global cleanup
need separate authority and verified backups.

## Examples

```sh
axstack install --preset mixed --bundle ./bundle --skills-dir /tmp/ax-skills --instructions /tmp/AGENTS.md
axstack install --preset mixed --bundle ./bundle --skills-dir /tmp/ax-skills --instructions /tmp/AGENTS.md
axstack check --bundle ./bundle --skills-dir /tmp/ax-skills --instructions /tmp/AGENTS.md
axstack uninstall --skills-dir /tmp/ax-skills --instructions /tmp/AGENTS.md
```

The second install should report no changes. These scratch examples do not
activate Orca sessions or schedules.
