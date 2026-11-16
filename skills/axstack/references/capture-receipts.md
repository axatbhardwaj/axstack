# Capture receipts

Use [check-run](../scripts/check-run.js) for command evidence; consult its
`--help` for flags, dirty snapshots and effects. Capture at the pinned head/base
into the private evidence folder outside source and writable mounts.
Cite every check-run capture by receiptPath and identity: repository,
requested head/base, sourceBefore snapshot and logSha256.
Use field references into that JSON for identity, rather than transcribing hashes.
Read argv, cwd, exitCode and test counts from the receipt and its captured log.
The wrapper's exit measures capture, not child success or proof sufficiency.

## Limitation reconciliation

Keep every limitation in the ledger with stable id, boundary, changedAt,
raisedAt, acceptedProofKinds, sourceScope and previousEvidence.
Build the schema-v1 packet from [evidence-inspector](../scripts/evidence-inspector.js)
`--help`: repository, full head/base, items and dispositions.
Rebind revisions on refresh while preserving IDs, boundaries and prior evidence.
Each disposition binds id, head/base and boundary, with status `proved`,
`withdrawn-by-reviewer`, `user-accepted-unproven` or `open`.
Proof carries id, itemId, kind, observedAt and receipt; kind and chronology are
caller-declared. Supply a new item-specific capture after the change and limitation,
and set expectedExitCode in the item policy (default zero).
Withdrawal and user acceptance require the inspector's bound decision record.
Run evidence-inspector with `--input ledger.json` and retain its report.
Read every term by id, status, reasonCode and disposition.
Never use summary.pass as proof.
Never label user-accepted-unproven as proved.
Reviewer withdrawal also records a decision rather than exercised behavior.
Open, fail or unknown items stay explicit gaps; apply the owning workflow's holds.
For zero limitations record `none`, inspector `n/a`; empty item packets are invalid.

Cite ledger path and inspector report plus item IDs in `Limitations`/`Unverified`.
Keep `changed-behavior: unproven` on changed behavior lacking sufficient proof,
including accepted unproven behavior; its recorded decision settles only the
owning workflow's permitted cause at that head/base.
The reviewer judges proof kind, semantic sufficiency, coverage and safety;
consistent receipts grant no verdict or merge authority.
