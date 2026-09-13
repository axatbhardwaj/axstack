---
name: axstack-review
description: Exactly two independent Sol and Opus final reviewers, same six-angle brief, prompt-only urgent escalation.
---

# Review

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)

## Two-reviewer contract (exact)

Each PR owner launches exactly two independent final reviewers — Sol and
Opus by default — with the same instantiated scope, spec, ticket, base,
candidate revision, exclusions, and review instructions. Neither reviewer
reads the other's initial findings, and neither creates children. The PR
owner is never its own independent reviewer. Authoring disqualifies a
session from reviewing that candidate; the same model family in a fresh
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

Reviewers verify executable evidence of spec and ticket acceptance, the
affected integration boundary, and rendered interaction evidence for UI work
where relevant. Unverified boundaries are reported as limitations, never
implied as covered. A test passing is not enough if it checks the wrong
behavior; seeded regressions and inadequate checks must be called out.

## Findings and re-review

Reviewers report concrete evidence and consequences, coverage, limitations,
and findings tied to the candidate. No finding quota. The owner verifies
findings, reconciles contradictions with focused checks, and returns
accepted fixes to the author. Unresolved material disagreement means
incomplete review; votes do not settle correctness.

Changed code requires a refreshed receipt for the new revision: reuse
unchanged evidence and review the delta plus affected behavior when
sufficient; bigger scope, base, or behavior changes require broader review.

## Template: candidate review brief

```text
Candidate: <PR URL> rev <sha> (immutable checkout)
Scope: <spec rev + ticket + base + exclusions>
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

## Publishing rule

Confirm the approved spec identity first: a missing baseline, or a
materially changed and unaccepted one, blocks approval and merge-ready
declarations, while read-only investigation may proceed. Declaring
merge-ready then requires current verified receipts from both
reviewers for the exact candidate revision: each shows verdict APPROVE with
its candidate SHA, coverage, and limitations, and no material finding
remains unresolved. The owner synthesizes both reviews into the decision
without voting — a single receipt can never satisfy the exactly-two
requirement. An open urgent hold blocks any declaration. Neither reviewer
unanimity nor passing tests grants merge authority; the human merges.

## Prompt-only urgent escalation

Credible serious security issues, possible downtime or data loss, and major
design concerns are raised immediately — do not wait for the second
reviewer or consensus. Hold approval, merge-ready declarations, and
dependent dangerous actions (not merge alone) while presenting evidence,
likely impact, options, and the needed user decision. Safe investigation
and unrelated work may continue. Disagreement or silence is not permission.

This is an instruction, not a programmatic gate, hook, or decision engine.
The Hermes bot relay is an optional configured notification route respecting
its existing authorization; Paseo chat is the fallback. If Hermes delivery
fails, deliver the same escalation content concretely via Paseo chat.
Failed delivery never resolves the concern. Public installations must not
inherit private host paths, recipients, credentials, or relay configuration.
