# Standing contracts (every standalone phase loads this)

## Scope approval

No implementation or ticket work without an approved spec revision as the
execution baseline — whether invoked from entry or standalone. A standalone
`axstack-implement` or `axstack-tickets` call must first confirm the
approved spec identity (see `axstack-spec`) and hold if the scope is
unapproved or materially changed and unaccepted.

## Model discipline

Validate provider/model availability at launch. An unavailable or exhausted
model pauses affected work pending user decision. Never substitute another
model automatically, including one listed in configuration. Preselected role
profiles are distinct from post-failure substitution.

## Advisor split

The current driver chat consults the Fable advisor profile only for
consequential decisions still unresolved after factual checks — not every
task or phase. The driver forms an independent assessment first, then takes
advisor evidence; profile notes alone never trigger a consultation.
High-stakes decisions require the advisor's plain AGREE plus the driver's
accepted assessment. Resolve disagreements with bounded checks; no silent
fallback to another model, and never proceed on silence. Ordinary work uses
the Sol/Opus pair; high-stakes work uses an Opus high author with a fresh
Sol high checkpoint reviewer — without changing the exactly-two final
reviewers.

## Serious risk

Credible serious security issues, possible downtime or data loss, and major
design concerns are raised immediately via prompt, never waiting for a
second reviewer or consensus. Hold approval, merge-ready declarations, and
dependent dangerous actions. Safe work may continue. Disagreement or silence
is not permission. This is an instruction, not a programmatic gate.

## Authority

The human merges by default, bottom-up for a stack. Review approval never
grants merge authority. The driver owns every Linear mutation; the checker
only reports. Votes never settle correctness.
