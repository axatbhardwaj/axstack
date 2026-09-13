---
name: axstack-audit
description: Readonly run audits with evidenced metrics and a bounded proposal loop — tested reviewed PRs, human merges.
---

# Audit

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)
- [Audit record schema](references/record.md)

Core invokes the `axstack-auditor` profile (codex/gpt-5.6-luna max) at run end and at meaningful checkpoints; that profile and its invocation are core-owned. This skill defines what the auditor may read, measure, and propose. The user-chose mode is fixed: propose a tested, reviewed PR; human merges.

## Role: non-author reader

The auditor is a non-author reader: readonly over the run except for writing the assigned audit artifact. It makes no edits to product, skills, or config and launches no child sessions.

## What the auditor inspects

Actual records, never memory: the approved spec or the accepted peer, research, or maintenance scope; the decision log and Fable receipts; git revisions; test and review evidence; and the run execution record.

## Cadence

Enabled for every substantive run by default. Run a checkpoint after a material deviation or repair pattern when useful. Reuses prior audit evidence instead of repeated whole-run rescans. A routine small lookup may end with a compact audit record, and the auditor never forces the full implementation pipeline for research. No extra daemon, timer, or analytics service is created.

## Metrics with denominators

Every metric carries counts with denominators plus its evidence, following the [audit record schema](references/record.md):

- Acceptance criteria passed, failed, and unverified, each traced to its tests plus SHA.
- Planned steps completed and deviated, each deviation with why and approval.
- Fable coverage across spec creation, spec revision, design, and consequential decisions, under the broader rule rather than an unresolved-only trigger.
- TDD red-green proof, or recorded noncompliance where the proof is absent.
- Independent exact-revision review status and unresolved findings.
- Rework cycles with causes.
- Avoidable user interventions where records support the call, and no call where they do not.
- Parallelizable tasks identified versus dispatched, judged with dependency and writer isolation.
- Actual model, tool, time, token, and cost figures when provider receipts are available, unknown otherwise.

Distinguish execution outcome, procedural adherence, and measurement coverage as three separate judgments. The auditor never counts missing evidence as a pass and never collapses gaps into a vanity score. Parallelism is preferred for independent decomposable work, and is never gamed by spawning needless agents.

## Proposal loop

Each proposal carries observed failure or inefficiency, root cause with evidence and counterevidence, and a bounded hypothesized skill change. The change earns a regression scenario first, then an unchanged holdout evaluation, with cost and quality comparison when measured. The auditor suggests; the driver arranges the authorized author and independent review, and delivery is a reviewed PR with human merge. The loop borrows one structural principle from the public hermes-agent-self-evolution project (https://github.com/NousResearch/hermes-agent-self-evolution) — it separates evaluation data, candidate changes, and validation — re-expressed here as original Axstack workflow with no outside dependency and no extra frameworks to install.

## Prohibitions and privacy

No self-edit. No changing acceptance criteria or metrics after failures. No external transmission of raw traces. No hidden per-user memory mutation. No automatic merge or activation. Run artifacts stay local and private by default; sanitized summaries leave the run only when authorized. Compare compatible runs only and qualify causality: report what the evidence supports, not what it suggests.
