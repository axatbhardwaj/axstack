---
name: axstack-improve
description: When assessing codebase quality or planning a refactor, use axstack-improve to find evidenced improvements and prepare behavior-preserving changes.
---

# Improve

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.

Find a small set of worthwhile maintainability, architecture, or testability
improvements from inspected code. This is a direct discovery route: it needs no
spec or tickets and writes only the requested report. No worthwhile
improvement is a valid result.

Before acting, load [Standing contracts](../axstack/references/contracts.md),
then follow its lifecycle and audit pointers. Immediately before any useful
role dispatch, load the [Orca runtime
sequence](../axstack/references/orca-runtime.md). Use existing
`axstack-explore-codebase` or `axstack-research-code` roles only when their
specialization materially helps; create no new profile.
When dispatching `axstack-research-code`, dispatch `axstack-research-code-sol`
independently on the same bounded brief without cross-reading. The driver
reconciles findings per claim and never averages them. Record an intentionally
absent Sol pair and proceed with the base seat alone. A configured optional
Sol pair that fails to launch is fenced, recorded `absent (<reason>)`, and
named once in the next read-back, then skipped without relay or substitution.
In mixed fan-out retain a Codex and a Claude seat or hold the affected work.

## 1. Bound discovery

1. Start with the user's named subsystem or pain. Otherwise inspect recent
   change hot spots rather than sweeping the repository.
2. Record inspected paths, known decisions, and an exact revision for Git
   sources. For a non-versioned file, screenshot, or exported snippet, record a
   stable source identity or content hash instead. Record the history window
   when available; unavailable history is a named limitation, never an invented
   window. Claims outside the inspected set are unknown.
3. Read the relevant code, history, and tests. Look for actual friction in
   maintainability, architecture, and testability: shallow interfaces that
   leak details, lost locality, hidden state, needless layers, or unclear
   seams. Prefer simpler targets with smaller interfaces, deeper modules, and
   restored locality when the evidence supports them.
4. Apply KISS, YAGNI, and SOLID as judgment, not a mandatory scorecard. Use no
   invented metrics and no arbitrary complexity targets.

### Test-audit lens

For a test audit, load [Test value](../axstack/references/test-value.md) and
bound scope to one owner boundary. Mark every test declaration in scope
R/F/C/D as a completeness floor. It is not a deletion quota; zero candidates is valid.
Report reviewed and eligible counts. Each C/D carries the reference's evidence:
exact test name and location, detectable failure, named keeper or
vacuity/obsolescence proof, and validation command. Require its deletion proof
before routing candidates. Report F and test-only production seams; do not
change them. Only explicitly authorized, proven C/D batches route to
`axstack-implement` as explicitly structure-preserving work: same-check green
before/after, through its normal independent review. Discovery remains report-only.

## 2. Return decision evidence

Produce a small ranked candidate set. For each candidate include:

1. Source evidence and the scoped problem.
2. Current and proposed shape. Only when the scope identity carries a sketch,
   use the [design lens](../axstack/references/design-lens.md) vocabulary and
   red flags and return candidates in sketch form.
3. Concrete benefit and tradeoffs.
4. Behavior to preserve and test approach.
5. Uncertainty and recommendation strength.

If a worthwhile candidate benefits from a before/after visual, route that
artifact through `axstack-explain`. Never force HTML for a tiny result.

## 3. Preserve the action boundary

Discovery may read code, history, and tests and write the requested report
only. It does not edit source code, domain documentation, or issues, and it
never auto-refactors.

Selecting a report card item does not authorize execution. Keep preparation
and execution separate:

1. Unresolved design or preparation routes to `axstack-align` under the
   proportional scope rules.
2. Clear, explicitly authorized bounded work may use its settled, recorded
   small-change intent and route to `axstack-implement` without forcing a new
   approval. Substantial work keeps its approved spec and ticket identity.
3. The accepted refactor scope records listed files, current and target shape,
   preserved behavior contract, and test evidence. When the accepted intent is
   structure-preserving, record that explicit tag in the scope; never infer
   the tag from “refactor” alone. Work outside the listed files, a broader
   campaign, or a new security or infrastructure boundary triggers the existing
   scope reassessment; never silently expand it.
