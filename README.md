# Axstack

Engineering workflows for AI agents, from an idea to a reviewed pull request.

Axstack is a set of skills for engineers who want agents to carry work forward
with less supervision, without giving up clear scope, independent review, or
control over what ships. Use it to plan a feature, implement an agreed task,
review a teammate's PR, or maintain your own PRs as feedback arrives.

Your chat stays in charge. Orca provides the worktrees, agent sessions, and
coordination; Axstack supplies the workflow and review rules. A small Bun CLI
installs the skills and checks prerequisites. There is no Axstack daemon,
scheduler, or runtime database to operate. Orca is the only supported runtime.

## What you can do

| Need | Skill |
| --- | --- |
| Explore an idea and settle scope | `axstack-align` |
| Turn agreed scope into a specification | `axstack-spec` |
| Break a specification into executable tickets | `axstack-tickets` |
| Build an approved task with tests and independent review | `axstack-implement` |
| Review a pull request or bounded existing code | `axstack-review` |
| Monitor or maintain an existing PR | `axstack-watch` |
| Diagnose a bug and establish a failing check | `axstack-debug` |
| Answer a bounded question with sources | `axstack-research` |
| Explain a system or identify improvements | `axstack-explain`, `axstack-improve` |
| Measure a run's outcomes and gaps | `axstack-audit` |
| Retire eligible completed subagent resources | `axstack-cleanup` |
| Send an explicit message or authorized notification | `axstack-relay` |

Start at the phase you need. Small, bounded changes can begin with your request
or an existing issue; substantial work needs an approved spec and matching
tickets before implementation. Research, explanation, and peer review do not
require a new specification.

For a larger feature, the usual path is:

```text
align → spec → tickets → implement → review → watch
```

The implementation workflow includes the author–review–repair loop. You do not
need to manually coordinate every agent or repeat an approval that is still valid.

## Quick start

You need Bun >=1.3.14, Git, the GitHub CLI (`gh`), the `gh stack` extension,
and a running Orca with its `orca-cli`, `orchestration`, and `orca-linear`
guides available.
The agents selected by your preset must also be available in Orca.

Install the CLI and skills for your harness. For example, for Codex:

```sh
bun add --global axstack
axstack check --harness codex
axstack install --harness codex --preset mixed --yes
```

Codex skills default to the shared `~/.agents/skills` root while its owned
`AGENTS.md` block stays under `$CODEX_HOME` (default `~/.codex`). A default
install safely retires only unchanged manifest-owned legacy Axstack skills;
use `--skills-dir` for an explicit target without automatic migration.

Then open an Orca chat and ask for the relevant skill:

```text
$axstack-align Help me scope account recovery.
$axstack-implement Build the task we agreed on.
$axstack-review Review this pull request: <PR URL>
$axstack-review Find issues in <paths> at <commit SHA>.
$axstack-watch Monitor this PR without making changes: <PR URL>
$axstack-watch Watch every PR raised by this chat until all merge or close
```

Use `--harness claude`, `opencode`, or `antigravity` for another supported
installation target, or provide explicit skill and instruction paths.
Installation adds an owned instruction block and preserves unrelated content;
it does not enable automations or prove that every configured model is available.
See [installation](docs/installation.md) for source installs, custom paths,
upgrades, conflicts, and uninstalling.

## How work stays controlled

- **One accountable driver, one writer per candidate.** Your current chat
  coordinates work; separate worktrees keep PR jobs isolated.
- **Independent review.** Peer PRs receive two independent reviews; authored
  changes receive a reviewer selected from the actual author's configured
  pairing. Reviews apply to an exact revision, not just a branch name.
- **Visible agent work.** Delegation uses visible Orca orchestration via the `orca` CLI,
  not harness-native subagent tools.
- **Explicit boundaries.** Agents work within agreed scope. Missing authority,
  unavailable models, and serious risks are surfaced rather than silently
  bypassed. The human merges by default.
- **Resumable progress.** Work retains ownership, decisions, and evidence so a
  later session can reconcile what happened before continuing.
- **Bounded cleanup.** The driver can retire proven completed subagent resources
  inline or from an explicitly scoped backlog without touching active, manual,
  uncertain, user-owned, dirty, unpushed, or useful unmerged work.

Choose an explicit role preset:
[mixed](profiles/presets/mixed.json),
[codex-only](profiles/presets/codex-only.json), or
[claude-only](profiles/presets/claude-only.json).
Mixed supports the cross-provider implementation workflow. Single-provider
presets have workflow limitations; they are not automatic fallbacks when a
model is unavailable. See [workflow and routing details](docs/workflows.md).

## Optional PR automation

Manual review and watch work independently of scheduled automation.
For recurring peer review, Axstack defines one optional native Orca review manager.
Own-PR observation and authorized repair remain user-driven through `axstack-watch`. Its chat-run mode can use one optional same-host native Orca observer per Run, about every ten minutes, to report new PR events internally to the original chat. The chat alone directs repairs and publication. Activation needs a live host canary; source and install checks do not prove it is running.

The review manager uses a 15-minute schedule. Each pass uses a fresh finite
session in one dedicated existing workspace and admits eligible actionable PR events within
measured host capacity. Waiting PRs remain tracked without consuming
execution slots, so a large open-PR backlog does not require an idle agent per PR.
Completed passes save compact continuity and close only their own exact terminal.
Held jobs preserve evidence, use private worktree-local temporary paths, and
release capacity only after native descendant settlement. Uncertain execution
teardown pauses the lane; settled evidence cleanup does not occupy a slot.

Scheduling is opt-in and requires host-specific runtime validation before
activation. Installing Axstack does not turn it on. The review automation never merges for you.
See [PR-manager setup and safety](skills/axstack/references/automations.md).

## Documentation

- [Installation and configuration](docs/installation.md)
- [Workflows, review policy, and model routing](docs/workflows.md)
- [PR scope and sizing](skills/axstack/references/pr-shape.md)
- [Releases](https://github.com/axatbhardwaj/axstack/releases)

## License

[MIT](LICENSE) © 2026 Axat Bhardwaj.
