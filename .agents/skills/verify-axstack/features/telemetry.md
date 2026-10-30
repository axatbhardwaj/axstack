# Collect bounded fleet telemetry

Entry: `skills/axstack/scripts/fleet-route.js sample|sample-recommend`, backed by
fleet-sample, fleet-proc, fleet-sample-manifest, fleet-sample-io and
fleet-sample-cli. Contract: `skills/axstack/references/fleet-route-schema.md`.
Prerequisites: offline Launch/Doctor, Linux, Bun >=1.3.14. No fleet credentials,
live SSH, T3 or deployment required. Fixture SSH binaries run only in TMPDIR.

```bash
doctor > "$EVIDENCE/telemetry-doctor.log" 2>&1
bun run test tests/workflows/fleet-sample.test.js \
  tests/workflows/fleet-sample-boundaries.test.js tests/workflows/fleet-sample-cli.test.js \
  tests/workflows/fleet-route.test.js tests/workflows/fleet-route-eligibility.test.js \
  tests/workflows/fleet-route-cli.test.js tests/workflows/dispatch-plan/fleet.test.js \
  > "$EVIDENCE/telemetry-tests.log" 2>&1
bun "$SCRIPTS/fleet-route.js" --help > "$EVIDENCE/telemetry-help.txt"
bun -e 'import { sampleFleet } from "./skills/axstack/scripts/fleet-sample.js";
import { telemetry } from "./skills/axstack/scripts/fleet-facts.js";
const host = {id:"synthetic-local", environmentId:"env-synthetic-local"};
const start = performance.now();
const result = await sampleFleet({schemaVersion:1, hosts:[{hostId:host.id,
 environmentId:host.environmentId, transport:"local"}]}, [host], {intervalMs:5000, timeoutMs:10000});
const elapsedMs = performance.now() - start;
const sample = result.telemetry[0]; const normalized = telemetry(sample, Date.now());
if (elapsedMs < 5000 || sample.status !== "ok" || sample.durationMs < 5000
 || sample.source !== "linux-proc-local" || normalized.status !== "measured"
 || normalized.windowStartedAt !== sample.windowStartedAt || normalized.ramLatestBp === null
 || normalized.ageMs < 0 || normalized.ageMs > 15000) throw Error("local sampling smoke failed");
console.log(JSON.stringify({elapsedMs, result, normalized}, null, 2));' > "$EVIDENCE/telemetry-local.json"
```

Proof: the remote read command runs under sh and, when installed, fish. A valid
CLI control invokes the SSH fixture, while an invalid C1 request fails before
any SSH invocation. First-eight-counter CPU includes steal without guest double counting;
endpoint-average/latest RAM and integer upward pressure round correctly. Valid
manifest/config controls precede single-fact failures with exact reasons.
Three synthetic hosts enter the same collection batch. Real six-second timeout,
cancelled waits and killed/reaped local subprocess fixtures establish cleanup;
remote clocks never enter facts and collector skew produces unknown. Unknown,
future and >15000ms-old samples preserve provenance and do not disable routes.
Sample/recommend emits a replayable envelope; unchanged C1 gate tests still
reject unavailable/unauthorized or remote-author routes. Local real /proc smoke
records actual duration and source; it proves this host only.

Repeat targeted checks with the already available minimum Bun 1.3.14 binary;
record its absolute path/version and output. Do not download in the offline
namespace. Run the package recipe for all relative imports and schema coverage.
Directed fleet matrix, remote SSH reachability, destination receipts, remote
authors and deployment are C6/live boundaries and remain unverified here.
