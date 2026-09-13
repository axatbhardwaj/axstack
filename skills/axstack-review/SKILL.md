---
name: axstack-review
description: Exactly two independent Sol and Opus final reviewers, same six-angle brief, prompt-only urgent escalation.
---

# Review

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)
- [Shared routing](../axstack/references/routing.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)

## Peer mode (colleague PR)

The PR description, linked issue, and repository requirements are the
review intent. Peer review demands no Axstack-created approved spec and
never blocks read-only investigation on a missing baseline. Missing or
contradictory intent makes requirements coverage incomplete: report the
gap as a limitation, never imply it as covered. Peer code stays
readonly; the reviewer never edits it.

## Authored mode (own PR)

Retains the approved baseline from `axstack-spec`: confirm the approved
spec identity before approval or merge-ready declarations. An existing
PR adopted for maintenance records its accepted maintenance scope
snapshot once — linked issue, acceptance criteria, actual head/base,
current ownership — and that snapshot is accepted without repeated
approval.

## Two-reviewer contract (exact)

Each PR owner launches exactly two independent final reviewers — Sol and
Opus by default — with the same instantiated scope, spec or linked
intent, ticket, base, candidate revision, exclusions, and review
instructions. Neither reviewer reads the other's initial findings (no
first-pass cross-read), and neither creates children. The PR owner is
never its own independent reviewer. Authoring disqualifies a session
from reviewing that candidate; the same model family in a fresh
non-author session is allowed. Materialize reviewers via
[Paseo launch](../axstack/references/paseo-launch.md): the Opus reviewer is
a claude session, the Sol reviewer a codex session. Reuse a reviewer
session for a checkpoint only when it is a non-author session with
unchanged or revalidated scope and evidence under the same instantiated
brief, recording checkpoint scope in the receipt; otherwise launch a new
session.

Both reviewers cover all six angles:

1. Security and trust boundaries.
2. Correctness, failures, and edge cases.
3. Integration and regressions.
4. Requirements, acceptance, and user behavior.
5. Architecture and solution design, including SOLID and credible simpler alternatives.
6. Simplicity and maintainability: KISS, YAGNI, cyclomatic complexity where measurement is useful. Never invent a metric or demand abstractions to satisfy a principle.

## Evidence bar

Reviewers verify executable evidence of spec (or linked intent) and
ticket acceptance, the affected integration boundary, and rendered
interaction evidence for UI work where relevant. Unverified boundaries
are reported as limitations, never implied as covered. A test passing
is not enough if it checks the wrong behavior; seeded regressions and
inadequate checks must be called out.

## Findings and re-review

Reviewers report concrete evidence and consequences, coverage, limitations,
and findings tied to the candidate. No finding quota. The owner verifies
findings, reconciles contradictions with focused checks, and validates
them without voting: unresolved material disagreement means incomplete
review, and votes do not settle correctness. Accepted fixes return to
the author.

Changed code requires a refreshed receipt for the new revision: reuse
unchanged evidence and review the delta plus affected behavior when
sufficient; bigger scope, base, or behavior changes require broader review.

## Template: candidate review brief

```text
Candidate: <PR URL> rev <sha> (immutable checkout)
Scope: <spec rev or linked issue + ticket + base + exclusions>
Angles: <all six, same brief for both reviewers>
```

## Template: review receipt (one block per revision)

```text
Reviewer: <Sol | Opus> session <id> rev <candidate sha>
Verdict: <APPROVE | REQUEST_CHANGES | INCOMPLETE>
Coverage: <angles covered + executable evidence checked>
Limitations: <unverified boundaries + why>
Findings: <evidence + consequence each>
```

## Standalone owner

Standalone peer review or watch adoption materializes `axstack-owner`
via [Paseo launch](../axstack/references/paseo-launch.md); reuse the
existing owner where live. The current chat stays out of coordination
once the owner exists — no competing coordinator. Only the owner
launches the writer, reviewers, monitor, and watchdog. Workers launch
no recursive teams and create no children.

## Completeness before verdict (not dual-APPROVE gate)

Internal review completeness is separate from the recommendation:

- Complete: current verified receipts from both reviewers for the exact
  candidate revision, with coverage and limitations recorded. Validated
  blocking defects permit verdict REQUEST_CHANGES; no blockers with
  complete evidence permits verdict APPROVE.
- Incomplete or stale: verdict INCOMPLETE — never fabricate APPROVE or
  REQUEST_CHANGES, and submit nothing.

An open urgent hold blocks APPROVE declarations and dangerous actions
(push, replies, merge) but never blocks reporting validated risk as
REQUEST_CHANGES.

## Publishing rule

Peer mode: declarations need a complete review for the exact candidate
revision per the rule above, with no material finding unresolved except
the validated defects a REQUEST_CHANGES reports. Authored mode
additionally confirms the approved spec identity first: a missing
baseline, or a materially changed and unaccepted one, blocks approval
and merge-ready declarations, while read-only investigation may
proceed. The owner synthesizes both reviews into the decision without
voting — a single receipt can never satisfy the exactly-two
requirement. Neither reviewer unanimity nor passing tests grants merge
authority; the human merges.

## Report-only scope

An explicit report-only scope writes nothing to GitHub: no review
submission, no reply, no mutation, no merge action. It still records an
internal verdict (APPROVE, REQUEST_CHANGES, or INCOMPLETE) with
evidence, coverage, and limitations, synthesized in the current driver
chat — declaring neither approval nor merge-ready status.

## Authorized submission (peer review)

Submit the consolidated peer review only within user authority, and only
for a complete review with verdict APPROVE or REQUEST_CHANGES:

1. Confirm fresh remote head and base are unchanged for the exact
   candidate revision (exact-head readback).
2. Bind the submission to the actual GitHub commit parameter for that
   revision — SHA text in prose alone is not binding.
3. Publish the consolidated review (owner-synthesized, both receipts
   attached as evidence), then verify the submission receipt.
4. On ambiguous submission (unknown whether it landed), lookup before
   retry: read back remote state and submit only if absent. Never
   resubmit blindly; the operation stays idempotent.

## Prompt-only urgent escalation

Credible serious security issues, possible downtime or data loss, and major
design concerns are raised immediately — do not wait for the second
reviewer or consensus. Hold approval, merge-ready declarations, and
dependent dangerous actions (not merge alone) while presenting evidence,
likely impact, options, and the needed user decision. Safe investigation
and unrelated work may continue. Disagreement or silence is not permission.

These stay written instructions carried in prompts and briefs; nothing
here runs on its own. The Hermes bot relay is an optional configured
notification route respecting its existing authorization; Paseo chat is
the concrete fallback. If Hermes delivery fails, deliver the same
escalation content via Paseo chat. Failed delivery never resolves the
concern. No private script carries escalation. Public installations must
not inherit private host paths, recipients, credentials, or relay
configuration.
