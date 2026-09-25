# Axstack

Engineering workflows for AI agents, from a first question to a reviewed PR.

```text
align → spec → tickets → implement → review → watch
```

Axstack gives your current chat a way to scope work, build it with tests, and
review the exact result. Orca provides worktrees, agent sessions, and visible
coordination. You can start at the phase you need.

## What you can do

| Layer | Skill | What it does |
| --- | --- | --- |
| Plan | [axstack-align](skills/axstack-align/SKILL.md) | Settle scope through questions, a design lens sketch, and a four-family arena for hard choices. |
| Plan | [axstack-spec](skills/axstack-spec/SKILL.md) | Write and approve an observable specification. |
| Plan | [axstack-tickets](skills/axstack-tickets/SKILL.md) | Break approved scope into executable tasks. |
| Build | [axstack-implement](skills/axstack-implement/SKILL.md) | Build with strict TDD and an author → review → repair loop. |
| Build | [axstack-debug](skills/axstack-debug/SKILL.md) | Diagnose a bug with a failing check and hand off a bounded repair. |
| Verify | [axstack-review](skills/axstack-review/SKILL.md) | Review a PR or bounded codebase at an exact revision. |
| Verify | [axstack-improve](skills/axstack-improve/SKILL.md) | Find evidenced codebase improvements without editing code. |
| Verify | [axstack-audit](skills/axstack-audit/SKILL.md) | Measure a run's outcomes and evidence gaps. |
| Operate | [axstack-watch](skills/axstack-watch/SKILL.md) | Observe or maintain an existing PR within its authority. |
| Operate | [axstack-cleanup](skills/axstack-cleanup/SKILL.md) | Retire eligible completed agent resources. |
| Operate | [axstack-relay](skills/axstack-relay/SKILL.md) | Send an explicit message or authorized notification. |
| Understand | [axstack-research](skills/axstack-research/SKILL.md) | Answer one bounded question with sources. |
| Understand | [axstack-explain](skills/axstack-explain/SKILL.md) | Explain a system and separate known behavior from gaps. |

Small, bounded changes can begin with your request or an existing issue;
substantial work needs an approved spec and matching tickets before
implementation. Research, explanation, and peer review can start directly.

## Why Axstack

| Failure mode | How Axstack responds |
| --- | --- |
| Wrong thing built | Align rounds clarify the request; a four-family arena compares approaches for hard choices. |
| Nobody really reviewed it | Strict TDD checks behavior first; cross-provider review checks the exact revision. |
| Design rot | The design lens sketches boundaries before a build; Improve surfaces evidenced changes later. |
| Agents left a mess | Orca makes delegation visible, one writer owns each PR, cleanup stays bounded, and a human merges. |

## Quick start

> [!NOTE]
> You need Bun >=1.3.14, Git, the GitHub CLI (`gh`) with `gh stack`, and a
> running Orca with the `orca-cli`, `orchestration`, and `orca-linear` guides.
> The agents selected by your preset must also be available in Orca.

Install the CLI and skills. This example targets Codex:

```sh
bun add --global axstack
axstack check --harness codex
axstack install --harness codex --preset mixed --yes
```

Open an Orca chat and ask for the phase you need:

```text
$axstack-align Help me scope account recovery.
$axstack-implement Build the task we agreed on.
$axstack-review Review this pull request: <PR URL>
$axstack-review Find issues in <paths> at <commit SHA>.
$axstack-watch Monitor this PR without making changes: <PR URL>
$axstack-watch Watch every PR raised by this chat until all merge or close
```

<details>
<summary>Codex installation notes</summary>

Codex skills default to the shared `~/.agents/skills` root. The owned
`AGENTS.md` block stays under `$CODEX_HOME` (default `~/.codex`). A default
install retires only unchanged manifest-owned legacy skills; `--skills-dir`
sets an explicit target without automatic migration.

</details>

<details>
<summary>Other harnesses</summary>

Use `--harness claude`, `opencode`, or `antigravity` with `axstack check` and
`axstack install`, or provide explicit skill and instruction paths. Installation
adds an owned instruction block and preserves unrelated content. It does not
enable automations or prove that every configured model is available.

</details>

See [installation](docs/installation.md) for source installs, custom paths,
upgrades, conflicts, and uninstalling.

## How work stays controlled

- The current chat drives scope, coordination, and publication. Delegation uses
  visible Orca orchestration via the `orca` CLI, not harness-native subagent
  tools. Separate worktrees keep one writer on each candidate.
- Peer PRs receive two independent reviews. Authored changes receive a reviewer
  selected from the author's configured pairing. Reviews bind to exact revisions.
- Agents keep accepted decisions and evidence for resume. Missing authority,
  unavailable models, and serious risks surface as holds. The human merges.

Choose one explicit preset (26 roles each): [mixed](profiles/presets/mixed.json)
(recommended), [codex-only](profiles/presets/codex-only.json), or
[claude-only](profiles/presets/claude-only.json). Mixed supports cross-provider
implementation review; single-provider presets have workflow limits. See
[workflow and routing details](docs/workflows.md).

## Optional PR automation

Manual review and watch work without a schedule. An optional native Orca review
manager can handle recurring peer review; chat-run watch can observe owned PRs.
Own-PR repairs stay chat-driven.
Activation is opt-in and needs live host validation. See
[PR-manager setup and safety](skills/axstack/references/automations.md).

## Some notes

- Orca is the only supported active runtime. Axstack adds no daemon or runtime
  database.
- A human merges by default.
- This is an early project; expect the workflows to evolve.

## Documentation

- [Installation and configuration](docs/installation.md)
- [Workflows, review policy, and model routing](docs/workflows.md)
- [PR scope and sizing](skills/axstack/references/pr-shape.md)

## License

[MIT](LICENSE) © 2026 Axat Bhardwaj.
