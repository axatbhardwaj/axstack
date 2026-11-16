# Capture receipts

Use [check-run](../scripts/check-run.js) for command evidence and consult
`--help` for flags, dirty snapshots and effects.
Create an owned 0700 subfolder in the run's evidence folder outside source and
writable mounts for check-run `--out` at the pinned head/base.
Cite every check-run capture by receiptPath and identity: repository,
requested head/base, sourceBefore snapshot and logSha256.
Use JSON Pointer references (such as `receipt.json#/requested/head` and
`receipt.json#/logSha256`) instead of transcribing hashes.
Read argv, cwd, exitCode and test counts from the receipt and its captured log.
A stated child result requires a citation to `#/exitCode`.

## Limitation reconciliation

Follow [evidence-inspector](../scripts/evidence-inspector.js) `--help` for the
item ledger, dispositions and refresh rules.
Run evidence-inspector with `--input ledger.json` and retain its report.
Read every term by id, status, reasonCode and disposition.
Keep open, fail and unknown items as gaps under the owning workflow's holds.
For zero limitations record `none` and inspector `n/a`.
Cite ledger path, inspector report and item IDs in `Limitations`/`Unverified`.
The reviewer judges proof kind, semantic sufficiency, coverage and safety.
