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

## Fleet cleanup (MIG-9)

Keep **Fleet thread cleanup · 30 minutes** enabled on axat-vps until a
complete quiet decision is proven on the configured fleet. T3 0.1.12
prints a bare thread array without its denominator and omits subagents,
worktree attachments, active run IDs and pending request counts from the
observed list. The predecessor receipt records actions and coverage but
provides no fresh, exact-run eligibility facts for the next tick. These
gaps keep MIG-9 on the native schedule.

The workflow preserves the predecessor's sidebar metadata scope. It
recognizes exact-run settlement and archive candidates. Existing snoozes
and continuation cursors require reconciliation through the predecessor.
The report-only path surfaces gaps without handing a cleanup turn to the
agent. A cleanup turn can follow only after a positive inventory, exclusive
operation claims, and effective binding readback from the same owner thread.

### Binding and evidence

The mode-0600 binding uses `mode` (`shadow` or `active`), the local
registered `project` path and `projectId`, absolute paths for `bun`, `t3`,
`git`, `ssh`, installed `roles`, the scoped `registryTokenFile`, and
`receipt`. The token needs `orchestration:read`. The seat comes from the
installed `axstack-owner` role and the live catalog. Under `hosts`, supply
exactly `io`, `iobook`, `iobox`, `iosatellite`, and `axat-vps`. For each,
provide its absolute T3 `base`, absolute `t3` path and `projects` with exact
`id`, `path` and Git `repository` paths. Reads use local binaries on
axat-vps and noninteractive SSH as `xzat` elsewhere. Measure inventory
duration on the full fleet before activation. The workflow runs one T3
list and one Git worktree list per configured project, with additional
Git reads for candidate worktrees. Reconcile an attached submodule checkout
through the predecessor when the workflow cannot prove its status.

With the predecessor, point `receipt` to its private `latest.md` or to a
private JSON copy in a disposable replay. The current predecessor format
is an unknown for admission. A complete fact source must supply both:

- Project coverage for all five hosts from an independently exhausted
  native inventory. The version-1 private receipt has `capturedAt` in the
  current slot, `coverage[host].projectsComplete`, exact `projectIds`,
  `outstandingCleanupOwnedSnoozes`, and `decisions`. Each decision names
  the host, project, thread, latest run and native `updatedAt`, with
  `action` of `retain`, `settle` or `archive`. Cleanup decisions require
  affirmative `accepted`, `descendantsClear`, `ownership`, `preserved`
  and `protectionClear` guards. An attached worktree also needs a
  `publishedHead` verified at the remote and fresh local Git checks.
- A project thread listing with full rows, including descendants and the
  native request and worktree facts. The replay contract uses an envelope
  with `complete: true`, `includesDescendants: true`, `nextCursor: null`
  and `threads`. The shipped T3 CLI does not emit that envelope. Before
  cutover, prove the supported native read and its coverage end to end.
  A project binding or a wrapper that merely marks a bare array complete
  cannot supply that proof.

### Shadow, handoff and rollback

1. Replay the shipped workflow in an isolated T3 base with `mode: "shadow"`.
   Record eligible work, a quiet tick, host unreachable, incomplete thread
   coverage, duplicate claims, binding mismatches, and dirty or unpushed
   worktrees. Test preflight and claim holds separately with fake agents.
   Compare native predecessor inputs wherever captured and record every
   difference. Shadow inventory creates no claims or agent threads.
2. Leave the predecessor as the sole writer until the missing native inputs
   and all decision classes pass with zero mismatches. Before cutover, save
   the predecessor schedule and binding, verify the last run drained, disable
   it, and read back its disabled state. Reconcile the latest receipt, pending
   snoozes, manual overrides, holds, project coverage, continuation cursors
   and interrupted actions. Seed any unresolved operation claims in T3 with
   their exact prior owners. Read back the imported state and verify one owner.
3. With recorded authority, opt in on axat-vps using the private active
   binding and a passing host conformance receipt. Read back the registry,
   trigger and first due slot, then bind it in [workflow health](workflow-health.md#trigger-bindings).
   Confirm the first exact operation and its native readback before treating
   the handoff as complete. A paused claim requires owner reconciliation.
   Inspect the current thread and private receipt before resuming or cancelling.
4. After a verified state advance, drill rollback with a disposable predecessor:
   drain or cancel the workflow's owned runs, remove its version, and read back
   registry absence. Export exact actions and readbacks, unresolved claims,
   snooze ownership, manual overrides and continuation state to the predecessor's
   receipt format. Restore its recorded schedule and binding from step 2.
   Verify one enabled owner and check the first restored pass against the
   exported state before using the rollback on live data.

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
