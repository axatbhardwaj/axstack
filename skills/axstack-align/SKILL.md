---
name: axstack-align
description: When exploring or planning engineering work, use axstack-align to settle scope, decisions, and its execution boundary.
---

# Align

For authorized delivery runs, follow [Autopilot](../axstack/references/autopilot.md)
for phase continuation and holds.

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.

Leave the work with settled scope, explicit exclusions, and the proportional
identity its next phase requires. Stop before execution.

Load before acting:

- [Standing contracts](../axstack/references/contracts.md)

This preserves the required contracts -> lifecycle -> audit load edge.

## Design the shape

Set the rung from researched facts; never ask the user to choose it. A change
inside one module's existing interface, ownership, data flow, and failure
guarantees is Rung 0: no design questions or sketch. Otherwise load the
[design lens ladder](../axstack/references/design-lens.md) for Rung 1 or 2
and settle only unresolved areas in its order within the existing budget. Carry a
Rung 1 or 2 sketch in the substantial spec's `Design` section or the returned
small-change intent. A design question alone does not make small work
substantial; apply routing's existing size reassessment rule.

## Settle the frontier

1. **Research and map dependencies.** Inspect the available code, docs, and
   tools before asking the user. Separate facts from preferences, name evidence
   gaps, and map which decisions unlock others. When a fact needed for the
   frontier is not derivable from the local repo or docs by ordinary reading,
   dispatch `axstack-research` branches through Orca by source type:
   requirements, code, web, and, once configured, X. Give one owner per branch,
   use cross-harness routes where the roles allow, and require a cited note per
   the research skill's source standards. The driver folds verified claims into
   the frontier and records the receipts. Ordinary reading stays in-chat; a
   single factual lookup never dispatches. Unresolved research blocks only its
   dependent branch while safe fact work and independent branches continue.
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

The current chat remains the driver under
[Standing contracts](../axstack/references/contracts.md). For each new
user round, the driver independently drafts the prioritized frontier and
recommendations, except for an arena-grade question (below), where the driver
writes the brief and rubric but drafts no recommendation until the candidates
and judge verdicts return, so nothing anchors them. Then consult `axstack-advisor-astra` and
`axstack-advisor-opus` independently, without cross-reading, using the same
bounded evidence and question. Each adviser challenges assumptions, edges,
omissions, and alternatives; the driver synthesizes disagreements and accepts
or rejects each material point with a reason. Use one focused reply when
material disagreement remains, then surface the choices to the user. Never
fabricate consensus or impersonate a role.

Immediately before the first actual adviser dispatch, load and follow
[Orca runtime](../axstack/references/orca-runtime.md). Reuse each adviser
session and settled receipt; consult only the changed frontier and reuse
unchanged receipts. Record compact adviser evidence, the driver's assessment,
and user-resolved choices for `axstack-spec`. If either adviser is unavailable,
hold Align; safe fact work may continue without substitution.

An optional adviser note may be deferred or rejected in a `Decisions` row with
the draft unchanged; it needs no new adviser pair. Changed draft text, a
blocking finding, or a high-stakes decision requires fresh receipts on the new
revision.

## Arena for hard-to-reverse design choices

Critique of one draft anchors every reader to that draft's shape. Rung 2 designs
alone enter the arena: they meet the same test as for an ADR (a meaningful,
hard-to-reverse, non-obvious trade-off: architecture, module boundaries, data
model, migration strategy). Replace the critique round for that question with
an arena. Small or routine questions never enter the arena.

1. **Frame.** The driver writes the brief (the artifact, its constraints, the
   settled decisions it must respect) and three to six gradeable rubric
   criteria. Candidates receive only the brief; the rubric is for judging.
2. **Fan out.** Produce one candidate per configured family independently from the same brief,
   without cross-reading: `axstack-advisor-astra`, `axstack-advisor-opus`,
   `axstack-arena-candidate-grok`, and `axstack-arena-candidate-antigravity`.
   Each gives a design, rationale, and rejected alternatives. The driver authors no candidate.
3. **Cross-judge.** After every candidate completes, give round 1 judge
   `axstack-arena-judge-opus` the anonymized, relabeled candidates and rubric to
   score every candidate per criterion and recommend a base with a reason.
   The driver compares its own pick with the Opus verdict. Only if the driver
   and the Opus judge disagree on the base, or the user rejects the round-1
   synthesis,
   run round 2 with fresh sessions: `axstack-escalation-fable` and `axstack-arena-judge-astra`
   independently score the same anonymized candidates and rubric. Judges never
   author, never cross-read each other, and never average verdicts. After round-2
   verdicts return, the driver re-picks in step 4 and re-presents in step 6.
4. **Pick.** The driver reads every candidate end to end and scores per
   criterion, not on holistic feel, then compares with the judge verdicts from
   each completed round. Agreement confirms the base. On disagreement, re-read
   the rationales and decide with a stated reason; never average verdicts or
   fabricate consensus.
5. **Graft.** Walk the losing candidates once more for the one or two ideas
   worth porting and fold them into the base by hand so the result stays
   coherent under one mental model. Convergence on the same shape is a strong
   agreement signal: adopt the consensus shape, no graft. Wide divergence
   means the frame was under-specified: reframe and rerun once, never
   average.
6. **Present.** The synthesized design is the recommendation in the next
   `Qn`, with its trade-off, judge verdicts per round, and what was grafted or rejected.
   The user still decides; spec approval remains the one human checkpoint.

Record the synthesis note (base, grafts and their source candidate, rejections,
dropouts, judge verdicts per round) as `Decisions` rows in the
[run record](../axstack/references/run-record.md). Load
[Orca runtime](../axstack/references/orca-runtime.md) immediately before the
first candidate or judge dispatch. If an optional Grok or Antigravity candidate
fails to launch, fence it, record `absent (<reason>)`, name it once in the next
read-back, and continue with available candidates without relay or substitution.
A required adviser, candidate, or judge unavailable at launch or returning a
failed receipt holds that question without substitution; record the gap and ask
whether to proceed. In mixed fan-out retain at least one Codex and one Claude
seat, or hold the affected question.
For an uncertain dispatch, reconcile natively; it is never treated as absent.
Unaffected fact work and questions continue.

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

## Read back, classify, and route

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
   settled, open, and deferred branches, compact round adviser receipts, and
   documentation pointers without adding another runtime. Return the compact
   scope and record pointer in the current chat. Native transfer is separate:
   use it only when the user explicitly requests transfer, loading
   [Orca runtime](../axstack/references/orca-runtime.md) immediately before
   actual dispatch. Alignment completion never dispatches a recipient.

Alignment completes for both sizes only when the handoff is usable and its next
scope identity is explicit. An eligible delivery run continues under Autopilot;
an explicit stop-after-Align request ends here. Substantial work continues to
Spec, and small work continues from its small-change intent to Implement.
