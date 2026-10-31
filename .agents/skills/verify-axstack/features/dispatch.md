# Resolve a model and plan a dispatch

Entry points: `skills/axstack/scripts/{resolve-models,dispatch-plan}.js`;
harness inputs: `tests/workflows/fixtures/{t3-capabilities,dispatch-plan}.json`.
Prerequisites: Launch; saved fixture catalogs only. Plans never dispatch work.

```bash
doctor > "$EVIDENCE/dispatch-doctor.log" 2>&1
CAPS="$REPO/tests/workflows/fixtures/t3-capabilities.json"
ROLES="$REPO/tests/workflows/fixtures/dispatch-plan.json"
bun "$SCRIPTS/resolve-models.js" --provider codex --class sol \
  --capabilities "$CAPS" --effort high > "$EVIDENCE/model.json"
bun "$SCRIPTS/dispatch-plan.js" --role axstack-author --roles "$ROLES" \
  --capabilities "$CAPS" --kind task \
  --out "$EVIDENCE/plan.json" > "$EVIDENCE/plan.log"
# Independent fixture in T3 configuration shape; task plans emit target instead.
bun -e 'await Bun.write(process.env.TMPDIR + "/configuration.json", JSON.stringify({ modelSelection: { instanceId: "codex", model: "gpt-6.1-sol", options: [{ id: "reasoningEffort", value: "high" }] }, runtimeMode: "full-access" }));'
bun "$SCRIPTS/dispatch-plan.js" --role axstack-author --roles "$ROLES" \
  --capabilities "$CAPS" --kind task \
  --verify "$TMPDIR/configuration.json" > "$EVIDENCE/plan-verify.log"
test "$(tail -n 1 "$EVIDENCE/plan-verify.log")" = MATCH
bun -e 'const p = await Bun.file(process.env.EVIDENCE + "/plan.json").json(); const m = await Bun.file(process.env.EVIDENCE + "/model.json").json(); const s = await Bun.file(process.env.EVIDENCE + "/plan.log").json(); if (m.model !== "gpt-6.1-sol" || p.target.providerInstanceId !== "codex" || p.target.model !== m.model || p.runtimeMode !== "full-access" || s.reportPath !== process.env.EVIDENCE + "/plan.json" || s.omittedPayloadFields !== 3 || p.isolation !== "worktree" || s.target !== undefined) throw Error("fixture binding or saved-payload summary mismatch");'
```

Proof: resolution outputs the fixture Sol model; the delegated task plan binds the
fixed Codex instance, full-access mode and worktree isolation; MATCH is the readback's last line.
With `--out`, stdout is a summary; copy dispatch fields from the saved JSON.
The resolver accepts only Codex, Claude and Grok workflow providers. Run
`bun run test tests/installer/installed-preset-routing.test.js tests/workflows/resolve-models.test.js tests/workflows/dispatch-plan.test.js`
to verify unsupported-provider holds, saved bindings and readback mismatches.
Run `bun run test tests/workflows/research-web.test.js` to exercise mixed
Terra-high web dispatch/readback and both provider-bounded explicit absences.
The resolver suite also proves the mixed tracker checker resolves to Claude
Sonnet with low effort; readiness rejects a checker lacking both model and class.
It resolves the mixed research-code, execution and visual-review seats and the
codex-only authored reviewer to Terra at exactly high effort. Class-based and explicit Terra pins reject
medium/xhigh/missing effort, including through dispatch-plan; unavailable high
holds without selecting an older model. Effective non-high readback holds. The role
readiness suite rejects Luna or a wrong effort for that authored reviewer.
The installed-routing boundary installs the real mixed bundle and dispatches its
existing UI verifier to Codex `gpt-6.1-terra` high/full-access from saved
capabilities. Missing Terra or high effort holds even while Sol and Claude remain
available; this proves no live browser execution.
An omitted provider label is reported as unknown while the exact instance,
model, options and mode remain checked. Input paths remain in the complete JSON.
These fixture results grant no live dispatch authority. Missing models or
mismatched readback must hold, not substitute.


## Fleet recommendations and destination binding (C1)

