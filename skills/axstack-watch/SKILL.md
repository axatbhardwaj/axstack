---
name: axstack-watch
description: When babysitting an existing PR, use axstack-watch to monitor or maintain it within bounded authority.
---

# Watch

Leave each adopted PR with one accountable owner, current readiness evidence,
and user-facing updates that name its current milestone and next wake or
condition.

Before acting, load [Standing contracts](../axstack/references/contracts.md).
Its required edge loads [Shared lifecycle](../axstack/references/lifecycle.md),
including the end-of-run audit hook. Reach other references only at the steps
that name them.

When the current session is a fresh watch-manager session, load
[Native PR managers](../axstack/references/automations.md) and follow only its
discovery, admission, recovery, and settlement branch. Do not adopt or repair a
PR, materialize `axstack-owner`, or check out a PR branch in the manager
workspace. Each admitted bounded PR coordinator re-enters this skill in its
recorded mode.

Preserve any explicitly named PR, repository, or peer scope. For broad
discovery of the user's own PRs (such as “my” or “our” PRs), run
`gh api user --jq .login` on the execution host, then select open PRs authored
by that login in the named or current repository. Never hardcode or guess the
username; a missing or failed authenticated-login lookup is a concrete blocker.
The authenticated human login selects PRs. Runtime session IDs coordinate work
only and establish neither human identity nor write, reply, or merge authority.
When the session is a bounded watch-manager PR job, also load
[Native PR managers](../axstack/references/automations.md): the bounded PR
coordinator owns that event and its allowlist bounds every mutation.

## 1. Adopt and reconcile

Start from actual state. Reconcile the PR's remote head and base, ownership,
existing Orca Tasks, Dispatches, sessions, private run record, and watch registrations. Reuse the
live owner and watch; uncertain state holds new registrations until resolved.

