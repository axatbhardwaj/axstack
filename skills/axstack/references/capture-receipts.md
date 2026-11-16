# Capture receipts

Use [check-run](../scripts/check-run.js) for evidence; read
`--help` for flags, dirty snapshots, effects.
Create owned 0700 subfolder in the run's evidence folder outside source and
writable mounts for check-run `--out` at pinned head/base.
Cite every check-run receiptPath and identity: repository,
requested head/base, sourceBefore snapshot, logSha256.
Use JSON Pointer references instead of transcribing hashes.
Read argv, cwd, exitCode and test counts from receipt and captured log.
Stated child result requires citation to `#/exitCode`.

## Limitation reconciliation

Follow [evidence-inspector](../scripts/evidence-inspector.js) `--help`: ledger, dispositions and refresh rules.
Run evidence-inspector `--input ledger.json`; retain its report.
Read each term: id, status, reasonCode, disposition.
Keep open/fail/unknown items as gaps under owning workflow holds.
Outside peer reviews, for zero limitations record none and inspector n/a.
Peer reviews supply inspector `review` even without limitations.
Cite ledger path, inspector report and item IDs in Limitations/Unverified.
Reviewer judges proof kind, semantic sufficiency, coverage, safety.
