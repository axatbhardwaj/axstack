# Axstack

Axstack is a standalone toolkit for finishing agreed engineering work with less
supervision while retaining independent review. Chat drives execution; a Bun
CLI installs owned skills and role data and checks capabilities. Axstack has no
daemon, scheduler, runtime database, or workflow state machine.

Orca is the only supported active runtime. Its installed, version-matched
`orchestration` and `orca-cli` guides own worktrees, sessions, supervised
dispatch, messages, settlement, and handoff mechanics. Axstack owns scope,
role choices, evidence, review policy, and one private derived run record.

## How a run works

Invoke `axstack` or the needed phase directly: `axstack-align`,
`axstack-spec`, `axstack-tickets`, `axstack-implement`, `axstack-review`, and
`axstack-watch`. Direct `axstack-research`, `axstack-explain`,
`axstack-improve`, and `axstack-debug` routes need no spec ceremony. `axstack-relay` remains an
optional inline route for explicit messages and authorized notifications; an
unavailable or legacy-runtime-only relay falls back to the current conversation
without changing authority.

1. Classify new engineering work as substantial, small, or unclear with a brief
   reason. Small, bounded one-PR work uses the current request or selected issue
   as a snapshotted small-change intent;
   substantial or stacked work needs an approved spec and matching ticket map.
2. The current chat drives on whatever model runs it; there is no driver
   profile. Bind each ready task to the selected role snapshot and an authoritative Orca
   Run, Task, and Dispatch. Exactly one writer owns a candidate at a time.
3. Peer PRs receive both configured independent reviewer roles. Authored PRs
   receive one eligible reviewer from the selected preset's explicit mapping
   and actual author provenance. Every review binds the exact head and base.
   Stable IDs are `axstack-reviewer-primary` and `axstack-reviewer-secondary`.
4. Accepted repairs return to the same author where its session and evidence
   remain valid. The human merges by default, bottom-up for a stack.
5. Full handoff requires explicit recipient acceptance of the exact scope and
   authority before ownership changes. Ordinary resume reconciles the current
   owner instead of replacing it.

Active PR fanout is dependency- and capacity-driven; there is no fixed count.
Each PR has one theme and a measured size under the shared
[PR-shape policy](skills/axstack/references/pr-shape.md). Routine shape and
fanout choices remain autonomous inside approved scope. Material scope,
serious-risk, unavailable-model, and human-merge holds remain explicit.
The autonomous driver records the rationale band's cohesion rationale; the exception band needs a
reasonable split attempt and full exception record. Size alone never requires
user approval.

## Install from source

Requirements: Bun >=1.3.14, Git, `gh`, the `gh stack` extension, and a running
Orca with its runtime-owned guides. Filesystem access uses Bun's implementation
of `node:fs` and `node:fs/promises`; there are no runtime dependencies.

```sh
bun bin/axstack.js check --bundle .
bun bin/axstack.js install --bundle . --skills-dir <dir> --preset mixed [--yes]
bun bin/axstack.js install --bundle . --skills-dir <dir> --preset mixed
bun bin/axstack.js uninstall --skills-dir <dir>
```

Use `--harness codex` or `--harness claude` only for a verified default skill
directory. `--claude-settings` and `--no-claude-settings` manage the existing
Claude Code subagent default transaction; they do not configure Orca roles.
See [installation details](docs/installation.md).

The public bundle preserves three canonical 21-role inputs:
[mixed](profiles/presets/mixed.json),
[codex-only](profiles/presets/codex-only.json), and
[claude-only](profiles/presets/claude-only.json). Each is exactly
`{ "version": 1, "roles": [...] }`. Installation writes the selected snapshot
to `<skills-dir>/axstack/roles.json` as
`{ "version": 1, "preset": "<name>", "roles": [...] }` under normal ownership
hashes. An edited installed role file is preserved.

Mixed configures independent Astra and Fable advisers at high. Single-provider
presets preserve both adviser IDs and mark the unavailable one with `model:
null` inside that preset's provider bounds; installation remains ready, while
Align and Spec hold because both receipts are required. The mixed
`axstack-checker` model is also intentionally `null`; that role stays held
instead of inheriting a provider default. The single-provider presets configure
the checker. Preset changes affect new runs only. Stored model, effort, and permission
fields are declared intent until actual Orca launch receipts establish effective
behavior; installation never proves provider availability or permission parity.
Subscription availability and quota never select a fallback model.
End-to-end compatibility remains unverified without matching runtime receipts.

## Runtime evidence and holds

Native Orca exercises have returned Codex and Claude worker completions,
same-terminal follow-up, separate worktree placement, settlement cleanup,
`user_takeover` retention, and recovery from `consumer_fenced`. These are
bounded runtime facts, not proof that every role or harness is compatible.

Input acceptance is not agent readiness. A trust prompt was observed after an
accepted launch, so startup recovery must inspect the existing attempt, never
answer trust or permission prompts on the worker's behalf, and never create a
duplicate writer. A `worker_done` advances work only when its Task and Dispatch
match the active attempt and its revision evidence verifies.

The user lifted the native-watch hold by decision on 2026-09-16. Orca's native automation
schema exposes a provider but cannot pin model, effort, or permission, so the
driver automation records its model identity every tick and the watchdog treats
a mismatch as a safety hold. Axstack uses no historical fallback and introduces
no custom scheduler. The five-minute driver, hourly read-only watchdog, quiet
healthy ticks, and shared 24-hour deadline remain the acceptance contract.

Mobile completion/reply behavior remains unverified. Structural checks and
qualitative scenario evaluation are not live runtime proof.

## Historical migration boundary

Older releases used Paseo for orchestration and could leave profile ownership
provenance or retired skills behind. That state is historical and inert in the
Orca runtime. Migration preserves user-edited and unknown assets and records
legacy ownership without reading, writing, or deleting live host configuration.
Use the explicit migration guidance in [installation](docs/installation.md);
release installation, host cutover, and old-timer cleanup need separate
authorization.

## License

[MIT](LICENSE) © 2026 Axat Bhardwaj.
