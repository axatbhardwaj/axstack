---
name: axstack-implement
description: When an approved task is ready to build or repair, use axstack-implement for strict TDD and owned delivery.
---

# Implement

Drivers follow [Parallel-first ready work](../axstack/references/parallel-first.md#ready-work)
at intake and dependency/completion transitions. Workers keep their assigned
scope and never dispatch.

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

At admission and before dispatch, load and follow [Independent delivery](../axstack/references/independent-delivery.md).

Before consequential work, load the standing contracts, follow their required
edge into the lifecycle (including its audit hook), then apply shared routing:

- [Standing contracts](../axstack/references/contracts.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)
- [Shared routing](../axstack/references/routing.md)
- [PR-shape policy](../axstack/references/pr-shape.md)
- [Candidate publication](../axstack/references/candidate-publication.md)
- [PR chains](../axstack/references/pr-chain.md)

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

### Small-change path

Use this lean path only for a recorded small-change intent with acceptance
checks, exclusions and one PR that is not a risk path. Substantial work uses
the full path below.
This path keeps §§2-5's ownership, isolation, strict TDD and verification
requirements and §6's publication, review, repair, native watch and merge gates;
it omits full-path step-back advice until escalation.

1. Allow isolated package writers for small work with eligible combined review.
   Package count alone changes neither scope classification nor diligence depth;
   all contributors must satisfy that review pairing. Keep one writer per candidate
   and return package-local repairs to its author.
   Workers never push. The driver verifies author proof and evidence before
   publication, publishes the exact candidate under candidate-publication and
   confirms remote readback.
2. Select one cross-provider reviewer from actual author provenance.
   Never skip cross-model review for a small change. For eligible work use the
   combined reviewer under the
   [applicable diligence gate](../axstack/references/diligence.md#applicable-diligence-gate).
   Otherwise require separate diligence, including unknown eligibility.
   The same gate's exact head/base receipts, `Scope: FINDINGS` repair and
   `Scope: UNKNOWN` hold remain mandatory. Single-provider presets or unavailable
   mapped reviewers hold review under §6; separate diligence cannot replace it.
3. After publication and remote readback, arm or join the native watch under §6.
   The owning watch merges only under [watch §5](../axstack-watch/SKILL.md#5-state-readiness-precisely)
   and its full predicate. Keep checkpoint cleanup and Close-out under §6.
4. Escalate to the full path on a second PR, a risk path, review round 3 or a
   design conflict. Risk path includes the
   [merge-risk list](../axstack-watch/references/readiness.md), changes to merge,
   dispatch or authority rules, and anything the driver or reviewer flags as a
   security, data-loss or major-design concern. This classification changes
   review depth only; it grants no merge clearance.

Record the trigger and reconcile scope, dependencies and current receipts on
escalation; preserve the author and review-round budget. Reopen material scope
or design decisions through shared routing before dependent repair.
Step-back advisers run only on the full path after escalation, under §6's
counted-round and unused-budget conditions. Audits follow lifecycle triggers.

## 2. Establish one owner and exclusive candidate writers

For substantive delegated or resumable work, use the shared
[run record](../axstack/references/run-record.md). Reconcile it on restart with
the approved scope, T3 threads/runs and forge state, exact revisions, tickets, and watches.
Reuse valid owners and authors; ambiguity holds a replacement writer.
When a logical Coordinator coordinates project drivers, follow
[Coordinating multiple drivers](../axstack/references/t3-runtime.md#coordinating-multiple-drivers).

At execution start, bind work to the T3 driver thread and one authoritative
dispatch attempt. Preserve the actual thread/task/run IDs and process completion
receipts through the shared lifecycle. Do not activate a task-owned automation outside
the accepted automations contract.

Immediately before an actual role dispatch, read and follow the
[T3 runtime boundary](../axstack/references/t3-runtime.md). Ordinary local
reading and writing does not require that launch reference.

Before a fresh author dispatch for work bound to an issue or ticket id, the driver
must search open PRs in the target repository for that id and check closing references
and PR bodies (e.g. `gh api -X GET search/issues -f q='repo:<target-repo> is:pr is:open <id>'`).
A match outside the current run holds only that dispatch and requires reporting the PR URL.
Exempt the current run's recorded PR for repair/resume.
A failed or incomplete lookup (non-zero exit, `incomplete_results: true`, or
`total_count` greater than the number of returned items) is unknown and holds only that dispatch.
Work without an issue/ticket id is unaffected.

Authors must use async `delegate_task` with `isolation:"worktree"`, title = role-labelled dispatch key
and stable `clientRequestId` under the runtime contract's fresh-checkout bootstrap,
same-child repair and recorded launch fallback rules.

One persistent owner remains accountable for each PR; the driver coordinates
integration and forge actions and never edits candidate source. Follow
[Package ownership](../axstack/references/parallel-first.md#ownership): one
isolated candidate has one active writer, while several candidates may feed one PR.
Assign one integration author as sole writer of the final branch. Reuse a package
author after its package duty ends and the driver records the exclusive scope
transition, or use a separate native-created worktree; a single package needs no
extra integrator. Shared files and glue have one named writer or a serialized
integration step. Separate worktrees alone do not establish semantic independence.
Only an explicit accepted transfer changes PR ownership; path reassignment needs
driver reconciliation and no live competing writer, never presumed from idleness.

Dispatch ready independent packages before waiting, within current capacity and
configured limits; a PR boundary does not determine package boundaries. Consume
settled immutable interfaces or verified terminal package tips under
[Dependencies and repairs](../axstack/references/parallel-first.md#dependencies-and-repairs).
An internal code dependency within one PR needs its exact tip and applicable
acceptance evidence, without a separate package review. Across PRs, PR chains
retains reviewed-parent branching, immediate child evidence invalidation, lazy
merge updates and legacy rebasing. Sensitive-action holds remain in force.
Failed, stale, partial, unknown or questioned receipts cannot satisfy consumers;
producer changes invalidate affected consumers while unrelated work continues.
Keep package worktrees for repairs until the integrated PR merges or closes.

Use one supported snapshotted author binding for package, integration and repair
writers; record each actual session/provider/model. Same-binding writers are the
scoped fanout-floor exception, with independent authored review still required.
Divergent or unknown provenance without a supported review mapping holds the
candidate. All contributors and the owner are ineligible to review it.
Dispatch only when ownership, worktree, input revisions, writer exclusivity and
capacity agree with live state. Shape, split, fanout and exceptions are autonomous
driver decisions within approved scope; size alone requires no user approval.

## 3. Establish test-first evidence

For authorized UI improvement work, load [UI improvement loop](../axstack/references/ui-improvement-loop.md).

For performance work only, load [Performance loop](../axstack/references/perf-loop.md).
For performance work, run the change loop defined in [Performance loop](../axstack/references/perf-loop.md).
For an accepted optimization scope without new behavior explicitly marked structure-preserving, use the structure-preserving path with the same checks green before and after plus the measured delta.
For performance work with new behavior, run a failing check first.
For an optimization not explicitly marked structure-preserving, use the normal behavior path with real red-to-green evidence.

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

### Combined behavior and assembly

Require a named owner to record a meaningful behavioral red before implementing
new combined behavior, then green on the integrated head, including behavior
emerging without glue. Plan this check before the behavior-producing merge on
the pinned base or partial assembly; missing-module/setup failures and later tests
are not historical TDD. Package completion alone does not prove joined correctness.

Only the driver classifies mechanical assembly under
[Evidence](../axstack/references/parallel-first.md#evidence). Verify input identities
and merge order, absence of manual resolutions/integration-owned edits, and tree
equality with a reproducible automatic merge; a clean textual merge is insufficient.
Reuse package red/green or accepted characterization only for covered behavior,
run combined acceptance green, and retain independent review. Unknown classification
holds the exception; new glue, semantic resolutions or emergent behavior needs real
red first. Green-only assembly never exempts unaccounted combined behavior.

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

Before every commit, the author runs the
[staged-file size check](../axstack/scripts/check-staged-file-tokens.js)
with `bun` from the target repository.
Successful staged-file size measurements, including files above 20,000 bytes,
are advisory and exit 0.
Never require splitting files solely for size.
Never request user approval solely for file size.
Review file structure and responsibilities even when size is advisory.
Git, read, malformed-size and unmerged-index errors must fail with a nonzero exit.
Resolve measurement errors before committing; keep repository-owned checks enforceable.
Preserve the check's exclusions, but never hide authored files behind generated banners or ignore globs.
Record the staged-file size check result in the implementation receipt.

## 5. Verify and return the candidate

Run the acceptance checks and affected integration boundaries. Record commands,
observed outputs, and verified states. UI work includes rendered interaction
evidence through [UI verification](../axstack/references/ui-verification.md)
when relevant. Name every unavailable OS, harness, credential, or other
boundary instead of implying coverage.

Use a present `verify-<app>` skill for affected behavior.
If a PR changes a mapped feature, its author updates the feature file in the same PR.
For a missing skill, add "suggest `axstack-verify create`" to the receipt's `Unverified:` line.
Never generate a verification skill automatically.
For a broken or stale recipe, report the gap.
Report a broken or stale recipe as a `low` finding naming `axstack-verify maintain`.
Never let a broken or stale recipe waive existing acceptance obligations.
Keep browser recipes tool-neutral for the verifier.

Each package returns the author receipt below with package scope/base/tip,
current writer attempt, exact input identities and named test logs. Verify consumed
package tips are ancestors of the final head; default assembly uses ordinary local
merges preserving package commits and repairs append commits. Guarded necessary
rewrites supersede affected identities and ancestry evidence. The integration
receipt adds package-tip ancestry, dependency identities, merge order/commits,
integration-owned edits/conflict resolutions and final head/base. Publication
metadata belongs only to the final candidate; package receipts invent no PRs.
Prepublication receipt checking/diligence covers every package and integration
receipt and may be batched or overlap other work, without a mandatory extra
session per package. Partial checks remain provisional until all required inputs
and combined acceptance pass.

After the last change, pin the exact candidate revision and return this compact
implementation receipt to the driver:

```text
Record: <progress.md path or tiny-task brief>
Candidate: <PR or branch> base <sha> revision <sha>
Owner: <profile + session ID + worktree>
Scope: <approved spec + capability | small-change intent | maintenance snapshot>
Delivery map: <record pointer; outcomes/accepted scope drivers; current milestone evidence; held launches>
Shape: <total> lines vs base <sha>; bulk: <buckets>; theme: <one line>
TDD: <normal red/green | structure-preserving old-green/same-check-new-green evidence | F-repair base-green/removal-inversion-red/rewording-green evidence>
Token limit: <staged-file size check command + observed advisories/errors before each commit>
Simplification: <applied | not-applicable> — evidence: <diff locations and checks>; retained complexity: <necessary complexity and why>
Acceptance: <checks + observed results>
Dependencies: <parent revisions or none>
Unverified: <boundaries + reasons>
Next: <owner reconciles receipt, uses candidate-publication to push exact revision, confirms
remote readback, then routes it to axstack-review>
```

The author stops at that receipt and does not push. The driver reconciles it,
uses candidate-publication to publish, confirms remote readback, and continues the loop
without editing the candidate. No step grants merge authority.

Every own PR description must contain exactly one `Revert` line.
Follow [Revert line](../axstack/references/candidate-publication.md#revert-line)
for its format and classification.

## 6. Loop until merge-ready

Inputs are one snapshotted small-change intent or an approved spec and ticket
map. The unit is that accepted package/task/PR map: advance each ready package
without a global wave barrier and assemble required accepted inputs; run an
ordinary dependent PR chain root-first under PR chains, each child
from its reviewed parent; preexisting native stacks retain their legacy path. The driver is owner, sole record writer, dispatcher,
publisher, and wait-holder for every loop PR it creates. Resume preserves an
existing live owner absent an accepted transfer.

For each PR:

1. Dispatch package authors under §§2-5 and consume each verified terminal
   strict-TDD receipt. The integration author combines accepted tips and returns
   the integration receipt and combined acceptance before final publication.
2. Publish through candidate-publication and read back the exact SHA.
   For each own PR, the owner must follow [PR previews](../axstack/references/preview.md)
   to decide whether a preview makes sense.
3. Dispatch and consume the authored-mode `axstack-review` selected from actual
   author provenance. State every package, integration and repair contributor's
   actual session/provider/model from T3 launch receipts in the review dispatch
   brief; a `Claude-Session`
   trailer is attribution, not provenance. At
   [run checkpoints](../axstack-cleanup/SKILL.md#run-checkpoints), batch eligible
   reviewer worktree retirement through `axstack-cleanup`, preserving and reading back
   the private evidence archive first with every existing per-resource guard. A later review
   uses a fresh child checkout. Keep the author candidate until its PR merges or
   closes; a cleanup hold preserves only the affected reviewer resource.
4. Route the verdict. `APPROVE` at that head plus `axstack-watch` §5's full
   predicate—required checks, all feedback, approvals, mergeability, and
   exact-revision receipts—records `merge-ready`. With required checks pending,
   use the forge-native blocking check wait, bounded and used once per revision, then
   re-evaluate. Timeout, error, or missing wait capability records `held` at
   that revision with reason and resume condition; it never triggers author
   repair. Keep CI-pending state in the T3 driver thread.
   Follow the [applicable diligence gate](../axstack/references/diligence.md#applicable-diligence-gate):
   eligible small non-risk-path work uses the same cross-provider reviewer's
   `APPROVE` plus `Scope: PASS`; all other work keeps separate diligence `PASS`.
   `APPROVE` with only non-blocking findings plus applicable diligence evidence
   can be `merge-ready` when the full predicate passes. The driver records the
   non-blocking notes and does not elect a repair; only the user can ask for
   polish.
   `REQUEST_CHANGES`, a failed required check, or post-readiness feedback returns
   package-local findings to the exclusive package author and integration-only
   findings to the integration author for a new revision, increments `repairs`,
   and returns to step 1. Split cross-package findings by ownership and prerequisite
   order. Base updates and unattributed combined CI defects first go to the
   integrator for diagnosis, then verified local causes return to their package
   owner without competing writers. Budgets remain per PR, never per package.
   `INCOMPLETE`, a provenance gap, unavailable model or serious risk records `held`.
   A changed parent immediately invalidates affected child readiness; refresh the
   next ready children as needed under PR chains before step 1.
   Follow [Advised holds](../axstack/references/contracts.md#advised-holds) for eligible `held` causes.
   Merge-ready also requires current applicable diligence evidence at the exact
   head and base. Diligence `FINDINGS` or combined `Scope: FINDINGS` return to
   the same package/integration repair route within the review round.
   Diligence `UNKNOWN` or combined `Scope: UNKNOWN` records the PR as `held`
   with the reason in the run record and blocks merge-ready pending the driver's
   recorded disposition; the disposition never substitutes for `PASS` evidence.
   Any head or base change requires fresh review and applicable diligence
   evidence, including base-only retargets.
   Before merge-ready, treat a run-record `Learning` that contradicts a shipped
   rule as a finding on the owning PR and hold merge-ready until the contradiction is resolved.
   An unrelated run-record `Learning` leaves merge-ready eligibility unchanged.
   A round with reviewer `REQUEST_CHANGES` and/or diligence `FINDINGS` (including
   combined `Scope: FINDINGS`) increments `repairs` once and counts once toward
   the round-3 step-back.
   Failed checks and post-readiness feedback increment `repairs` but never count
   as failing review rounds.
   Small-path work first escalates to the full path at review round 3.
   On the full path, on any counted failing review round that leaves `rounds` at 3 or more while
   `step-back: unused`, the driver steps back with both `axstack-advisor-astra`
   and `axstack-advisor-opus` to assess exactly one extra repair round (round 4
   in the normal case).
   Load and follow [Round-3 step-back](references/step-back.md).
   Load and follow [Review-round budgets](../axstack/references/run-record.md#review-round-budgets) before dispatching any repair from the step-back.

The T3 run watch reconciles unsettled launched-fallback Writer runs; native
completion delivers delegated receipts. Never status-check running delegate_task
children on scheduled wakes. The bounded forge check wait is the only other
implementation wait.
After verified readback of every own PR publication, the driver arms or joins
its maintain-mode chat-run watch under [Autopilot](../axstack/references/autopilot.md).
That watch owns the bound T3 schedule wake; its runtime sets the cadence.
A turn with unsettled launched threads must end only under the bound-watch rule in the T3 runtime contract.
With settled threads, end a turn only when every required PR is `merge-ready` or `held`.
Follow [Route each wake](../axstack-watch/SKILL.md#4-route-each-wake).
Follow [Advised holds](../axstack/references/contracts.md#advised-holds) when raising eligible holds.
Raise user-decision and serious-risk holds in the owning T3 driver thread and
end the turn waiting on the decision when all remaining authorized work is held.
Continue independent authorized work under Autopilot's scoped-hold rules.
Serious risks are raised immediately.
After bounded safe recovery, raise a genuine blocked operation that still needs
the user in the owning T3 driver thread, and the driver ends its turn waiting on it
when all remaining authorized work is held.

Merge-ready opens the merge boundary. Own PRs default to automatic merge under
[watch §5](../axstack-watch/SKILL.md#5-state-readiness-precisely).
The merge actor is the recorded owning watch thread (`axstack-owner` for
standalone authorized maintenance), including small and adopted work.
Apply `axstack-watch` §5's merge card and full predicate; an approval alone
never grants merge authority. Re-read every predicate term under watch §5
before merging; follow its guarded ordinary-root/singleton or legacy-native
merge path and PR chains retarget/retirement proof.
Personal own PRs, including `deploying` bases, follow automatic merge under watch §5.
Work promotion PRs and `deploying` or unknown bases are merged by the user on the forge.
Peer PRs are merged by the user on the forge. User merges are bottom-up for a stack.
A manager, worker, reviewer, monitor, or nightly triage must never merge.
This policy grants no release, npm publish, or host install authority.
A failing push run on the target base after an automated merge holds
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
