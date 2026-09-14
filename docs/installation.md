# Installation

Axstack ships a setup CLI that installs owned chat skills, merges configured
Paseo agent profiles, and checks host capabilities. Chat drives execution; the CLI
performs installation bookkeeping only. There is no Axstack daemon, run
scheduler, or workflow state machine in this package.

Requirements: Bun >= 1.3.14. No runtime dependencies. Filesystem access
uses the approved narrow exception: node:fs and node:fs/promises are
Bun-implemented built-ins; no Node.js runtime is used and no other node:
imports are allowed.

Bundled Codex profiles use `full-access`; Claude profiles use
`bypassPermissions`. These modes remove tool permission prompts; role scope and
explicit action-authority requirements still apply. Upgrades preserve edited
profiles, so verify modes on existing installations separately.

## Commands

All commands take explicit target directories. The installer never guesses
where your skills live: pass `--skills-dir` (or a verified `--harness`
default plus `--yes`, see below).

### `axstack install`

```
axstack install --preset <mixed|codex-only|claude-only> --bundle <dir> --skills-dir <dir> [--profile <file>] [--claude-settings <file>|--no-claude-settings] [--harness <name>] [--force] [--yes]
```

- `--bundle <dir>`: bundle root holding `skills/axstack-*/SKILL.md`
  (plus supporting files) and `profiles/presets/*.json`. Defaults to the
  package root. Fixture bundles may omit `profiles/presets`; in that case a
  `--profile` install has no profiles to merge.
- `--preset <name>` (required): routing preset `mixed`, `codex-only`, or
  `claude-only`. `codex` is an alias for `codex-only`; `claude` is an alias
  for `claude-only`. The preset is required even when `--profile` is omitted.
  Axstack never infers it from `--harness`, installed tools, credentials, or
  subscriptions.
- `--skills-dir <dir>` (required unless `--harness` resolves one): where
  skills are installed.
- `--profile <file>`: Paseo host config file. Axstack profiles merge into
  `config.daemon.agentProfiles`; custom profiles, other `daemon` fields,
  and top-level keys keep their values. (The file is reserialized as JSON,
  so formatting may change but no values are altered.) Newly created config
  files are mode `0600`; existing files keep their permissions.
- `--claude-settings <file>`: use this Claude Code user-settings file and
  treat Claude as available. This is primarily a deterministic setup/test
  override. Without it, availability is detected with `Bun.which("claude")`
  and the path is `$CLAUDE_CONFIG_DIR/settings.json` when set, otherwise
  `~/.claude/settings.json`.
- `--no-claude-settings`: skip Claude Code user-settings management.
- `--harness <name>`: `claude`, `codex`, `opencode`, or `grok`. Grok has no
  verified auto-discovery, so `--harness grok` is rejected: pass an explicit
  `--skills-dir` override instead.
- `--force`: overwrite user-edited owned assets and take ownership of
  unknown pre-existing files. Off by default. Ordinary bundle upgrades of
  pristine owned files and profiles do NOT need `--force`.
- `--yes`: confirm writes inside your home directory. Temporary directories
  outside home never need this; the installer refuses home writes without it.

Behavior:

- The whole bundle is validated before anything is written: every skill
  directory needs `SKILL.md`; bundle-root, `skills/`, and
  `profiles/presets/` symlinks are rejected. Every preset JSON entry must be a
  real file, name the same preset as its filename, contain a non-empty valid
  profile list, and expose the same role-ID set as every other shipped preset.
  Symlinks, absolute
  paths, and `..` escapes inside the skills tree — all before any target
  write.
- Destination ancestry is checked before mutation too: symlinks anywhere
  below the skills target (or a symlinked profile file itself) refuse the
  run instead of writing, reading-for-delete, or removing through the link.
  A symlinked target root is canonicalized first, so it stays contained.
- Reinstalls are idempotent: unchanged files report `no changes`.
- Omitted and invalid presets fail before any skill, manifest, or Paseo config
  mutation and list the valid choices.
- Bundle profiles without a selected model are setup placeholders, not
  executable defaults. They are reported but omitted from both the Paseo
  config and ownership manifest. An existing configured profile with the same
  ID is preserved and never replaced by an unset value, including with
  `--force`.
- Upgrades remove an older unconfigured placeholder only when its current
  bytes still match the hash bound in Axstack's manifest. A changed entry is
  preserved; an already-missing entry only releases its stale ownership.
- The legacy reviewer IDs `axstack-reviewer-opus` and
  `axstack-reviewer-sol` migrate to the neutral primary/secondary reviewer
  roles only when their live bytes still match an ownership hash in this
  installation's manifest. Unowned or edited legacy entries are never adopted
  or deleted, even when byte-identical to a shipped entry; they remain visible
  as readiness gaps for manual resolution.
