---
name: axstack-spec
description: When agreed work needs an approved baseline, use axstack-spec to write and snapshot the execution specification.
---

# Specification baseline

Drivers follow [Parallel-first ready work](../axstack/references/parallel-first.md#ready-work)
at intake and dependency/completion transitions. Workers keep their assigned
scope and never dispatch.

For authorized delivery runs, follow [Autopilot](../axstack/references/autopilot.md)
for phase continuation and holds.

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.

Produce one user-approved specification whose exact revision can govern
ticketing and execution.

Never add a driver-invented spec decision that makes the user merge PRs outside
[watch §5](../axstack-watch/SKILL.md#5-state-readiness-precisely)'s user-merge categories.
Explicit user restrictions, including `Auto-merge: off`, chat holds, and user
instructions, always win.

Before specification work, load [Standing contracts](../axstack/references/contracts.md).
Follow its required path through [Shared lifecycle](../axstack/references/lifecycle.md)
and the lifecycle's [audit skill](../axstack-audit/SKILL.md) hook.

## Procedure

Before drafting, load and follow [Independent delivery](../axstack/references/independent-delivery.md).

1. **Select the authoritative store.** Use Linear through the executor MCP only
   for repositories in `defi-com`. Keep specs for other repositories on GitHub;
   if the issue, PR or repository-file location is unclear, ask before creating
   a planning artifact. Use GitHub Issues or repository Markdown when the user
   explicitly selects it, and for non-`defi-com` repositories under that boundary.
   Name the store before writing; one recorded choice
   leaves no implicit fallback.
2. **Preflight external-tracker access.** In Linear mode, inspect the executor
   MCP's advertised document operations before any write. Verify read, create,
   and update support separately. For missing Linear access through the executor
   MCP, record its guide/help evidence, hold only that operation, and stop this
   phase without mutation or store switch; the selected document remains authoritative.
   A later tickets-phase check cannot replace this preflight. In GitHub mode, use
   authenticated `gh` to verify the target
   repository, issues enabled, and the current identity's issue read and write
   access before any issue write. Record the repository and identity checked.
   Missing access preserves the GitHub selection and stops the phase without
   mutation or fallback. Markdown mode skips external access preflight.
3. **Draft with decision evidence.** Follow the
   [readable specification format](references/format.md) when drafting in the
   selected store. Only when the scope identity
   carries a sketch, include the [design lens](../axstack/references/design-lens.md)
   sketch in the approved revision's `Design` section and its `Usage` line in
   acceptance. First record the driver's
   independent assessment. For questions, consult advisers only for consequential
   decisions and disagreements. Never dispatch advisers for every question,
   routine factual clarification or settled preferences.
   For those consequential decisions and disagreements and the required draft
   rounds below, load
   [T3 runtime](../axstack/references/t3-runtime.md) before dispatching the
   configured `axstack-advisor-codex` and `axstack-advisor-claude` independently,
   without cross-reading, with the same bounded evidence and question. The
   driver synthesizes disagreements. Cache both receipts with the draft and
   reuse unchanged receipts only while their evidence, scope, and question
   remain unchanged. If either adviser is unavailable, hold Spec without
   substitution. A reviewable draft covers the agreed outcome, acceptance
   criteria, exclusions, and both adviser receipts or the reported hold.
   Run a full adviser round on the first draft and every revision that changes
   meaning in criteria, scope, decisions or authority.
   Before user approval, run `axstack-diligence` on the first draft and the revision
   presented for approval under [Diligence](../axstack/references/diligence.md) to
   check the draft against the Align decisions for anything dropped, added, or softened.
   Batch low and wording-only findings into one final pass.
   Never start a new full adviser round for low or wording-only findings;
   for low or wording-only findings with changed text, follow delta confirmation below.
   Never waive high or medium findings.
   When existing triggers apply, run `axstack-escalation-fable` only after ordinary
   high and medium findings settle. Reuse the Fable receipt while the reviewed
   meaning holds. If Fable's own findings change meaning, a fresh Fable session
   reviews the revised result.
   An optional adviser note may be deferred or rejected in a `Decisions` row
   with the draft unchanged; it needs no new adviser pair.
   By default, changed draft text requires fresh receipts on the new revision.
   The only exception to this default is delta confirmation, available only after
   each configured adviser seat confirms the driver's meaning-preservation claim.
   If the driver claims an edit preserves criterion, scope, decision and
   instruction meaning, each configured adviser seat confirms that claim on
   the delta, naming its prior receipt, the delta and the new revision.
   If a seat disagrees, a blocking finding exists, a high-stakes decision arises,
   or meaning changes, obtain full fresh review on the new revision.
   An unavailable adviser seat holds the affected phase.
4. **Obtain the specification checkpoint.** The driver owns the draft and the
   user approves it; adviser input cannot grant approval. High-stakes decisions
   require `axstack-advisor-codex` and `axstack-escalation-fable` to return
   plain AGREE. Each use of `axstack-escalation-fable` must start a fresh session.
   Reuse the Fable plain-AGREE receipt only while the reviewed meaning holds under step 3.
   If the reviewed meaning changes, a fresh Fable session must review the revised result.
   Present one reviewable, identified revision for this checkpoint. Its user approval
   creates the execution baseline.
   In a T3 thread, the driver also publishes the spec readback as an inline page and
   follows [Explain](../axstack-explain/SKILL.md) and
   [Inline pages](../axstack-explain/references/inline-pages.md) for its checks and delivery.
   The readback page shows the revision ID, SHA-256, and store path.
   Approval binds to that revision, not to the page.
   Name the draft revision covered by each adviser receipt at the checkpoint.
   If draft text changed and an adviser receipt covers an older revision, hold
   approval until fresh receipts cover the presented revision, using delta
   confirmations only under step 3's meaning-preserving rule.
   Except for high-stakes decisions, a change confined to a `Decisions` row
   reuses adviser receipts only while draft text, evidence, scope, and question
   remain unchanged.
5. **Snapshot the baseline.** Record the approved revision identity and a
   concise repository Markdown counterpart pointing to the same requirements,
   not a second human or agent contract. In Linear mode, the native
   document remains authoritative. In GitHub mode, the approved issue body is
   authoritative and its GitHub issue URL plus SHA-256 body digest identifies
   the exact approved revision. In Markdown mode, the agreed repository path does.
   Use this shape:

```text
Approved spec: <title> rev <id> (<date>)
Authoritative store: <Linear document URL + revision | GitHub issue URL + SHA-256 body digest | repo Markdown path + ref>
Markdown counterpart: <repo path + ref>
Baseline preserved at: <ref>
Material change: <none | description + affected PRs/tasks + hold state>
```

   The snapshot is ready for ticketing when its authoritative revision,
   counterpart, and preserved ref resolve to the approved content. Return that
   exact identity; routine execution of the settled plan needs no repeat adviser
   consultation or spec approval. In an eligible delivery run with no hold,
   continue to Tickets in the same driver chat.

## Material revisions

For a material change, preserve the previous baseline, identify affected
tasks and PRs, and propose the revised scope and plan. Hold affected code
changes until the user accepts the revision; unrelated safe work may continue.
A revised baseline exists only after acceptance and a new snapshot in the
same format above.
