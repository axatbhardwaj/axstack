# Install, check and version

Entry points: `bin/axstack.js` (`--version`, `install`, `check`),
`src/installer.js`, `src/capabilities.js`; harness: `tests/installer/helpers.js`.
Installed-routing keeper: `tests/installer/installed-preset-routing.test.js`
reinstalls after validated null/stale legacy metadata, checking explicit-preset
role selection and inert provenance preservation.
Prerequisites: Launch's offline shell and temporary HOME; explicit selected
preset (default `mixed` below). The installer provisions no external tools. No network clone, live HOME write or production authentication is allowed.

```bash
doctor > "$EVIDENCE/install-doctor.log" 2>&1
export PRESET=mixed # Select mixed, codex-only or claude-only for this run.
bun "$REPO/bin/axstack.js" --version > "$EVIDENCE/version.log"
bun -e 'const p = await Bun.file("package.json").json(); const v = await Bun.file(process.env.EVIDENCE + "/version.log").text(); if (v.trim() !== "axstack " + p.version) throw Error(v);'
bun "$REPO/bin/axstack.js" install --preset "$PRESET" --bundle "$REPO" \
  --skills-dir "$HOME/.agents/skills" \
  --instructions "$HOME/AGENTS.md" --no-claude-settings --yes \
  > "$EVIDENCE/install.log" 2>&1
bun "$REPO/bin/axstack.js" install --preset "$PRESET" --bundle "$REPO" \
  --skills-dir "$HOME/.agents/skills" \
  --instructions "$HOME/AGENTS.md" --no-claude-settings --yes \
  > "$EVIDENCE/install-repeat.log" 2>&1
rg 'no changes \(idempotent' "$EVIDENCE/install-repeat.log"
bun "$REPO/bin/axstack.js" check --bundle "$REPO" \
  --skills-dir "$HOME/.agents/skills" --instructions "$HOME/AGENTS.md" \
  > "$EVIDENCE/check.log" 2>&1 || CHECK_STATUS=$?
printf '%s\n' "${CHECK_STATUS:-0}" > "$EVIDENCE/check-exit.txt"
rg 'bundle ok:|instruction owned:' "$EVIDENCE/check.log"
test -f "$HOME/.agents/skills/.axstack-manifest.json"
test -f "$HOME/.agents/skills/axstack/roles.json"
test -f "$HOME/.agents/skills/axstack-anatomy/SKILL.md"
test ! -d "$TMPDIR/tools"
test ! -d "$HOME/.agents/skills/axstack-diagram"
cp "$HOME/.agents/skills/.axstack-manifest.json" "$EVIDENCE/install-manifest.json"
cp "$HOME/.agents/skills/axstack/roles.json" "$EVIDENCE/installed-roles.json"
cp "$HOME/AGENTS.md" "$EVIDENCE/installed-instructions.md"
bun -e 'const installed = await Bun.file(process.env.EVIDENCE + "/installed-roles.json").json();
const selected = await Bun.file(process.env.REPO + "/profiles/presets/" + process.env.PRESET + ".json").json();
if (installed.version !== 1 || installed.preset !== process.env.PRESET ||
    JSON.stringify(installed.roles) !== JSON.stringify(selected.roles))
  throw Error("installed roles differ from selected preset");'
ROUTING_STATUS=0
bun run test tests/installer/installed-preset-routing.test.js \
  > "$EVIDENCE/install-routing.log" 2>&1 || ROUTING_STATUS=$?
printf '%s\n' "$ROUTING_STATUS" > "$EVIDENCE/install-routing-exit.txt"
test "$ROUTING_STATUS" -eq 0
```

Proof: version matches the package; install creates owned skills, preset and
instruction block; installed role count, IDs and complete records match the
selected preset; repeat is idempotent; check observes bundle and owned
instructions. Review the complete check log and exit: missing Git, gh, T3
are explicit environment gaps, not a successful host check.
Gotcha: installation alone cannot prove harness discovery or model readiness.
Ordinary check must never invoke or require `gh stack`; legacy native-stack
operations probe it separately. Verify that boundary with the controlled
toolchain tests:

```bash
doctor > "$EVIDENCE/capabilities-doctor.log" 2>&1
bun run test tests/installer/capabilities.test.js tests/installer/r2.test.js \
  > "$EVIDENCE/capabilities-suite.log" 2>&1
```
