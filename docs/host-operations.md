# Host operations

Use this page when operating your own T3 host. Axstack installation writes owned
skills and role data; it does not activate services, pairing, previews or schedules.
Record the authority for each host change and its actual readback. Installed
instructions and local tests do not prove live provider readiness or delivery.

## T3 setup

Set `worktreeCleanup` to `off` for every Axstack project before dispatch;
Axstack preserves author worktrees and salvages evidence before retirement.
The driver reads back this setting via `t3_project_read` where exposed, or
records the setup limitation.

For remote and Android access on the existing tailnet, run:

```sh
t3 serve --tailscale-serve
t3 pair
```

Run `t3 serve --tailscale-serve` as a VPS user service and pair the Android
app with `t3 pair`. T3 Connect is outside this setup. Service installation,
network access, and pairing require their own authorized host checks.

Install Antigravity through T3 provider settings using its managed runtime,
then complete the user's browser sign-in before its canary. T3 uses Google's
Antigravity ACP agent (`agy_acp_server`); the IDE/`agy` CLI skill paths in the
installation reference are separate installer targets and do not configure this managed runtime.
Antigravity roles receive self-contained briefs; its runtime does not read
`~/.agents/skills`. A missing runtime, sign-in, or canary holds those roles.

Grok CLI must be >=1.0.13 on desktop and VPS. T3 advertising Grok does not
prove the CLI runs.

