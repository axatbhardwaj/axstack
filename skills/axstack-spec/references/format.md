# Readable specification format

Use this structure inside the selected authoritative store. It changes layout,
not store selection, adviser review, diligence, approval or snapshot authority.

## Decision brief

Begin with a decision brief before execution detail and history.
Keep identity and status compact, with review-round history after current requirements.
For example: title, revision, draft or approved status, authoritative location.

- In the opening, explain the problem, why it matters and the proposed change.
- When useful, include a concrete before/after example or flow in the opening.
- State included and excluded scope in the brief.
- Surface consequential risks, trade-offs and unverified boundaries in the brief.
- Collect all decisions needed from the user in the opening, with options and
  consequences; say explicitly when none remain.

Give enough context for an informed decision. Link each consequential choice
or risk to its precise execution requirement. Never bury a material decision
or risk only in supporting detail.

## Execution requirements

Group precise requirements and observable acceptance by capability, using stable
IDs where useful. Include behavior, interfaces, data, invariants, failure cases
and validation that determine success. Put routine file-by-file task and PR
sequencing in Tickets, retaining meaningful design and rollout constraints in the spec.
State each rule once and reference it from other sections.
Technical execution detail remains binding wherever stored, including linked detail.
Human and agent views share one authoritative specification.
Resolve brief/detail conflicts before approval rather than declaring one view expendable.

Use headings, short requirement blocks or lists for scanning. Use a table when
it helps compare choices, rather than putting whole paragraphs in cells.
Do not impose word caps, mandatory tables, an extra artifact or ceremony.
The example below is adaptable guidance, not another required document.
The existing readback identifies and explains this same revision; it is not
a duplicate whole spec with separate requirements.

## Evidence and history

Keep history, evidence and adviser receipts separate from current requirements.
Place provenance, commands, review-round dispositions and change logs here or
link their existing records. They explain the requirements, not override them.
When amending a draft, update current criteria in place and keep the change log
as history. Preserve approved snapshots immutable and mark supersession through
metadata or links outside the approved bytes. Use the existing material-revision
and snapshot procedure for a changed baseline; a new draft is not approval.

## Readability review

For readability review, verify a human can identify what changes, why, decisions
and risks from the opening and an implementer can find exact requirements without
reconstructing history. Assess this alongside completeness before the existing
specification checkpoint. Return unclear or conflicting passages for revision
under the existing review and approval rules.

## Compact example

```markdown
# Export the filtered view — r2, draft
Authoritative location: <selected store URL or repository path>

## Decision brief
Problem/why: exports ignore the table filter, forcing users to clean the file.
Change: export what the user is viewing.
Before: export downloads the whole dataset. After: it downloads filtered rows.
Included: CSV export from this table. Excluded: scheduled exports and new formats.
Trade-off/risk: an active filter can omit rows users expect; label the action
“Export filtered rows” (EXP-1). Unverified: large exports on low-memory devices.
Decision needed: approve filtered export with the explicit label, or retain
whole-dataset export and its cleanup cost. Proposed choice: filtered export.

## Execution requirements
### Filtered export
EXP-1: On click, capture the active filter and visible column order, label the
action “Export filtered rows”, and export only matching rows in those columns.
Acceptance for EXP-1: with a two-row dataset and a filter matching one row,
the CSV contains that row and the visible columns in order; with a filter
matching zero rows, the CSV contains the header only.

## Evidence and history
Source: <observed current behavior and revision>.
Adviser receipts: <links bound to r2>; approval: pending.
Change log: r2 incorporates the zero-row case into EXP-1 acceptance.
Previous approved baseline, if any: <immutable ref>; supersession: pending approval.
```
