# Axstack

Engineering workflows for AI agents, from a first question to a reviewed PR.

```text
align → spec → tickets → implement → review → watch
```

Axstack gives your current T3 thread a way to scope work, build it with tests, and
review the exact result. T3 Code provides worktrees, agent threads, and visible
coordination. You can start at the phase you need.

## Why Axstack

| Failure mode | How Axstack responds |
| --- | --- |
| Wrong thing built | Align rounds clarify the request; every brainstorm runs a light arena across configured families. Use judges only for Rung 2 hard-to-reverse choices. |
| Nobody really reviewed it | Strict TDD checks behavior first; mixed authored review is cross-provider, and mixed peer review pairs Sol high with Opus medium in isolated sessions at the exact revision. |
| Design rot | The design lens sketches boundaries before a build; Improve surfaces evidenced changes later. |
| Agents left a mess | T3 makes delegation visible, one writer owns each PR, cleanup stays bounded, and watched own PRs merge under guarded rules. |

## Prerequisites

Axstack supports only Linux hosts. You need Bun >=1.3.14, Git, the GitHub
CLI (`gh`) with `gh stack`, and T3 Code `0.0.46-nightly.20261003.2610` or newer
on PATH. The providers selected by your preset must be available inside T3.

Choose one explicit preset (each contains all role IDs): [mixed](profiles/presets/mixed.json)
(recommended), [codex-only](profiles/presets/codex-only.json), or
[claude-only](profiles/presets/claude-only.json). Mixed supports cross-provider
implementation review; single-provider presets have workflow limits and are
not automatic cross-class or cross-provider fallbacks when a model is unavailable. See
[workflow and routing details](docs/workflows.md).

## Quick start

Install the CLI and skills, then check your host. This example targets Codex:

```sh
bun add --global axstack
export PATH="$HOME/.bun/bin:$PATH"
axstack install --harness codex --preset mixed --yes
axstack check --harness codex
```

Reload the harness's skills in T3 after installation. A green check verifies
local capabilities and installed files; it does not prove live provider readiness,
schedule activation or mobile delivery. See [installation](docs/installation.md)
for other harnesses, custom paths, upgrades, conflicts and uninstalling.

### First task

Open your repository as a T3 project and start a driver thread.
Codex invokes skills with `$skill`, and Claude uses `/skill`.
For a small repair, send this request (replace `$` with `/` in Claude):

```text
$axstack-implement Fix the empty-state message in the existing list view within one PR, preserve list behavior, and verify the displayed result.
```

Small, bounded changes can begin with your request or an existing issue;
substantial work needs an approved spec and matching tickets before
implementation. Research, explanation, and peer review can start directly.
The driver returns a candidate revision, test evidence and unverified boundaries.
You make decisions at holds and substantial-spec approval.
Follow [getting started](docs/getting-started.md) for the full first-task journey
and [guides](docs/guides.md) for features, reviews, watches, debugging and releases.

## What you can do

| Layer | Skill | What it does |
| --- | --- | --- |
| Plan | [axstack-align](skills/axstack-align/SKILL.md) | Settle scope through questions, a design lens sketch, and inline brainstorm validation. |
| Plan | [axstack-brainstorm](skills/axstack-brainstorm/SKILL.md) | Validate an approach with independent candidates; judges for hard choices. |
| Plan | [axstack-spec](skills/axstack-spec/SKILL.md) | Write and approve an observable specification. |
| Plan | [axstack-tickets](skills/axstack-tickets/SKILL.md) | Break approved scope into executable tasks. |
| Build | [axstack-implement](skills/axstack-implement/SKILL.md) | Build with strict TDD and an author → review → repair loop. |
| Build | [axstack-debug](skills/axstack-debug/SKILL.md) | Diagnose a bug with a failing check and hand off a bounded repair. |
| Build | [axstack-perf](skills/axstack-perf/SKILL.md) | Route measured performance work to Debug, Improve, or Implement. |
| Verify | [axstack-review](skills/axstack-review/SKILL.md) | Review a PR or bounded codebase at an exact revision. |
| Verify | [axstack-verify](skills/axstack-verify/SKILL.md) | Create, prove and maintain a repository verification skill. |
| Verify | [axstack-improve](skills/axstack-improve/SKILL.md) | Find evidenced codebase improvements without editing code. |
| Verify | [axstack-audit](skills/axstack-audit/SKILL.md) | Measure a run's outcomes and evidence gaps. |
| Verify | [axstack-correct](skills/axstack-correct/SKILL.md) | Report repeated mistakes and propose stronger checks when invoked by the user. |
| Operate | [axstack-watch](skills/axstack-watch/SKILL.md) | Observe or maintain an existing PR within its authority. |
| Operate | [axstack-cleanup](skills/axstack-cleanup/SKILL.md) | Retire eligible completed agent resources. |
| Operate | [axstack-relay](skills/axstack-relay/SKILL.md) | Send an explicit message or authorized notification. |
| Understand | [axstack-research](skills/axstack-research/SKILL.md) | Answer one bounded question with sources. |
| Understand | [axstack-explain](skills/axstack-explain/SKILL.md) | Explain a system and separate known behavior from gaps. |
| Understand | [axstack-diagram](skills/axstack-diagram/SKILL.md) | Draw SVG/CSS in inline pages, Mermaid for chat/GitHub/docs, or requested archify viewers. |

