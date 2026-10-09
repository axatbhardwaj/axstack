# Create run records and inspect repositories

Entry points: `skills/axstack/scripts/{run-init,pr-shape,readiness}.js`;
fixtures: `tests/workflows/{run-init,readiness,pr-shape-helper}.test.js`.
Prerequisites: Launch; a new local Git fixture, never the driver's run namespace.
Run-init writes only its fixture Git common directory and owned scratch.

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
bun -e 'const e = process.env.EVIDENCE; const r = await Bun.file(e + "/run-init.json").json(); const s = await Bun.file(e + "/shape.json").json(); if (r.terms.some(t => t.status !== "pass") || !(await Bun.file(r.recordPath).text()).includes("Run: " + r.runId) || s.total.additions !== 1 || s.total.deletions !== 0) throw Error("fixture report mismatch"); await Bun.write(e + "/fixture-progress.md", await Bun.file(r.recordPath).text());'
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