Entry point: `skills/axstack/scripts/fleet-route.js`; internal config/fact modules
are packaged relative imports. Input/output contract:
`skills/axstack/references/fleet-route-schema.md`. Prerequisites: Launch and
Doctor, Bun >=1.3.14; synthetic fixture facts only, no network or live config.
The pure API, offline CLI and destination-bound plans are covered here.
Bounded sampling has its own [offline recipe](telemetry.md). C3a saved native inventory and receipt checks follow below; live acceptance remains driver-owned.

```bash
doctor > "$EVIDENCE/fleet-doctor.log" 2>&1
bun run test tests/workflows/fleet-route.test.js tests/workflows/fleet-route-eligibility.test.js > "$EVIDENCE/fleet-selector.log" 2>&1
bun -e 'import { recommend } from "./skills/axstack/scripts/fleet-route.js";
import { fixture, NOW } from "./tests/workflows/fleet-route-fixture.js";
const f = fixture(); const input = f.bind(); const before = JSON.stringify(input);
const result = recommend(input, NOW);
if (result.stage !== "balance" || result.selected.hostId !== "worker-a" || result.selected.environmentId !== "env-worker-a"
 || result.selected.projectId !== "project-worker-a" || JSON.stringify(input) !== before)
 throw Error("pure selector binding or mutation failure");
console.log(JSON.stringify(result, null, 2));' > "$EVIDENCE/fleet-recommendation.json"
```

Proof: fixture selection is host worker-a, environment env-worker-a and
project project-worker-a, with destination model
settings, exact config digest and provenance; input bytes remain unchanged.
Tests prove all four ordered stages, 20/35/40 sequential batch spread,
assignment/pending de-duplication, unknown inventory, required actual sessions,
capability/project/access/target exclusions, local-only authors on both personal
fixture hosts, disabled/version-bound remote authors, overload continuation,
clock freshness, basis-point precision and explicit schema/digest errors.
The disabled coordinator has complete valid proof; directed-origin, each proof
field and both endpoint versions are checked independently. Additional tables
isolate execution availability/provider/mode/options, evidence and observation
times, config/join ambiguity and assignment conflicts; result mutation checks
protect the supplied snapshot from output aliases.
No credential, personal host configuration, T3 launch or live telemetry is used.
Preserve JSON and logs outside scratch selected for deletion. Repeat this drive
when selector/schema changes; later integration recipes must verify the actual
destination readback independently rather than treating this output as authority.

Drive the installed-style command and adapter with saved synthetic facts:

