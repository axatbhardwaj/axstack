---
name: axstack-review
description: Exactly two independent Sol and Opus final reviewers, same six-angle brief, prompt-only urgent escalation.
---

# Review

## Two-reviewer contract (exact)

Each PR owner launches exactly two independent final reviewers — Sol and
Opus by default — with the same instantiated scope, spec, ticket, base,
candidate revision, exclusions, and review instructions. Neither reviewer
reads the other's initial findings, and neither creates children. The PR
owner is never its own independent reviewer. Authoring disqualifies a
session from reviewing that candidate; the same model family in a fresh
non-author session is allowed. Reuse eligible reviewer sessions for
checkpoints where evidence and scope allow.

Both reviewers cover all six angles:

1. Security and trust boundaries.
2. Correctness, failures, and edge cases.
3. Integration and regressions.
4. Requirements, acceptance, and user behavior.
5. Architecture and solution design, including SOLID and credible simpler alternatives.
6. Simplicity and maintainability: KISS, YAGNI, cyclomatic complexity where measurement is useful. Never invent a metric or demand abstractions to satisfy a principle.

## Findings and re-review

Reviewers report concrete evidence and consequences, coverage, limitations,
and findings tied to the candidate. No finding quota. The owner verifies
findings, reconciles contradictions with focused checks, and returns
accepted fixes to the author. Unresolved material disagreement means
incomplete review; votes do not settle correctness. Changes require a
refreshed review receipt for the new revision; reuse unchanged evidence and
review the delta plus affected behavior when sufficient.

## Template: candidate review brief

```text
Candidate: <PR URL> rev <sha> (immutable checkout)
Scope: <spec rev + ticket + base + exclusions>
Angles: <all six, same brief for both reviewers>
```

## Template: review evidence

```text
Reviewer: <Sol | Opus> session <id> rev <sha>
Coverage: <angles covered + limits>
Findings: <evidence + consequence each>
Verdict: <blocking | non-blocking> (no merge authority)
```

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
