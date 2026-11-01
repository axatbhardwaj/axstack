# Saved New-chat default (opt-in)

Run these commands from the installed Axstack skill directory (containing
`scripts/` and `systemd/`). `bun scripts/sync-default.js --help` lists all inputs
and writes. Dry-run is the default. `--apply` changes only the global saved
`defaultModelSelection`; existing chats, dispatch roles and provider settings
are untouched. Manual New chat may retain a draft model choice; project overrides
still win. Output lists saved project override IDs. On older T3 settings where
`projectSettingsFolded` is false/absent, legacy project defaults may also live in
T3's project records and are not enumerated by this script; inspect Project Settings.
There is no per-start hook or guarantee that a client has refreshed its saved default.

## Inputs and policy

The live path reads the one enabled `cliproxy` source from settings, using its
URL and management key in memory. When settings contain the literal masked key
`••••••`, resolve only `secrets/usage-limit-source-<base64url(sourceId)>.bin` beside
the explicit settings file, using T3's UTF-8/base64url naming. Inline keys still work.
The settings object stays masked; only a temporary hub config is hydrated. Secret
files must be owned private regular files, with no symlinks or shared writable
parent; malformed, missing or unsafe keys hold with a sanitized reason. Neither
secret bytes nor raw settings/headers/responses are logged or persisted. Like installed T3 0.1.3 `makeCliproxyApi`, it
GETs `v0/management/auth-files`, then POSTs `api-call` envelopes requesting GET
Anthropic OAuth `/api/oauth/usage` or Codex `/backend-api/wham/usage`. Hub-side
`$TOKEN$` substitution keeps account tokens out of the script. It never requests
account credential contents, reset credits or reset-quota operations. HTTPS is required except
loopback fixtures, redirects are refused, requests time out after 15 seconds,
and at most 32 accounts are queried in batches of four. A source/account failure
holds; reports contain only policy diagnostics, never raw settings or responses.
No live requests were needed to develop the adapter.

The default model catalog comes from existing T3 `caches/<instanceId>.json`
(sibling to `userdata`), with ready/enabled/installed status, matching driver,
model slug and effort descriptor. Catalogs older than 24 hours hold; the script
never refreshes providers. Exactly one enabled instance per target driver is
required because usage sources do not establish which of several instances
shares which accounts. Refresh catalogs in T3 if held. These checks establish
catalog evidence, not successful provider execution.

Routes: Claude `claude-opus-5-5` medium; Codex `gpt-6-astra` medium;
Codex `gpt-6.1-sol` xhigh. The configured instance IDs are discovered, not renamed.
Both source and account telemetry must be no older than five minutes, with
valid applicable session/weekly percentages and durations. A supplied reset must
be a valid future date within its window duration. Missing,
stale, malformed or ambiguous data holds the entire decision, without failover.
A successful Codex response containing only a seven-day primary window (secondary
absent/null) is authoritative single-window telemetry: the adapter explicitly marks
session n/a. It does not synthesize session capacity. A plain incomplete snapshot
without this provenance still holds; weekly is always required. An account needs
remaining quota in every applicable window.

Claude session n/a requires an explicit `five_hour: null`, valid `seven_day` usage
and future weekly reset, and exactly one active, unscoped `weekly_all` row in
`limits` with matching percentage and identical reset string. Every limits row
must be validated weekly metadata: only `weekly_all` and model-scoped
`weekly_scoped` rows with valid percentages, future weekly resets and boolean
`is_active` are supported. Scoped rows require a named model and null surface.
Any session row contradicts n/a, even when `is_active: false`; that flag never
hides a present session or scoped weekly usage. Unknown/malformed limits,
non-null legacy `seven_day_opus`/`seven_day_sonnet`, error fields, missing fields
or null without corroboration hold. No plan name, bootstrap outcome, zero usage
or fabricated reset establishes n/a. All accounts remain counted; supported scoped
rows remain in telemetry with existing Opus eligibility checks. Source/account
freshness and catalog guards still apply.
This narrowly supported response shape does not establish universal null semantics
or an account's plan/verification status. Model scope names retain their existing
meaning; no Fable-to-Opus mapping is inferred.

For ordinary Claude session/weekly/scoped Opus and Codex windows, null or absent
reset timing is valid. The adapter omits the missing
reset; it never invents a timestamp. Unknown reset timing alone does **not** mean
unused or not started: the reported used percentage still governs remaining quota,
same-account eligibility and the primary-pool reserve, including exhaustion at 100% used.
For pressure, an untimed window earns zero elapsed-window credit, a conservative
lower bound, while its full reported usage is subtracted. `untimedWindows` reports
these windows (including relevant Opus scope); n/a session windows are separate.
Malformed non-null dates, stale telemetry and missing applicable windows still hold. A blocked account does not
exhaust other accounts. Opus scoped weekly limits also constrain eligibility.

