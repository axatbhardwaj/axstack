# Create run records and inspect repositories

Entry points: `skills/axstack/scripts/{run-init,pr-shape,readiness,scratch}.js`;
fixtures: `tests/workflows/{run-init,readiness,readiness-run,pr-shape-helper,scratch,scratch-consumers}.test.js`.
The pr-shape fixtures cover the optional `--source` sync term: fast-forward
containment after source advancement, no-ff promotion trees, unrelated history,
lost base-only hotfixes, divergent head/source trees with a shared ancestor base,
missing source objects and absent-source n/a.
They bind the proof to resolved SHAs and check that Git remains unchanged.
Ordinary-chain policy is in `skills/axstack/references/pr-chain.md`;
contract checks exercise ancestor-first repair and genuine paraphrases with removal/
inversion negatives; local history fixtures cover three layers, siblings,
merge-preserved commit identity, retarget shape and current-tip ancestry.
These checks prove shipped instruction contracts and local Git behavior, not live
forge retargeting or agent compliance.
Prerequisites: Launch; a new local Git fixture, never the driver's run namespace.
Run-init writes only its fixture Git common directory and owned scratch.

## Run commands in owned scratch

After Launch/Doctor and the install feature, invoke the installed helper:

```bash
doctor > "$EVIDENCE/scratch-doctor.log" 2>&1
INSTALLED="$HOME/.agents/skills/axstack/scripts/scratch.js"
bun "$INSTALLED" --help > "$EVIDENCE/scratch-help.txt"
bun "$INSTALLED" run --root "$TMPDIR" -- bun -e \
  'await Bun.write("relative.txt", "cwd"); await Bun.write(process.env.TMPDIR + "/temporary.txt", "tmp"); process.exit(7)' \
  > "$EVIDENCE/scratch-run.json"
bun -e 'const r = await Bun.file(process.env.EVIDENCE + "/scratch-run.json").json();
  if (r.child.exitCode !== 7 || await Bun.file(r.cwd + "/relative.txt").text() !== "cwd" ||
      await Bun.file(r.tmp + "/temporary.txt").text() !== "tmp") throw Error("scratch run mismatch");'
SCRATCH_ROOT=$(bun -e 'console.log((await Bun.file(process.env.EVIDENCE + "/scratch-run.json").json()).root)')
bun "$INSTALLED" plan --root "$SCRATCH_ROOT" > "$EVIDENCE/scratch-plan.json"
bun -e 'const r = await Bun.file(process.env.EVIDENCE + "/scratch-plan.json").json();
  if (!r.terms.length || r.terms.some(t => t.status !== "pass")) throw Error("scratch plan mismatch");'
bun run test tests/workflows/scratch.test.js tests/workflows/scratch-consumers.test.js > "$EVIDENCE/scratch-tests.log" 2>&1
```

