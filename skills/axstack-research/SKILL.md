---
name: axstack-research
description: When one bounded question needs verified answers, use axstack-research to produce a source-linked note with limitations.
---

# Research

Produce a source-linked Markdown note that answers one bounded question and
makes every evidentiary gap visible.

Before researching, load [Standing contracts](../axstack/references/contracts.md)
and the lifecycle it requires, then read the
[source standards](references/checklist.md).

This skill is independently callable. A research-only run needs no spec
baseline, ticket map, or author pipeline. Keep it read-only unless requested
and separately authorized to change product code or publish; otherwise, neither
is part of research.

## Procedure

1. **Frame the question.** Restate the question, what is in scope, what is
   excluded, and which claims could change the answer. Keep one bounded
   question in one run; separate only genuinely independent questions. Start
   gathering evidence only after the target and stopping boundary are explicit.

2. **Choose the smallest route.** Handle a single factual lookup directly in
   the current chat. Use a profile only when its specialization or independent
   work is useful. Before an actual dispatch, read and follow the
   [Paseo launch sequence](../axstack/references/paseo-launch.md). Give each
   research branch one owner; keep implementation out of every branch.

   These routes are data presets, not proof of live readiness. Confirm profile
   availability through the shared launch sequence:

   - `axstack-research-requirements`: requirements and intent.
   - `axstack-research-code`: code behavior.
   - `axstack-research-web`: web and external sources.
   - `axstack-explore-codebase`: broad codebase mapping.
   - `axstack-explore-execution`: execution and runtime traces.

3. **Gather primary source evidence.** Inspect the actual documentation, code,
   or tool output for every answer-changing claim. Apply the source standards
   for citations, freshness, revisions, and access dates. Continue until each
   material claim has direct evidence or a named evidence gap.

4. **Form the verdict.** Mark every material claim as **verified**,
   **inference**, or **unverified** using the source standards. Derive
   inferences only from cited verified facts. A finished verdict leaves no
   inference or unchecked claim presented as verified.

5. **Deliver and stop.** Save or return the requested Markdown artifact with
   the question, bounds, source-linked claims and labels, verdict, and explicit
   limitations. Apply the audit hook required by the shared lifecycle when the
   run is substantive. Once the artifact is recheckable, stop: no spec, tickets,
   implementation, publication, or follow-on workflow starts without separate
   authority.
