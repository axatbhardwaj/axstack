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

Run this command on the host through its bound SSH command. It emits one JSON
observation on stdout. Supply paths from the private binding.

```sh
axstack workflow observe --base-dir "$T3_BASE" --conformance "$T3_RECEIPT" \
  --registry-token-file "$T3_REGISTRY_TOKEN_FILE"
```

The collector uses T3 `workflow list` and `show` to read active runs. It reads
just the needed columns of `workflow_triggers` and `workflow_runs` from
`userdata/statev2.sqlite` through a read-only SQLite connection. T3 state
databases can be tens of GB. The collector traverses the trigger primary-key
index and the newest run rowids, reading at most 1,001 entries from each table.
It filters for schedule and probe evidence after the run bound. When either
table exceeds 1,000 entries, the collector also reads at most one newest
schedule key per captured trigger using the `(workflow, idempotency_key)`
index. This can establish that the most recent two-interval window has no
slot even when the journal has more history. An unavailable index, or a key
within the window without a matching exported run, leaves the slot unknown.
T3 run detail is collected for up to 12 owned active runs per host.
Supply a host-local private file containing an existing `orchestration:read`
bearer for native loader diagnostics. The collector uses it only against the
running T3 server's loopback origin and returns the `workflows.subscribe`
snapshot. Omit the flag when a credential or supported registry is unavailable.
The collector limits its T3 commands to read operations and keeps no state.

Add the bound `host` label and `policies` to each observation. Place the rows in
`hosts` and set `at` after collection. Keep an explicit unreachable row for
each failed SSH connection. Bind the agent's current native evidence if an
active step needs it.

| Field | Read-only source |
| --- | --- |
| `host`, `evidence` | The bound host label and a source reference for this observation round. |
| `manifest`, `catalog` | The opted-in base's ownership manifest and that host's shipped [catalog](../skills/axstack/workflows/catalog.json). The helper uses its own packaged catalog when the field is omitted. Include an older version in the opt-in manifest while its runs drain. |
| `t3`, `conformance` | The live server runtime's `serverVersion`, `cliVersion` from t3 --version, `environment` from userdata/environment-id and the private conformance receipt. Record the server version only after confirming the runtime instance is live. |
| `registry` | The current native `workflows.subscribe` snapshot. It provides exact `workflows` and the loader's nullable `definition.problem`. An unavailable snapshot leaves loader diagnostics unknown. |
| `activeRuns` | Native JSON arrays keyed by running, waiting and paused. Use `t3 workflow list --base-dir <base> --status <status> --json` for each status. A saved unfiltered list can instead be passed as `runs`. A list that reaches the native cap of 500 entries cannot establish absence. |
| `shows` | Native `t3 workflow show --base-dir <base> --json <run-id>` output keyed by each active run ID. If a run changes state during the read, collect it again at the next tick. |
| `policies` | The host binding's trigger and timing facts keyed by exact name@version. See below. |
| `agents` | Optional current native agent facts tied to the run and its active agent step. Supply runId, threadId, the step's environmentId and startedAt, status (healthy or wedged), and the evidence reference. |
| `journal` | Read-only SQLite export with `triggers`, `runs`, and `complete`. A capped journal can also include `latestScheduledAt`, keyed by native trigger ID. A null value represents an empty indexed key range. An absent key represents unavailable indexed evidence. |

The registry gives the current registered versions, and an active retired
run identifies a missing version. With no registry, an active run or a native
trigger plus a current exact-version slot can prove registration. For the
triggerless load probe, the evaluator also accepts a successful readback with
the expected version and binding, the `axstack-watchdog-` key prefix, and a
timestamp in the past hour on the current server instance.

If the separately recorded watchdog authority allows that opted-in probe,
the private binding can supply a per-slot key starting with
`axstack-watchdog-`. Run the probe once with the bound base and key, then
read it through the collector. Use the same key for the same slot.

```sh
t3 workflow start axstack-load-probe --base-dir "$T3_BASE" --key "$PROBE_SLOT_KEY" --input null --json
```

The probe gives a registration receipt for its own version. Loader diagnostics
still come from the native registry.

## Trigger bindings

Use `"kind": "on-demand"` for manual, invoked and event-driven definitions. Supply
a positive `progressTimeoutMs` from the workflow's agreed operating bound when
it has active runs. A native ask, sleep or wait counts as recorded progress.
An invokable workflow without active runs needs no periodic tick. For an active
agent step, bind current thread evidence to distinguish a wedge from work in
progress. Preserve an unknown status when that evidence is unavailable.
Bind `axstack-release-reinstall@2` as on-demand on axat-vps. The watchdog
observes invoked runs. The release driver keeps its own bound one-shot check.
See [release reinstall](host-operations.md#release-reinstall).

Use `"kind": "scheduled"` with `intervalMs`, `firstDueAt`, and the exact native
`triggerId` for a scheduled definition. Keep the historical activation time
stable. On T3 0.1.12 an interval trigger has the form
`<workflow>/every:<milliseconds>`. For fleet cleanup on axat-vps, bind
`axstack-fleet-cleanup@1` with `intervalMs` set to `1800000` and
`triggerId` set to `axstack-fleet-cleanup/every:1800000`. Set `firstDueAt`
from the first due slot observed after authorized cutover.
Nightly triage uses
`axstack-pr-triage/daily:02:00:all`. Set `firstDueAt` to the first eligible
02:00 in the server's timezone as an ISO UTC timestamp and use
`"intervalMs": 86400000` when the opt-in host uses a fixed UTC offset. The
trigger ID carries no version. The evaluator
matches the journal's workflow, version, `trigger:<triggerId>:<scheduledAt>`
key, and start time at or after the scheduled time.
An offline fixture may instead supply explicit `slots` and leave out the
trigger ID. Set `"slotsComplete": true` only with coverage of
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
