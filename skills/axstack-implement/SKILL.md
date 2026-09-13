---
name: axstack-implement
description: When an approved task is ready to build or repair, use axstack-implement for strict TDD and owned delivery.
---

# Implement

Deliver one reviewable candidate at an exact revision. Its accepted behavior
has real red -> green -> refactor evidence, its unverified boundaries are
named, and its ownership remains unambiguous. Review and merge are later
phases.

## 1. Admit the work

Before consequential work, load the standing contracts, follow their required
edge into the lifecycle (including its audit hook), then apply shared routing:

- [Standing contracts](../axstack/references/contracts.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)
- [Shared routing](../axstack/references/routing.md)

Independently confirm the applicable
[proportional scope identity](../axstack/references/routing.md#proportional-scope-identity):

- Substantial new work has an approved spec identity and matching ticket map.
- Small new work has one snapshotted **small-change intent**: the current
  request or chosen issue, explicit acceptance checks, and exclusions.
- An adopted own-PR repair has its accepted maintenance snapshot.

Pin the exact base and current candidate revision. A missing, mismatched, or
materially changed but unaccepted identity holds affected work; safe
investigation may continue under the standing contracts. Proceed only with a
valid recorded identity and revisions; otherwise report the hold and exact gap.

## 2. Establish one owner and one writer

For substantive delegated or resumable work, use the shared
[run record](../axstack/references/run-record.md). On restart, reconcile it
against actual Paseo sessions, Git revisions, GitHub state, the approved scope,
Linear issue state, and watch registrations. Reuse the existing owner and
author when valid. Ambiguous launch state is a hold on creating another writer,
not evidence that the old writer disappeared.

Immediately before an actual role dispatch, read and follow the
[Paseo launch sequence](../axstack/references/paseo-launch.md). Ordinary local
reading and writing does not require that launch reference.

One persistent owner remains accountable for the PR, fixes, evidence, and
monitoring. Exactly one author writes a candidate at a time; accepted review
repairs return to that author when its evidence is still usable. When the owner
delegates writing, the owner does not edit that candidate concurrently. Use
native Paseo handoff when a transfer or resumable boundary needs it and that
capability is available. Otherwise preserve the run-record receipts and report
the native capability gap without inventing a command.

The default limit is two active PRs. The driver queues conflicting or dependent
work and coordinates dependent PRs through `gh stack`. A dependent candidate
starts from its reviewed parent. If that parent changes, hold reliance on stale
child evidence and child merge readiness, update the child to the new parent
revision, and re-run every affected check. A green parent does not prove the
combined stack, but the parent need not wait for an independently reviewed
child. Dispatch only when ownership, worktree, dependency revisions, and
writer exclusivity agree with live state.

## 3. Make one behavior slice red

Choose a behavior from the accepted scope, including its failure behavior or a
real integration boundary. Test it through an observable interface rather than
restating source text or mirroring the intended implementation. Execute the
check before changing production behavior and capture the expected behavioral
failure. A missing-module error or unrelated setup failure is not red.

If no meaningful test-first check can be established, report why and hold
dependent implementation for a scoped decision. Historical tests added after
code remain noncompliant; they never become retroactive TDD evidence.
Corrective work begins with a new behavior slice that can go real red. This
slice may turn green only after the intended failure is observed and recorded.

## 4. Turn the slice green, then refactor

Implement only what makes the red check pass. Run it and capture green evidence,
then refactor while keeping it green. Repeat steps 3 and 4 for the next behavior
slice until every accepted behavior assigned to this candidate is covered.
All assigned slices must have observed red and green evidence and remain green
after refactoring.

## 5. Verify and return the candidate

Run the acceptance checks and affected integration boundaries. Record commands,
observed outputs, and verified states. UI work includes rendered interaction
evidence when relevant. Name every unavailable OS, harness, credential, or
other boundary instead of implying coverage.

After the last change, pin the exact candidate revision and return this compact
implementation receipt to the owner or driver:

```text
Record: <progress.md path or tiny-task brief>
Candidate: <PR or branch> base <sha> revision <sha>
Owner: <profile + session ID + worktree>
Scope: <approved spec + capability | small-change intent | maintenance snapshot>
TDD: <red and green commands + evidence references>
Acceptance: <checks + observed results>
Dependencies: <parent revisions or none>
Unverified: <boundaries + reasons>
Next: <owner routes exact revision to axstack-review>
```

The implementation phase ends with that revision-bound receipt. It grants no
merge authority; the human merges by default.