- Edited owned files and profiles are detected via sha256 ownership hashes
  (`.axstack-manifest.json` in the skills directory) and preserved with a
  report. Preserved entries keep their prior install hashes; only actually
  created or updated entries gain manifest records. Pre-existing unrelated
  files — even byte-identical ones — are never adopted as owned, so a later
  uninstall cannot remove them. Byte-identical profile matches are reported as
  `profiles unchanged (pre-existing, not adopted)`.
- Owned profile hashes are bound to the canonical config file they were
  installed into. Running install or uninstall with a different `--profile`
  is refused before any file mutation: identical bytes in an unrelated file
  never authorize removal. If the bound file is gone, uninstall releases the
  ownership so a new path can bind; otherwise uninstall the bound config
  first, then install with the new path.
- The manifest itself is validated (version, file/profiles shape, safe
  relative paths) and a symlinked manifest is refused; corrupt or
  foreign-shape manifests stop the run before any mutation.
- Unknown pre-existing files are never silently overwritten.
- Option values beginning with `--` are rejected as missing values before
  any mutation (so `--bundle --skills-dir X` cannot misroute a path).
- Uninstall reads, parses, and plans the profile change before deleting any
  skill file, so a malformed profile fails with skills still on disk.
- Partial failures restore overwritten files (skills and profile) from
  backups, restore or remove Claude settings and sidecar writes, remove files
  created in that run, and leave the manifest
  untouched, so the pre-run state holds again and a retry converges
  (deleted-then-retried entries reconcile as `missing`). If a restore step
  itself fails, the error says rollback is incomplete and names what needs
  manual repair instead of silently swallowing it.

### `axstack check`

```
axstack check [--bundle <dir>]
```

Probes `bun`, `git`, `gh`, the `gh stack` extension (via the real
`gh stack --help`), and `paseo`, then
reports gaps with a non-zero exit when anything is missing. With `--bundle`,
also validates the bundle layout.

Limits (by design, not a bug): a host binary probe cannot prove each agent
session's Linear MCP access, model availability, or quotas. An unavailable
or exhausted model pauses affected work until you choose a replacement; the
installer never substitutes models. Skill prompts perform a session
preflight for Linear access.

### `axstack uninstall`

```
axstack uninstall --skills-dir <dir> [--profile <file>] [--claude-settings <file>|--no-claude-settings] [--force] [--yes]
```

Removes only unchanged Axstack-owned assets (hash match against the
manifest). User-edited files and profiles survive and are reported. `--force`
may remove an edited owned skill file, but later profile edits remain
preserved. Directories are pruned only when left empty, and the target root
itself is never removed. With no manifest, uninstall reports that there is
nothing to remove instead of guessing.

## Claude Code subagent default

