---
name: axstack-align
description: When exploring or planning engineering work, use axstack-align to settle scope, decisions, and its execution boundary.
---

# Align

Leave the work with settled scope, explicit exclusions, and the proportional
identity its next phase requires. Stop before execution.

Load before acting:

- [Standing contracts](../axstack/references/contracts.md)

This preserves the required contracts -> lifecycle -> audit load edge.

## Settle the frontier

1. **Research and map dependencies.** Inspect the available code, docs, and
   tools before asking the user. Separate facts from preferences, name evidence
   gaps, and map which decisions unlock others. Unresolved research blocks only
   its dependent branch while safe fact work and independent branches continue.
2. **Prioritize the ready frontier.** Rank questions whose prerequisites are
   settled by consequence, uncertainty, and the branches they unlock. Probe
   vague terms, assumptions, success criteria, exclusions, failures, and edge
   scenarios without using a fixed questionnaire or padding the interview. An
   empty ready frontier means completion only when no material choice remains;
   otherwise report the blocking research and continue safe fact work.
3. **Ask a focused round.** Present one to three independent questions; present
   one alone when it is complex or governs dependent branches. Number questions
   cumulatively as `Q1`, `Q2`, and so on. Recommend a choice for each with a
   short reason and trade-off, then wait for the user's answers and recompute
   the frontier. The user owns preferences and decisions unless they explicitly
   delegate them; agents research facts.
4. **Preserve settled decisions.** Carry them across phases and resumes.
   Reopen one only when material new evidence changes it; otherwise restate it
   and proceed. Every reopened decision names the evidence that invalidated it.

## Consult on consequential decisions

The current chat remains the driver; never auto-launch a preferred profile.
For each new user round, the driver independently drafts the prioritized
frontier and recommendations, then uses the configured persistent
`axstack-advisor` under [Standing contracts](../axstack/references/contracts.md).
The advisor challenges assumptions, edges, omissions, and alternatives; the driver responds
and accepts or rejects each material point with a reason. Use one focused reply
when material disagreement remains, then surface the choices to the user. Never
fabricate consensus or impersonate either role.

Immediately before the first actual advisor dispatch, load and follow
[Orca runtime](../axstack/references/orca-runtime.md). Reuse the advisor session
and settled receipts; consult only the changed frontier. Record compact advisor
evidence, the driver's assessment, and user-resolved choices for `axstack-spec`.
If the configured model is unavailable, pause the affected interview and ask
the user; safe fact work may continue without substitution.

## Bound the interview

Twenty cumulative presented questions is the normal ceiling, not a target.
Follow-ups, reopened questions, and separate decisions bundled into one prompt
each count; never discount a presented question later. Before extending beyond
20, name the material gaps and why they require more questions. Reserve the
remaining budget for the highest-value branches and never exceed 35 questions
in the initial pass. Stop earlier as soon as no unresolved material choice
remains; 20 is not a quota.

At completion or the 35-question cap, read back the result and ask whether the
user wants deeper refinement. Ask no further interview or refinement questions
without opt-in; this does not replace required spec approval or a clarification
prompt when a configured model is unavailable. An opted-in refinement names
one area and a separate finite budget of at most five questions; it preserves
the initial count and settled answers and cannot roll into another automatic
extension. Declining or silence does not settle an open blocker. If the user
stops early, return a partial handoff naming unresolved items and do not claim
readiness or begin execution.

## Document settled understanding

Discover existing `CONTEXT-MAP.md`, `CONTEXT.md`, and ADR conventions once per
run and use the relevant context. If none exist, default to a glossary in
`CONTEXT.md` and ADRs under `docs/adr/`; create either only when useful. Within
authorized local planning docs, record canonical domain terms as answers settle
without putting implementation detail in the glossary, and keep observed facts
distinct from desired behavior. A still-open related architecture choice
remains explicitly unresolved.

Use an ADR only for a meaningful, hard-to-reverse, non-obvious trade-off. Keep
it Proposed until the applicable approval, and preserve accepted history by
superseding rather than rewriting it. Routine decisions belong in the run
record or spec. Read-only scope keeps proposed documentation in the permitted
private record or response. Documentation is neither implementation nor spec
approval; record chosen document names and paths once per run.

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
3. Record substantive or resumable preparation through the
   [shared lifecycle](../axstack/references/lifecycle.md) and
   [run record](../axstack/references/run-record.md). Persist the question count,
   settled, open, and deferred branches, compact round advisor receipts, and
   documentation pointers without adding another runtime. Return the compact
   scope and record pointer in the current chat. Native transfer is separate:
   use it only when the user explicitly requests transfer, loading
   [Orca runtime](../axstack/references/orca-runtime.md) immediately before
   actual dispatch. Alignment completion never dispatches a recipient.

Alignment stops for both sizes only when the handoff is usable, its next scope
identity is explicit, and execution has not started. The user invokes `axstack`
to execute.