Installed T3 0.1.3 client `main-lZWM_z1N.js` functions `g7`/`_7` display **equal
account arithmetic means**, not a weighted quota total: each account contributes
one percentage. Codex groups by window kind; Claude uses kind plus window ID.
A weekly-exhausted account contributes 100% session usage. Different resets stay
per account; T3 lists refill events scaled by member count, rather than inventing
one pool reset. An n/a session contributes neither a zero nor 100% observation;
only accounts with an applicable session enter its mean, and an all-n/a session
is reported as null with status n/a. For each primary pool, remaining capacity is
its minimum applicable session/weekly unrounded pooled percentage; n/a is omitted.
Sol xhigh is eligible **only when both Opus and Astra pools have <30% remaining**.
Exactly 30% on either pool excludes Sol, even if it is the current default.
When both are low, choose Sol if its Codex accounts and catalog are eligible.
Otherwise choose eligible Opus medium/Astra medium, preferring a non-low primary
over a low primary before pacing or fairness. If only low primaries remain
available, use those; exhausted accounts never gain capacity. Scoped Opus limits
still constrain eligibility; an unavailable primary is not evidence of <30%.
Unknown telemetry or catalogs hold. There is no separate Astra reserve cutoff.
Percentages do not establish absolute tokens or relative subscription sizes.
Duplicate identities hold instead of adding capacity from overlapping sources.

Pressure is the worse session/weekly mean of elapsed-window percentage minus
used percentage, higher meaning more underused capacity. As in T3's pace display,
a weekly-blocked synthetic session has no duration and is omitted from pace,
while still contributing 100% to remaining-capacity aggregation. Reset timing is
computed per account before averaging. Similar pressure is within five percentage
points; an existing eligible default stays unless a challenger is at least ten
points better or a fair tie-break is justified.

The timer automatically reads the existing `statev2.sqlite` beside settings using
Bun's built-in SQLite read-only mode. It queries only recent thread metadata from
`orchestration_v2_projection_threads` across all projects, including archived and
soft-deleted records still present. It creates no DB, migrates nothing, and issues
no T3 auth session. Symlink/unsafe DB or WAL/shared-memory paths hold history;
a WAL without existing shared memory is refused to avoid creating sidecars.
SQLite's normal transient reader locks are required. Metadata reads are capped at
50,000 rows. Missing, incompatible, incomplete or malformed history reports an
explicit unavailable reason, without pretending the counts are all zero.

This route avoids installed CLI limitations: 0.1.0 has no thread-list command;
0.1.3's thread list exhausts pagination but issues/revokes an auth session, and
its project command has no list subcommand. No CLI auth or settings updates are
needed. `--history-db` selects another existing projection DB; `--history-file`
overrides the DB with a saved native thread-list array or complete result object.
A non-null cursor (including zero), hasMore, total mismatch, duplicates or missing
manual identity makes the inventory unavailable.

Count identifiable top-level `createdBy:user` starts from web **or mobile** in the
preceding seven days, using native `providerInstanceId` and `model` fields (legacy
modelSelection snapshots also work). Two extra starts can break a pressure tie.
Projection metadata describes the **current saved model** of a thread created in
that period, not an immutable record of its original model; hard-deleted/pruned
records and manual model changes limit fidelity. The source/coverage is reported.
A supplied project-only list remains caller-scoped, not global history.

When history is unavailable, similarly pressured eligible primaries receive fixed
six-hour UTC slots in Opus/Astra order. Sol is selected only in the both-low case. The target is stable within a slot;
pressure hysteresis still protects a current default outside a fair tie. This
prevents indefinite starvation without timer state, a new database, per-tick
rotation, or any claim of equal chat counts. Reserve eligibility always wins over fairness and hysteresis.

## Run or enable

First inspect a dry-run, including any hold and project overrides:

```bash
bun scripts/sync-default.js
bun scripts/sync-default.js --apply
```

`--usage-file` accepts an array of normalized T3 `UsageLimitSourceSnapshot`
objects, including per-account `usageLimits`. `--catalog-dir` selects provider
caches. `--now <ISO>` is fixture-only and requires `--usage-file`.
Settings symlinks are refused. Apply creates a sibling lock directory and unique
temporary file, preserves mode, fsyncs, compares current bytes/inode/mode before
atomic rename, then reads back. A non-cooperating writer still has a small
compare-to-rename race; this is not a transaction with T3's settings watcher.
An existing lock holds; after a crash inspect ownership/process state before
manually removing that exact lock. Dry-run creates no lock or file.

The five-minute user timer is a separate explicit opt-in. It runs one bounded
process, never an agent. It is not enabled by the installer. After accepting its
writes, install the shipped units:

```bash
mkdir -p ~/.config/systemd/user
cp systemd/axstack-default-sync.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now axstack-default-sync.timer
journalctl --user -u axstack-default-sync.service -n 20
# Stop future updates:
systemctl --user disable --now axstack-default-sync.timer
```

Exit 2 means held; inspect the sanitized reason. Systemd may show that bounded
run as failed and will try again at the next timer tick. No automatic retry loop,
provider failover, account routing, or live service upgrade is included.

## Titles

On **T3 server >=0.1.3** paste [the short instructions](thread-title-instructions.txt)
into global Settings → Threads → title instructions, or use the supported
`server.updateSettings` patch containing only `threadTitleInstructions`.
Preserve `textGenerationModelSelection`.
This script never writes title settings; 0.1.0 does not support that field.
Do not upgrade or restart T3 as part of enabling this script.

These are best-effort generation instructions; deterministic child titles come
from [runtime naming guidance](t3-runtime.md). Supply `Worker: <dispatch-key>`,
`Reviewer: <dispatch-key>`, `Researcher: <dispatch-key>` or `Subagent: <dispatch-key>`
explicitly, with a first message. Regeneration and empty-then-human-fed threads
can invoke generation again; preserve the complete prior title and `Needs you:`.
Verify New chat selection, settings watcher refresh and title regeneration on the
actual supported client/server before claiming live behavior.
