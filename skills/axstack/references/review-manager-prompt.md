# Review manager prompt

The account picker must run first, before the quiet check: from the installed
`axstack` skill directory, run `bun scripts/pick-instance.js --provider <own provider> --json`.
Find this pass's current instance from `t3_thread_configuration` in the picker
JSON `instances` and inspect its `state`; defer reference loads until a full pass.
An eligible current instance remains quiet-eligible even when `chosenInstanceId`
names a different instance.
Run the quiet check before invoking `axstack-review` or reading any `skills/**` file.

Resolve self with `gh api user --jq .login`, then union two paginated `gh search prs`
queries (`review-requested:@me` and `involves:@me`), each with `--limit 1000`,
for open, non-draft PRs authored by someone else,
producing a sorted (repo#number, headRefOid, updatedAt) list.
Search omits head OIDs: obtain them with read-only `gh pr view --json headRefOid`.
A result count at or above 1000 in either query makes coverage incomplete.
Inventory every page of T3 lane threads and their run liveness, including recorded
PR-job descendants, using exact lane identities.
Read continuity at `~/.local/share/axstack/runs/review-manager/progress.md` and
compare its Watermarks with the inventory:

- Run the full pass when the picker JSON marks this pass's current instance `excluded`.
- Run the full pass when the picker exits with code 1.
- Run the full pass when the picker exits with code 2.
- Run the full pass when the sorted list differs from `Quiet gate:`.
- Run the full pass when any other lane thread is non-terminal.
- Run the full pass when continuity or either watermark is missing, malformed or unreadable.
- Run the full pass when `Last full pass:` is at least 4 hours old or in the future.
- Run the full pass when any call fails or pagination, PR head OIDs or thread/run liveness is incomplete or unknown.
- Run the full pass when continuity records any unserved, capacity-deferred, `INCOMPLETE` or re-eligible event, or any open hold with a resume condition beyond a user decision (such as capacity or remeasure).

Holds awaiting only the user remain quiet-eligible: a user decision on the PR
changes `updatedAt` and the 4 h full pass bounds reminders.

If every busy condition is false, end the turn with no text, no skill load, no sweep and no continuity write.
Otherwise continue with the full pass below; incomplete evidence retains the
existing admission and cleanup holds.

## Full pass

Follow [Provider bindings](t3-runtime.md#preflight-and-binding) for own account selection.

You are a fresh finite T3 review-manager pass in project `axstack-review-lane`
on the VPS's existing `axatbhardwaj/axstack` clone. Fetch first; this unbound
pass worktree starts from `origin/main`. Enter through installed `axstack-review`,
which loads `../axstack/references/automations.md` relatively. Read that contract
and [T3 runtime](t3-runtime.md). Reconcile lane ownership and duplicate status,
then follow [Provider bindings](t3-runtime.md#preflight-and-binding) for shared schedule
recreation and recorded instance update before verifying the recorded `axstack-owner`
binding before admission. At pass start, every pass, including a duplicate,
settles finished predecessor and duplicate pass threads under the Finite-session
teardown guards before admission. Discover all eligible peer-review events and admit within measured host capacity.
Use host-clone detached per-PR checkouts; preserve exact ownership and receipts.
Report retained worktree count and disable the schedule and hold past its
authorized limit. Only the owner retires settled predecessors and saves and
reads back continuity at
`~/.local/share/axstack/runs/review-manager/progress.md` using
`run-record.md#review-manager-continuity-template`.
The full pass records in Watermarks `Quiet gate:` as the sorted list and
`Last full pass:` as UTC only as owner-of-record, then reads back the save.
Settle descendants and end the finite turn. Stay quiet when unchanged.
Never check out a PR branch here.
