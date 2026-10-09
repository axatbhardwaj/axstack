# Resolve a model and plan a dispatch

Entry points: `skills/axstack/scripts/{resolve-models,dispatch-plan}.js`;
harness inputs: `tests/workflows/fixtures/{t3-capabilities,dispatch-plan}.json`.
Prerequisites: Launch; saved fixture catalogs only. Plans never dispatch work.

```bash
doctor > "$EVIDENCE/dispatch-doctor.log" 2>&1
CAPS="$REPO/tests/workflows/fixtures/t3-capabilities.json"
ROLES="$REPO/tests/workflows/fixtures/dispatch-plan.json"
bun -e 'const p = await Bun.file(process.env.REPO + "/tests/workflows/fixtures/dispatch-plan.json").json(); await Bun.write(process.env.TMPDIR + "/picker.json", JSON.stringify(p.picker));'
bun "$SCRIPTS/resolve-models.js" --provider codex --class sol \
  --capabilities "$CAPS" --effort high > "$EVIDENCE/model.json"
bun "$SCRIPTS/dispatch-plan.js" --role axstack-author --roles "$ROLES" \
  --capabilities "$CAPS" --picker "$TMPDIR/picker.json" --kind launch \
  --out "$EVIDENCE/plan.json" > "$EVIDENCE/plan.log"
bun "$SCRIPTS/dispatch-plan.js" --role axstack-author --roles "$ROLES" \
  --capabilities "$CAPS" --picker "$TMPDIR/picker.json" --kind launch \
  --verify "$EVIDENCE/plan.json" > "$EVIDENCE/plan-verify.log"
rg '^MATCH$' "$EVIDENCE/plan-verify.log"
bun -e 'const p = await Bun.file(process.env.EVIDENCE + "/plan.json").json(); const m = await Bun.file(process.env.EVIDENCE + "/model.json").json(); if (m.model !== "gpt-6.1-sol" || p.modelSelection.instanceId !== "codexAlt" || p.modelSelection.model !== m.model || p.runtimeMode !== "full-access") throw Error("fixture binding mismatch");'
```

Proof: resolution outputs the fixture Sol model; the launch plan binds its
alternate instance and full-access mode; readback prints MATCH. Input paths
remain in the complete JSON. These fixture results grant no live dispatch
authority. Missing models or mismatched readback must hold, not substitute.
