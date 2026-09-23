---
name: axstack-implement
description: When an approved task is ready to build or repair, use axstack-implement for strict TDD and owned delivery.
---

# Implement

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.
At author dispatch, apply [Readable sidebar](../axstack/references/workspace-hygiene.md#readable-sidebar).

From an accepted scope identity, drive its task/PR map through author -> review
-> repair until every required PR is merge-ready or held. Keep exact revisions,
strict TDD evidence, ownership, and unverified boundaries explicit. The human
merges; the same run later reconciles those merges and closes out.

## 1. Admit the work

Before consequential work, load the standing contracts, follow their required
edge into the lifecycle (including its audit hook), then apply shared routing:

- [Standing contracts](../axstack/references/contracts.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)
- [Shared routing](../axstack/references/routing.md)
- [PR-shape policy](../axstack/references/pr-shape.md)
- [Candidate publication](../axstack/references/candidate-publication.md)

Independently confirm the applicable
[proportional scope identity](../axstack/references/routing.md#proportional-scope-identity):

- Substantial new work has an approved spec identity and matching ticket map.
- Small new work has one snapshotted **small-change intent**: the current
  request or chosen issue, explicit acceptance checks, and exclusions. An
  `axstack-debug` diagnosis record with repair class `bounded` is an accepted
  small-change intent source; verify the repair against both its original loop
  and its minimised repro. An implementation slip (wrong file, bad test, setup
  failure) returns to the author and does not increment the bug's fix ledger.
- An adopted own-PR repair has its accepted maintenance snapshot.

If substantial work lacks an approved spec or matching ticket map, report that
exact gap, name `axstack-align` as the next route, and stop.

Pin the exact base and current candidate revision. A missing, mismatched, or
materially changed but unaccepted identity holds affected work; safe
investigation may continue under the standing contracts. Proceed only with a
valid recorded identity and revisions; otherwise report the hold and exact gap.

## 2. Establish one owner and one writer

For substantive delegated or resumable work, use the shared
[run record](../axstack/references/run-record.md). Reconcile it on restart with
the approved scope, Orca and forge state, exact revisions, tickets, and watches.
Reuse valid owners and authors; ambiguity holds a replacement writer.

At execution start, bind work to the driver-owned Orca Run and one authoritative
Task/Dispatch attempt. Preserve the actual IDs and process completion deliveries
through the shared lifecycle. Do not activate a task-owned automation outside
the accepted automations contract.

Immediately before an actual role dispatch, read and follow the
[Orca runtime boundary](../axstack/references/orca-runtime.md). Ordinary local
reading and writing does not require that launch reference.

One persistent owner remains accountable for each PR. Exactly one author writes
it; accepted repairs return there while its evidence is usable, and the owner
never edits concurrently. Only an explicit accepted transfer changes ownership;
ordinary resume reconciles the same sessions and record.

Fanout follows dependencies and capacity within configured limits. Queue
conflicts and dependent work; use `gh stack`, starting each child from its
reviewed parent. When the reviewed parent changes, hold reliance on
stale child evidence and child merge readiness; rebase onto the new parent revision,
re-run affected checks, and remeasure shape against it.
Size growth alone is not an automatic hold.
A parent need not wait for an
independently reviewed child. Dispatch only when ownership, worktree, dependency
revisions, writer exclusivity, and capacity agree with live state. Shape, split,
fanout, and exceptions are autonomous driver decisions within the approved scope.
Size alone never requires user approval.

## 3. Establish test-first evidence

Use the normal behavior path unless the accepted improvement scope is
explicitly marked **structure-preserving**. The author never chooses that tag.

### Normal behavior path

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

At this post-green refactor step, inspect the changed paths. When the candidate
contains a code diff or agent-instruction changes, load and follow
[Simplify the diff](../axstack/references/simplify-diff.md), then rerun affected
green checks after any edit. Do not load it for general human-facing or
marketing prose. Record the required evidence line whether simplification was
applied or found not applicable in the `Simplification:` line of the
[section 5 implementation receipt](#5-verify-and-return-the-candidate),
including evidence and retained complexity.

## 5. Verify and return the candidate

Run the acceptance checks and affected integration boundaries. Record commands,
observed outputs, and verified states. UI work includes rendered interaction
evidence when relevant. Name every unavailable OS, harness, credential, or
other boundary instead of implying coverage.

After the last change, pin the exact candidate revision and return this compact
implementation receipt to the driver:

```text
Record: <progress.md path or tiny-task brief>
Candidate: <PR or branch> base <sha> revision <sha>
Owner: <profile + session ID + worktree>
Scope: <approved spec + capability | small-change intent | maintenance snapshot>
Shape: <total> lines vs base <sha>; bulk: <buckets>; theme: <one line>
TDD: <normal red/green | structure-preserving old-green/same-check-new-green evidence>
Simplification: <applied | not-applicable> — evidence: <diff locations and checks>; retained complexity: <necessary complexity and why>
Acceptance: <checks + observed results>
Dependencies: <parent revisions or none>
Unverified: <boundaries + reasons>
Next: <owner reconciles receipt, uses gh stack to push exact revision, confirms
remote readback, then routes it to axstack-review>
```

The author stops at that receipt and does not push. The driver reconciles it,
uses `gh stack` to publish, confirms remote readback, and continues the loop
without editing the candidate. No step grants merge authority.

## 6. Loop until merge-ready

Inputs are one snapshotted small-change intent or an approved spec and ticket
map. The unit is that accepted task/PR map: run independent PRs in parallel
within the fanout rule; run a dependent `gh stack` bottom-up, each child from
its reviewed parent. The driver is owner, sole record writer, dispatcher,
publisher, and wait-holder for every loop PR it creates. Resume preserves an
existing live owner absent an accepted transfer.

For each PR:

1. Dispatch `axstack-author` under §§3-5 and consume its strict-TDD receipt.
2. Publish through candidate-publication and read back the exact SHA.
3. Dispatch and consume the authored-mode `axstack-review` selected from actual
   author provenance. State the author's actual provider and model from the
   Orca launch receipt in the review dispatch brief; a `Claude-Session`
   trailer is attribution, not provenance. After each settled review, run
   `axstack-cleanup` for its exact reviewer resources before PR merge,
   preserving and reading back the
   private evidence archive before eligible worktree retirement. A later review
   uses a fresh child checkout. Keep the author candidate until merge and
   Close-out; a cleanup hold preserves only the affected reviewer resource.
4. Route the verdict. `APPROVE` at that head plus `axstack-watch` §5's full
   predicate—required checks, all feedback, approvals, mergeability, and
   exact-revision receipts—records `merge-ready`. With required checks pending,
   use the forge-native blocking check wait, bounded and used once per revision, then
   re-evaluate. Timeout, error, or missing wait capability records `held` at
   that revision with reason and resume condition; it never triggers author
   repair. Keep CI-pending state in Orca.
   `REQUEST_CHANGES`, a failed required check, or post-readiness feedback returns
   findings to the same author for a new revision, increments `repairs`, and
   returns to step 1. `INCOMPLETE`, a provenance gap, unavailable model, serious
   risk, or the third `REQUEST_CHANGES` on one PR records `held`. A changed
   parent sends its child back to step 1.

One run-level completion wait covers every unsettled Dispatch; the bounded
forge check wait is the only other wait. End a turn only when every required PR
is `merge-ready` or `held`. Under the recorded Notification policy,
`axstack-relay` sends only a serious risk immediately or a genuine blocked
operation that needs user intervention after bounded safe recovery. Questions,
spec approvals, progress, CI pending, merge-ready, merged, and completion stay
in Orca.

Merge-ready is the human boundary: the user merges, bottom-up for a stack. The
driver resumes on the user's next message or `/axstack-watch`; no Orca merge
wake exists today. Re-read forge state: record forge-merged PRs as `merged`;
changed heads or feedback return to step 1; retain useful author work before Close-out.
Run Close-out once only after every required PR is forge-merged and acceptance
passes. It settles workers, records counts, makes the auditor decision and
settlement, releases worktrees, closes eligible tickets, and archives the run.

The loop requires the `mixed` two-provider authored-review row. `codex-only` or
`claude-only` holds at step (3) for an explicit user routing choice, with no
substitution or same-provider review. Derived PR states are `authoring |
published | in-review | repairing(n) | merge-ready | merged | held`. The run is
done only when every required PR is forge-merged and Close-out has receipts.
