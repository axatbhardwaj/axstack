# Design lens

In Align, set the rung from researched facts, not a user choice. Carry the
sketch through the scope identity.

## Ladder

- **Rung 0 — skip.** The change stays inside one module's existing interface,
  ownership, data flow, and failure guarantees. Ask no design questions and
  carry no sketch. “Might be small” is not a reason to skip.
- **Rung 1 — design questions.** Any change that fails Rung 0. Typical triggers:
  crossing a module boundary; adding a module, service, interface, or external
  dependency; changing an interface or failure guarantee; changing data
  ownership, schema, wire format, or persisted format. A design question does
  not reclassify work: Rung 1 can stay small. An unsettled material design
  question still makes routing reassess size.
- **Rung 2 — arena.** A Rung 1 design that also meets the existing ADR test:
  a meaningful, hard-to-reverse, non-obvious trade-off. Use Align's all-family
  arena for that question.

There is no numeric threshold, file-count gate, or class-count gate.

## Questions in order

Ask only unresolved areas in numbered `Qn` rounds of one to three. Give each a
recommendation, reason, and trade-off; use Align's adviser critique. Design and
arena questions share its unchanged budget: 20 normally, a justified extension
to 35, then opted-in refinement of at most five.

1. **Scope:** What exists, the minimum change, and what is explicitly excluded?
2. **Caller first:** Write realistic usage before drawing the shape.
3. **Shape:** Which boundaries, module depth, ownership, invariants, seams,
   and adapters serve that usage?
4. **Flow and failure:** Trace the data flow. For each materially new path,
   name one realistic production failure and its observable behavior.
5. **Reversibility:** Name compatibility, migration, rejected alternatives, and
   what we accept for what benefit.

## Vocabulary and red flags

A **deep module** hides substantial behavior behind a small interface. A
**shallow module** exposes most of its machinery. Treat an **interface as test
surface**: test caller behavior and observable failures. A **seam** permits a
second implementation; one adapter is hypothetical, two make it real. Prefer
**locality** and explicit **ownership** of state and invariants. The **deletion
test** asks what contract would be lost if a layer vanished. Choose **boring by
default** and **reversible over clever**.

Red flags—shallow module, information leakage, temporal decomposition, and
pass-through layers—are prompts for evidence, not automatic defects. Ask what
crosses each boundary and whether a layer can be removed.

## Sketch

For Rung 1 or 2, put this block in the spec's `Design` section or the returned
small-change intent. `Binding` names commitments; other lines may illustrate.

```text
Usage: <call site or command as the caller writes it>
Shape: <signatures or a <=10-line ASCII/Mermaid diagram>
Binding: <which lines are committed; the rest is illustrative>
Flow + failure: <path -> one realistic failure -> observable behavior>
We accept: <X> for <Y>
Rejected: <alternative -> why>
Open: <question?>
```

Keep settled choices in `Decisions` rows. `CONTEXT.md` stays a glossary; ADRs
keep their existing test. Add no design document or phase.

## Arena rubric candidates

For each arena, the driver selects three to six and tailors the rubric criteria
to the question. Score candidate designs on evidence, not a generic checklist:

- Is `Usage` realistic and simple for the caller?
- Are module boundaries deep enough and ownership unambiguous?
- Is behavior local with a useful test surface?
- Are materially new failure paths observable and recoverable?
- Are compatibility, migration, and deletion costs explicit?
- Does the trade-off justify complexity against rejected options?