Proof: installed execution creates stamped owned paths, preserves the child exit
separately, and plan observes them without deletion. Fixtures compare the outside
inventory and reject unsafe explicit parents; absent/unsafe inherited TMPDIR
uses a fresh private system-temp root. The helper retains scratch for validated
cleanup under Launch's outer root. It is not filesystem or process containment;
these fixtures prove no protection against absolute-path or HOME writes.
Repository commands wrapped by scratch must select the repository explicitly;
use the [repository command recipe](../../../../skills/axstack/references/workspace-hygiene.md#safe-deletion)
and check the JSON child exit fields. Consumer fixtures execute that documented
pattern against a deliberately failing repository test, preventing false greens.

Run the readiness CLI fixtures in the offline shell. These use real PEM
certificate and key bytes. The escaped-writer fixtures stop their exact child
process in cleanup, including when an assertion fails.

```bash
doctor > "$EVIDENCE/reports-tests-doctor.log" 2>&1
REPORT_STATUS=0
bun run test tests/workflows/readiness.test.js tests/workflows/readiness-run.test.js \
  > "$EVIDENCE/reports-tests.log" 2>&1 || REPORT_STATUS=$?
printf '%s\n' "$REPORT_STATUS" > "$EVIDENCE/reports-tests-exit.txt"
test "$REPORT_STATUS" -eq 0
```

Proof: complete public certificate/public-key PEM blocks in `.pem` and `.key`
files pass the content heuristic. Private-key markers and tracked env paths
fail. Unavailable, opaque, binary or malformed PEM evidence stays unknown.
This checks PEM envelopes and encoding, not cryptographic validity. Other key
formats remain conservative path checks. Reports contain paths, not key bytes.
Without PID containment, an escaped writer can leave `logIncomplete: true`
in concise `--run` stdout. The full report keeps each command's flag and the
summary keeps its existing `incompleteLogs` count. Status and descendant
containment facts remain unchanged.

```bash
doctor > "$EVIDENCE/reports-doctor.log" 2>&1
mkdir "$TMPDIR/reports-repo"
git -C "$TMPDIR/reports-repo" init -q -b main
git -C "$TMPDIR/reports-repo" -c user.name=Fixture \
  -c user.email=fixture@example.invalid commit --allow-empty -qm fixture
BASE=$(git -C "$TMPDIR/reports-repo" rev-parse HEAD)
printf 'fixture\n' > "$TMPDIR/reports-repo/README.md"
git -C "$TMPDIR/reports-repo" add README.md
git -C "$TMPDIR/reports-repo" -c user.name=Fixture \
  -c user.email=fixture@example.invalid commit -qm 'fixture feature'
(cd "$TMPDIR/reports-repo"; bun "$SCRIPTS/run-init.js" \
  --slug verify-fixture --date 20261008) > "$EVIDENCE/run-init.json"
(cd "$TMPDIR/reports-repo"; bun "$SCRIPTS/pr-shape.js" \
  --base "$BASE" --head HEAD) > "$EVIDENCE/shape.json"
bun -e 'const e = process.env.EVIDENCE; const r = await Bun.file(e + "/run-init.json").json(); const s = await Bun.file(e + "/shape.json").json(); if (r.terms.some(t => t.status !== "pass") || !(await Bun.file(r.recordPath).text()).includes("Run: " + r.runId) || s.totals.additions !== 1 || s.totals.deletions !== 0) throw Error("fixture report mismatch"); await Bun.write(e + "/fixture-progress.md", await Bun.file(r.recordPath).text());'
```

Outputs: run-init returns owned paths, template record and per-term facts;
pr-shape returns resolved revisions and full additions/deletions. Observe
the record, empty evidence directory and scratch's 0700 mode before cleanup:

```bash
bun -e 'const { statSync, readdirSync } = await import("node:fs"); const r = await Bun.file(process.env.EVIDENCE + "/run-init.json").json(); if ((statSync(r.scratchDir).mode & 511) !== 448 || readdirSync(r.evidenceDir).length) throw Error("run isolation mismatch");'
```

For candidate readiness, its output guard requires a Git common directory.
Use a local shared clone with a **separate Git directory inside EVIDENCE**;
never write to the driver's `.git/axstack/readiness`. No fetch or network.
This clone reads the pinned candidate's committed files, not working edits.

```bash
git clone --shared --no-checkout --separate-git-dir "$EVIDENCE/readiness-git" \
  "$REPO" "$TMPDIR/readiness-repo" > "$EVIDENCE/readiness-clone.log" 2>&1
git -C "$TMPDIR/readiness-repo" checkout --detach "$REV" \
  >> "$EVIDENCE/readiness-clone.log" 2>&1
git -C "$TMPDIR/readiness-repo" remote set-url origin \
  "$(git -C "$REPO" remote get-url origin)"
GH=/usr/bin/false bun "$SCRIPTS/readiness.js" \
  --repo "$TMPDIR/readiness-repo" --rev "$REV" \
  --out "$EVIDENCE/readiness-git/axstack/readiness/head.json" \
  > "$EVIDENCE/readiness.log" 2>&1
bun -e 'const r = await Bun.file(process.env.EVIDENCE + "/readiness-git/axstack/readiness/head.json").json(); if (r.header.revision !== process.env.REV || r.criteria.find(c => c.id === "testing.verify-skill").status !== "pass") throw Error("candidate verification missing");'
```

Proof: the static report binds REV and discovers this skill. Other failed or
unknown criteria remain visible. GH is deliberately unavailable offline, so
forge protection remains unknown; no `--run` executes product commands.
Gotchas: use a fresh readiness clone per attempt. Its retained Git directory
references local source objects; reports are self-contained proof, while the
clone is bookkeeping, not an archival source bundle.

```bash
doctor > "$EVIDENCE/chains-doctor.log" 2>&1
bun run test tests/workflows/pr-chain.test.js tests/workflows/chat-run-watch.test.js \
  tests/workflows/structural.test.js tests/workflows/pr-shape-helper.test.js \
  > "$EVIDENCE/chains-suite.log" 2>&1
```

## Reconcile dispatch evidence folders

Entry point: `skills/axstack/scripts/ledger-reconcile.js` (read-only JSON stdout).
After Doctor, run `bun run test tests/workflows/ledger-reconcile.test.js` and save
the log. The CLI fixtures prove missing-row exit 2 with named folders, complete
exit 0, help/error exits and unchanged directory listing and record bytes. Drive a real run read-only:
`bun skills/axstack/scripts/ledger-reconcile.js --run-dir <run-dir>`.
The default record is `run-record.md`; use `--record <path>` for `progress.md`.
Pipe-delimited rows supply a first-cell dispatch key and an evidence path cell;
matching uses `evidence/<key>/` (or a file inside it), including backticked paths
and list rows. A dispatch key may differ from its evidence folder key.
Same-key rows without evidence paths appear in the dispatch list with
`evidenceKey: null` and fail with "dispatch row <key> has no evidence path" (exit 2).
Rows pointing to another folder fail with that mismatched path named.
Prose mentions do not count as rows; only explicit matching paths pass.
This reports ledger gaps only; it proves neither live dispatch nor settlement.

## Canonical schedule drift

Entry: `skills/axstack/scripts/schedule-drift.js`; contracts:
`tests/workflows/{schedule-drift,schedule-cadence,schedule-policy}.test.js`.
After Doctor, run those three files with `bun run test` and retain the log.
The synthetic saved export covers exact prompt bytes after explicit host-token
binding, the 30-minute review interval, enabled state, project/host identity,
missing schedules, stale/future/incomplete/unavailable input and read-only output.
A host binding may declare `{promptFile,absent:true}` for an intentional exclusion;
only fresh complete matching-host coverage yields four `n/a` terms. Include an
expected `scheduledTaskId` when known: any matching exported task must fail all
four terms. Undeclared missing schedules remain unknown; unknown exports never
prove an exclusion. With no ID this is a host-scope declaration, not discovery.
Run the files once more with TMPDIR unset to exercise the CI fallback.
The policy check binds each verbatim imported clause to its private export hash;
missing admission/submission age and pending-check policies remain unknown (T30).

After pack and temporary-home install, confirm `schedule-drift.js` and
`references/schedule-policy.json` are in the pack inventory and byte-identical
at the installed location. Run the installed helper's `--help`, then drive the
same committed synthetic export, bindings and prompt files from owned scratch
with `--export`, `--bindings`, `--prompts`, `--now` from the fixture. Expect exit 0
and only pass terms. Append a byte to the exported prompt and expect its prompt
term to fail (measured exit 0); remove the export and expect unknown (exit 2).
Also drive intentional exclusion (n/a, exit 0), an excluded identity that exists
(fail, measured exit 0), undeclared missing identity (unknown, exit 2), and stale
exclusion (unknown, exit 2) through the installed helper.
Never use live HOME, mutate schedules or commit a host export. Live T10 deployment
and native schedule delivery remain separate, unverified boundaries.
