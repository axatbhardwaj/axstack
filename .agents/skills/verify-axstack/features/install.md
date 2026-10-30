# Install, check and version

Entry points: `bin/axstack.js` (`--version`, `install`, `check`),
`src/installer.js`, `src/capabilities.js`; harness: `tests/installer/helpers.js`.
Owned instructions route every role through `delegate_task`, with author worktree
isolation and top-level launches only on explicit user request for a new thread.
The recorded rare author fallback has the same new-thread restriction.
Fleet routing keeper: `tests/installer/fleet-instructions.test.js` runs the actual
installed helper command with account-local config and a run-pinned digest,
rejects mismatched bytes and no-route, and checks install/check/uninstall ownership.
Semantic instruction checks cover current routing facts before workers/reviewers
and authorized launches, destination/settings binding, separate native UI balancing,
local isolated fallback, coordinator gates and existing scoped authority.
Installed-routing keeper: `tests/installer/installed-preset-routing.test.js`
reinstalls after validated null/stale legacy metadata, checking explicit-preset
role selection and inert provenance preservation. It also exercises the real mixed
bundle through its installed dispatch helper, verifying Terra high/full-access for
the UI verifier and holds when its model or effort is missing.
Prerequisites: Launch's offline shell and temporary HOME; explicit selected
preset (default `mixed` below). The installer suite covers edited legacy-record retention, its kept-copy reason,
and a subsequent forced uninstall. The installer provisions no external tools. No network clone, live HOME write or production authentication is allowed.

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
cmp "$REPO/skills/axstack-publish/SKILL.md" "$HOME/.agents/skills/axstack-publish/SKILL.md"
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
doctor > "$EVIDENCE/install-fleet-doctor.log" 2>&1
bun run test tests/installer/fleet-instructions.test.js tests/installer/instructions.test.js \
  > "$EVIDENCE/install-fleet.log" 2>&1
```

Proof: version matches the package; install creates owned skills, preset and
instruction block; installed role count, IDs and complete records match the
selected preset; repeat is idempotent; check observes bundle and owned
instructions. Review the complete check log and exit: missing Git, gh, T3
are explicit environment gaps, not a successful host check.
Gotcha: installation alone cannot prove harness discovery or model readiness.
When verifying Haoshoku profile integration, use a separately pinned, read-only
candidate source and a private fixture HOME. Run its `syncAgentsConfig({home})`
before and after actual Axstack install to `.codex/AGENTS.md` and `.claude/CLAUDE.md`.
Re-run Axstack check and verify each managed block against its manifest hash after
resync. Uninstall must preserve the account-local policy bytes and every unrelated
profile byte remaining outside the owned block. Haoshoku preserves existing blocks;
it deliberately never synthesizes them. Record both revisions, policy digest and
complete outputs; a synthetic fixture proves ownership compatibility only, never
deployed policy, route eligibility or live dispatch. An unavailable pinned source
leaves this cross-repository boundary explicitly unverified.
Ordinary check must never invoke or require `gh stack`; legacy native-stack
operations probe it separately. Verify that boundary with the controlled
toolchain tests. These accept stable T3 >=0.1.0 with bare, `v`, `t3` and
`t3 v` version forms; old, nightly, other prerelease and malformed outputs fail
with stable installation/PATH remediation. The CLI fixtures assert only version
commands run and temporary HOME contents survive both success and failure. They
disable Bun's transpiler cache so runtime cache files cannot mask product writes:

```bash
doctor > "$EVIDENCE/capabilities-doctor.log" 2>&1
bun run test tests/installer/capabilities.test.js tests/installer/r2.test.js \
  tests/installer/instructions.test.js \
  > "$EVIDENCE/capabilities-suite.log" 2>&1
```

## Legacy retirement and retry

The authored reviewer drives these CLI fixtures at the pinned final head after
base-revision Launch and Doctor. They cover fresh installs with no external-tool
provisioning, same-path upgrades and direct uninstall, preserved edits/unowned
records, owner-release guards and rollback, kept-copy reasons, and forced retry.
They use private temporary bundles/homes and local Git fixtures, without network.

```bash
doctor > "$EVIDENCE/retirement-doctor.log" 2>&1
STATUS=0
bun run test tests/installer/*retirement.test.js tests/installer/legacy-*.test.js \
  > "$EVIDENCE/retirement.log" 2>&1 || STATUS=$?
printf '%s\n' "$STATUS" > "$EVIDENCE/retirement-exit.txt"
test "$STATUS" -eq 0
```

Proof includes a kept edited record and its manifest binding, followed by a
forced retry that releases the owner and removes only a pristine unowned copy.
The author's earlier fixture log is development evidence; record the reviewer's
own command and log as the final-head drive. No live host copy is touched.
