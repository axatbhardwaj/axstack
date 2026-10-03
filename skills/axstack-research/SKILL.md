---
name: axstack-research
description: When one bounded question needs verified answers, use axstack-research to produce a source-linked note with limitations.
---

# Research

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.

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

2. **Fan out research:** A single factual lookup stays in the current chat.
   Every other research run dispatches every configured research branch through
   T3 `delegate_task`: requirements, code, and web (Sonnet high in mixed/claude-only;
   Codex in codex-only), web-google (Gemini/Antigravity, with Google Search
   built in), and X (Grok).
   Give each branch one owner, allow no cross-reading, and require a cited note
   with a URL and access date per claim; re-open sources and never trust a search
   summary. The driver reconciles agreements/disagreements per claim.
   An unconfigured branch is recorded as intentionally absent. A configured
   optional branch that malfunctions (launch failure, trust/login prompt, or
   prompt block) is fenced, recorded `absent (<reason>)`,
   named once in the next read-back, then skipped without relay or substitution;
   continue with available branches. Required branches hold their affected work.
   These routes are data presets, not proof of live readiness; before dispatch,
   follow the [T3 runtime boundary](../axstack/references/t3-runtime.md),
   confirm availability, and keep implementation out of every branch:

   - `axstack-research-requirements`: requirements and intent.
   - `axstack-research-code`: code behavior.
   - `axstack-research-code-sol`: independent Sol code investigation.
   - `axstack-research-web`: web and external sources.
   - `axstack-research-web-google`: Google-Search-grounded web sources via Gemini/Antigravity.
   - `axstack-research-x`: X (Twitter) posts and threads via Grok; cite post URLs and dates.
   - `axstack-explore-codebase`: broad codebase mapping.
   - `axstack-explore-execution`: execution and runtime traces.
   - `axstack-explore-execution-sol`: independent Sol execution investigation.

   When dispatching `axstack-research-code` or `axstack-explore-execution`,
   dispatch its `-sol` pair independently on the same bounded brief without
   cross-reading. The driver reconciles agreement and disagreement per claim,
   never averaging findings. Record an intentionally absent pair and proceed
   with the base seat alone. The `-sol` pair is optional: fence a launch failure,
   trust/login prompt, or prompt block; record `absent (<reason>)`, and continue
   with the base seat. In mixed fan-out,
   retain a Codex and a Claude seat or hold the affected fan-out.

3. **Gather primary source evidence.** Inspect the actual documentation, code,
   or tool output for every answer-changing claim. Apply the source standards
   for citations, freshness, revisions, and access dates. Continue until each
   material claim has direct evidence or a named evidence gap.
   Before the driver folds verified claims, dispatch `axstack-diligence` under
   [Diligence](../axstack/references/diligence.md) to reopen cited sources for
   answer-changing claims and flag mismatches.

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
