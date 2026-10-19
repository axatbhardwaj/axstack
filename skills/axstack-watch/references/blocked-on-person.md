### Blocked on a person

A PR is ready-except-human when every term other than collaborator approval,
human `CHANGES_REQUESTED` and open findings from a person holds.
Each blocker has a key: `approval:<PR>`, `changes:<review id>` or
`comment:<comment id>`. A missing approval's clock starts at the first observed
ready-except-human time, including no review requested.
Other clocks start at the later of that ready-except-human time and the item's
forge time. A `comment:` clock starts only once the reviewer rates the item
`above low`. An unrated or uncertain item waits on the reviewer and does not
count as ready-except-human.
A clock resets when the PR stops being ready-except-human or its patch-id
changes. A same-patch-id rebase keeps the clock.
Each key is posted at most once, even when readiness is lost and regained or the
patch changes. After 60 minutes, post one T3 driver-thread note per key, including
simultaneous blockers and a new key.
Write the blocked note as short bullet points with the action first and a PR link.
Include `<repo>#<n> waiting <age> on @<login|no reviewer>: <approval|changes|comment>; ready at <sha7>.`
The check runs on existing watch wakes with no new schedule.
The note is a notification only: when the blocker clears, the PR merges with no reply.

Immediately before each automated merge, re-read every term from the forge.
Never edit a running script: freeze its exact script bytes until exit.
For each merge refusal record exact argv, result, head and base and an evidence pointer.
Keep pending CI distinct from failed CI and wait for terminal check results before repair.
Apply the existing [escalation threshold](../../axstack/references/contracts.md#driver-and-adviser-split) to repeated same-goal refusals; changed evidence permits reconciliation, never a blind retry or rules bypass.
Confirm merge commits are allowed, `delete_branch_on_merge` is false, and the
base has no merge queue; otherwise hold for the user. For a singleton PR, use
`gh pr merge <n> --merge --match-head-commit <sha>`; add `--delete-branch` only
when no open PR uses its branch as base and PR chains retirement proves no
unpublished dependency, active author or unknown consumer. For an ordinary
chain root use `gh pr merge <n> --merge --match-head-commit <sha>` without
branch deletion until retirement is proven. After merge, verify actual head
equals reviewed head and is an ancestor of the integration result before
retargeting direct children under PR chains. A failed head guard or uncertain merge
result holds for fresh reconciliation. If the target base moves after final
readback, the singleton/ordinary-root head guard or legacy stack top `sha` decides whether the merge
proceeds; the push run on the merge result decides any further-merge hold.

For a native `gh stack`, automate only a whole-stack merge: the top is the
highest open member, and every open downstack member satisfies the full
predicate, including scope. A partial stack holds for the user. Re-read each
member's head and base; each must equal its reviewed head and base. Request
`PUT /repos/{o}/{r}/pulls/{top}/merge-async` with `sha` equal to the top
reviewed head, `merge_method: merge`, and `merge_action: direct_merge` (never
`bypass_rules`). Poll `GET /repos/{o}/{r}/pulls/{top}/merge-async/{uuid}` to
`merged` or `failed`. Reconcile HTTP 200 (already merged or queued) and HTTP
409 (existing request) against this exact request; a mismatch holds. A failed,
timed-out, or unknown status holds for the user; never retry blindly.
After `merged`, read back every member as MERGED with its actual head equal to
its reviewed head and an ancestor of the merge result; otherwise take a
serious-risk hold. No retargeting, branch deletion, or rebase of a reviewed
member is allowed inside the stack.

After any automated merge, a failing push run on the target base for that
merge result is a run-wide hold on further automated merges until resolved.

