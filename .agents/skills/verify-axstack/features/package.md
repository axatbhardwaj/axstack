# Inspect the package payload

Entry points: `package.json.files`, `bin/axstack.js`, packaged `skills/` and
`profiles/`; existing checks: `tests/installer/package.test.js` and
`tests/workflows/prose-size.test.js`. Prerequisites: Launch, Bun >=1.3.14.
No install, publish, registry request or archive write is intended.

For dependency-lock changes, verify frozen install and this dry run on both the
minimum Bun in `package.json.engines` and the authoring Bun. Confirm frozen
install leaves the lock byte-unchanged; `tests/installer/tooling.test.js` guards
the minimum runtime's supported lockfile format.

```bash
doctor > "$EVIDENCE/package-doctor.log" 2>&1
find "$REPO" -maxdepth 1 -name '*.tgz' -printf '%f\n' | sort \
  > "$EVIDENCE/archives-before.txt"
(cd "$REPO"; bun pm pack --dry-run) > "$EVIDENCE/pack.log" 2>&1
find "$REPO" -maxdepth 1 -name '*.tgz' -printf '%f\n' | sort \
  > "$EVIDENCE/archives-after.txt"
cmp "$EVIDENCE/archives-before.txt" "$EVIDENCE/archives-after.txt"
rg 'bin/axstack.js|skills/axstack/scripts/dispatch-plan.js|profiles/presets/mixed.json' \
  "$EVIDENCE/pack.log"
if rg '\.agents/|\.claude/|verify-axstack/' "$EVIDENCE/pack.log"; then
  echo 'repository verification skill unexpectedly packaged' >&2
  exit 1
fi
```

Proof: complete pack listing contains CLI, helpers and presets, excludes the
repository verification skill and Claude symlink, and creates no new tarball.
Review the full inventory for accidental data before any publication.
Prose-size scans only `skills/`; preserve its exact ceiling and all comments.
Gotcha: `--dry-run` proves a file selection, not a successful registry publish.