Explanations default to checked inline T3 pages above a short reply.
Use [archify](https://github.com/tt-a1i/archify) (MIT) only on an explicit viewer request.

## How work stays controlled

- The current T3 thread drives scope, coordination, and publication. Delegation uses
  visible T3 orchestration via the `t3-code` MCP; harness-native subagent
  tools are forbidden. Separate worktrees keep one writer on each candidate.
  See the [T3 runtime boundary](skills/axstack/references/t3-runtime.md).
- Peer PRs receive two independent reviews. Authored changes receive a reviewer
  selected from the author's configured pairing. Reviews bind to exact revisions.
- Agents keep accepted decisions and evidence for resume. Missing authority,
  unavailable models, and serious risks surface as holds. For own PRs, automatic
  merge is the default under the
  [watch predicate](skills/axstack-watch/SKILL.md#5-state-readiness-precisely).

## Optional PR automation

Manual review works without a schedule.
Every verified own-PR publication arms or joins the driver's chat-run watch,
subject to explicit stop-after-publication or observation requests.
See [Host operations](docs/host-operations.md#chat-run-watch-activation) for wake activation and cadence.
See [Chat-run PR watch](docs/workflows.md#chat-run-pr-watch) for the lifecycle and quiet cadence.

An optional native T3 review manager runs finite peer-review passes every 15
minutes; the review automation never merges for you. Activation needs live
host validation. See [PR-manager setup and safety](docs/host-operations.md#optional-native-peer-review-automation).


## Automatic merge boundaries

Eligible own PRs use guarded automatic merge; see [merge boundaries, exclusions, account-selection carve-out and accepted risks](docs/workflows.md#automatic-merge-boundaries).

## Some notes

- T3 Code is the only supported active runtime. Axstack adds no daemon or runtime
  database. The exception is one opt-in systemd user timer `axstack-default-sync`,
  running a stateless script that rewrites only T3 `defaultModelSelection`.
  It has no workflow state and launches no agent; see
  [Host operations](docs/host-operations.md#new-chat-default-sync).
- The recorded owning watch thread merges eligible own PRs; excluded PRs use a merge card.
- This is an early project; expect the workflows to evolve.

## Documentation

| Page | Use it for |
| --- | --- |
| [Getting started](docs/getting-started.md) | Install, understand `check`, and run a first bounded task. |
| [Concepts](docs/concepts.md) | Driver threads, phases, roles, presets, holds, evidence and account selection. |
| [Guides](docs/guides.md) | Step-by-step journeys for features, fixes, reviews, watches, debugging and releases. |
| [Workflows](docs/workflows.md) | Routing, review policy, merge boundaries, exclusions and accepted risks. |
| [Installation](docs/installation.md) | CLI commands, harness paths, configuration, upgrades and troubleshooting. |
| [Host operations](docs/host-operations.md) | Configure your host, provider runtimes, remote access and automations. |
| [Skill writing](docs/skill-writing.md) | Contribute self-contained skills and contract tests. |

See [PR scope and sizing](skills/axstack/references/pr-shape.md) for candidate
shape and [Releases](https://github.com/axatbhardwaj/axstack/releases) for release history.

## License

[MIT](LICENSE) © 2026 Axat Bhardwaj.
