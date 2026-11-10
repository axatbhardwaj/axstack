# Parallel-first delivery

Apply this default across every Axstack phase within its accepted scope. It
adds no planning phase, worker quota, role, scheduler or execution authority.

## Ready work

At intake and each meaningful dependency/completion transition, identify useful
ready work. Dispatch independent ready work before yielding to wait, subject to
runtime capacity and existing launch/configuration prerequisites. Launch the
ready batch, then follow native completion instructions; serial tool calls do
not require waiting for an independent worker to finish.

The compact work map in the existing run record names each package's outcome,
owner, inputs and prerequisite milestone, write/resource boundary, output,
acceptance check and state/reason. Tiny direct actions need no extra ceremony.
For serial exceptions, record the specific dependency, semantic/write/resource
conflict, observed capacity or spending restriction, unavailable configuration,
or task too small/inseparable to benefit. Reassess when relevant evidence changes.
Unknown telemetry stays unknown; record any conservative operational bound used
without inventing capacity failure or unlimited capacity. There is no universal
fanout count. Separate worktrees alone never prove semantic independence.

## Ownership

One accountable driver owns scope, dispatch, records, integration coordination
and forge actions; it never edits candidate source. A candidate is one
writer-owned branch/worktree or artifact, distinct from the PR assembling it.
For small work, permit isolated writing packages within one PR with eligible
combined review; every contributor must satisfy that review pairing. Package
count alone changes neither small-work classification nor diligence eligibility.

Each engineering writing package uses a T3-created isolated worktree with
exactly one active writer and explicit file/interface/resource boundaries.
The integration author remains the sole writer of the combined branch. Reuse
`axstack-author`, without a new model seat. A single-package task needs no extra
integrator. The driver records the exclusive scope transition after package duty
finishes; only then can that package author become integrator. A separate integrator requires its own native-created worktree.
Settle interfaces first; give shared files/glue to one writer or a serialized
integration step. Retain package worktrees for repairs until the integrated PR
merges or closes, then apply existing preservation and cleanup guards.

Record every package, integration and repair contributor's actual session,
provider and model. Ordinary writers use the same snapshotted supported author
binding for independent authored-review. Divergent or unknown provenance without
a supported review mapping holds the candidate; never substitute a reviewer.
The owner and every contributing writer never review the joined candidate.

These Git, ancestry, author-binding and head/base rules apply to engineering.
Supported read-only/nonrepo artifact modes retain configured roles, shared native
isolation with separately owned artifact/evidence directories, SHA-256 identities
and phase-specific review under [Local artifacts](local-artifacts.md). Ready-work
scheduling, exclusive ownership, verified terminal outputs and stale-input
invalidation apply in both modes. Never invent a repository or artifact authority.

## Dependencies and repairs

Record each consumer's earliest sufficient prerequisite: accepted immutable
interface/artifact, exact code revision, review, merge or deployment as needed.
Within one PR, a verified terminal package receipt, exact code tip and applicable
acceptance evidence satisfy an internal code dependency without separate package
review. This replaces the blanket reviewed-code-predecessor rule only internally;
across PRs retain reviewed-parent and [PR-chain](pr-chain.md) rules. Artifact
milestones never invent Git ancestry. An early interface is a completed bounded
output with verified required evidence, never a progress message.

