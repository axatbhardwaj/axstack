---
name: axstack-watch
description: When babysitting an existing PR, use axstack-watch to monitor or maintain it within bounded authority.
---

# Watch

Leave each adopted PR with one accountable owner, current readiness evidence,
and a bounded watch that ends cleanly or preserves enough state to resume.

Before acting, load [Standing contracts](../axstack/references/contracts.md).
Its required edge loads [Shared lifecycle](../axstack/references/lifecycle.md),
including the end-of-run audit hook. Reach other references only at the steps
that name them.

## 1. Adopt and reconcile

Start from actual state. Reconcile the PR's remote head and base, ownership,
existing Paseo sessions, private run record, and watch registrations. Reuse the
live owner and watch; uncertain state holds new registrations until resolved.

For an existing own PR, read the
[proportional scope identities](../axstack/references/routing.md#proportional-scope-identity),
verify writable ownership and user maintenance authority, then snapshot the
accepted maintenance intent once: authorized scope, actual head and base,
current owner, and watch state. It needs no new spec, ticket, or repeated
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

Read-only checks and updates to the already-owned local record need no launch
load. When the watch needs a new owner, monitor, watchdog, or timer, first read
[Watch runtime](references/watch-runtime.md) and then
[Paseo launch](../axstack/references/paseo-launch.md). Reconcile before creating
anything.

For standalone adoption, materialize `axstack-owner` only when no live owner
exists. Once it exists, the current chat is not a competing coordinator. Only
the owner launches the writer, reviewers, monitor, and watchdog. Workers create
no children or recursive teams, and the adoption watcher is never the writer.

A live watch has verified role and timer receipts, handshakes, watched scope,
wake ownership, and a common expiry. A missing runtime capability is a setup gap,
not a reason to invent a call or create a duplicate registration. Wait through
native wake-ups; no model remains active between events.

## 4. Route each wake

Re-read the remote head and base, then reconcile the event against acknowledged
IDs and the recorded mode. A changed head, CI result, or review comment is an
event, not repair authority. Stale or ambiguous observations authorize nothing.

Observation-only and peer wakes produce a read-only report and stop. For an
authorized maintenance wake that may require a repair or public reply, read and
follow [Repair and publication](references/repair-publication.md).

### Feedback routing

New work routes only under its confirmed scope identity: an approved spec and
matching ticket map for substantial work, or a snapshotted **small-change
intent** for small work. An adopted own PR instead uses its accepted maintenance
snapshot. Missing, stale, or materially changed identity holds repair routing
while monitoring continues. Accepted fixes return to the same original author
session where evidence allows, then receive refreshed independent review before
publication.

A handled wake has an acknowledged event ID, an observation or action bound to
the current revision, and a recorded hold or next owner where work remains.

## 5. State readiness precisely

The owner checks current required checks, all feedback, approvals, mergeability,
and exact-revision receipts before any merge-ready statement. API errors leave
readiness `UNKNOWN`; review approval alone is not merge-ready. Merge-ready is an
observed state distinct from merged, and the human merges by default.

## 6. End and preserve continuity

End early when all required PRs merge, or at cancel or the shared default 24h
deadline. In every case, stop and verify all owned registrations. The deadline
also stops timers for open PRs; never silently renew them.

If work remains, use native Paseo handoff when that capability is available.
Otherwise leave the compact resumable state below in the private run record and
report it in chat. Do not invent a native command or assume an installed handoff
skill.

```text
Record: <progress.md path>
PR: <URL> rev <sha> base <sha>
Owner: <profile + session> Worktree: <path>
Scope: <approved rev, small-change intent, or maintenance snapshot>
Capability: <issue + lifecycle state>
CI/review: <current states + evidence refs>
Watch: <stopped timer receipts + expiry>
Remaining: <next actions + owner>
Resume: <known commands or verified refs needed to reconcile from this revision>
```

The watch ends only when registrations are stopped, receipts are recorded, and
the PR is either merged or represented by this resumable state.
