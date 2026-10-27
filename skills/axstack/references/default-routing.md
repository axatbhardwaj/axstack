# Saved New-chat default (opt-in)

`bun ~/.agents/skills/axstack/scripts/sync-default.js --help` lists all inputs
and writes. Dry-run is the default. `--apply` changes only the global saved
`defaultModelSelection`; existing chats, dispatch roles and provider settings
are untouched. Manual New chat may retain a draft model choice; project overrides
still win. Output lists saved project override IDs. On older T3 settings where
`projectSettingsFolded` is false/absent, legacy project defaults may also live in
T3's project records and are not enumerated by this script; inspect Project Settings.
There is no per-start hook or guarantee that a client has refreshed its saved default.

## Inputs and policy

The live path reads the one enabled `cliproxy` source from settings, using its
URL and management key in memory. Like installed T3 0.1.3 `makeCliproxyApi`, it
GETs `v0/management/auth-files`, then POSTs `api-call` envelopes requesting GET
Anthropic OAuth `/api/oauth/usage` or Codex `/backend-api/wham/usage`. Hub-side
`$TOKEN$` substitution keeps account tokens out of the script. It never requests
credentials, reset credits or reset-quota operations. HTTPS is required except
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
valid session/weekly percentages, durations and future resets. Missing, stale,
malformed or ambiguous data holds the entire decision, without failover.
An account needs remaining quota in both windows. A blocked account does not
exhaust other accounts. Opus scoped weekly limits also constrain eligibility.

Installed T3 0.1.3 client `main-lZWM_z1N.js` functions `g7`/`_7` display **equal
account arithmetic means**, not a weighted quota total: each account contributes
one percentage. Codex groups by window kind; Claude uses kind plus window ID.
A weekly-exhausted account contributes 100% session usage. Different resets stay
per account; T3 lists refill events scaled by member count, rather than inventing
one pool reset. This script uses that unrounded mean for the reserve check:
Astra is excluded if either Codex window has less than 25% remaining; exactly
25% is eligible. Opus has no Codex reserve exclusion. Percentages do not establish
absolute tokens or relative subscription sizes. Duplicate identities hold
instead of silently adding capacity from overlapping sources.

Pressure is the worse session/weekly mean of elapsed-window percentage minus
used percentage, higher meaning more underused capacity. As in T3's pace display,
a weekly-blocked synthetic session has no duration and is omitted from pace,
while still contributing 100% to remaining-capacity aggregation. Reset timing is
computed per account before averaging. Similar pressure is within five percentage
points; an existing eligible default stays unless a challenger is at least ten
points better or a fair tie-break is justified.

Optional `--history-file` accepts a complete saved T3 thread-list object with
`threads`, no next cursor/hasMore, and explicit `createdBy:user`,
`creationSource:web`, `parentThreadId:null`, `createdAt` and `modelSelection`.
It counts only identifiable manual driver starts in the preceding seven days;
a two-start difference can break a similar-pressure tie. Do not supply a partial
or filtered inventory as complete. No existing CLI was verified to export all
these fields, so the timer runs without history. Without it, a healthy current
default stays; when selection is needed, choose the next tied route after the
current default in Opus/Astra/Sol order. This simple rotation cannot claim equal
chat counts. No new state database or per-tick rotation is introduced.

## Run or enable

First inspect a dry-run, including any hold and project overrides:

```bash
bun ~/.agents/skills/axstack/scripts/sync-default.js
bun ~/.agents/skills/axstack/scripts/sync-default.js --apply
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
cp ~/.agents/skills/axstack/systemd/axstack-default-sync.{service,timer} ~/.config/systemd/user/
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
Preserve `textGenerationModelSelection` (including the current Gemini model).
This script never writes title settings; 0.1.0 does not support that field.
Do not upgrade or restart T3 as part of enabling this script.

These are best-effort generation instructions; deterministic child titles come
from [runtime naming guidance](t3-runtime.md). Supply `Worker: <dispatch-key>`,
`Reviewer: <dispatch-key>`, `Researcher: <dispatch-key>` or `Subagent: <dispatch-key>`
explicitly, with a first message. Regeneration and empty-then-human-fed threads
can invoke generation again; preserve the complete prior title and `Needs you:`.
Verify New chat selection, settings watcher refresh and title regeneration on the
actual supported client/server before claiming live behavior.
