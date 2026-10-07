# Getting started

Install Axstack, check your host, then ask for one bounded task in T3 Code.
For the mental model, read [concepts](concepts.md); for other journeys, use
[guides](guides.md).

## Prepare your host

You need Bun >=1.3.14, Git, the GitHub CLI with its `gh stack` extension, and
T3 Code `0.0.46-nightly.20261003.2610` or newer. These executables must be on PATH.
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
and fetches the pinned archify tool for explicit viewer requests. Reload the harness's skills in T3 after
installation. Use the [installation reference](installation.md) for other
harnesses, source installs or conflicts.

A successful check exits 0. Its five capability rows mean:

| Row | Meaning |
| --- | --- |
| `bun` | The running Bun version meets the floor. |
| `git` | Git's version command succeeds. |
| `gh` | The GitHub CLI's version command succeeds. |
| `gh stack` | The extension's actual help command succeeds. |
| `t3` | T3's version command succeeds and meets the floor. |

With this harness target, check also validates the archify record/copy/SHA and
reports the owned instruction binding. Missing Chrome is a warning. Any reported
gap exits 1; follow [troubleshooting](installation.md#exit-codes-and-troubleshooting) before
starting a task.

Explanations default to checked inline T3 pages above a short reply.
Use archify only on an explicit viewer request. Spec approval readbacks also
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
