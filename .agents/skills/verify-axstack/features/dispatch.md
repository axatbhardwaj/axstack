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


## Pure fleet recommendations (C1a)

Entry point: `skills/axstack/scripts/fleet-route.js`; internal config/fact modules
are packaged relative imports. Input/output contract:
`skills/axstack/references/fleet-route-schema.md`. Prerequisites: Launch and
Doctor, Bun >=1.3.14; synthetic fixture facts only, no network or live config.
This path imports the production API directly; CLI/dispatch binding and
sampling are subsequent slices and are not claimed by this recipe.

```bash
doctor > "$EVIDENCE/fleet-doctor.log" 2>&1
bun run test tests/workflows/fleet-route.test.js tests/workflows/fleet-route-eligibility.test.js > "$EVIDENCE/fleet-selector.log" 2>&1
bun -e 'import { recommend } from "./skills/axstack/scripts/fleet-route.js";
import { fixture, NOW } from "./tests/workflows/fleet-route-fixture.js";
const f = fixture(); const input = f.bind(); const before = JSON.stringify(input);
const result = recommend(input, NOW);
if (result.stage !== "balance" || result.selected.environmentId !== "worker-a"
 || result.selected.projectId !== "project-worker-a" || JSON.stringify(input) !== before)
 throw Error("pure selector binding or mutation failure");
console.log(JSON.stringify(result, null, 2));' > "$EVIDENCE/fleet-recommendation.json"
```

Proof: fixture selection is worker-a/project-worker-a with destination model
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
