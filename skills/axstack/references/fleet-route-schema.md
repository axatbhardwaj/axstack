# Pure fleet recommendation API (schema 1)

C1a exports `recommend(input, now)` and `parseFleetConfig(configText, configDigest)`
from `../scripts/fleet-route.js`. Both are synchronous Bun APIs. They perform no
I/O, use no ambient clock and keep no state. Importing the module launches nothing.
The CLI wraps this API; bounded collection is separate from pure recommendation.

```js
import { recommend } from '../scripts/fleet-route.js';
const recommendation = recommend(snapshot, evaluationEpochMs);
// The driver preserves this JSON, then independently verifies execution authority.
```

Inputs are JSON values. The same canonical input and integer `now` produce
byte-identical `JSON.stringify` output. Neither the input nor nested facts are
mutated or shared with the output. Times are nonnegative epoch milliseconds.
Errors throw `Error` with a stable leading code, e.g. `config-digest-mismatch`,
`schema-version`, `assignment-conflict` or `evaluation-time`. CLI mapping of
these errors belongs to the adapter; exceptions never authorize fallback routes.

## Configuration bytes and policy

`configText` contains the exact reviewed UTF-8 JSON bytes, including whitespace.
`configDigest` is the run-pinned lowercase SHA-256 hex digest of those bytes.
`parseFleetConfig` verifies the digest before parsing and returns the validated
object. Missing/invalid configuration and digest mismatches fail explicitly.
No account path or fleet identity is built into this API.

### Offline command

`bun fleet-route.js recommend --input snapshot.json --now 100000 --json`
reads saved facts plus `--config <path>` (default:
`~/.config/haoshoku/fleet-routing.json`). It never samples or dispatches.
`--config-digest <sha256>` pins reviewed config bytes; otherwise the saved
input must carry `configDigest`. Any saved `configText`/`configDigest` must
agree with the file and explicit pin. Saved input may omit `configText`.
`--task <name>` overrides only the request task preference. Evaluation time
is required and explicit. `--help` lists flags and side effects.

With `--json`, stdout is the complete schema-1 result; errors are always
`{"error":{"code":"stable-code","message":"detail"}}` on stderr with
empty stdout. Exit 0 means a recommendation/help, 1 means an input/config
error, and 2 means explicit no-route JSON (when `--json` is used). Without
`--json`, stdout is a one-line stage/host/reason summary. Authentication stays
on the actual destination session: required session capabilities are supplied
evidence, never inferred from the origin catalog or copied credentials.

| Config field | Contract |
| --- | --- |
| `schemaVersion` | Exactly `1` |
| `hosts` | Nonempty array of `{id, environmentId, fallbackLimitBp, capabilities}`; both identities unique |
| `pool` | Unique subset of host IDs; may be empty |
| `defaultOrder` | Every host ID exactly once |
| `taskOrders` | Task-name map of complete preference orders, e.g. `playwright`; unknown tasks use default order |
| `balanceLimitBp` | Integer 0..10000 |
| `routes` | Ordered array of unique `{id, originEnvironmentId, environmentId, kind, enabled, evidence, authorProof?}` |

Each host's `fallbackLimitBp` is an integer 0..10000. Routes target configured
host environment IDs. `kind` is `local`, `remote` or `remote-author-coordinator`;
only `local` has equal origin/destination IDs. Multiple routes to one host are
allowed; the first proven route in configuration order represents that host.
Only routes whose origin matches the input origin are considered.

An `evidence` value is `{environmentId, pointer, observedAt}`. The environment
must match the fact's destination host; the pointer is an opaque nonempty
host-qualified reference and observation cannot be in the future. Evidence is
supplied provenance, never a permission grant. A capabilities map has arbitrary
names such as `browser:headed`, `worktree-isolation`, `session:sign-in`; each value
is `{value: true|false|null, evidence}`. Required capabilities must be true and
proven in both configuration and the destination snapshot.

Coordinator routes are exclusively for `author` requests; readers use local/remote
routes. Remote authors cannot use `remote` routes. A coordinator route is disabled
unless explicitly enabled with `authorProof`:
`{originEnvironmentId, environmentId, originVersions, destinationVersions,
evidence, gatesPassed: true}`. Both version objects contain exact nonempty
`{t3, axstack}` strings matching current origin/destination snapshots. This
records the driver's completed pilot gates; the selector cannot prove them.
Changed versions invalidate the route. Direct remote worktree delegation is
unsupported; a local author requires `worktree-isolation` automatically.

