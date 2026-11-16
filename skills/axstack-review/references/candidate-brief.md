## Template: candidate review brief

```text
Candidate: <PR URL> rev <sha> (immutable checkout)
Workspace: <T3 taskId/childThreadId/runId + authored: native worktree absolute path | peer: detached checkout absolute path>
Driver worktree: <authored: resolved absolute path for isolation proof | peer: n/a>
Evidence: <run dir>/evidence/<dispatch>/ (report and probe paths)
Mode: <peer | authored> Actual author: <every package/integration/repair contributor's provider/model + T3 launch receipt/session | n/a>
Integration: <package tips + ancestry + input identities + combined acceptance | single package | n/a>
Scope: <spec rev or linked issue + ticket + current base + exclusions>
Combined review: <yes — return the Scope verdict | no — separate diligence>
Angles: <all six; identical brief for peer reviewers>
Follow Capture receipts at skills/axstack/references/capture-receipts.md, resolved from the absolute Workspace checkout.
Authored receipt requirements: Follow Review receipt at skills/axstack-review/references/review-receipt.md, resolved from the absolute Workspace checkout.
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

Follow [Advised holds](../../axstack/references/contracts.md#advised-holds) for eligible authored escalation holds.
