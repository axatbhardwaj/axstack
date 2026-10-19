## Template: candidate review brief

```text
Candidate: <PR URL> rev <sha> (immutable checkout)
Workspace: <T3 taskId/childThreadId/runId + detached checkout absolute path>
Evidence: <run dir>/evidence/<dispatch>/ (report and probe paths)
Mode: <peer | authored> Actual author: <provider/model from T3 launch receipt + session | n/a>
Scope: <spec rev or linked issue + ticket + current base + exclusions>
Angles: <all six; identical brief for peer reviewers>
Authored receipt requirements:
  Report Coverage: COMPLETE | INCOMPLETE with covered angles, acceptance and executable evidence.
  Tag each limitation leaving changed behavior unexercised or unverified, in whatever words, changed-behavior: unproven.
  Record Final-head check: <command> -> <log path> for a check the reviewer ran at the final head; keep the log in the run's evidence folder.
  Applicable verify-<app>: Final-head check records the reviewer's local drive of each affected feature at the pinned final head. Use n/a — <reason> when no skill covers the affected behavior.
  Record a Safety fact: about the change itself rather than the review process.
  Rate each non-agent comment at the current head above low | low | addressed | uncertain.
  Re-rate each non-agent comment at every new head.
Escalate to user: yes | no — <criterion> — <reason>
```

The `Claude-Session` trailer is attribution, not provenance; use the T3
launch receipt for the actual author provider and model.

Every brief ends with the `Escalate to user` field and the reviewer answers it
in the receipt. Peer mode permits only its serious security/funds escalation;
no scope, design or process approval is requested. In authored mode a reviewer
may cite only a security concern, a permanent
on-chain state change, or an architectural change in approach. Health is not a
reviewer criterion. The answer is escalation input, not a veto or verdict; see
[Native PR managers](../../axstack/references/automations.md) for the manager-chat
hold.

