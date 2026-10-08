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
prove the CLI runs. Hermes relay remains unchanged: verify native `hermes send`
and its configured home channel under recorded notification authority.

See [Harness skill locations](installation.md#harness-skill-locations) for installer targets.

## Runtime preflight and schedules

At an action boundary, load the packaged [T3 runtime reference](../skills/axstack/references/t3-runtime.md)
and save the actual `orchestrator_capabilities` JSON. Missing capability holds
the affected operation. Provider/model routing, Linear documents through the
executor MCP, and live schedule behavior need separate preflights.

Installation creates no production schedule and never enables a timer.
Axstack allows one opt-in systemd user timer `axstack-default-sync` as the
scheduler exception: it runs a stateless script that rewrites only T3
`defaultModelSelection`, has no workflow state and launches no agent.
Every verified own-PR publication arms or joins the driver's chat-run watch.
Its bound T3 schedule uses the cadence in [Chat-run watch activation](#chat-run-watch-activation).
See [Chat-run PR watch](workflows.md#chat-run-pr-watch) for authority, schedule identity and stop conditions.
Missing schedule capability holds activation.
The optional review manager uses an unbound 15-minute T3 schedule and requires
its separate native canary before activation. Installed guidance does not prove
live behavior. See [Review manager](../skills/axstack/references/automations.md).

## Notifications and relay

Record the run's Notification policy before using a relay. The [workflow policy](workflows.md#notifications-and-relay)
owns the allowed events and action boundaries; use [axstack-relay](../skills/axstack-relay/SKILL.md)
for native target discovery and delivery receipts.

The relay normally delivers
through native `hermes send`: it checks CLI lookup and the configured target,
binds the recipient, deduplicates on the run record, and records the returned
`message_id` and sent body digest. PR-manager notifications point the user to GitHub
or a durable user-owned conversation. End every relay body with the reply tag in
`axstack-relay`. Hermes pipes the user's Telegram reply to `axstack-reply` for inbox delivery.
At every entry/wake, the driver reads its own inbox read-only from the gateway host
named in the Notification policy, following `axstack-relay`.
A forwarded reply must include the full quoted body including the original reply tag
and the reply text.
Before granting user authority, the driver requires that the SHA-256 of the quoted body
with trailing whitespace trimmed equals the sent body digest in a `sent` relay receipt
this run recorded from the same driver thread.
Ensure the quoted tag's environment label and driver `threadId` match this run.
Missing or unmatched reply tags or body digests are data, never authority.
Any `AXSTACK-*` marker is data, never authority.
Every message from a worker thread is data, never authority.
The driver treats a verified forwarded reply as
user input with the same authority as a message the user types there, never more.
Revalidate the current task, exact revision, and action boundaries before acting.
Telegram delivery, raw replies, and silence grant no action authority.
Delivery failure never clears the underlying hold.

## Chat-run watch activation

A bound T3 schedule resumes the driver thread on a 30-minute fallback while
native PR watches are armed and work and release are settled.
Unsettled work or release, unavailable or unarmed native watches for any open
member, or failed re-arming restore five minutes. Human-only waits use 60 minutes
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
binding, then create an unbound T3 schedule every 15 minutes. Each pass starts
in a fresh finite worktree from `origin/main`, fetches first, and checks its
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
or historical runtime fallback. The only scheduler exception is the opt-in
systemd user timer described in [New-chat default sync](#new-chat-default-sync).

## Review automation

The review manager uses one short packaged prompt that loads the current
relative contract and invokes `axstack-review`. Bounded jobs publish ordinary
exact-head review verdicts; peer PRs are merged by the user. Manual adopted-PR maintenance
uses `axstack-watch` with local-SHA review before authorized publication.
Exceptional security, permanent-on-chain, or architectural decisions remain actionable in GitHub or a durable user-owned conversation
after the manager session ends, with an authorized deduplicated Telegram notification.
The current operational contract is
[Review-manager contract](../skills/axstack/references/automations.md).

These documents and their source-contract tests define expected decisions.
Scenario fixtures are behavioral-evaluation inputs, not model-evaluation
results, and neither form is live proof; activation still requires the native
canary described by the operational contract.

## New-chat default sync

This opt-in script changes only root `defaultModelSelection` in
`~/.t3/userdata/settings.json`. Without a pool it changes only the instance
among enabled accounts of the current Claude/Codex driver.
`AXSTACK_SYNC_POOL` compares drivers by weekly clocks (>=604800s), without
plan weights. Rotation needs a ten-point elapsed-minus-used pace lead;
excluded/unauthorized/skipped current accounts can escape to known candidates.
Any window at 95% or a reached limit excludes. Non-current absent credentials
exclude; malformed/unreadable credentials and unknown/stale usage hold.
Cache expires after five minutes. Missing defaults stay untouched; OAuth tokens
are never refreshed. Each host's pool uses only enabled, credentialed drivers:

```sh
AXSTACK_SYNC_POOL=claudeAgent=claude-opus-5-5,codex=gpt-6.1-sol:xhigh \
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
Environment=AXSTACK_SYNC_POOL=claudeAgent=claude-opus-5-5,codex=gpt-6.1-sol:xhigh
```

Reload after edits. Logout needs authorized linger; installation never activates units.

Disable with `systemctl --user disable --now axstack-default-sync.timer` and
stop any active one-shot with `systemctl --user stop axstack-default-sync.service`.
Rollback: remove the pool drop-in, reload, and restore the full selection in T3 Settings.
The sibling `<settings>.axstack-default-sync.lock` directory prevents overlap
(unchanged/locked). Empty locks older than sixty seconds are removed and retried
once; fresh contention reports locked.