When the `claude` binary is available, every routing preset—including
`codex-only`—may install the Claude Code user setting
`env.CLAUDE_CODE_SUBAGENT_MODEL = "opus"`. This is a default for native Claude
Code subagents when another source does not choose their model. It does not
change the main conversation model, replace Paseo's explicit role models, or
cause a Codex-only preset to launch Claude roles. Axstack deliberately never
sets `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`: built-in agents and explicitly chosen
models can still behave differently. See Claude's documentation for
[subagent model selection](https://code.claude.com/docs/en/sub-agents#choose-a-model)
and [settings scopes](https://code.claude.com/docs/en/settings).

Axstack merges only that one `env` key and preserves every unrelated settings
and environment value. A pre-existing value is preserved and never adopted,
even when it already equals `"opus"`. Missing Claude, `--no-claude-settings`,
and a default settings path inside `HOME` without `--yes` are reported skips;
Axstack never installs Claude. New settings and ownership files use mode
`0600`; existing modes are preserved. Malformed JSON, symlinked targets, and a
settings path that conflicts with saved ownership fail before mutation.

Ownership is per key and shared across skill installations. The sidecar
`<settings-dir>/.axstack-settings.json` records the canonical settings path,
the hash Axstack wrote, and canonical skill-root owners. Each skill root's
`.axstack-manifest.json` binds the same settings path. A later install from a
different root joins ownership without rewriting the setting. Uninstall drops
that root and removes the key only when the last owner leaves and the value is
unchanged; a user edit survives. Uninstall uses the saved path even if the
Claude binary has since disappeared. An explicit uninstall
`--claude-settings` must resolve to that same bound path.

For the four common skill targets, run the same explicit preset install for
each root (and confirm home writes):

```sh
for skills in ~/.agents/skills ~/.codex/skills ~/.claude/skills ~/.config/opencode/skills; do
  axstack install --preset mixed --skills-dir "$skills" --profile ~/.paseo/config.json --yes
done
```

Reports distinguish `set`, `unchanged (owned)`, preserved existing overrides,
and skips. Static installation is not proof that a running Claude process
reloaded settings, that a particular subagent accepts the model, or that the
model is available. It also provides no usage or savings evidence.

## Harness skill locations

| Harness  | Default directory                          | Source (verified 2026-09-13)                          |
| -------- | ------------------------------------------ | ----------------------------------------------------- |
| claude   | `~/.claude/skills`                         | [Agent Skills in the SDK](https://docs.claude.com/en/api/agent-sdk/skills) |
| codex    | `$CODEX_HOME/skills` (default `~/.codex`)  | [Agent Skills – Codex](https://developers.openai.com/codex/skills) |
| opencode | `~/.config/opencode/skills`                | [Skills - OpenCode](https://opencode.ai/docs/skills)  |
| grok     | (explicit `--skills-dir` only)             | unverified — no auto-discovery                        |

Each default above names the upstream page that documents it; the installer
also honors `$CODEX_HOME` for Codex. Paths change upstream, so confirm
against local CLI help when in doubt and prefer an explicit `--skills-dir`.
Installing files never proves harness behavior: compatibility needs a real
end-to-end run and is reported only at the level actually verified.

## Routing presets and readiness

Axstack ships three explicit role presets under `profiles/presets/`, each with the
same 17 role IDs:

- `mixed`: Codex and Claude roles. Its `axstack-checker` has `model: null`, so
  16 profiles are installed and the checker remains deferred for explicit
  user selection.
- `codex-only`: 17 configured Codex roles.
- `claude-only`: 17 configured Claude roles.

After a `--profile` install, the CLI evaluates the resulting host config and
prints either `preset <name>: ready` or `preset <name>: NOT ready — <gaps>`.
A not-ready result exits 1 after completing valid mutations; fix the reported
config and retry safely. Missing preset roles, out-of-bounds providers,
missing models, remaining legacy reviewers, an invalid reviewer pair, or an
unsupported/mismatched authored-review route are gaps. In mixed mode the
deferred checker is exempt. Harmless metadata differences and other allowed
model, effort, or mode customizations are reported as deviations but do not
make the preset unready. A skills-only install states that profiles were not
installed and readiness is unverified; it never claims readiness.

To switch routing, run `install` again with the new explicit `--preset` and
the same `--profile`. Pristine owned entries follow the new preset without
`--force`, while user-edited entries remain untouched and are evaluated by
the new readiness rules. The manifest records the canonical preset name.
Repeat installation is idempotent and reports `no changes` when bytes and
ownership are already current. A preset switch applies to new runs; active
runs retain their recorded model/effort snapshot unless separately changed by
an explicit user decision.

Review the mappings before installing. No model is substituted automatically;
outages pause affected work for your decision. The installer only writes the
requested JSON file; it does not call Paseo's native config API, hot-reload a
running daemon, or verify `list_profiles` readback. Installation and a ready
fixture report are not proof of live daemon reload, provider support, model
availability, effort support, quota, or end-to-end harness behavior. Profiles
observed from the host are authoritative at runtime. The merge preserves
existing user-configured profiles and unrelated fields.

## Examples

```sh
# Install fixture-style bundle into a scratch target (safe to try)
axstack install --preset mixed --bundle ./bundle --skills-dir /tmp/ax-skills --profile /tmp/paseo.json

# Re-run: expect "no changes (idempotent, everything unchanged)"
axstack install --preset mixed --bundle ./bundle --skills-dir /tmp/ax-skills --profile /tmp/paseo.json

# Check host tools and bundle layout
axstack check --bundle ./bundle

# Remove only unchanged owned assets
axstack uninstall --skills-dir /tmp/ax-skills --profile /tmp/paseo.json
```

## Retiring former skills and profiles

The bundle no longer contains `axstack-handoff`; task transfer uses Paseo’s
native `paseo-handoff` and `paseo` skills. Enable those through Paseo before
using the transfer route. Axstack’s own run-record and authority context are
carried into the handoff, rather than implemented as another skill.

The bundle also replaces `axstack-docs` with `axstack-explain` and retires the
`axstack-docs` prose profile. Explanation uses project documentation as evidence
while covering systems, changes, current versus intended behavior, and bounded
implementation gaps. If both skills are discoverable during migration,
`axstack-explain` supersedes the old route.

An ordinary installer upgrade reports previously owned assets absent from the
bundle as stale and preserves them. It therefore retains an installed
`axstack-handoff` or `axstack-docs` skill and the `axstack-docs` profile. To
refresh an existing target, use the documented uninstall/install cycle without
`--force`: pristine owned assets are removed, while edited, custom, and unknown
files or profiles survive for explicit resolution. Keep the same profile
binding when cycling profiles; a skills-only cycle can omit `--profile` to
leave profiles intact. Apply this separately to each selected harness target
and verify both the discovery catalog and configured profiles. No new deletion
logic is involved.
