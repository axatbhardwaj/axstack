# Inspect the package payload

Entry points: `package.json.files`, `bin/axstack.js`, packaged `skills/` and
`profiles/`, including candidate-publication and watch repair-publication;
checks: `tests/installer/package.test.js`, `tests/workflows/prose-size.test.js`
and `tests/workflows/publication-repair.test.js`. Prerequisites: Launch, Bun >=1.3.14,
Linux with Bash and POSIX grep.
The built-in package keeper is deterministic and needs no npm or network.
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
for MEMBER in bin/axstack.js skills/axstack/scripts/dispatch-plan.js \
  profiles/presets/mixed.json skills/axstack/references/candidate-publication.md \
  skills/axstack/references/preview.md skills/axstack/references/pr-chain.md \
  skills/axstack/scripts/single-server.js \
  skills/axstack/systemd/axstack-single-server.service \
  skills/axstack/systemd/axstack-single-server.timer \
  skills/axstack/scripts/sync-default.js \
  skills/axstack/scripts/hub-usage.js \
  skills/axstack/scripts/default-policy.js \
  skills/axstack/scripts/default-settings.js \
  skills/axstack/scripts/hub-secret.js \
  skills/axstack/scripts/driver-history.js \
  skills/axstack/references/thread-title-instructions.txt \
  skills/axstack/systemd/axstack-default-sync.service \
  skills/axstack/systemd/axstack-default-sync.timer \
  skills/axstack-publish/SKILL.md \
  skills/axstack-explain/references/design.md \
  skills/axstack-explain/references/frontend-design/FRONTEND-DESIGN.md \
  skills/axstack-explain/references/frontend-design/LICENSE.txt \
  skills/axstack-explain/references/frontend-design/PROVENANCE.md \
  skills/axstack-watch/references/repair-publication.md; do
  grep -Fq " $MEMBER" "$EVIDENCE/pack.log"
done
if rg '\.agents/|\.claude/|verify-axstack/' "$EVIDENCE/pack.log"; then
  echo 'repository verification skill unexpectedly packaged' >&2
  exit 1
fi
```

Proof: complete pack listing independently contains CLI, helpers, presets and
both current publication references (`candidate-publication.md`, `preview.md`), excludes the
repository verification skill and Claude symlink, and creates no new tarball.
Review the full inventory for accidental data before any publication.
Prose-size scans only `skills/`, excluding the upstream paths in the shared
vendored-path constant; owned guidance still counts. Preserve its measured
ceiling and all history comments.
For publication instruction changes, check semantic removal/inversion and
equivalent rewording, retained checkout guards and the current prose budget:

```bash
doctor > "$EVIDENCE/publication-doctor.log" 2>&1
bun run test tests/workflows/publication-repair.test.js \
  tests/workflows/publication-integrity.test.js tests/workflows/review-checkout.test.js \
  tests/workflows/prose-size.test.js tests/workflows/frontend-design-source.test.js > "$EVIDENCE/publication-suite.log" 2>&1
```

These checks prove packaged instruction contracts, not live publication.
`package.test.js` also proves Publish's packed bytes, owned installation,
repeat install and uninstall under all three presets.
Gotcha: `--dry-run` proves a file selection, not a successful registry publish.


## Optional npm comparison

This comparison additionally requires npm; Bun alone cannot execute it.
Use a declared absolute npm executable (prefer the cached npm@12.0.2 used by
staging), a private HOME/cache, and the offline Launch shell. Never install npm
to make this optional check pass. Retain its complete JSON and actual exit.

```bash
doctor > "$EVIDENCE/npm-package-doctor.log" 2>&1
[[ "$NPM_BIN" = /* ]] # caller-declared absolute npm executable
test -x "$NPM_BIN"
"$NPM_BIN" --version > "$EVIDENCE/npm-version.log"
NPM_STATUS=0
(cd "$REPO"; "$NPM_BIN" pack --dry-run --json) \
  > "$EVIDENCE/npm-pack.json" 2> "$EVIDENCE/npm-pack.stderr" || NPM_STATUS=$?
printf '%s\n' "$NPM_STATUS" > "$EVIDENCE/npm-pack-exit.txt"
test "$NPM_STATUS" -eq 0
bun -e 'const result = await Bun.file(process.env.EVIDENCE + "/npm-pack.json").json();
const packed = Array.isArray(result) ? result[0] : Object.values(result)[0];
const files = new Set(packed.files.map(({path}) => path));
const bun = await Bun.file(process.env.EVIDENCE + "/pack.log").text();
for (const [,path] of bun.matchAll(/^packed \S+ (.+)$/gm))
  if (!files.has(path)) throw Error("npm omitted " + path);'
```

This verifies selected package files, never registry publication. The npm JSON
shape differs by npm version; capture the version with the comparison.
