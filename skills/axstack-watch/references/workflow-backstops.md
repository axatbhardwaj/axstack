# Owner watch backstops

With a local MIG-5 opt-in, the owning driver starts `axstack-watch-backstops@1`
by default for the 60-minute watch, 5-minute lifecycle and hourly autopilot
backstops. The opted-in hosts are io, iobox, iosatellite and axat-vps. Use
native timers on iobook and on hosts without a local opt-in.
Restore native timers during rollback or when workflow recovery fails.
See [native fallback](watch-runtime.md#chat-run-watch). Keep native
`watch_pull_request` for PR events. The workflow runs on demand and delivers
timer wakes to the same driver thread. It has no host-wide trigger.

## Driver control

Use one private, canonical host binding outside the repository, with
`host`, absolute `t3` and `bun` binary paths, an absolute `registryTokenFile`
for an existing local `orchestration:read` bearer, and an absolute
`ownersDirectory`. Use mode 0600 files and an owner-only directory. Paths
accept ASCII letters, digits, slash, period, underscore, colon and hyphen.
Register with `axstack workflow opt-in --name axstack-watch-backstops --binding "$BINDING" --conformance "$RECEIPT" --yes`.
Read back the exact version and passing host-local POCs 2, 3, 6 and 7.
Bind the sweep health policy as on-demand with `progressTimeoutMs: 14400000`.

The owning driver creates `<ownersDirectory>/<ownerId>.json` and replaces
it atomically on each relevant transition. Read back its exact bytes.
Record the chosen mechanism and the interval deadlines in the run record.

```json
{
  "ownerId": "THREAD_ID",
  "state": "active",
  "capturedAt": "2026-11-27T12:00:00.000Z",
  "binding": {
    "projectId": "PROJECT_ID",
    "runtimeMode": "full-access",
    "model": {
      "instanceId": "INSTANCE_ID",
      "model": "MODEL_ID",
      "options": [{ "id": "reasoningEffort", "value": "high" }]
    }
  },
  "timers": {
    "watch": "2026-11-27T13:00:00.000Z",
    "writer": null,
    "recovery": null,
    "autopilot": "2026-11-27T13:00:00.000Z"
  }
}
```

Copy the effective T3 binding, including options, from the owner record.
Use UTC deadlines. Use `null` for inactive causes. `watch` (own PR/release)
and `autopilot` recur after 60 minutes. `writer` (launched-fallback Writer
or unsettled follow-up without a completion wake) and `recovery` (native PR
watch unavailable, unarmed or GraphQL-limited) recur after 5 minutes. A delegate's native
completion requires no timer. Keep armed deadline anchors stable across
turns. For a new cause, record its first due time.

Start locally with `t3 workflow start axstack-watch-backstops --key "$KEY" --input "$PAYLOAD" --json`.
Use a stable key for the owner, mode and activation attempt. The input is
`{"ownerId":"THREAD_ID","shadow":false}` in live mode. Record the run ID
and reuse the active run. At each turn end with an active owner and an active
timer cause, read `t3 workflow show <runId> --json` for the recorded run.
If paused, resolve the cause in the owner thread and use
`t3 workflow resume <runId> --json`, then read back the state. If a terminal
run still has an active cause, reconcile its last slot and re-arm with a fresh
key and the next due times. If workflow recovery fails, record the hold and follow the rollback
procedure to restore the native timer.

When the owner parks, the user stops, or the watch completes, publish
`parked`, `user-stopped` or `complete`. The workflow ends on observing the
state. For an immediate park or Stop, also cancel the exact run if still
active and read it back. Inspect the owner queue for an already accepted
backstop and handle that exact entry under the native queue rules. Use a
fresh key after a terminal run only when authorized work resumes.

## Wake handling

`AXSTACK-WAKE axstack-watch-backstops@1 run <runId>` identifies a timer wake.
Read the matching slot in `t3 workflow show <runId> --json`, including any
unknown fact. The owner reconciles launched Writers and cause deadlines,
runs the applicable PR digest and GraphQL-reset skip, and evaluates
readiness in the owner thread. Keep the native event path. If a native PR
event consumes a simultaneous slot, reconcile due local lifecycle and release
work on that wake too. Deduplicate actions using the recorded event IDs,
current revision and acknowledged observations. T3 can resend the same brief
after a failed turn. Treat the same run and slot IDs as one delivery.
A wake never clears a hold.

## Shadow, cutover and rollback

1. Start a separate key with `"shadow":true` while using native timers.
   Compare recorded decisions to the native path. Replay idle/activity,
   busy, parked/Stop, a launched writer, missing/archived, binding mismatch,
   simultaneous native PR and timer, unknown activity, and completion.
   Require zero mismatches and zero workflow deliveries in shadow.
2. On the owning host, record the predecessor IDs, cadence, next due times,
   outstanding workers and retired/paused schedule readback. Stop the exact
   old timer schedules, read back absence or disablement, reconcile their
   last wakes and export the final deadlines and acknowledged events into
   the owner record. Verify one owner, then start the live workflow.
3. After the workflow advances a slot, drill rollback in isolation. Record
   the latest `consumed` deadlines and outstanding causes from
   `t3 workflow show`. Cancel the exact workflow run, read back terminal
   state and reconcile any accepted wake in the owner queue. Restore the
   recorded native timers using the latest consumed deadline plus its
   cadence for each cause and verify the owner binding and schedule IDs.
   Apply the same halt-before-restore order for a live rollback.
