# Native T3 workflow activation

Axstack ships workflow sources and bundles with the npm package. Installing,
upgrading, or uninstalling Axstack skills leaves T3 workflow activation alone.
The workflow assets and conformance fixtures stay in the npm package during skill installation.
The bundled `axstack-load-probe` has no triggers. Its only result is its own
`name@version` and confirmation that the binding bytes match the opt-in digest.
Use [native workflow health](workflow-health.md) to observe opted-in hosts.

## Activate on one host

1. Start the host's T3 server on the default base with workflows enabled in T3
   settings. The T3 CLI and running server must agree on a version of at least
   0.1.12.
2. Prepare a private JSON binding outside this repository, mode 0600. The
   probe accepts `{}`. Place credentials for any conformance resources in
   separate private files.
3. Run conformance with the private inputs described below. Use its private
   output receipt for this host. A version change, different T3 environment,
   or unsuccessful receipt holds opt-in until conformance passes again.
4. Explicitly opt in to the chosen definition.

```sh
axstack workflow conformance --binding /absolute/private/conformance.json --out /absolute/private/receipt.json
axstack workflow opt-in --name axstack-load-probe --binding /absolute/private/probe.json --conformance /absolute/private/receipt.json --yes
```

The installer reads the T3 run back after starting the probe. Expect
`axstack-load-probe@1 registered` or `unchanged`. The files are
`~/.t3/workflows/axstack-load-probe-v1.mjs` and
`~/.t3/.axstack-workflows.json`. Keep the binding path and bytes stable for
the lifetime of the version. Changing them will pause the probe at the binding
check. The manifest includes paths and digests and has mode 0600.

## Nightly PR triage

Use the current conformance receipt for the opt-in host. Record the
server timezone and confirm the native schedule inventory for the bound repo set.
MIG-1 starts with no predecessor. Use one active triage schedule for the set.

Prepare an owner-only binding (mode 0600) outside the repository and T3 base.
Use the installed Axstack skill directory that contains `roles.json` and a
registered local T3 project with an empty workspace for the report thread.
The server's `gh` login determines which author's open PRs are reported.

```json
{
  "bun": "/absolute/path/to/bun",
  "skillsDirectory": "/absolute/path/to/installed/skills/axstack",
  "project": "T3_PROJECT_ID",
  "registryTokenFile": "/absolute/private/workflow-read.token",
  "repositories": ["OWNER/REPO"]
}
```

Put a T3 token scoped to `orchestration:read` in the private token file (mode
0600). The CLI uses it for local registry readback. The workflow checks the
live report seat against `axstack-auditor-sol` and reads back the effective
thread binding using the same scoped token. Rotate the token at the same path
before it expires.

The report seat uses the installed role's `full-access` runtime mode. The
narrower Codex modes in T3 0.1.12 use approval or auto-review policies. The
report turn receives collected facts and runs as a tool-free reply.

```sh
axstack workflow opt-in --name axstack-pr-triage --binding /absolute/private/pr-triage.json --conformance /absolute/private/receipt.json --yes
axstack workflow observe --base-dir "$HOME/.t3" --conformance /absolute/private/receipt.json --registry-token-file /absolute/private/workflow-read.token
```

