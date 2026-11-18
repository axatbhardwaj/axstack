# Readable specification format

Use the [compact example](#compact-example) as the default for substantial
drafts in the selected authoritative store. See the [Spec procedure](../SKILL.md#procedure).

## Decision brief

By default, start substantial spec drafts with a short outcome in the decision
brief, before execution details and history. Keep identity and status compact
(title, revision, status and store), with review-round history after current requirements.

- Explain the problem, why it matters and the proposed change in the opening.
- Include a concrete before/after example or flow in the opening when useful.
- State included and excluded scope in the brief.
- Surface consequential risks, trade-offs and unverified boundaries in the brief.
- Collect all decisions needed from the user in the opening, with options and
  consequences. Say when none remain.

Link consequential choices and risks to their execution requirements.

Compare considered solutions and trade-offs, and identify the proposed choice.
Cover edge cases and dependencies. Include a module or flow diagram only when
it clarifies the design.

Distinguish planning targets from engineering estimates and give each estimate's
confidence and basis. For unsized work, name missing inputs to estimate it.
Surface gaps in scope or evidence. For each open question, record the question,
accountable owner or role, why it matters, what it blocks and its needed-by date
when known.

## Execution requirements

Follow [Independent delivery](../../axstack/references/independent-delivery.md).
In execution requirements, describe each outcome with acceptance and produced
and consumed interfaces.

Group precise requirements and observable acceptance by capability, using stable
IDs where useful. Cover behavior, interfaces, data, invariants, failure cases
and validation that determine success. Put routine file-by-file task and PR
sequencing in Tickets, keeping design and rollout constraints in the spec. State
each rule once and reference it elsewhere. Technical execution detail remains
binding wherever stored, including linked detail. Human and agent views share
one authoritative specification.
Resolve brief/detail conflicts before approval.

Use scannable headings, lists or short blocks, and tables where they help comparisons.
Do not impose word caps, mandatory tables, an extra artifact or ceremony.
For small work, combine sections and keep detail needed for decisions and
execution. The readback identifies and explains the same revision.

## Evidence and history

Use this record line under [Prototype capture](prototype.md#capture).

```text
Prototype: <branch> (never-merge) | https://github.com/<owner>/<repo>/tree/<sha> | entry: <command or file> | question: <question> | verdict: <decision> (Qn)
```

Pin the author commit SHA in the tree URL.

Keep history, evidence and adviser receipts separate from current requirements.
Include or link provenance, commands, review-round dispositions and change logs
as supporting evidence. When amending a draft, update current criteria in place
and keep the change log as history. Keep approved snapshots immutable with
supersession metadata or links outside the approved bytes. Follow
[Material revisions](../SKILL.md#material-revisions) to change a baseline.

## Readability review

For readability review, verify a human can find changes, why, decisions and risks
in the opening and an implementer can find exact requirements without
reconstructing history. Check whether estimates and open questions explain timing
and dependencies. Check readability alongside completeness before the
specification checkpoint. Return unclear or conflicting passages for revision
under the existing rules.

## Compact example

```markdown
# Export the filtered view — r2, draft
Authoritative location: <selected store URL or repository path>

## Decision brief
**Outcome.** Users can download the filtered table as CSV.

**Problem.** Users clean exports by hand. Before: all rows. After: filtered rows.
Included: table CSV. Excluded: scheduled exports and new formats.

**Trade-offs.** Whole-dataset export keeps all rows but needs cleanup. Filtered
export saves cleanup but can omit expected rows. Propose filtered export (EXP-1).

**Decision needed.** Approve filtered export or keep whole-dataset export.

**Target.** Next release. **Estimate.** 2–3 engineering days, medium confidence
given filter and CSV reuse. Large exports are unverified and unsized pending
dataset sizes and memory measurements.

**Open question.** What size must work on low-memory devices? Owner: product lead.
The limit drives memory needs. Waiting for it blocks sizing larger exports.
Answer needed by release planning.

## Execution requirements
### Filtered export
Outcome: independently deliverable filtered export.
Produces: CSV. Consumes: existing filter and column-order interfaces.
EXP-1: Label the action “Export filtered rows”. On click, export matching rows
in visible column order using the filter and columns active at click time.
Acceptance for EXP-1: a filter matching one of two rows exports that row with
columns in visible order. A filter matching zero rows exports just the header.

## Evidence and history
Source and revision: <evidence>. Adviser receipts: <r2 links>. Approval: pending.
Change log: r2 adds zero-row acceptance. Previous approved baseline: <immutable ref, if any>.
```