Advance a ready consumer or integrate accepted independent inputs while unrelated
packages continue; there is no global wave barrier. Partial-integration checks
are provisional; publication and final acceptance wait for every required package.
Verify the current native task/run, exact commit/artifact and acceptance evidence
under [completion rules](t3-runtime.md#consume-completion-without-advancing-stale-work)
before consuming outputs. Failed, stale, unknown, partial or questioned results
cannot satisfy consumers. When a consumed interface or revision changes,
invalidate affected consumers and reviews while unrelated work continues.

Return package-local fixes to the package author and integration-only fixes to
the integration author. Split cross-package findings by exclusive ownership with
explicit prerequisite order. Base updates and initially unattributable combined
CI defects go to the integrator for diagnosis; a verified package-local cause
returns to its owner. Path transfer requires driver reconciliation and absence
of a live competing writer; idle alone transfers nothing. A within-run scope
reassignment is distinct from PR-owner transfer, which retains explicit user
request and acceptance. Review-round and repair budgets remain per PR regardless
of package count. Cancellation, resume and cleanup preserve attempts, evidence
and settlement guards; never duplicate a live writer.

## Evidence

Each engineering package returns [Implement §5](../../axstack-implement/SKILL.md#5-verify-and-return-the-candidate):
scope/base/tip, current writer attempt, input identities and named red/green or
accepted characterization logs. Package commits need no separate PR; publication
metadata belongs to the final candidate. The integration receipt adds package-tip
ancestry, dependency identities, merge order/commits, integration-owned edits and
conflict resolutions, final head/base. Default assembly preserves package commits
through ordinary local merges; repairs append commits. Verify consumed package
tips are ancestors of the final head. A guarded necessary rewrite supersedes
affected identities/evidence and requires new ancestry proof.

A named owner for each new combined behavior records meaningful behavioral red
on the pinned base or a partial assembly before implementing it and green on
the integrated head. This includes behavior
emerging from packages without glue; plan its check before the producing merge.
Missing-module/setup failures and retrospective tests never establish TDD.
The driver classifies mechanical assembly using tree equality with a reproducible
automatic merge, recorded inputs/order and absence of manual resolutions or
integration-owned edits. Clean textual merges alone are insufficient. Reuse
package red/green or accepted characterization only when combined acceptance and
review reveal no unaccounted new behavior or semantic conflict; unknown
classification holds this exception. Glue, semantic resolution and uncovered
behavior use normal meaningful red-first checks.

Combined acceptance must exercise package outputs together with independent
review at the exact head and base. Package checks never replace integrated
correctness, existing diligence or merge predicates. Artifact candidates retain
exact-hash acceptance/review; stale reviews remain historical only. Prepublication
receipt checking/diligence covers every package and integration receipt; batching
and overlap are permitted without a mandatory extra session per package.

Report packages identified, launched, completed and serialized with reasons in
the existing run record and audit Parallelism field. Record native execution
overlap separately from merely queued tasks and parallel tool calls. Costs and
durations without trustworthy receipts remain unknown. Never claim speedup or
savings without a comparable measured baseline. Close-out includes evidence links
and unexercised phase coverage; deterministic fixture PASS never proves native
observation. Required live acceptance that is FAIL or UNKNOWN holds its gate.

## Authority

Same-binding package, integration and independent-PR authors are exempt from the
Codex-plus-Claude fanout floor. Distinct-brief nonwriter packages using eligible
configured roles are exempt from the blanket provider-diversity floor; an extra
duplicate seat solely for diversity is unnecessary. Preserve research pairs and
branch floors, arena judges, peer first-pass reviewers and audit pairs, including
required independent corroboration, source isolation and configured absence rules.
These exceptions change neither model pins nor independent review composition.

Keep the current T3 thread as driver and workers local to its host. Use native
delegation/completion, configuration validation, serial first-binding preflight,
permission/quota/isolation and cancellation guards. Running proof can satisfy
first-binding preflight when permitted; completion is not an extra sibling gate.
A rejected binding holds its siblings; independent configurations can progress.
No polling running delegates, recursive teams, automatic top-level launches,
replacement runtimes, services or automatic privilege/model/budget escalation.

Internal milestones grant no sensitive-action or production authority. Preserve
auth, money, secrets, migration and production holds, sole forge ownership and
existing release/install authority. Read-only observers and peer reviewers remain
nonwriters. Preserve [performance](perf-loop.md) and [UI](ui-improvement-loop.md)
frozen sequential measurement/keep-revert loops and finite budgets, and
[device verification](ui-verification.md)'s ordered dual runs, one emulator per
host and credential-session ownership. Unrelated isolated preparation can overlap;
competing measured attempts and shared credential sessions cannot.
