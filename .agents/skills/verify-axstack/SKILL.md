---
name: verify-axstack
description: Verify axstack's Bun CLI, packaged helper scripts and npm package contents when changing installation, workflow helpers or packaging in this repository.
---

# Verify axstack

Use this repository recipe for offline, non-browser verification. Read the
[feature map](features/README.md) and select affected paths. Never fix product
code here. A failing build holds driving; report unavailable isolation or
harness discovery as unverified and hold acceptance.

## Launch

From the candidate checkout, substitute a fresh dispatch key and an existing
private evidence directory outside scratch. Resolve the discovered skill path
before using it: either `.agents/skills/verify-axstack` or its Claude symlink.
No daemon, port, test account or production credential is needed.

```bash
REPO=$(git rev-parse --show-toplevel)
SKILL=$(realpath "$REPO/.agents/skills/verify-axstack")
BUN=$(realpath "$(command -v bun)")
# Replace both literal paths for this run; never reuse another run's scratch.
TMPDIR=/tmp/axstack-verify-local
EVIDENCE=/absolute/private/evidence/verify-axstack
HOST_NET=$(readlink /proc/self/ns/net)
mkdir -m 700 /tmp/axstack-verify-local
test ! -L "$TMPDIR"
test "$(realpath "$TMPDIR")" = /tmp/axstack-verify-local
test "$(stat -c '%a:%u' "$TMPDIR")" = "700:$(id -u)"
mkdir -m 700 "$TMPDIR/home"
test -d "$EVIDENCE"
unshare -n -- env -i PATH="$(dirname "$BUN"):/usr/bin:/bin" \
  HOME="$TMPDIR/home" TMPDIR="$TMPDIR" REPO="$REPO" SKILL="$SKILL" \
  EVIDENCE="$EVIDENCE" HOST_NET="$HOST_NET" bash --noprofile --norc
```

Inside that offline shell, initialize these handles. The fresh network
namespace has no external interfaces; failure of `unshare` holds driving.
Readiness is an exited command plus observed files, not a listening service.

```bash
set -euo pipefail
cd "$REPO"
REV=$(git rev-parse HEAD)
SCRIPTS="$REPO/skills/axstack/scripts"
export REV SCRIPTS
export AXSTACK_ARCHIFY_REPO="$TMPDIR/absent-archify"
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
printf '%s\n' "$REV" > "$EVIDENCE/revision.txt"
printf '%s\n' "shell PID=$$; no background services" > "$EVIDENCE/processes.txt"
```

## Doctor

Define this read-only check in the offline shell and call it before **every**
Drive path. It checks instance ownership, version and isolated network identity.
There are no ports or auth prerequisites. Do not interpret offline capability
gaps as live T3/provider readiness. Bun must meet `package.json.engines.bun`.

```bash
doctor() {
  test ! -L "$TMPDIR"
  test "$(stat -c '%a:%u' "$TMPDIR")" = "700:$(id -u)"
  test "$(realpath "$HOME")" = "$TMPDIR/home"
  test "$(readlink /proc/self/ns/net)" != "$HOST_NET"
  test "$(git -C "$REPO" rev-parse HEAD)" = "$REV"
  test "$(realpath "$SKILL/../../..")" = "$REPO"
  bun --version
  bun "$REPO/bin/axstack.js" --version
  git --version
}
doctor > "$EVIDENCE/doctor.log" 2>&1
```

## Drive

Execute all steps in each selected feature file, including its assertions:

1. [Install, check and version](features/install.md).
2. [Resolve a model and plan a dispatch](features/dispatch.md).
3. [Create run records and inspect repositories](features/reports.md).
4. [Inspect the package payload](features/package.md).

Run the full suite after changes with `setpriv --bounding-set=-dac_override,-dac_read_search bun test`
in the offline shell; save stdout/stderr and the exit status under Evidence.
The clean environment unsets `CLAUDE_CONFIG_DIR`. Keep TMPDIR outside HOME:
installer fixtures reject home-based scratch. Do not weaken permission tests
by retaining root's DAC override capabilities.

## Evidence

Keep command logs, assertions, resulting files and side effects under EVIDENCE.
Bind them to `revision.txt` and record dirty state; pin the candidate before
acceptance. Save complete JSON reports and pack output, not only summaries.
For dry runs, compare before/after files. Never equate static configuration or
fixture model availability with live execution authority or provider access.

Check discovery in both harnesses: Codex must list `verify-axstack` from
`.agents/skills`; Claude Code must list it via `.claude/skills`. Confirm
`readlink .claude/skills/verify-axstack` equals `../../.agents/skills/verify-axstack`
and both paths resolve to identical content. Use local skill-list interfaces
without a model request or credentials. There are no custom helpers to execute;
check Doctor's skill-relative repository resolution through both paths.
If either harness is unavailable, record its check unverified and hold acceptance.

Clean up after a failed attempt. After a recipe drift fix, retry once; a failed
retry holds acceptance. For a peer candidate, use Launch and any helpers from
the trusted base against the pinned candidate, keeping base files separate.

## Cleanup

Exit the offline shell. No background process is launched by the Drive paths;
if a harness discovery process was started, record its PID and stop only that
exact PID. Never kill by process name. Before deletion, recheck scratch's real
path, absence of symlinks, owner and 0700 mode from the outer shell.
Replace the literal below only with this run's validated absolute scratch path.

```bash
test ! -L /tmp/axstack-verify-local
test "$(realpath /tmp/axstack-verify-local)" = /tmp/axstack-verify-local
test "$(stat -c '%a:%u' /tmp/axstack-verify-local)" = "700:$(id -u)"
```

Then run `rm -r /tmp/axstack-verify-local` as a **single** cleanup command.
Never delete HOME, shared roots, globbed variables or the evidence folder.
A safety prompt is a hold. Confirm scratch is absent and the evidence logs and
JSON reports still exist. The evidence-owned separate Git directory is retained.

## Helpers

No custom helpers are needed. Recipes reuse `bin/axstack.js`, scripts under
`skills/axstack/scripts/`, and existing `tests/installer` / `tests/workflows`
fixtures. Invoke them from REPO except run-init and report checks, which run
from their explicit fixture Git repositories. SCRIPTS is resolved from the
real skill directory's repository; the Claude symlink works identically.
Each helper invocation and its output is documented in the feature files;
consult the packaged helper's `--help` for flags (resolve-models uses its
existing argument interface). Do not change live home configuration.