## Device and browser examples

In account-local `taskOrders`, `device` and `playwright` are examples only;
the user supplies complete host orders in their reviewed configuration.
Capability names `device:android-emulator`, `browser:headless` and `desktop:user`
are examples only, using the existing arbitrary-name capability map.
A device request can require `device:android-emulator`; a headless web request
can require `browser:headless`, proven at the destination like any capability.
`desktop:user` describes desktop safety constraints, rather than a requirement
that would exclude workers; the driver checks it before executing UI work.
Host identities, preference orders, thermal thresholds and emulator availability
remain account-local facts, with current evidence collected before execution.
These examples add no runtime state, built-in task policy or capability inference.
Follow [UI verification](ui-verification.md#android-device-and-webpwa-dual-run)
for serial emulator use, desktop safety and declared thermal prechecks.

## Recommendation snapshot

| Input field | Contract |
| --- | --- |
| `schemaVersion` | Exactly `1` |
| `configText`, `configDigest` | Exact bytes and run-pinned digest above |
| `origin` | `{environmentId, versions: {t3, axstack}}` |
| `request` | `{task, role, requiredCapabilities, repositoryId, providerInstanceId, model, options, runtimeMode}` |
| `destinations` | One destination snapshot per environment, described below |
| `routeFacts` | One current observation per route, described below |
| `telemetry` | At most one sample per environment; absent samples are unknown |
| `inventoryStatus` | `known` or `unknown` |
| `inventoryObservedAt` | Required nonfuture timestamp when known; null/absent allowed when unknown |
| `assignments` | Array of normalized `{assignmentId, environmentId, state}` |
| `pendingAssignments` | Array of `{clientRequestId, environmentId, taskId?}` |
| `exclusions` | `{hosts: {hostId: reason}, routes: {routeId: reason}}`; nonempty reason strings |

`role` is `reader` (all nonwriter roles) or `author`. `requiredCapabilities`
is an array of strings. An authentication requirement names the actual session
capability; only the host proving that session is eligible. No credential
transfer occurs. `options` is an object keyed by option ID. The adapter must
normalize T3 option arrays to this map without dropping requested settings.

A destination is `{snapshotId, environmentId, status, observedAt, evidence,
versions, project, execution, capabilities}`. Status must be `known` to be
eligible; unreadable/unknown facts exclude it. `project` is `{id, repositoryId}`.
`execution` is `{available: true, providerInstanceId, model, options, runtimeMode}`:
these are destination-verified facts, never the origin's model catalog. They
must match the request exactly (option object key order is immaterial).
Missing projects and mismatched repository/target settings have distinct reasons.
For dispatch-plan binding, also supply `capabilitiesDigest`: the lowercase
SHA-256 of the exact raw saved destination `orchestrator_capabilities` JSON
bytes. The selector carries this optional fact as `destinationCapabilitiesDigest`;
the adapter requires it. Collect the catalog on that destination/session, not
from the origin's catalog. Both current `options.values[]` (strings/booleans)
and legacy `options.options[].id` advertisements are supported.

A route observation is `{routeId, reachable, authorized, expiresAt,
destinationSnapshotId, evidence}`. Reachability and authorization must be true.
Remote link expiry must be a future epoch timestamp. The destination snapshot ID
must match the corresponding destination; mismatches exclude the route.
The driver refreshes access, project and capability observations before dispatch;
the selector imposes no invented lifetime on those facts. Load alone has the
15-second freshness rule. Duplicate snapshot join keys fail schema validation.

## Assignment normalization

The driver queries T3 and supplies origin-qualified IDs (e.g. `origin:task-id`)
and the environment actually doing the work. Remote receipts may have null
`childThreadId`; use `remoteChild.environmentId`, not the origin, to normalize
that assignment. The selector does not parse raw T3 receipts or query inventory.
A coordinator and its nested author must share one normalized assignment ID.

States accepted: `pending`, `queued`, `running`, `waiting`, `blocked`,
`completed`, `failed`, `cancelled`, `canceled`, `rejected`. The last five are
terminal and do not count. The adapter normalizes T3-native states to these.
Duplicate identical inventory IDs count once; conflicting identities/states
throw. Pending records deduplicate by client request ID and by returned
origin-qualified `taskId` matching `assignmentId`. Even terminal inventory
records suppress their reflected pending records. Pending IDs on different
hosts conflict. Update the existing pending record when T3 returns a task ID;
remove failed/not-submitted selections, retain ambiguous submissions until
reconciled. An unknown inventory contributes no stale counts; known pending
records still count. Counts report inventory status/time and pending provenance.
These are observations, never reservations or predicted resource costs.

## Bounded collection (C2)

Collect with the installed helper (no bin/axstack.js subcommand):

```bash
bun fleet-route.js sample --fleet manifest.json --config reviewed.json --config-digest <sha256> --json
bun fleet-route.js sample-recommend --fleet manifest.json --config reviewed.json \
  --config-digest <sha256> --input facts.json --json
```

`sample` emits `{schemaVersion:1,configDigest,collectedAt,telemetry}`; each sample
includes its ageMs at collectedAt.
`sample-recommend` emits `{schemaVersion:1,input,evaluatedAt,recommendation}`;
its complete `input` and explicit `evaluatedAt` replay through pure `recommend`.
It replaces saved telemetry, validates all supplied C1 facts before networking,
and uses the collector clock after collection. It neither refreshes route/project
facts nor enables a route. Both commands require a run-pinned digest; config
path defaults as above. They write stdout/stderr only. Sample reports are JSON
with or without `--json`; this flag is accepted for interface consistency.

The caller supplies a separate manifest, never private fleet defaults:

```json
{"schemaVersion":1,"hosts":[
  {"hostId":"worker-a","environmentId":"env-worker-a","transport":"local"},
  {"hostId":"worker-b","environmentId":"env-worker-b","transport":"ssh","destination":"sample-worker","user":"fixture_user"}
]}
```

Only these keys are accepted. `hosts` has 1..64 entries, unique host IDs and
SSH destinations; each host/environment pair must match reviewed config.
At most one entry is local. Unlisted hosts have unknown telemetry. The caller
must bind the local identity to its collecting host; a manifest grants no T3
identity or execution authority. Local entries cannot carry SSH fields.
SSH destinations are lowercase MagicDNS short names (1..63 ASCII letters,
digits or interior hyphens, starting/ending alphanumeric, not all digits).
No aliases with punctuation, addresses, FQDNs, user@host, ports, options or
commands are accepted. Optional users match `[a-z_][a-z0-9_-]{0,31}`.
Existing SSH configuration/identities and known-host records must already exist;
no key paths, credentials, enrollment or interactive prompts are accepted.

`--interval-ms` defaults to 5000, integer range 5000..60000. All manifest hosts
start concurrently in one batch; each waits the interval after its first read
returns, then reads again. `--timeout-ms` defaults to 10000, integer range
interval+1000..120000, covering both reads, transport and waiting per host.
Long intervals require an explicit larger timeout. Timed-out/cancelled SSH
processes are killed and reaped, waits cancelled and listeners/timers removed.
SIGINT/SIGTERM cancel the owned collection and produce unknown telemetry.
SSH uses argv, noninteractive strict host-key checks and existing identities;
the only remote command is a constant read of /proc/stat and /proc/meminfo.
Output is capped at 64KiB per read; stderr details and credentials are not emitted.
No agent, daemon, schedule, dispatch or persistent collection state is created.

Linux CPU uses the delta of the first eight aggregate /proc/stat counters.
Busy includes steal and excludes idle/iowait; guest/guest_nice are already in
user/nice and are not added again. RAM uses MemTotal minus MemAvailable:
`ramBp` is the upward-rounded mean of the first and latest endpoint pressure,
`ramLatestBp` is latest pressure. This is an endpoint mean, not continuous RAM
history. Missing/duplicate/malformed fields, counter regression, zero elapsed
CPU ticks or changed MemTotal produce unknown, without partial pressure values.

Each collected sample contains host/environment IDs, status, source
`linux-proc-local` or `linux-proc-ssh`, `scope:whole-host`, intervalMs, timeoutMs,
durationMs, windowStartedAt and receivedAt. Success additionally contains
windowEndedAt, cpuBp, ramBp and ramLatestBp. `windowKind:collector-bracket`
means the collector-clock window brackets both reads, transport and the wait;
remote counter read times cannot be located more precisely within that bracket.
`durationMs` uses monotonic elapsed time (integer milliseconds), not a claimed
native history length. Both sources read whole-host Linux counters, never T3
process metrics or the cached 200ms delta. No fresh 30-second history is claimed.
Long windows retain their actual duration. All wall timestamps come from the
collecting host; remote clocks are neither read nor used for age.

A backwards collector clock, shortened window or forward jump over one second
relative to monotonic elapsed time produces collector-clock unknown. Per-host
statuses timeout, cancelled, malformed, inconsistent-counters, collector-clock
and failed become C1 unknown reasons. Collection failure does not fabricate an
access failure or load-based hold. C1 preserves source/window/duration and age
for unknown telemetry where supplied. Offline historical C1 inputs may omit
window timestamps and interval; when present, start/end must enclose duration,
end cannot follow receipt, and interval must be 5000..60000 and <=duration.
Age is solely evaluation time minus collector receipt, including stale/future
unknown results. Re-run before dispatch; snapshots reserve no capacity.

CPU/RAM basis points must be integers 0..10000. Instead of either `cpuBp` or
`ramBp`, supply `cpuFraction` or `ramFraction` (finite 0..1). Exactly one
representation per metric is allowed. Fractions round upward using their
shortest decimal representation, avoiding binary multiplication overshoot.
`ramLatestBp`, when supplied, also participates in the maximum pressure so an
average cannot hide recent RAM pressure. Load is the max of the supplied CPU
and RAM pressure; no role costs, GPU or personal-use gates exist.

Missing, malformed, short-window, non-whole-host, failed and timed-out samples
become unknown, as do ages >15000ms or <0. Age 15000ms remains measured. Unknown
load does not exclude an otherwise eligible route. Additional collector fields
(e.g. remote wall clock or detailed counter provenance) do not override the
collector receipt timestamp or validated pressure fields.

## Result and downstream binding

The result has `schemaVersion`, `configDigest`, `evaluatedAt`,
`originEnvironmentId`, `request`, `stage`, `reason`, `decisionReason`, `selected`,
`flags`, `counts`, `eligible`, `excluded`. Stage is exactly `balance`,
`pool-unknown`, `fallback` or `no-route`. No-route has `selected: null`.
`reason: author-local-only` explicitly exposes a local-author limitation;
`decisionReason` retains the underlying load choice.

`selected` and each eligible host contain `hostId`, `environmentId`, `projectId`,
`repositoryId`, `routeId`, `routeKind`, `destinationSnapshotId`,
`destinationObservedAt`, `destinationEvidence`, `routeEvidence`, `versions`,
`execution`, `capabilities`, `fallbackLimitBp`, `assignmentCount`, `telemetry`.
Measured telemetry includes age, CPU/RAM, maximum pressure, source and window;
unknown telemetry carries its reason and age when available.

`counts.byEnvironment` maps configured environments to observed distinct active
assignment counts. Flags expose `countsUnknown`, `poolEmpty`,
`poolPartlyUnknown`, `telemetryUnknown`, `overloaded`, `localAuthorOnly`.
Excluded entries include host/route identity, reason codes, explicit exclusion
text and available configured/observed evidence. Failed alternative routes may
appear even when another route on that host is eligible.

### Dispatch-plan adapter

Add `--recommendation recommendation.json --fleet-input snapshot.json
--now 100000 --config-digest <run-pin>` to the existing dispatch-plan flags.
All four are required together. `--capabilities` names the raw destination
catalog. The complete selector input includes config bytes; retain the CLI's
saved input plus the reviewed `configText` if the CLI supplied it from a file.
Recompute using the same explicit time and task before binding. The adapter
rejects any recommendation disagreement, missing/mismatched catalog digest,
unavailable destination model/options, or role/settings/config disagreement.
It never reinterprets a requested model pin as a different available model.

Task plans add `environmentId`/`projectId` to `target`; launch plans add them
beside `modelSelection`. All requested options survive as T3 option entries.
Both include `fleetBinding: {configDigest, destinationSnapshotId,
destinationCapabilitiesDigest}`. This is preserved evidence, not a T3 launch
parameter. Copy only tool-supported launch fields. Coordinator author routes
remain explicitly unsupported pending C3 lifecycle enablement.

For `--verify`, supply the effective configuration plus independently observed
`environmentId`, `projectId` and the preserved `fleetBinding` in one JSON
envelope. All are compared; missing values hold. Do not synthesize observed
fields from the plan. C3 owns live evidence collection and remote receipts;
C1b verifies supplied evidence only and cannot authenticate its origin.
Fleet binding mismatches exit 2; malformed CLI/files exit 1. Existing local
planning without these flags retains its interface.

A recommendation never launches,
provisions, mutates links, retries submission or grants authority. Call afresh
before each dispatch; assignment/load snapshots remain subject to races.
