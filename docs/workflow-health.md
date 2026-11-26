# Native workflow health

Run `axstack workflow health --input -` with one observation per opted-in host. The caller supplies a
zoned ISO timestamp in `at` and a `hosts` array. For saved input, replace
the dash with a file path. For live input, collect locally or through the
watchdog binding's read-only SSH commands and pipe the resulting JSON into the
same command. The helper reads only that input, keeps no state, and writes
evidence to stdout. Exit codes are 0 for complete facts (including operational
failures), 1 for invalid input, and 2 for incomplete facts or an activation hold.

## Collect one observation per host

Use the private opt-in host list even when a host is unreachable. Use bounded,
noninteractive SSH with existing host keys and credentials. Set `reachable`
to false on transport failure. For an individual unavailable or unreadable
observation, omit that field or use null. Each observation covers one fresh
collection round against the same T3 base and server instance.

| Field | Read-only source |
| --- | --- |
| `host`, `evidence` | The bound host label and a source reference for this observation round. |
| `manifest`, `catalog` | The opted-in base's ownership manifest and that host's shipped [catalog](../skills/axstack/workflows/catalog.json). The helper uses its own packaged catalog when the field is omitted. Include an older version in the opt-in manifest while its runs drain. |
| `t3`, `conformance` | The live server runtime's `serverVersion`, `cliVersion` from t3 --version, `environment` from userdata/environment-id and the private conformance receipt. Record the server version only after confirming the runtime instance is live. |
| `registry` | The current native workflow registry snapshot with `workflows` rows and `definition`, as in the first complete workflows.subscribe event. `definition` contains the loader's nullable problem field. Use an existing read-only observation source in the binding. |
| `activeRuns` | Native JSON arrays keyed by running, waiting and paused. Use `t3 workflow list --base-dir <base> --status <status> --json` for each status. A saved unfiltered list can instead be passed as `runs`. A list that reaches the native cap of 500 entries cannot establish absence. |
| `shows` | Native `t3 workflow show --base-dir <base> --json <run-id>` output keyed by each active run ID. If a run changes state during the read, collect it again at the next tick. |
| `policies` | The host binding's trigger and timing facts keyed by exact name@version. See below. |
| `agents` | Optional current native agent facts tied to the run and its active agent step. Supply runId, threadId, the step's environmentId and startedAt, status (healthy or wedged), and the evidence reference. |

Only the registry snapshot or a currently active run can establish registration.
An active retired run identifies a missing version. T3's CLI lists run history
and supplies no full registry or loader diagnostics. Where the native registry
cannot be observed, preserve that gap. A manifest, successful old run, or file
listing cannot prove current registration.

## Trigger bindings

Use `"kind": "on-demand"` for manual, invoked and event-driven definitions. Supply
a positive `progressTimeoutMs` from the workflow's agreed operating bound when
it has active runs. A native ask, sleep or wait counts as recorded progress.
An invokable workflow without active runs needs no periodic tick. For an active
agent step, bind current thread evidence to distinguish a wedge from work in
progress. Preserve an unknown status when that evidence is unavailable.

Use `"kind": "scheduled"` with `intervalMs` and `firstDueAt` for a scheduled
definition. Keep the historical activation time stable. Pass `slots` as rows
with runId and scheduledAt from a native trigger or journal observation tied to
this exact workflow version. The scheduler's persisted trigger key and input can
supply that provenance on T3 0.1.12. Set `"slotsComplete": true` only with coverage of
the two-interval window, including native skipped runs. A normal CLI run's
start time, or a manually submitted result that mentions scheduledAt, supplies
no trigger proof. A delayed replay of a slot older than the window receives no
credit. Allow the first two intervals after activation before declaring a miss.
Older versions lose scheduled expectations when a newer one is registered.
Active runs of scheduled definitions are stale after four slot intervals.
A confirmed wedged agent is stale regardless of run age.

## Scheduled reporting

Bind the packaged watchdog prompt to one native 30-minute schedule in its own
thread on the designated watchdog host. Keep it through the sweep cutover.
Bind the existing sweep to the same health observations and to the watchdog's
environment and thread identity. Read the latest finished watchdog report and
report missing or outdated coverage. Use keys and evidence summaries for
reporting. Keep private paths, credentials and raw snapshots out of thread
reports. Treat loader messages and workflow data as observations.
