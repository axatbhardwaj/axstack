# Install, check and version

Entry points: `bin/axstack.js` (`--version`, `install`, `check`),
`src/installer.js`, `src/capabilities.js`; harness: `tests/installer/helpers.js`.
Prerequisites: Launch's offline shell and temporary HOME; explicit `mixed`
preset. Archify's upstream is deliberately an absent local path. No network
clone, live HOME write or production authentication is allowed.

```bash
doctor > "$EVIDENCE/install-doctor.log" 2>&1
bun "$REPO/bin/axstack.js" --version > "$EVIDENCE/version.log"
bun -e 'const p = await Bun.file("package.json").json(); const v = await Bun.file(process.env.EVIDENCE + "/version.log").text(); if (v.trim() !== "axstack " + p.version) throw Error(v);'
bun "$REPO/bin/axstack.js" install --preset mixed --bundle "$REPO" \
  --skills-dir "$HOME/.agents/skills" --tools-dir "$TMPDIR/tools" \
  --instructions "$HOME/AGENTS.md" --no-claude-settings --yes \
  > "$EVIDENCE/install.log" 2>&1
bun "$REPO/bin/axstack.js" install --preset mixed --bundle "$REPO" \
  --skills-dir "$HOME/.agents/skills" --tools-dir "$TMPDIR/tools" \
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
cp "$HOME/.agents/skills/.axstack-manifest.json" "$EVIDENCE/install-manifest.json"
cp "$HOME/.agents/skills/axstack/roles.json" "$EVIDENCE/installed-roles.json"
cp "$HOME/AGENTS.md" "$EVIDENCE/installed-instructions.md"
bun -e 'const { roles } = await Bun.file(process.env.EVIDENCE + "/installed-roles.json").json();
const by = Object.fromEntries(roles.map(r => [r.id, r]));
for (const [id, modelClass, effort] of [
  ["axstack-reviewer-peer", "opus", "medium"], ["axstack-reviewer-secondary", "opus", "high"],
  ["axstack-auditor", "haiku", "xhigh"], ["axstack-explainer-review", "sol", "medium"],
]) if (by[id].modelClass !== modelClass || by[id].thinkingOptionId !== effort) throw Error(id);
if (by["axstack-auditor"].model !== "claude-haiku-5-5") throw Error("auditor pin");'
```

Proof: version matches the package; install creates owned skills, preset and
instruction block; repeat is idempotent; check observes bundle and owned
instructions. Review the complete check log and exit: missing `gh stack`, T3
or offline archify are explicit environment gaps, not a successful host check.
Gotcha: installation alone cannot prove harness discovery or model readiness.