```bash
doctor > "$EVIDENCE/fleet-cli-doctor.log" 2>&1
bun run test tests/workflows/fleet-route-cli.test.js tests/workflows/dispatch-plan/fleet.test.js \
  tests/workflows/resolve-models.test.js > "$EVIDENCE/fleet-cli-tests.log" 2>&1
bun -e 'import { fixture, NOW } from "./tests/workflows/fleet-route-fixture.js";
const f = fixture(); const root = process.env.EVIDENCE;
const capsText = await Bun.file("tests/workflows/fixtures/t3-capabilities.json").text();
const request = f.input.request;
request.providerInstanceId = "codex"; request.model = "gpt-6.1-sol";
request.options = {reasoningEffort: "high"};
const digest = new Bun.CryptoHasher("sha256").update(capsText).digest("hex");
for (const d of f.input.destinations) {
  d.execution = {available: true, providerInstanceId: request.providerInstanceId,
    model: request.model, options: request.options, runtimeMode: request.runtimeMode};
  d.capabilitiesDigest = digest;
}
const input = f.bind();
await Bun.write(root + "/fleet-input.json", JSON.stringify(input));
await Bun.write(root + "/fleet-config.json", input.configText);
await Bun.write(root + "/destination-capabilities.json", capsText);
await Bun.write(root + "/fleet-roles.json", JSON.stringify({version: 1, roles: [
  {id: "fixture-reader", provider: "codex", model: "gpt-6.1-sol",
    thinkingOptionId: "high", modeId: "full-access"}]}));
await Bun.write(root + "/fleet-pin.txt", input.configDigest);
await Bun.write(root + "/fleet-readback.json", JSON.stringify({environmentId: "env-worker-a",
  projectId: "project-worker-a", runtimeMode: "full-access",
  modelSelection: {instanceId: "codex", model: "gpt-6.1-sol", options: {reasoningEffort: "high"}},
  fleetBinding: {configDigest: input.configDigest, destinationSnapshotId: "snapshot-worker-a",
    destinationCapabilitiesDigest: digest}}));
if (NOW !== 100000) throw Error("fixture evaluation time drift");'
bun "$SCRIPTS/fleet-route.js" --help > "$EVIDENCE/fleet-help.txt"
bun "$SCRIPTS/fleet-route.js" recommend --input "$EVIDENCE/fleet-input.json" \
  --config "$EVIDENCE/fleet-config.json" --now 100000 --json > "$EVIDENCE/fleet-cli.json"
PIN=$(cat "$EVIDENCE/fleet-pin.txt")
bun "$SCRIPTS/dispatch-plan.js" --role fixture-reader --roles "$EVIDENCE/fleet-roles.json" \
  --capabilities "$EVIDENCE/destination-capabilities.json" --kind task \
  --recommendation "$EVIDENCE/fleet-cli.json" --fleet-input "$EVIDENCE/fleet-input.json" \
  --now 100000 --config-digest "$PIN" --out "$EVIDENCE/fleet-plan.json" > "$EVIDENCE/fleet-plan.log"
bun "$SCRIPTS/dispatch-plan.js" --role fixture-reader --roles "$EVIDENCE/fleet-roles.json" \
  --capabilities "$EVIDENCE/destination-capabilities.json" --kind task \
  --recommendation "$EVIDENCE/fleet-cli.json" --fleet-input "$EVIDENCE/fleet-input.json" \
  --now 100000 --config-digest "$PIN" --verify "$EVIDENCE/fleet-readback.json" > "$EVIDENCE/fleet-verify.log"
test "$(tail -n 1 "$EVIDENCE/fleet-verify.log")" = MATCH
bun -e 'const root = process.env.EVIDENCE;
const plan = await Bun.file(root + "/fleet-plan.json").json();
const rec = await Bun.file(root + "/fleet-cli.json").json();
if (rec.selected.hostId !== "worker-a" || rec.selected.environmentId !== "env-worker-a"
 || plan.target.environmentId !== "env-worker-a" || plan.target.projectId !== "project-worker-a"
 || plan.fleetBinding.configDigest !== rec.configDigest
 || plan.fleetBinding.destinationCapabilitiesDigest !== rec.selected.destinationCapabilitiesDigest
 || plan.target.model !== "gpt-6.1-sol" || plan.target.options[0].value !== "high")
 throw Error("fleet CLI destination binding mismatch");'
```

Proof: the real CLI selects host worker-a and targets env-worker-a/project-worker-a; saved task target and
MATCH bind exact config/catalog bytes and requested settings. Tests cover
current T3 `options.values[]` and legacy `options.options[]`, extra option
preservation, explicit missing/schema/digest errors, exclusions and mismatch
holds. Valid positive controls precede independent run-pin, configured role/settings,
fully proven coordinator, catalog ambiguity/unsupported option and no-route holds.
Changed catalogs are re-digested and destination execution agrees with the request,
so earlier selector/digest failures cannot mask those binding checks. These
pre-plan holds assert exact errors and empty stdout. The default config-path test uses
only a temporary account. Network
isolation plus before/after fixture bytes guard the offline/no-mutation contract.
`fleetBinding` is evidence, not a supported T3 dispatch parameter. Live C3 must
collect host-qualified readback independently; fixture MATCH grants no authority.

Current catalog compatibility also covers null or absent model options: an
optionless sibling does not block a usable model, while selecting an optionless
model holds for unsupported effort. The resolver regression tests exercise both
cases through its CLI.

Saved-catalog drives must check emitted model IDs and settings, not only exit
codes. Grok null-model roles hold when the first advertised ID lacks `grok-`;
they never skip to a later model. Count valid plans and expected identity holds
separately. A family prefix is not proof of live X access.

Malformed non-null sibling options must hold with the specific malformed-model
diagnostic; a generic hold or TypeError does not prove validation. The resolver
tests keep a valid first model so the family guard cannot mask this boundary.


## Native inventory and terminal receipts (C3a)

