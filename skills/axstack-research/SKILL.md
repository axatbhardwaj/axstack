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
   For other runs, dispatch through T3 `delegate_task` only branches whose
   source class (requirements, code, execution, web, X) an open answer-changing claim needs.
   Dispatch requirements only when scope is unclear.
   Dispatch execution when a claim depends on runtime behavior.
   Dispatch X only when a claim depends on X posts.
   Record each skipped branch as `not needed (<reason>)`.
   For each needed source class, retain two isolated branches where configured.
   In mixed, each needed source class retains branches from different providers.
   The code pair is `axstack-research-code` +
   `axstack-research-code-sol`.
   In mixed the web pair is `axstack-research-web` +
   `axstack-research-web-sol` (Terra high);
   the execution pair is `axstack-explore-execution` +
   `axstack-explore-execution-sol`. Requirements, code, and web use Sonnet high
   in mixed/claude-only and Codex in codex-only; X uses Grok.
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
   - `axstack-research-code-sol`: independent code investigation (Terra high in mixed, Sol high in codex-only).
   - `axstack-research-web`: web and external sources.
   - `axstack-research-web-sol`: independent Terra high web reader in mixed; intentionally absent in both single-provider presets.
   - `axstack-research-x`: X (Twitter) posts and threads via Grok; cite post URLs and dates.
   - For broad codebase mapping, use `axstack-scout`.
     Never dispatch `axstack-explore-codebase` directly for broad mapping.
   - `axstack-explore-execution`: execution and runtime traces.
   - `axstack-explore-execution-sol`: independent execution investigation (Terra high in mixed, Sol high in codex-only).

   When dispatching `axstack-research-web`, `axstack-research-code` or `axstack-explore-execution`,
   dispatch its `-sol` pair independently on the same bounded brief without
   cross-reading. The driver reconciles agreement and disagreement per claim,
   never averaging findings. Record an intentionally absent pair and proceed
   with the base seat alone. The `-sol` pair is optional: fence a launch failure,
   trust/login prompt, or prompt block; record `absent (<reason>)`, and continue
   with the base seat. A sized mixed research fan-out requires dispatched
   branches spanning at least two different providers; otherwise hold that fan-out.
   Every other mixed fan-out, including arena and peer review, retains at least one
   Codex and one Claude seat; otherwise hold that fan-out.

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
