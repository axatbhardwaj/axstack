# Pure fleet recommendation API (schema 1)

C1a exports `recommend(input, now)` and `parseFleetConfig(configText, configDigest)`
from `../scripts/fleet-route.js`. Both are synchronous Bun APIs. They perform no
I/O, use no ambient clock and keep no state. Importing the module launches nothing.
The CLI wraps this API; the collector is a subsequent slice.

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

## Telemetry handoff to C2

A sample is `{environmentId, status: 'ok', receivedAt, durationMs, source,
scope: 'whole-host', cpuBp, ramBp, ramLatestBp?}`. `receivedAt` is stamped by the
collecting driver on receipt; remote wall clocks do not control freshness.
`durationMs` must be a safe integer >=5000 and `source` nonempty. C2 samples hosts
concurrently and supplies complete whole-host interval provenance; the pure
selector cannot verify the collector's assertions. C2 reports timeout/failure
with a non-`ok` status or `timedOut: true`, which becomes unknown regardless of
numeric fields. Optional `windowStartedAt` is a collector-clock interval start;
when present, the receipt must be at least `durationMs` after that start.
A native history source uses the history window start, not the RPC call start.

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

C1b binds the exact environment/project, destination snapshot, requested
provider/model/options/mode and config digest to dispatch-plan. C3 binds them
to actual launch/readback/remote receipts. A recommendation never launches,
provisions, mutates links, retries submission or grants authority. Call afresh
before each dispatch; assignment/load snapshots remain subject to races.
