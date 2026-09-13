---
name: axstack-align
description: When engineering work has unclear or substantial scope decisions, use axstack-align to settle its execution boundary.
---

# Align

Leave the work with settled scope, explicit exclusions, and the proportional
identity its next phase requires. Stop before execution.

Load before acting:

- [Standing contracts](../axstack/references/contracts.md)

This preserves the required contracts -> lifecycle -> audit load edge.

## Settle the frontier

1. **Research the facts.** Inspect the available code, docs, and tools before
   asking the user. End with verified facts, named evidence gaps, and only the
   decisions or constraints the user must resolve.
2. **Close the decision frontier.** Ask the smallest set of questions that
   resolves material scope edges, trade-offs, or priorities. In each round,
   state what is already settled and recommend a choice for every open
   question. Stop asking when no unanswered choice can materially
   change scope, acceptance, design, or dependencies.
3. **Preserve settled decisions.** Carry them across phases and resumes.
   Reopen one only when material new evidence changes it; otherwise restate it
   and proceed. Every reopened decision names the evidence that invalidated it.

## Consult on consequential decisions

For spec creation or revision, solution design, and consequential decisions,
the driver forms an independent assessment and then involves the Fable advisor
under [Standing contracts](../axstack/references/contracts.md). Immediately
before actual advisor dispatch, load and follow
[Paseo launch](../axstack/references/paseo-launch.md). Cache the decision receipt
and carry it into `axstack-spec`; unchanged covered ground needs no repeat
consultation. Record the advisor evidence, driver assessment, and any
user-resolved choice. The driver owns the outcome.

## Read back, classify, and stop

1. Read back the decisions, constraints, exclusions, and remaining evidence
   gaps. For substantial work, this summary becomes part of the draft spec in
   `axstack-spec`; spec approval is the one human checkpoint. Included and
   excluded work must be distinguishable, and no open item may appear settled.
2. Classify the result with the shared
   [proportional scope identity](../axstack/references/routing.md#proportional-scope-identity):
   - For work clarified as small, return a **small-change intent** handoff with
     its acceptance checks and exclusions.
   - For substantial work, proceed through `axstack-spec` and then
     `axstack-tickets`; return an approved spec identity and a matching
     ticket map handoff. Never repeat a still-valid approval.
3. Record substantive or resumable preparation through the shared lifecycle
   and run record. Use native Paseo handoff when that capability is available;
   otherwise return the compact handoff in the current chat and report the
   capability gap without inventing a command.

Alignment stops for both sizes only when the handoff is usable, its next scope
identity is explicit, and execution has not started. The user invokes `axstack`
to execute.
