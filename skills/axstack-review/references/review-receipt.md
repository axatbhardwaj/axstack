## Template: review receipt (one block per revision)

Follow [Capture receipts](../../axstack/references/capture-receipts.md).

The reviewer tags every limitation leaving changed behavior unexercised or
unverified, in whatever words, `changed-behavior: unproven`.

```text
Mode: <peer | authored>
Reviewer: <reviewer role + provider/model/effort receipt> session <id> rev <candidate sha> base <current base>
Workspace: <authored: native worktree absolute path | peer: detached checkout absolute path>
Evidence: <run dir>/evidence/<dispatch>/ (report and probe paths)
Verdict: <APPROVE | REQUEST_CHANGES | INCOMPLETE>
Scope: <PASS | FINDINGS | UNKNOWN | n/a — separate diligence>
Coverage: COMPLETE | INCOMPLETE — <angles + acceptance + executable evidence checked>
Limitations: <ledger path + inspector report + item IDs/dispositions/tags, including changed-behavior: unproven where applicable, or none>
Final-head check: <check-run receipt path + identity + cited fields: #/argv -> #/logPath, #/exitCode for the reviewer's final-head drive>
Applicable verify-<app>: <Final-head check records the reviewer's local drive of each affected feature at the pinned final head>. Use n/a — <reason> when no skill covers the affected behavior.
Findings: <severity + evidence + consequence each>
Pre-existing: <each item with reference revision and evidence, or none>
Revert: <declared line + diff-based assessment in authored mode>
Agent-authored comment and thread IDs: <receipt-recorded IDs or none>
Non-agent comments: <each comment ID at the current head: above low | low | addressed | uncertain; re-rate each non-agent comment at every new head; none if absent>
Safety fact: <the one fact the change itself is safe because of, rather than the review process> — <ladder step + capture receipt path/identity + limitation-ledger item ID if applicable, otherwise n/a | unproven>
Escalate to user: <yes | no> — <criterion> — <reason>
```

The `Scope:` verdict is bound to the same head and base as the `Reviewer:` line.
For eligible combined review, report the diligence checks, evidence and limits
with that verdict; all other authored work uses `n/a — separate diligence`.
