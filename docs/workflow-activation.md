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

## Roll forward or back

Each bundle change requires a new version in both the source and the catalog.
The following command rebuilds the shipped bytes from the workflow directory.

```sh
cd skills/axstack/workflows
bun build entries/axstack-load-probe.mjs --target=node --format=esm > bundles/axstack-load-probe-v1.mjs
```

Use the new version in the output filename. Append its SHA-256 under
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

Prepare the listed PR conditions and open the fresh fixture PR after the
isolated `opened` watcher starts. Use a different installed version for the
disposable update target. Conformance checks the CLI part of POC-5. Process
coverage remains unknown when the CLI omits inventory.
