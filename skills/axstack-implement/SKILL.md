---
name: axstack-implement
description: When an approved task is ready to build or repair, use axstack-implement for strict TDD and owned delivery.
---

# Implement

For authorized delivery runs, follow [Autopilot](../axstack/references/autopilot.md)
for phase continuation and holds.

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.
Include [Safe deletion](../axstack/references/workspace-hygiene.md#safe-deletion) in author briefs.

From an accepted scope identity, drive its task/PR map through author -> review
-> repair until every required PR is merge-ready or held. Keep exact revisions,
strict TDD evidence, ownership, and unverified boundaries explicit. The same
run later reconciles merges and closes out.

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
the approved scope, T3 threads/runs and forge state, exact revisions, tickets, and watches.
Reuse valid owners and authors; ambiguity holds a replacement writer.

At execution start, bind work to the T3 driver thread and one authoritative
dispatch attempt. Preserve the actual thread/task/run IDs and process completion
receipts through the shared lifecycle. Do not activate a task-owned automation outside
the accepted automations contract.

Immediately before an actual role dispatch, read and follow the
[T3 runtime boundary](../axstack/references/t3-runtime.md). Ordinary local
reading and writing does not require that launch reference.

Launch authors through `t3_thread_launch` in their own SHA-pinned worktrees;
use async `delegate_task` for non-writers under the runtime contract.

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
explicitly marked **structure-preserving**, or the accepted scope explicitly
authorizes **F repairs**. The author never chooses those exceptions.

Only when the scope identity carries a sketch, copy it into the author brief
under the [design lens](../axstack/references/design-lens.md).

Authors apply the gate in [Test value](../axstack/references/test-value.md)
to every new or changed test. A test failing the gate is not added.

### F-repair path

For explicitly authorized F repairs, use [F proof](../axstack/references/test-value.md#f-proof):
base-green, targeted removal/inversion-red with byte-for-byte restore, and
equivalent-rewording-green. Never weaken or loosen an assertion.

### Normal behavior path

When that sketch exists, make the first red check target its `Usage` line.
The structure-preserving path stays as is.
If a repeated workaround or unnamed boundary conflicts with the sketch, the
author stops and returns a sketch conflict. The driver reopens only the
affected decision through Align under the existing material-revision rule.

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
evidence through [UI verification](../axstack/references/ui-verification.md)
when relevant. Name every unavailable OS, harness, credential, or other
boundary instead of implying coverage.

After the last change, pin the exact candidate revision and return this compact
implementation receipt to the driver:

```text
Record: <progress.md path or tiny-task brief>
Candidate: <PR or branch> base <sha> revision <sha>
Owner: <profile + session ID + worktree>
Scope: <approved spec + capability | small-change intent | maintenance snapshot>
Shape: <total> lines vs base <sha>; bulk: <buckets>; theme: <one line>
TDD: <normal red/green | structure-preserving old-green/same-check-new-green evidence | F-repair base-green/removal-inversion-red/rewording-green evidence>
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

Every own PR description must contain exactly one `Revert` line.
Follow [Revert line](../axstack/references/candidate-publication.md#revert-line)
for its format and classification.

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
   T3 launch receipt in the review dispatch brief; a `Claude-Session`
   trailer is attribution, not provenance. After each settled review, run
   `axstack-cleanup` for its exact reviewer resources before PR merge,
   preserving and reading back the
   private evidence archive before eligible worktree retirement. A later review
   uses a fresh child checkout. Keep the author candidate until its PR merges or
   closes; a cleanup hold preserves only the affected reviewer resource.
4. Route the verdict. `APPROVE` at that head plus `axstack-watch` §5's full
   predicate—required checks, all feedback, approvals, mergeability, and
   exact-revision receipts—records `merge-ready`. With required checks pending,
   use the forge-native blocking check wait, bounded and used once per revision, then
   re-evaluate. Timeout, error, or missing wait capability records `held` at
   that revision with reason and resume condition; it never triggers author
   repair. Keep CI-pending state in the T3 driver thread.
   `APPROVE` with only non-blocking findings plus diligence `PASS` can be
   `merge-ready` when the full predicate passes. The driver records the
   non-blocking notes and does not elect a repair; only the user can ask for
   polish.
   `REQUEST_CHANGES`, a failed required check, or post-readiness feedback returns
   findings to the same author for a new revision, increments `repairs`, and
   returns to step 1. `INCOMPLETE`, a provenance gap, unavailable model, serious
   risk, or the third review round with `REQUEST_CHANGES` and/or diligence
   `FINDINGS` on one PR records `held`. A changed parent sends its child back
   to step 1.
   Merge-ready also requires a current diligence `PASS` at that head; diligence
   `FINDINGS` return to the same author within the review round.
   Diligence `UNKNOWN` records the PR as `held` with the reason in the run record
   and blocks merge-ready pending the driver's recorded disposition.
   Before merge-ready, treat a run-record `Learning` that contradicts a shipped
   rule as a finding on the owning PR and hold merge-ready until the contradiction is resolved.
   An unrelated run-record `Learning` leaves merge-ready eligibility unchanged.
   A round with reviewer `REQUEST_CHANGES` and/or diligence `FINDINGS` increments
   `repairs` once and counts once toward the third-round hold.

The T3 run watch reconciles every unsettled dispatch attempt; the bounded
forge check wait is the only other implementation wait. The eligible run arms
one maintain-mode chat-run watch at its first published PR; that watch owns its
bound 10-minute T3 schedule wake.
A turn with unsettled launched threads must end only under the bound-watch rule in the T3 runtime contract.
With settled threads, end a turn only when every required PR is `merge-ready` or `held`. Under the recorded Notification policy,
`axstack-relay` sends only a serious risk immediately, a genuine blocked
operation needing user intervention after bounded safe recovery, or the
decision holds and capped milestones named by the recorded Notification policy.
Routine questions stay in the T3 driver thread. Progress, CI pending, and completion always stay
in the T3 driver thread.
Only the bounded categories—user-decision holds (including spec approval),
serious-risk holds, and at most two merge-ready/merged milestones per run—may
be relayed under the recorded Notification policy.

Merge-ready opens the merge boundary.
For own PRs, automatic merge is the default under the
[watch predicate](../axstack-watch/SKILL.md#5-state-readiness-precisely).
The merge actor is the recorded owning watch thread (`axstack-owner` for
standalone authorized maintenance), including small and adopted work.
Missing or idle ownership follows lifecycle reconciliation and explicit transfer first.
Apply `axstack-watch` §5's merge card and full predicate; an approval alone
never grants merge authority.
A peer PR or `deploying` base waits for the user to merge, in either approval mode.
User merges are bottom-up for a stack.
A manager, worker, reviewer, monitor, or nightly triage must never merge.
Observation-only and peer watches never merge.
Watch §5 owns provider provenance, approval carryover, eligible bases, every
planned stack member's publication, exclusions, and card-reply exceptions.
This policy grants no release, npm publish, or host install authority.
Re-read every predicate term under watch §5 before merging. Confirm merge
commits are allowed, `delete_branch_on_merge` is false, and the base has no
merge queue; otherwise hold for the user. For a singleton, use
`gh pr merge <n> --merge --match-head-commit <sha>` and add `--delete-branch`
only when no open PR uses its branch as base. For a native `gh stack`, merge
only the whole stack through `merge-async`: pass the top reviewed head as `sha`,
`merge_method: merge`, and `merge_action: direct_merge`, then poll its UUID.
Reconcile HTTP 200 or 409 against the intended request, verify every merged
member's actual head equals its reviewed head and is an ancestor of the merge
result, and hold unknown or failed outcomes; watch §5 owns the detailed rule.
Never retarget, delete a stack branch, or rebase a reviewed stack member for
merging. A failing push run on the target base after an automated merge holds
further automated merges run-wide. The driver resumes on the user's next
message, `/axstack-watch`,
or the armed chat-run watch wake; verify merge state through the forge on wake.
Re-read forge state: record forge-merged PRs as `merged`;
changed heads or feedback return to step 1; retain useful author work before Close-out.
Run Close-out once only after every required PR is forge-merged, the run's
Release step is settled or not applicable, and acceptance passes. It settles
workers, records counts, makes the auditor decision and
settlement, releases worktrees, closes eligible tickets, and archives the run.
Without an Autopilot or Release record, the Release step is not applicable for
both Close-out and run completion.

The loop requires the `mixed` two-provider authored-review row. `codex-only` or
`claude-only` holds at step (3) for an explicit user routing choice, with no
substitution or same-provider review. Derived PR states are `authoring |
published | in-review | repairing(n) | merge-ready | merged | held`. The run is
done only when every required PR is forge-merged, the run's Release step is
settled or not applicable, and Close-out has receipts.
