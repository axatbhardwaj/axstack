# Installation

Axstack ships a setup CLI that installs owned chat skills, merges Paseo
agent profiles, and checks host capabilities. Chat drives execution; the CLI
performs installation bookkeeping only. There is no Axstack daemon, run
scheduler, or workflow state machine in this package.

Requirements: Bun >= 1.3.14. No runtime dependencies. Filesystem access
uses the approved narrow exception: node:fs and node:fs/promises are
Bun-implemented built-ins; no Node.js runtime is used and no other node:
imports are allowed.

## Commands

All commands take explicit target directories. The installer never guesses
where your skills live: pass `--skills-dir` (or a verified `--harness`
default plus `--yes`, see below).

### `axstack install`

```
axstack install --bundle <dir> --skills-dir <dir> [--profile <file>] [--harness <name>] [--force] [--yes]
```

- `--bundle <dir>`: bundle root holding `skills/axstack-*/SKILL.md`
  (plus supporting files) and `profiles/paseo.json`. Defaults to the
  package root.
- `--skills-dir <dir>` (required unless `--harness` resolves one): where
  skills are installed.
- `--profile <file>`: Paseo host config file. Axstack profiles merge into
  `config.daemon.agentProfiles`; custom profiles, other `daemon` fields,
  and top-level keys keep their values. (The file is reserialized as JSON,
  so formatting may change but no values are altered.) Newly created config
  files are mode `0600`; existing files keep their permissions.
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
  `profiles/paseo.json` symlinks are rejected, as are symlinks, absolute
  paths, and `..` escapes inside the skills tree — all before any target
  write.
- Destination ancestry is checked before mutation too: symlinks anywhere
  below the skills target (or a symlinked profile file itself) refuse the
  run instead of writing, reading-for-delete, or removing through the link.
  A symlinked target root is canonicalized first, so it stays contained.
- Reinstalls are idempotent: unchanged files report `no changes`.
- Edited owned files and profiles are detected via sha256 ownership hashes
  (`.axstack-manifest.json` in the skills directory) and preserved with a
  report. Preserved entries keep their prior install hashes; only actually
  created or updated entries gain manifest records. Pre-existing unrelated
  files — even byte-identical ones — are never adopted as owned, so a later
  uninstall cannot remove them.
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
  backups, remove files created in that run, and leave the manifest
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
axstack uninstall --skills-dir <dir> [--profile <file>] [--force] [--yes]
```

Removes only unchanged Axstack-owned assets (hash match against the
manifest). User-edited files and profiles survive and are reported; `--force`
removes them. Directories are pruned only when left empty, and the target
root itself is never removed. With no manifest, uninstall reports that there
is nothing to remove instead of guessing.

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

## Model presets

Role presets (driver, advisor, PR owners, reviewers) ship as data in
`profiles/paseo.json` and are merged by `axstack install --profile`.
Namespaced role defaults extend the same file: research requirements,
research code, research web, docs authorship, visual explanation and its
review, codebase and execution exploration, the monitor and watchdog
roles, plus the read-only auditor. Review them before installing: the installer applies explicit
configuration only and never auto-installs into your live home. No model is
ever substituted automatically; outages pause affected work for your
decision. Selected live profiles are authoritative at runtime; bundled
values are setup defaults, not a claim of actual model availability.

## Examples

```sh
# Install fixture-style bundle into a scratch target (safe to try)
axstack install --bundle ./bundle --skills-dir /tmp/ax-skills --profile /tmp/paseo.json

# Re-run: expect "no changes (idempotent, everything unchanged)"
axstack install --bundle ./bundle --skills-dir /tmp/ax-skills --profile /tmp/paseo.json

# Check host tools and bundle layout
axstack check --bundle ./bundle

# Remove only unchanged owned assets
axstack uninstall --skills-dir /tmp/ax-skills --profile /tmp/paseo.json
```
