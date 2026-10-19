## Template: review receipt (one block per revision)

```text
Mode: <peer | authored>
Reviewer: <reviewer role + provider/model/effort receipt> session <id> rev <candidate sha> base <current base>
Workspace: <T3 taskId/childThreadId/runId + detached checkout absolute path>
Evidence: <run dir>/evidence/<dispatch>/ (report and probe paths)
Verdict: <APPROVE | REQUEST_CHANGES | INCOMPLETE>
Coverage: COMPLETE | INCOMPLETE — <angles + acceptance + executable evidence checked>
Limitations: <unverified boundaries + why; tag each limitation leaving changed behavior unexercised or unverified, in whatever words, changed-behavior: unproven>
Final-head check: <command> -> <log path> — <check the reviewer ran at the final head; log kept in the run's evidence folder>
Applicable verify-<app>: <Final-head check records the reviewer's local drive of each affected feature at the pinned final head>. Use n/a — <reason> when no skill covers the affected behavior.
Findings: <severity + evidence + consequence each>
Pre-existing: <each item with reference revision and evidence, or none>
Revert: <declared line + diff-based assessment in authored mode>
Agent-authored comment and thread IDs: <receipt-recorded IDs or none>
Non-agent comments: <each comment ID at the current head: above low | low | addressed | uncertain; re-rate each non-agent comment at every new head; none if absent>
Safety fact: <the one fact the change itself is safe because of, rather than the review process> — <ladder step + proof | unproven>
Escalate to user: <yes | no> — <criterion> — <reason>
```

