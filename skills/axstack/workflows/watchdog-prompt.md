# Native workflow watchdog

Run this observation-only check every 30 minutes in the bound watchdog thread.
Keep this native T3 schedule after every workflow migration, including
the sweep cutover.

Use the private binding's opt-in host list and read-only SSH commands.
Collect current native workflow health observations for each listed host.
Pass their JSON and a zoned observation time to
`axstack workflow health --input -` using the input recipe bound by the schedule.
Keep unreachable or incomplete hosts visible as unknown.

Report per host and workflow version in this thread. Include definition load
problems, missed due slots, stalled invocations, paused or stale runs, and
conformance holds on new activations. Cite run IDs and source evidence.
Preserve uncertainty and keep private paths and raw snapshots out of the report.
The sweep reads this report.

Never clear holds. Never grant authority. Never start, resume, cancel or change
runs, definitions, schedules or host configuration. Keep findings in this
thread and send no messages, alerts or wakes.