Entry points: fleet-inventory.js (via selector), fleet-destination.js (via
fleet-dispatch.js), fleet-native-receipt.js and fleet-receipt.js (via dispatch-plan --verify).
Prerequisites: offline Launch/Doctor and synthetic saved native envelopes only.
No actual T3 call, credential, config edit, SSH agent or installed routing change.

```bash
doctor > "$EVIDENCE/fleet-receipt-doctor.log" 2>&1
bun run test tests/workflows/fleet-inventory.test.js \
  tests/workflows/dispatch-plan/fleet.test.js tests/workflows/fleet-contracts.test.js \
  > "$EVIDENCE/fleet-receipt-tests.log" 2>&1
bun "$SCRIPTS/dispatch-plan.js" --help > "$EVIDENCE/fleet-receipt-help.txt"
```

Proof: independent host/environment/project identities, remoteChild with null
local child, origin collisions/nested/pending dedup and unknown totals; valid
native destination controls then single-fact holds; T3 0.1.5 optional native
provider mode restrictions and cold project-read identity joined to complete
host-bound project-list pages, with conflict/pagination/access/provider holds
and unchanged exact catalog digests; current terminal continuation
versus old summary/run, pending children/questions, settings and host-qualified
candidate/base/path holds through real CLI subprocesses. Semantic runtime pins
reject removal/inversion and survive rewording. Tests neither authenticate saved
input nor grant aggregate authority. Run the package recipe to verify relative
import closure and no archive side effects. Repeat affected tests on the cached
minimum Bun. The [live procedure](../../../../skills/axstack/references/fleet-verification.md)
is a separate later C3/C6 action; remote authors stay DISABLED after checkpoint-ref
pilot failure. Effective fields unavailable from native APIs remain unknown.

The native inventory/receipt suite must spread a pending batch even when native totals are unknown, and accept a single completion marker followed by the required T3 PR trailer while rejecting conflicting markers.

The receipt drive also covers the T3 0.1.5 remote emitter's omitted options/null
result-run ID through a host/version/argument-bound native family observation.
Only a sole initial run with exact origin/destination final text can use that
join; continuations, conflicting settings, unknown facts and live/unknown family
members hold. The driver-owned acquisition procedure is in
[fleet dispatch](../../../../skills/axstack/references/fleet-dispatch.md#t3-015-initial-remote-receipt).
Read-only authenticated native RPC is distinct from agent execution. Offline
saved-live replay preserves raw bytes and uses labelled synthetic envelopes; it
proves no fresh dispatch, authentication, recovery or session lifecycle. Retain
named negative/mutation logs and rerun restored source green after the probes.

## Explicit local non-repository articles

Use the run's trusted protected offline launcher when the ordinary Launch recipe
is unsuitable; never run old root fixtures or use /dev/null as Git configuration.
With its private HOME, owned TMPDIR and read-only source/Git mounts, run:

```bash
bun run test tests/workflows/fleet-artifact.test.js \
  tests/workflows/fleet-artifact-receipt.test.js \
  tests/workflows/fleet-artifact-contracts.test.js \
  tests/workflows/fleet-route.test.js tests/workflows/fleet-route-eligibility.test.js \
  tests/workflows/dispatch-plan/fleet.test.js > "$EVIDENCE/local-artifact-tests.log" 2>&1
```

Proof: the actual dispatch-plan CLI emits a shared task for a synthetic No-project
article, with exact native environment/project/provider/model/options/runtime.
Absent scope, engineering/code-review roles, remote routes, mismatched native
reads, unsafe/overlapping ownership and changed artifact bytes hold. SHA-256
receipts need no fabricated Git revision; existing engineering tests remain.
Semantic instruction checks reject boundary removal/inversion and permit equivalent
wording. Helpers cannot prove filesystem ownership or authenticate supplied facts.
The driver's real No-project canary, installed support, Playwright exact-byte
publication review and live publication remain separately unverified.

Live nonrepo regression: include fleet-artifact-receipt tests for T3 0.1.5
shared parent scratch inheritance and deduplicated local task summaries. Preserve
raw native observations; require parent/path/run/byte bindings and reject stale
or conflicting evidence. Replay is not a new live dispatch.
