# Getting started

Linux is the only supported host OS.

Install Axstack, check your host, then ask for one bounded task in T3 Code.
For the mental model, read [concepts](concepts.md); for other journeys, use
[guides](guides.md).

## Prepare your host

You need Bun >=1.3.14, Git, the GitHub CLI, and
T3 Code stable `0.1.0` or newer. These executables must be on PATH.
Nightly and other prerelease builds are unsupported. Install or update T3 from
its stable channel, ensure the stable `t3` executable is on PATH, and rerun
`axstack check` if this prerequisite fails. Check does not install or switch T3.
The providers required by your chosen preset must be available inside T3.
See [installation](installation.md) for harness paths and
[host operations](host-operations.md) for provider and project setup.

## Install and check

Run this block in a shell. It installs for Codex and explicitly chooses `mixed`:

```sh
bun add --global axstack
export PATH="$HOME/.bun/bin:$PATH"
axstack install --harness codex --preset mixed --yes
axstack check --harness codex
```

Installation writes owned skills and instructions, preserving unrelated content,
with the vendored anatomy kit included. Reload the
harness's skills in T3 after installation. Use the [installation reference](installation.md) for other
harnesses, source installs or conflicts.

A successful check exits 0. Its four capability rows mean:

| Row | Meaning |
| --- | --- |
| `bun` | The running Bun version meets the floor. |
| `git` | Git's version command succeeds. |
| `gh` | The GitHub CLI's version command succeeds. |
| `t3` | T3's version command succeeds and reports stable >=0.1.0. |

The `gh stack` extension is needed only for preexisting native stacks; ordinary
PRs/chains use Git and `gh pr`. With this harness target, check also reports the
owned instruction binding. Any reported gap exits 1; follow
[troubleshooting](installation.md#exit-codes-and-troubleshooting) before starting a task.

Explanations default to checked inline T3 pages above a short reply.
Use Anatomy only on an explicit isometric or physical-object figure request.
Every Explain visual receives author and reviewer dispatches. Spec approval readbacks also
use inline pages, identifying the revision you approve.

Check does not prove live provider readiness, schedule activation or mobile delivery.
Inside the driver thread, capability discovery, provider configuration read-back
and actual execution receipts establish their respective runtime boundaries.

## First bounded task

Open your repository as a T3 project and start a driver thread. Pick a small
one-PR change with an observable result. For example, ask the agent to repair
an existing empty-state message and verify its behavior.

Codex invokes skills with `$skill`; Claude uses `/skill`. Send one of these
equivalent requests in T3:

```text
$axstack-implement Fix the empty-state message in the existing list view. Keep this to one PR, preserve list behavior, and verify the displayed result.
```

```text
/axstack-implement Fix the empty-state message in the existing list view. Keep this to one PR, preserve list behavior, and verify the displayed result.
```

The driver reads back the small-change intent, acceptance checks, exclusions and
Release/host authority, then carries the author → review → repair loop forward.
If the request has an unsettled material design question, it enters Align first.
For a larger feature, Align and an approved Spec come before implementation.

You make the decisions at holds or substantial-spec approval. Watch follows the
[canonical merge policy](workflows.md#automatic-merge-boundaries).
Follow the [small-fix journey](guides.md#small-fix) to see the returned evidence
and where to look when a task holds.