For an existing own PR, read the
[proportional scope identities](../axstack/references/routing.md#proportional-scope-identity),
verify writable ownership and user maintenance authority, then snapshot the
accepted maintenance intent once: authorized scope, actual head and base,
current owner, actual author provenance, and watch state. Check authoring
session evidence; the orchestrator identity is not author evidence, and never
assume an author for an imported own PR. It needs no new spec, ticket, or repeated
approval. Monitoring-only adoption grants no repair or reply authority.

Adoption is settled when the record names one persistent owner, one watch, the
exact PR revision and base, and the applicable authority snapshot. If write
authority is unverified, record the hold and continue read-only.

## 2. Fix the operating mode

Choose one mode from the user's authority and record it before dispatch:

- **Observation-only:** reconcile and report CI, reviews, and PR state. It
  dispatches no author and sends no reply. This restriction dominates every
  repair path, including obvious fixes after changed heads or feedback.
- **Peer:** observe and report a colleague's PR. Peer mode never repairs.
- **Authorized maintenance:** repair an adopted own PR only within the accepted
  maintenance snapshot and publication authority.

Every later wake must be classifiable from this recorded mode without inferring
new authority.

## 3. Start the bounded watch

Read-only checks and updates to the already-owned local record need no runtime
load. When the watch needs a new owner or automated observation, first read
[Watch runtime](references/watch-runtime.md) and then
[Orca runtime](../axstack/references/orca-runtime.md). Reconcile before creating
anything. Each native watch-manager pass starts a fresh finite session in one
persistent dedicated workspace on its staggered 15-minute schedule, covers
every eligible own PR, and starts only bounded actionable-event jobs. Waiting PRs reserve no execution slots and
there is no watch deadline for manager automation. `axstack-monitor` stays an
optional read-only observer that never sends. One read-only PR observation
needs neither. The bounded PR coordinator is the live owner for its event;
materialize no `axstack-owner` and start no automation for a read-only check.

For standalone adoption, materialize `axstack-owner` only when no live owner
exists. Once it exists, the current chat is not a competing coordinator. Only
the owner launches the writer, reviewers, and optional monitor. Leaf workers
create no recursive teams, and the adoption watcher is never the writer.

A standalone live watch has verified role and timer receipts, handshakes, watched scope,
wake ownership, and a common expiry. A missing runtime capability is a setup gap,
not a reason to invent a call or create a duplicate registration. Native
wake-ups drive observation; never poll or keep a model active between events.

## 4. Route each wake

Re-read the remote head and base, then reconcile the event against acknowledged
IDs and the recorded mode. A changed head, CI result, or review comment is an
event, not repair authority. Stale or ambiguous observations authorize nothing.
Every user-facing update is actionable: name the current milestone, the next
wake or condition, and an ETA when the forge exposes one, such as CI median.
A healthy unchanged observation produces no user-facing message.

Observation-only and peer wakes produce a read-only report and stop. For an
authorized maintenance wake that may require a repair or public reply, read and
follow [Repair and publication](references/repair-publication.md). A manager PR
job repairs in its per-PR child worktree created through `orca-cli`;
the manager workspace never checks out a PR branch.

### Feedback routing

New work routes only under its confirmed scope identity: an approved spec and
matching ticket map for substantial work, or a snapshotted **small-change
intent** for small work. An adopted own PR instead uses its accepted maintenance
snapshot. Missing, stale, or materially changed identity holds repair routing
while monitoring continues. Accepted fixes return to the same original author
session only when the run itself launched that session and evidence allows,
then receive refreshed review under the authored mode rule before publication.
For an adopted own PR under the manager, the original authoring session is
not a run-launched session: the repair author is the manager PR coordinator or
a dispatched `axstack-author`, and the authored-review
pairing follows the recorded actual provenance of that repair, not the PR's
historical author. Unknown, mixed, or unsupported author provenance
that cannot establish the eligible configured reviewer is an exact gap to
report to the user, not permission to invent a pairing or model fallback.

A handled wake has an acknowledged event ID, an observation or action bound to
the current revision, and a recorded hold or next owner where work remains.

When a new actionable event is eligible under a recorded `Notification policy`,
the owner may use the optional [axstack-relay](../axstack-relay/SKILL.md).
The monitor never sends. The manager deduplicates authorized notifications;
absent policy or failed relay uses the recorded durable GitHub or user-owned
conversation and leaves every existing hold open.

## 5. State readiness precisely

The owner checks current required checks, all feedback, approvals, mergeability,
and exact-revision receipts before any merge-ready statement. API errors leave
readiness `UNKNOWN`; review approval alone is not merge-ready. Merge-ready is an
observed state distinct from merged, and the human merges by default.

## 6. End and preserve continuity

A bounded manager PR job ends as soon as its current event and every owned
descendant settle. It returns exact receipts and remaining state to the logical
manager lane's durable continuity, releases proven resources, and never waits
for merge or stops the manager's recurring schedule.

End a standalone watch early when all required PRs merge, at cancellation, or
at its shared default 24 h deadline. There is no watch deadline for manager
automation. In every case, stop and verify all owned registrations.

At every end condition, leave the compact state below in the private run record
and report it in the current chat, even when work remains. Expiry grants neither
silent renewal nor ownership-transfer authority.

Transfer ownership through the runtime-owned Orca handoff route only when the
user explicitly requests it. Before transfer, follow the lifecycle-owned
preflight for native capability availability, the configured role, and explicit
recipient acceptance. A failed or incomplete preflight preserves the current
owner and reports the gap; never invent a native command or infer acceptance.

```text
Record: <progress.md path>
PR: <URL> rev <sha> base <sha>
Owner: <profile + session> Worktree: <path>
Scope: <approved rev, small-change intent, or maintenance snapshot>
Capability: <issue + lifecycle state>
CI/review: <current states + evidence refs>
Watch: <automation ids or stopped registration receipts + expiry>
Remaining: <next actions + owner>
Resume: <known commands or verified refs needed to reconcile from this revision>
```

The watch ends only when registrations are stopped, receipts are recorded, and
the PR is either merged or represented by this resumable state.
When every required PR is merged, follow the lifecycle
[Close-out](../axstack/references/lifecycle.md#close-out) before reporting the
run as done.
