## Arena

Every brainstorm runs a light arena. At Rung 1, the driver scores, picks and
grafts without a judge round. Only at Rung 2, run the judge rounds below for
hard-to-reverse choices; they replace the critique round for that question.

1. **Frame.** The driver writes the brief (the artifact, its constraints, the
   settled decisions it must respect) and three to six gradeable rubric
   criteria. Every brief requires a premise check and comparison with the
   smallest change and doing nothing. The rubric uses agent-contributor red
   flags as evidence prompts: seeing only opened files, copying the nearest
   example, taking the shortest path that compiles. Treat them as prompts, not defects. Candidates receive only the brief; the rubric is for judging.
2. **Fan out.** Produce one candidate per configured family independently from the same brief,
   without cross-reading: `axstack-advisor-astra`, `axstack-advisor-opus`,
   `axstack-arena-candidate-grok`, and `axstack-arena-candidate-antigravity`.
   Each gives a design, rationale, and rejected alternatives. The driver authors no candidate.
   The driver drafts no recommendation until every candidate returns.
3. **Cross-judge (Rung 2 only).** After every candidate completes, give round 1 judge
   `axstack-arena-judge-opus` the anonymized, relabeled candidates and rubric to
   score every candidate per criterion and recommend a base with a reason.
   The driver compares its own pick with the Opus verdict. Only if the driver
   and the Opus judge disagree on the base, or the caller re-invokes with the user's rejection of the round-1
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
6. **Present.** Return the synthesized design to the caller with its
   trade-off, judge verdicts per round, and what was grafted or rejected.
   The user still decides; spec approval remains the one human checkpoint.

Record the synthesis note (base, grafts and their source candidate, rejections,
dropouts, judge verdicts per round) as `Decisions` rows in the
[run record](../../axstack/references/run-record.md). Load
[T3 runtime](../../axstack/references/t3-runtime.md) immediately before the
first candidate or judge dispatch. If an optional Grok or Antigravity candidate
malfunctions (launch failure, trust/login prompt, or prompt block), fence it,
record `absent (<reason>)`, name it once in the next
read-back, and continue with available candidates without relay or substitution.
A required adviser, candidate, or judge needed for this rung unavailable at
launch or returning a failed receipt holds that question without substitution;
record the gap and return a proposed question to the caller about whether to proceed. In mixed fan-out retain at least one Codex and one Claude
seat, or hold the affected question.
For an uncertain dispatch, reconcile natively; it is never treated as absent.
Unaffected fact work and questions continue.
