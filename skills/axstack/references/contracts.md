# Standing contracts (standalone phases load this, then follow its pointers)

## Required lifecycle load

Except for `axstack-audit` itself, every independently called phase
follows this edge. Load and follow [Shared lifecycle](lifecycle.md)
before acting, then apply its audit hook when a substantive run ends.
The audit phase loads these standing contracts but stops after its own
record instead of auditing itself.

## Scope identity (conditional — see routing and lifecycle)

One global spec gate contradicts proportional work, peer, and adoption modes.
The required scope identity depends on the mode (see the
[proportional scope identity](routing.md#proportional-scope-identity)):

Substantial means substantial features and multi-PR or stacked work; a bounded
small feature is not substantial merely because it is labelled a feature.
Clarify unclear size first, then classify it as small or substantial.

- Substantial new implementation: approved spec identity plus a matching
  ticket map before execution or authored review.
- Small new implementation: the named **small-change intent** — recorded
  request or existing issue plus explicit acceptance checks and exclusions,
  snapshotted once — is its non-null identity. Each phase confirms it before
  building or approving.
- Adopted own PR: the user-authorized maintenance intent snapshot
  (see [Lifecycle](lifecycle.md)) — not merely
  untrusted linked content, and never a new spec or ticket ceremony.
- Peer review: linked issue plus PR description and repository
  requirements; demands no Axstack-created approved spec.
- Read-only research, docs, and handoff: no baseline at all.

Pre-approval alignment and spec writing, and safe read-only investigation and
review, remain allowed without a baseline. A still-valid approval is never
repeated. Material scope changes still hold affected work until the user
accepts the revised scope.

## Model discipline

Validate provider/model availability at launch. An unavailable or exhausted
model pauses affected work pending user decision. Never substitute another
model automatically, including one listed in configuration. Preselected role
profiles are distinct from post-failure substitution.

## Advisor split

The current driver chat involves the Fable advisor profile for spec
creation and revision, solution design, and consequential decisions —
broader than only deadlocks after factual checks. The driver still
forms an independent assessment first, still owns the decision, and the
user still approves the spec. Cache each valid unchanged decision
receipt: routine execution already covered by a receipt needs no repeat
consultation. Profile notes alone never trigger a consultation.
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
