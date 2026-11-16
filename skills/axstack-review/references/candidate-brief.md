## Template: candidate review brief

```text
Candidate: <PR URL> rev <sha> (pinned)
Workspace: <T3 taskId/childThreadId/runId; authored: native worktree | peer: detached checkout; absolute paths>
Driver worktree: <authored: resolved absolute path for isolation proof | peer: n/a>
Evidence: <run dir>/evidence/<dispatch>/
Mode: <peer | authored> Actual author: <all package/integration/repair contributors: provider/model + T3 launch receipt/session | n/a>
Integration: <package tips + ancestry + input identities + combined acceptance | single package | n/a>
Scope: <spec rev or linked issue + ticket + current base + exclusions>
Combined review: <yes — return the Scope verdict | no — separate diligence>
Angles: <all six; identical brief for peer reviewers>
Follow Capture receipts at skills/axstack/references/capture-receipts.md, resolved from the absolute Workspace checkout.
Authored: Follow Review receipt at skills/axstack-review/references/review-receipt.md, resolved from the absolute Workspace checkout.
Escalate to user: yes | no — <criterion> — <reason>
```

For peer mode, follow [Peer execution](../../axstack/sandbox/host-execution.md).

`Claude-Session` is attribution, not provenance; use T3 launch receipts.

Every brief ends with `Escalate to user`, answered in the receipt. Peer: serious
security/funds only, never scope/design/process approval. Authored: security concern,
permanent on-chain state change or architectural change in approach. Health is not a reviewer criterion.
Input, not a veto/verdict; [Native PR managers](../../axstack/references/automations.md)
owns the manager-chat hold.

Follow [Advised holds](../../axstack/references/contracts.md#advised-holds) for authored holds.