Expect `axstack-pr-triage@1 registered` and the native daily trigger in the
observation. Opt-in does not start a triage run. Configure the watchdog from
the observed trigger described in [workflow health](workflow-health.md#trigger-bindings).
Keep the first three eligible nights as a report-only trial. For each, record
the workflow run ID, coverage, effective binding and report thread or hold.
Subsequent nights retain the same read-only report behaviour. T3 drops a daily
slot missed by more than ten minutes.

An actionable hold pauses the run and appears in workflow health. Inspect its
reason with `t3 workflow show <run-id>`. Resume after restoring missing binding
evidence, or cancel a failed report so the next slot can run.

To deactivate, locate the exact runs with `t3 workflow list --json`, drain
or cancel active runs, and run
`axstack workflow remove --name axstack-pr-triage --version 1 --yes`.
Repeat the observation to verify that the registry no longer lists the version
and check that it has no active runs. If a report is needed after deactivation,
use the [native schedule fallback](../skills/axstack/references/automations.md#native-schedule-fallback).

## Scheduled binding example

For `axstack-dependabot-merge`, use a private binding such as
`/absolute/private/dependabot-v1.json`.

```json
{
  "project": "/absolute/canonical/t3-project",
  "worktreeRoot": "/absolute/private/worktrees",
  "roles": "/absolute/installed/skills/axstack/roles.json",
  "registryTokenFile": "/absolute/private/t3-reader-token",
  "bun": "/absolute/bin/bun",
  "t3": "/absolute/bin/t3"
}
```

Use the canonical path of the registered T3 project, a separate worktree root
owned by the T3 user with mode 0700, and a mode 0600 token file scoped to
`orchestration:read`. The first three distinct eligible heads are report-only.
Keep the binding bytes stable so the version retains its recorded digest.

```sh
axstack workflow opt-in --name axstack-dependabot-merge --binding /absolute/private/dependabot-v1.json --conformance /absolute/private/receipt.json --yes
```

An unresolved guard or owner readback pauses the run, including while CI is
pending. Workflow health flags the paused run, and later slots skip processing
until it clears. The exact-head check inventory includes earlier attempts, so
a failed or pending attempt can continue holding after a rerun.

Inspect the failed step in T3. Before a head is claimed, cancel the run to let
a later tick collect fresh evidence. A cancellation after a claim retains that
claim. A later tick encountering the same head pauses with the prior run ID.
Handle that head through the on-demand path. The hold identifies report-only
claims and reports whether a prior owner checkout is present, absent, or
unverified. If a checkout remains, use the run ID and PR number to find it in
the bound worktree root. Confirm no thread uses it and that it is clean before
removing it with `git worktree remove` without force.

## Roll forward or back

Changing a shipped bundle requires a new version in the source and catalog.
Rebuild from the workflow directory with the minimum supported Bun. Run
`bun run test tests/workflows/native-bundle.test.js` with both CI Bun versions
to check that each catalogued bundle rebuilds byte for byte.

```sh
cd skills/axstack/workflows
bun build entries/axstack-load-probe.mjs --target=node --format=esm > bundles/axstack-load-probe-v1.mjs
```

Use the new version in the output filename and set the catalog entry's
`version`. Keep `registration` as `probe` for a safe start-on-opt-in probe
or `registry` for read-only registration. Append the SHA-256 under
`name@version` in `bundle-digests.json` to pin the shipped bytes. Opting in to a newer package adds a versioned
definition beside the older one. T3 starts new runs on
the newest version and keeps previous runs attached to their version.

Drain or cancel active runs in T3 before removing the older definition.
Review the run with `t3 workflow show <run-id>` and explicitly cancel it if
appropriate with `t3 workflow cancel <run-id>`. The following command removes
the selected owned version.

```sh
axstack workflow remove --name axstack-load-probe --version 1 --yes
```

Remove the newer version to roll back while its predecessor is still installed.
Axstack refuses files without a matching ownership record and files whose bytes
have changed. If a process stops mid-operation, confirm that it has exited
before removing its empty `~/.t3/.axstack-workflows.json.lock` directory.
When an ownership record exists and the bundle is absent, opt in again
with the same binding to restore the bundle, or use `workflow remove`
to clear the record after its runs drain.

## Prepare the conformance binding

Conformance uses a new private loopback T3 base and an isolated workflow
directory on every run. It deletes that scratch state on exit. Long-lived
credentials and T3 settings belong in private host files. Replace the
placeholders in this private binding with that host's values.

```json
{
  "providers": {
    "settings": "/absolute/private/testing-provider-settings.json",
    "secrets": [{"source": "/absolute/private/provider-slot.bin", "name": "{{PROVIDER_SLOT_FILENAME}}.bin"}]
  },
  "seats": {
    "claude": {"instanceId": "{{CLAUDE_INSTANCE}}", "model": "{{CLAUDE_MODEL}}"},
    "codex": {"instanceId": "{{CODEX_INSTANCE}}", "model": "{{CODEX_MODEL}}",
      "options": [{"id": "reasoningEffort", "value": "low"}]}
  },
  "forge": {
    "repo": "{{DISPOSABLE_SCRATCH_REPO}}",
    "absentRepo": "{{ABSENT_REPO}}",
    "config": "/absolute/private/testing-gh-hosts.yml",
    "opened": {"existing": 1, "fresh": 2},
    "cases": {
      "missingChecks": {"number": 3},
      "failedJob": {"number": 4, "name": "{{NON_REQUIRED_CHECK_NAME}}"},
      "failingStatus": {"number": 5},
      "retarget": {"number": 6, "base": "{{CURRENT_BASE}}", "previousBase": "{{OLD_BASE}}"},
      "lateReview": {"number": 7, "greenAt": "{{UTC_TIME_CI_WENT_GREEN}}"}
    }
  },
  "ssh": {
    "host": "{{SSH_READ_TARGET}}",
    "identity": "/absolute/private/testing-ssh-key",
    "knownHosts": "/absolute/private/testing-known-hosts"
  },
  "linear": {
    "clientFile": "/absolute/private/executor-client.json",
    "endpoint": "{{EXECUTOR_HTTPS_ENDPOINT}}",
    "tool": "linear_app.{{ACCOUNT_PATH}}.list_issues"
  },
  "update": {"version": "{{DISPOSABLE_T3_RELEASE}}", "channel": "nightly"}
}
```

Use approved provider fixtures and a disposable scratch repository. Point
`forge.config` at a private GitHub CLI config with credentials scoped to that
repository. The credentials must allow PR reads and merges so GitHub can
reach the expected head-pin refusal. Conformance also starts typed runs on
both seats and sends wake test messages in an isolated owner thread.

When an approved root-run Claude fixture requires its sandbox flag, add
`"isolatedEnv": {"IS_SANDBOX": "1"}` at the top level of the private binding.
Conformance accepts only that flag and value and passes it to the isolated T3
server, including after restarts.

If the host has an authenticated Executor listener bound to IPv4 loopback,
set `linear.endpoint` to its explicit `http://127.0.0.1:<port>/mcp` URL and
set `linear.loopback` to `true`. Use a private Executor client file whose URL
matches that endpoint. Conformance reads the authorization header from that
file and rejects redirects. Omit `linear.loopback` for HTTPS.

Prepare the listed PR conditions and open the fresh fixture PR after the
isolated `opened` watcher starts. Use a different installed version for the
disposable update target. Conformance checks the CLI part of POC-5. Process
coverage remains unknown when the CLI omits inventory.
