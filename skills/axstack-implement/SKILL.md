---
name: axstack-implement
description: When an approved task is ready to build or repair, use axstack-implement for strict TDD and owned delivery.
---

# Implement

Deliver one reviewable candidate at an exact revision. Normal behavior changes
have real red -> green -> refactor evidence; a narrowly accepted
structure-preserving change has old-green characterization evidence. Name
unverified boundaries and keep ownership unambiguous. Review and merge are
later phases.

## 1. Admit the work

Before consequential work, load the standing contracts, follow their required
edge into the lifecycle (including its audit hook), then apply shared routing:

- [Standing contracts](../axstack/references/contracts.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)
- [Shared routing](../axstack/references/routing.md)
- [PR-shape policy](../axstack/references/pr-shape.md)

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
against actual Orca Tasks, Dispatches, sessions, Git revisions, GitHub state, the approved scope,
Linear issue state, and watch registrations. Reuse the existing owner and
author when valid. Ambiguous launch state is a hold on creating another writer,
not evidence that the old writer disappeared.

At execution start, bind work to the driver-owned Orca Run and one authoritative
Task/Dispatch attempt. Preserve the actual IDs and process completion deliveries
through the shared lifecycle. Do not activate a task-owned automation while the
native watch capability hold remains open.

Immediately before an actual role dispatch, read and follow the
[Orca runtime boundary](../axstack/references/orca-runtime.md). Ordinary local
reading and writing does not require that launch reference.

One persistent owner remains accountable for the PR, fixes, evidence, and
monitoring. Exactly one author writes a candidate at a time; accepted review
repairs return to that author when its evidence is still usable. When the owner
delegates writing, the owner does not edit that candidate concurrently. An
ownership transfer occurs only when explicitly requested; follow the shared
lifecycle's native capability preflight for that transfer. An ordinary restart
or resume reconciles the existing sessions and run record without creating a
fresh recipient.

There is no fixed active-PR count. Fanout is dependency- and capacity-driven
within configured host resource and spending limits, while one host owns the
run and one writer owns each candidate. The driver queues conflicting or
dependent work and coordinates dependent PRs through `gh stack`. Routine shape,
split, fanout, and exception choices are autonomous driver decisions within the
approved spec; size alone never requires user approval. A dependent candidate
starts from its reviewed parent. When a reviewed parent changes, hold reliance
on stale child evidence and child merge readiness. Rebase the child onto the
new parent revision, re-run affected checks, and remeasure shape against the new
actual base. Re-record the shape and re-check its level-matching rationale; size
growth alone is not an automatic hold. A green parent does not prove the
combined stack, but the parent need not wait for an independently reviewed
child. Dispatch only when ownership, worktree, dependency revisions, writer
exclusivity, and configured capacity agree with live state. Escalation occurs
only if a split exposes an existing shared-contract hold.

## 3. Establish test-first evidence

Use the normal behavior path unless the accepted improvement scope is
explicitly marked **structure-preserving**. The author never chooses that tag.

### Normal behavior path

Choose a behavior from the accepted scope, including its failure behavior or a
real integration boundary. Test it through an observable interface rather than
restating source text or mirroring the intended implementation. Execute the
check before changing production behavior and capture the expected behavioral
failure. A missing-module error or unrelated setup failure is not red.

For example, retry the same payment ID and observe one charge through the
public interface. Counting internal helper calls alone would not prove that
behavior. This illustrates the boundary test; it does not require a payment
scenario in unrelated work.

If no meaningful test-first check can be established, report why and hold
dependent implementation for a scoped decision. Historical tests added after
code remain noncompliant; they never become retroactive TDD evidence.
Corrective work begins with a new behavior slice that can go real red. This
slice may turn green only after the intended failure is observed and recorded.

### Structure-preserving path

The accepted scope records the listed files, current and target shape,
preserved behavior contract, and expected test evidence. Write or identify a
behavioral baseline or characterization check. The old revision must run green
before any structural edit. After the edit, run the same checks on the new
revision green, plus appropriate actual artifact or equivalence checks.

No behavioral red is expected here; never manufacture red. A mutation
sensitivity check is optional evidence that the baseline detects meaningful
change. If it detects nothing, record that sensitivity as an unverified
boundary rather than changing acceptance tests to create a failure.

Any bug or new behavior found during the refactor is separately accepted and
returns to the normal strict real red -> green path. If work exceeds the listed
files or crosses a new security or infrastructure boundary, stop and reassess
scope through shared routing. Do not turn a bounded refactor into a sweeping
campaign.

## 4. Turn the slice green, then refactor

For the normal behavior path, implement only what makes the red check pass.
Run it and capture green evidence, then refactor while keeping it green. Repeat
for each accepted behavior slice; every normal slice needs observed red and
green evidence. For structure-preserving work, make only the accepted
structural edits and keep the unchanged baseline and equivalence evidence
green.

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
Shape: <total> lines vs base <sha>; bulk: <buckets>; theme: <one line>
TDD: <normal red/green | structure-preserving old-green/same-check-new-green evidence>
Acceptance: <checks + observed results>
Dependencies: <parent revisions or none>
Unverified: <boundaries + reasons>
Next: <owner routes exact revision to axstack-review>
```

The implementation phase ends with that revision-bound receipt. It grants no
merge authority; the human merges by default.