See [Harness skill locations](installation.md#harness-skill-locations) for installer targets.

## Runtime preflight and schedules

At an action boundary, load the packaged [T3 runtime reference](../skills/axstack/references/t3-runtime.md)
and save the actual `orchestrator_capabilities` JSON. Missing capability holds
the affected operation. Provider/model routing, Linear documents through the
executor MCP, and live schedule behavior need separate preflights.

Installation creates no production schedule and never enables a timer.
Axstack allows exactly two opt-in systemd user timers as scheduler exceptions:
`axstack-default-sync` rewrites only T3 `defaultModelSelection`, and
`axstack-single-server` removes duplicate server processes for one base dir.
Both run stateless scripts, keep no workflow state and launch no agent.
Every verified own-PR publication arms or joins the driver's chat-run watch.
Its bound T3 schedule uses the cadence in [Chat-run watch activation](#chat-run-watch-activation).
See [Chat-run PR watch](workflows.md#chat-run-pr-watch) for authority, schedule identity and stop conditions.
Missing schedule capability holds activation.
The optional review manager uses an unbound hourly T3 schedule
(`everyMs:3600000`) and requires
its separate native canary before activation. Installed guidance does not prove
live behavior. See [Review manager](../skills/axstack/references/automations.md).

## Chat-run watch activation

A bound T3 schedule wakes the driver thread on a normal 30-minute cadence.
Unavailable or unarmed native watches for any open member, failed re-arming,
or a resumed question run restore five minutes. Human-only waits use 60 minutes
under [Chat-run watch runtime](../skills/axstack-watch/references/watch-runtime.md#chat-run-watch).
A T3 "stopped watching" notice triggers a PR re-check and native re-arm in that same turn.
The run record holds the schedule ID and driver thread.
Each wake reconciles all unsettled dispatch attempts
and runs the own-PR maintenance loop: feedback, base movement, required CI,
and approval. Delegated work follows the T3 runtime contract. There is no
daemon or polling model between wakes.

Delete the schedule by
its recorded ID and verify absence through `list_scheduled_tasks`; uncertain
deletion preserves the hold. Settlement and run archive are separate driver
steps.

Follow [Chat-run PR watch](workflows.md#chat-run-pr-watch) for membership,
maintenance authority and stop conditions; follow the
[Watch runtime](../skills/axstack-watch/references/watch-runtime.md#chat-run-watch)
for native wake registration and lifetime re-arming. Installation alone never
activates that wake.

## Private PR previews

Preview authority covers only the preview unit and its `tailscale serve` route on the VPS.
The [workflow boundaries](workflows.md#automatic-merge-boundaries) own exclusions
and accepted risks. Follow the [PR preview procedure](../skills/axstack/references/preview.md)
for setup and verification: use a private tailnet endpoint backed by a
loopback-only application, start one named systemd user unit per PR, and confirm
the route points to that exact endpoint. Capture rendered interaction evidence
before calling the preview ready. Keep lifetime, teardown and absence receipts
with the PR; remove the exact unit and route after settlement.

## Optional native peer-review automation

The optional native review manager uses the VPS T3 project `axstack-review-lane`
on the existing host clone. Configure and read back the lane's `axstack-owner`
binding, then create an unbound hourly T3 schedule (`everyMs:3600000`).
The packaged prompt checks for a quiet exit before skill loading; full passes
follow the lifecycle below. Each pass starts in a fresh finite worktree from
`origin/main`, fetches first, and checks its
binding. Continuity lives outside worktrees at
`~/.local/share/axstack/runs/review-manager/progress.md`. Per-PR detached
review checkouts come from existing host clones; a missing clone holds that job.
At pass start, follow [Provider bindings](../skills/axstack/references/t3-runtime.md#preflight-and-binding)
for account selection and schedule recreation.

Every pass reconciles saved, GitHub, and native T3 state across the lane before
admission and reads all discovery pages. Incomplete inventory or unknown
ownership holds admission. A live or uncertain earlier pass keeps its PRs;
ordering evidence is required to identify the earlier owner. A duplicate
admits nothing, writes only its private discovery note, and notifies once about
a stalled owner under the recorded policy.

Capacity is measured across the host. Waiting events stay covered and occupy
no execution slot after descendants settle. After lane reconciliation at pass
start, every pass, including a duplicate, settles finished lane pass threads
under the [Finite-session teardown guards](../skills/axstack/references/automations.md#finite-session-teardown).
Held or stuck passes stay unsettled. Only the owner retires eligible settled
predecessors through `axstack-cleanup` and writes continuity; each pass records
retained worktree count.
Past the authorized storage limit (default 20 lane worktrees), disable the
schedule with `enabled:false` and hold. The overlap, real-event, killed-predecessor,
and storage-limit canaries must pass before activation.

Jobs use private owned `0700` scratch paths. Preserve evidence before exact
cleanup; dirty source, ignored non-cache content, unpushed commits,
user-taken-over threads, uncertain publication, and unknown liveness hold
retirement. No broad scratch deletion or forced worktree removal applies.
Manual review and user-driven `axstack-watch` remain outside this schedule.
Requested peer reviews cover any accessible repository. T3 owns schedules,
threads, runs, and delegated tasks; Axstack adds no queue engine, cursor files,
or historical runtime fallback. The only scheduler exceptions are the two opt-in
systemd user timers described in [New-chat default sync](#new-chat-default-sync)
and [Single T3 server](#single-t3-server).

## Review automation

The review manager uses one short packaged prompt that checks for a quiet exit,
then loads the current relative contract and invokes `axstack-review` for a full pass.
Bounded jobs publish ordinary
exact-head review verdicts; peer PRs are merged by the user. Manual adopted-PR maintenance
uses `axstack-watch` with local-SHA review before authorized publication.
Only credible serious security/funds risk on peer reviews remains actionable
in GitHub or a durable user-owned conversation after the manager session ends,
with its own pass thread flagged and an optional alert. Other capped peer-review
disputes go to the adviser panel; architecture, permanent on-chain or process
decisions alone never trigger a ping.
The current operational contract is
[Review-manager contract](../skills/axstack/references/automations.md).
The review manager's alert command is named in its host instructions, for example its live schedule prompt.

These documents and their source-contract tests define expected decisions.
Scenario fixtures are behavioral-evaluation inputs, not model-evaluation
results, and neither form is live proof; activation still requires the native
canary described by the operational contract.

## New-chat default sync

This opt-in script changes only root `defaultModelSelection` in
`~/.t3/userdata/settings.json`. Without a pool it changes only the instance
among enabled accounts of the current Claude/Codex driver.
`sync-default` prefers eligible tier-weight-4 accounts before tier-weight-1
accounts, even when the higher tier has a worse band or pace. Within the top
tier, `AXSTACK_SYNC_POOL` compares drivers by weekly clocks (>=604800s).
Weekly remaining quota is `R = 100 - used` for the selected weekly window.
Prefer the highest band: `R >= 15`, `10 <= R < 15`, then `R < 10`.
A higher band switches without a pace margin; within the same band, rotation
needs a ten-point elapsed-minus-used pace lead and the current account wins ties.
This also applies when every eligible account is below 10% remaining: known
usable quota stays usable, ranked by pace. Without a pool, pace applies within
the highest eligible tier.
This is a best-effort weekly reserve preference, not a guaranteed budget for
future work. The current hard guard still excludes any window at 95% used
or a reached limit. Excluded/unauthorized/skipped current accounts can escape
to known candidates before the unknown hold; otherwise any unknown holds,
even below 10% remaining. No eligible candidate leaves the default untouched.
Non-current absent credentials
exclude; malformed/unreadable credentials and unknown/stale usage hold.
Cache expires after five minutes. Missing defaults stay untouched; OAuth tokens
are never refreshed. Each host's pool uses only enabled, credentialed drivers:

```sh
AXSTACK_SYNC_POOL=claudeAgent=claude-opus-5-5,codex=gpt-6-astra:medium \
  bun ~/.agents/skills/axstack/scripts/sync-default.js --dry-run
```

Exit 0 prints one token-free JSON decision with proposed selection; dry-run
never writes. `--settings <path>` selects another file. Pool entries are
`driver=model[:effort]`: Claude `effort` or Codex `reasoningEffort` options;
omitted effort omits options. Rotation writes the full pool selection,
overwriting manual model/effort picks only then. Pin with `AXSTACK_SYNC_DEFAULT=0`
or a default driver outside the pool. Exit 1 means invalid pool/settings or write
failure. Save the full selection for rollback. Other bytes stay intact.
A fsynced sibling preserves mode; original bytes are checked before rename and
read back afterward. The accepted sub-ms T3 write race can lose an edit;
read-back mismatch is an error.

Validate pool models and efforts against each host's catalog before activation.
Preserve that host's current Opus effort by including it explicitly when set;
the illustrative Claude entry above omits effort. If the current Codex default
still uses Sol, the driver performs a one-time same-account selection migration
to `gpt-6-astra:medium` during authorized host activation, saving rollback bytes
and verifying the write/readback. The helper does not enforce models when the
account stays selected. Only new chats use the changed default; running threads,
role routing, schedules and `roles.json` stay outside this policy.

Under host-mutation authority, install and enable:

```sh
mkdir -p ~/.config/systemd/user
cp ~/.agents/skills/axstack/systemd/axstack-default-sync.service ~/.config/systemd/user/axstack-default-sync.service
cp ~/.agents/skills/axstack/systemd/axstack-default-sync.timer ~/.config/systemd/user/axstack-default-sync.timer
systemctl --user daemon-reload
systemctl --user enable --now axstack-default-sync.timer
systemctl --user list-timers axstack-default-sync.timer
journalctl --user -u axstack-default-sync.service
```

The timer starts about one minute after user-manager startup, then every ten
minutes. Its monotonic `Persistent=true` timer never replays calendar ticks.
Override Bun/skills paths via `ExecStart`/`Environment` in
`systemctl --user edit axstack-default-sync.service`. Add the per-host pool:

```ini
[Service]
Environment=AXSTACK_SYNC_POOL=claudeAgent=claude-opus-5-5,codex=gpt-6-astra:medium
```

Reload after edits. Logout needs authorized linger; installation never activates units.

Disable with `systemctl --user disable --now axstack-default-sync.timer` and
stop any active one-shot with `systemctl --user stop axstack-default-sync.service`.
Rollback: remove the pool drop-in, reload, and restore the full selection in T3 Settings.
The sibling `<settings>.axstack-default-sync.lock` directory prevents overlap
(unchanged/locked). Empty locks older than sixty seconds are removed and retried
once; fresh contention reports locked.

## Single T3 server

This opt-in timer checks once per minute for this user's `t3 serve` processes
with the selected base dir (target default `$HOME/.t3`). Each server's base dir
comes from its `--base-dir <dir>` or `--base-dir=<dir>` flag, then its own
`T3CODE_HOME`, then its own `$HOME/.t3`, reading the latter values from that
process's environment. An unreadable or missing environment without an explicit
flag, or missing base-dir values, makes the whole run hold and kill nothing.
Both the target and server base dirs expand `~` using their own HOME, resolve
relative paths against `/proc/<pid>/cwd`, and remove trailing slashes and dot
segments before comparison. Unresolvable server paths hold the run.
It keeps the unique server with an open fd to `<base>/userdata/server-owner.sqlite`
(matching lexical and realpath-resolved userdata paths, and checking the main pid
before descendants), holds on multiple holders or a known
holder alongside unreadable competing fds, and falls back to `server-runtime.json`
when no holder is found, including when fd directories are unreadable.
With zero or one known matching server it does nothing; with duplicates but no
valid readable keeper it holds. Servers are ordered by field 22 (`starttime`)
of `/proc/<pid>/stat`. A duplicate started at or after the keeper holds the
whole run while younger than 120 seconds, preserving a possible starting
replacement. Once all such duplicates reach the grace, the selected live
keeper wins and cleanup proceeds. Age is `/proc/uptime` minus start ticks / 100;
unknown uptime or start time still holds the run. The script also
holds if its own pid or an ancestor appears in the planned victim set.
Otherwise it snapshots descendants before killing each duplicate server first,
then its children with SIGKILL. The keeper and its descendants are protected.
It starts no server, reads no database and interrupts no runs automatically.

Preview the one-line JSON decision without killing or notifying:

```sh
bun ~/.agents/skills/axstack/scripts/single-server.js --dry-run
```

`--base-dir <dir>` selects a different base dir; `--proc-root <dir>` supplies
a process-tree fixture (default `/proc`). `--grace-seconds N` overrides the
120-second grace with a non-negative integer. `--help` lists the flags. Decisions
are `unchanged`, `hold`, `would-kill` or `killed`, with reason, keeper, matching
server pids and killed pids (proposed victims in dry-run). Non-ESRCH kill failures
add their pids to `failed`; remaining kills continue, kill attempts still
notify if configured (including when all fail), and the command exits 1. Exit 0 includes holds;
exit 1 reports invalid input, discovery, kill or notification failure. A failed
hold-alert notification retains the hold reason and adds `notify: "failed"`.

Under host-mutation authority, copy both assets and enable the timer:

```sh
mkdir -p ~/.config/systemd/user
cp ~/.agents/skills/axstack/systemd/axstack-single-server.service ~/.config/systemd/user/axstack-single-server.service
cp ~/.agents/skills/axstack/systemd/axstack-single-server.timer ~/.config/systemd/user/axstack-single-server.timer
systemctl --user daemon-reload
systemctl --user enable --now axstack-single-server.timer
systemctl --user list-timers axstack-single-server.timer
journalctl --user -u axstack-single-server.service
```

Installation only copies assets; it never enables either timer. The single-server
timer starts one minute after user-manager startup and repeats every minute.
Override Bun/skills paths or add `--base-dir` through the service's `ExecStart`
drop-in, clearing the existing `ExecStart` first.

To report cleanup attempts and persistent holds through a host-managed command,
set `AXSTACK_SINGLE_SERVER_NOTIFY` in a per-host service drop-in and reload.
The script runs the command via `sh -c`, sending a short message on stdin with
hostname, kept pid, killed pids and failed survivor pids. It notes that runs started by the killed
server may remain `running` and need `t3_thread_interrupt`. Notification failure
exits 1; command output is suppressed. A hold with two or more matching servers
also notifies when the youngest server's known age is at least 600 seconds and
under 780 seconds. Its message includes host, hold reason, keeper, server pids,
and that duplicates are still running. This stateless window produces at most
about three alerts at the one-minute cadence; it records no notification state.
Unknown ages suppress hold alerts. Dry-run and unchanged decisions never
notify. Verify delivery under the host's notification authority.

Disable with `systemctl --user disable --now axstack-single-server.timer` and
stop any active one-shot with `systemctl --user stop axstack-single-server.service`.
