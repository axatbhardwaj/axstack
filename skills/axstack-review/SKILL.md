---
name: axstack-review
description: When a candidate PR or bounded codebase needs review, use axstack-review for configured reviewers.
---

# Review

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.
Include [Safe deletion](../axstack/references/workspace-hygiene.md#safe-deletion) in reviewer briefs.

Manual review keeps the user’s chat and workspace open.

Produce evidence-bound findings for an exact revision using the review count
and model routing required by its mode. Report within the requested authority;
for own PRs, automatic merge is the default under the
[watch predicate](../axstack-watch/SKILL.md#5-state-readiness-precisely).
The recorded owning watch thread merges under the same watch predicate.
Reviewers never merge.

When the current session is a fresh review-manager session, load
[Native PR managers](../axstack/references/automations.md) and follow only its
discovery, admission, recovery, and settlement branch. Do not review a PR,
materialize `axstack-owner`, or check out a PR branch in the manager workspace.
Each admitted bounded PR coordinator re-enters this skill in peer mode.

Before reviewing, load [Standing contracts](../axstack/references/contracts.md),
then [Lifecycle and receipts](../axstack/references/lifecycle.md) so its required
audit edge remains active. Load [Shared routing](../axstack/references/routing.md)
to select the mode and scope identity. For PR modes, apply the shared
[PR-shape policy](../axstack/references/pr-shape.md) and
[PR chains](../axstack/references/pr-chain.md) for PR/head/base-branch/base-SHA
evidence identity. For an owned implementation candidate,
load and verify the
[candidate-publication boundary](../axstack/references/candidate-publication.md).
When the caller is a bounded review-manager PR job, load
[Native PR managers](../axstack/references/automations.md): its reviewer briefs
carry the required escalation field and every eligible peer PR takes a binding
`APPROVE` or `REQUEST_CHANGES` verdict under the automation exception below.

For performance claims only, load [Performance checklist](../axstack/references/performance-checklist.md).

## Finding severity

Rate every review and diligence finding as `high`, `medium`, or `low` under
this shared rubric. Peer findings use the overriding
[peer blocking bar](#peer-mode-colleague-pr); authored findings keep this rubric.

- `high` = correctness, security, data-loss, or contract defect with real impact.
- `medium` = material behaviour, test, or maintainability defect, a softened or
  dropped obligation, or an evidence-integrity mismatch (SHAs, counts, missing red/green logs).
- `low` = polish that does not change behaviour.

The reviewer rates each finding.
Round uncertain ratings up.
Only diligence can raise a rating.
Nobody can lower a rating.
`medium` and `high` findings block `APPROVE`, except validated `Pre-existing` findings in authored mode.
Fix and re-review every `medium` or `high` finding, except validated `Pre-existing` findings in authored mode.
`low` findings do not block approval or merge.
The owner records all low findings and validated `Pre-existing` items with their
severity and evidence in one follow-up issue in the repository's tracker (GitHub Issues, or Linear for `defi-com`), linked from the PR.
The follow-up issue never gates merge.

### Pre-existing disposition

`Pre-existing` is a disposition, not a severity.
Only the reviewer applies the `Pre-existing` tag.
The author never self-tags.
Prove the defect itself exists at the reference revision using quoted code there
plus a reproduction or a same-input argument.
Blame alone is not enough.
For own run PRs, the reference revision is the run's recorded `Source base`,
rather than a chain child's parent head.
For adopted own PRs and peer PRs, the reference revision is the merge-base of
the PR head with the default branch.
For own run PRs, all `Pre-existing` diff checks span the reference revision to the PR head: unchanged defective code, introduction/amplification/new exposure and same-class instances.
The diff must not change the defective code.
The diff must not introduce, amplify or newly expose the defect through changed
callers or configuration.

Exclude the defect the accepted scope targets (peer: linked issue or stated
purpose) from `Pre-existing`.
Exclude a defect an acceptance check depends on from `Pre-existing`.
Exclude another instance of the same defect class inside the diff from `Pre-existing`.
Exclude amplified or newly exposed defects from `Pre-existing`.
Run the defect-class sweep before a finding takes `Pre-existing`, including peer candidates.
Failed proof denies the disposition, never raises a rating or creates a peer blocker by itself.
In authored mode, serious-risk categories still raise the serious-risk hold for `Pre-existing` findings.
On own run PRs, defects others land on the default branch after `Source base` follow normal rules.

## Codebase findings mode

Load and follow [Codebase findings mode](references/codebase-mode.md).

### Template: codebase findings brief

Load and follow [Template: codebase findings brief](references/codebase-brief.md).

### Template: codebase findings report

Load and follow [Template: codebase findings report](references/codebase-report.md).

## Peer mode (colleague PR)

Load and follow [Peer mode (colleague PR)](references/peer-mode.md).

## Authored mode (own PR)

Independently check the
[proportional scope identity](../axstack/references/routing.md#proportional-scope-identity)
before an approval or [merge-ready declaration](#authored-mode-own-pr):

- Substantial new work: confirm the approved spec identity and matching ticket
  map.
- Small new work: confirm the snapshotted **small-change intent**.
- Adopted existing PR: record its accepted maintenance scope once — linked
  issue, acceptance criteria, actual head/base, current ownership, and actual
  author provenance. Never assume an imported own PR's author. That
  snapshot is accepted without repeated approval.

The mode is ready when the applicable identity matches the candidate, no
material scope change remains unaccepted, and every mode-required authored
reviewer receipt records `APPROVE` at the current head and base (verified Muse
absence allowed). Every reviewer is independent, non-author and non-owner.
Green CI, passing tests, or an older-head receipt leave readiness
`UNKNOWN`, never merge-ready. Readonly investigation may continue while an
identity gap holds declarations.

Resolve actual author provenance from authoring session receipts and candidate
history. The orchestrator model, provider, profile, or owner name is not author
evidence. The PR owner session may not independently review in either mode, and
no author session may review its own candidate. Use the run's recorded routing
snapshot to select an eligible reviewer from actual author provenance. When
unknown, mixed, or unsupported provenance cannot establish an approved pairing,
report the exact author-provenance gap, mark review `INCOMPLETE`, and ask the
user. Never assume an author or invent a reverse pairing, provider, model, or
fallback.

## Standalone owner

This section applies to PR review and watch adoption.

Before dispatch, read [T3 runtime](../axstack/references/t3-runtime.md).
The T3 driver thread is the sole owner and coordinator; it never writes tracked files or repairs an author’s source.
Standalone peer review or watch adoption reuses that driver and any valid
recorded ownership. `axstack-owner` is a binding, not a separately launched worker.
Only the driver launches writers through `t3_thread_launch` and non-writers
through async `delegate_task` under the runtime contract. Leaf workers create
no recursive teams. A bounded manager PR job keeps its admitted coordinator
and settles after its skill-owned reviewers settle.

## Review the candidate

Load and follow [Review the candidate](references/review-candidate.md).

## Mode-specific completeness before verdict

These verdicts apply only to PR modes. Codebase findings use coverage status.

- **Peer complete:** mixed first peer review has three receipts (Sol primary,
  Opus peer, Muse), or two with verified Muse absence, for the exact candidate
  SHA and current base, covering the identical full brief with an isolated
  first pass. Single-provider first review keeps two configured receipts and
  never dispatches Muse. Follow-up has exactly one current
  `axstack-reviewer-primary` receipt covering the bounded Peer mode brief.
  Peer review requires no diligence receipt.
- **Authored complete:** mixed Sol-authored review has two receipts (Opus secondary
  and Muse), or one with verified Muse absence. A validated medium/high finding
  from either seat blocks; one `repairs` increment is recorded per round.
  Mixed Opus-authored review keeps one Sol primary receipt with no Muse seat.
  Single-provider counts stay one and Muse is never dispatched. Every required
  eligible non-author/non-owner reviewer has a current verified receipt for
  the exact candidate SHA and current base, covering the whole brief, all six
  angles, and applicable acceptance.
- **Complete verdict:** validated blocking defects permit `REQUEST_CHANGES`;
  complete evidence with no blocker permits `APPROVE`.
- **Authored diligence:** a current `PASS` is required with reviewer approval for
  merge-ready; `FINDINGS` return to the author in that round.
- **Incomplete or stale:** use `INCOMPLETE`; never fabricate `APPROVE` or
  `REQUEST_CHANGES`.

The owner verifies and synthesizes the mode-required evidence without voting.
A first peer review with fewer than its mode-required receipts is incomplete;
a peer follow-up requires one primary receipt. An authored reviewer receipt
count other than its mode-required count is incomplete. Passing tests or reviewer unanimity grants
no merge authority.

## Template: candidate review brief

Load and follow [Template: candidate review brief](references/candidate-brief.md).

## Template: review receipt (one block per revision)

Load and follow [Template: review receipt (one block per revision)](references/review-receipt.md).

## Prompt-only urgent escalation

Follow [Advised holds](../axstack/references/contracts.md#advised-holds) for urgent escalation ordering and eligible advice.

Peer reviews, including interactive non-manager reviews, raise only credible
serious security/funds risk through this prompt-only hold in the T3 driver thread.

In authored and codebase modes, promptly raise credible serious security issues, possible
downtime or data loss, and major design concerns without waiting for every
mode-required reviewer. Present evidence, likely impact, options, and the user
decision needed. An urgent hold blocks approval,
[merge-ready declarations](#authored-mode-own-pr), and
dependent dangerous actions, but does not block safe investigation, unrelated
work, or reporting validated risk as `REQUEST_CHANGES`. Disagreement and
silence leave the hold open.

This escalation exists only in prompts and briefs; no runtime component
enforces it. Raise the hold in the T3 driver thread and end the turn parked on
the user's decision. Silence leaves the hold open. Use no private escalation script.

Under a manager PR job, apply Peer mode's serious security/funds threshold.
A qualifying credible serious risk found by a reviewer raises the
standing internal prompt and dependent-action hold immediately in the compact
run record and a durable GitHub or user-owned conversation. The manager pass
follows [flag and alert](../axstack/references/automations.md#exceptional-decisions-and-notifications)
for its own thread; silence never authorizes action.

## Publishing rule

Mode-required exact-revision completeness gates external approval,
[merge-ready declarations](#authored-mode-own-pr), and authorized submission. It never gates returning
evidence, limitations, validated risk, or an internal `INCOMPLETE` report.

- Peer mode requires its mode-specific first-review receipts or single primary follow-up receipt under
  Peer mode, with validated blockers reported by `REQUEST_CHANGES`; diligence
  is excluded.
- Authored mode requires exactly its mode-required count of current eligible configured reviewer receipts and
  a separate current diligence receipt; applicable scope identity must remain valid.
- A missing, mismatched, stale, or materially changed input blocks approval and
  merge-ready declarations while readonly investigation continues.

The recorded owning watch thread applies watch §5's guarded merge and card rules.
Review approval alone never supplies merge authority. Peer PRs stay user-merged.
User merges are bottom-up for a stack.

## Report-only scope

For PR modes, report-only writes nothing to GitHub: no review submission,
reply, mutation, or merge action. Codebase mode follows its own report rule.

Record an internal verdict (`APPROVE`, `REQUEST_CHANGES`, or
`INCOMPLETE`) with evidence, coverage, and limitations. The persistent owner
consolidates the mode-required receipts; the current driver presents that
report without declaring approval or merge-ready status.

This output is complete when the report identifies the exact candidate,
verdict, evidence, coverage, limitations, and unresolved findings, with no
external write.

## Authorized submission (peer review)

Submit a consolidated peer review only within explicit user authority and only
for a complete `APPROVE` or `REQUEST_CHANGES` verdict:

1. Read back the remote head and base; stop if either differs from the reviewed
   candidate.
2. Bind the submission to the actual GitHub commit parameter for that revision;
   SHA text in prose is not binding.
3. Publish the owner-synthesized review with the mode-required peer receipts as evidence,
   then verify the submission receipt.
4. If submission is ambiguous, lookup before retry: read remote state and
   submit only when absent. Never resubmit blindly.

Submission is complete only when the remote receipt confirms the review bound
to the intended commit.

## Automation exception

For a peer PR selected under
[Native PR managers](../axstack/references/automations.md), apply the same
complete-review and exact-commit requirements, using Peer mode's first/follow-up
review shape, blocking bar, output limits and five-request adviser cap. Count
existing bot verdict markers across heads before publishing `REQUEST_CHANGES`;
a would-be sixth takes the panel path before submission. A serious-risk escalation holds
submission at its durable decision location. Otherwise `APPROVE` requires
no validated blocker and `REQUEST_CHANGES` requires at least one evidenced
validated blocker. `INCOMPLETE`, unavailable inputs, unresolved disagreement,
or unknown GitHub state submits nothing.

Immediately before `gh pr review`, re-read self's reviews at the head.
Never resubmit an identical verdict at the same head. Record the existing
review id for such duplicates. Publish a changed peer verdict at the same head
only when a new event (author reply, PR comment or review re-request) changes
the disposition. A newly accepted explanation can turn same-head
`REQUEST_CHANGES` into `APPROVE`. Count every same-head `REQUEST_CHANGES`
submission toward the five-request cap.

Before every submission, re-check head, base, draft status, authorship, and
allowlist, bind the verdict to the exact commit parameter, and end the body
with this marker line:

```text
<!-- axstack-automation verdict head=<sha> -->
```

After submission, read back and record the review id at the bound head. An
ambiguous result is looked up before any retry. The automation never submits a
`COMMENT` review.
