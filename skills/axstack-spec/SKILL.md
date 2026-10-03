---
name: axstack-spec
description: When agreed work needs an approved baseline, use axstack-spec to write and snapshot the execution specification.
---

# Specification baseline

For authorized delivery runs, follow [Autopilot](../axstack/references/autopilot.md)
for phase continuation and holds.

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.

Produce one user-approved specification whose exact revision can govern
ticketing and execution.

Before specification work, load [Standing contracts](../axstack/references/contracts.md).
Follow its required path through [Shared lifecycle](../axstack/references/lifecycle.md)
and the lifecycle's [audit skill](../axstack-audit/SKILL.md) hook.

## Procedure

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
3. **Draft with decision evidence.** Write observable acceptance criteria
   and explicit exclusions in the selected store. Only when the scope identity
   carries a sketch, include the [design lens](../axstack/references/design-lens.md)
   sketch in the approved revision's `Design` section and its `Usage` line in
   acceptance. First record the driver's
   independent assessment, then load
   [T3 runtime](../axstack/references/t3-runtime.md) before dispatching the
   configured `axstack-advisor-astra` and `axstack-advisor-opus` independently,
   without cross-reading, with the same bounded evidence and question. The
   driver synthesizes disagreements. Cache both receipts with the draft and
   reuse unchanged receipts only while their evidence, scope, and question
   remain unchanged. If either adviser is unavailable, hold Spec without
   substitution. A reviewable draft covers the agreed outcome, acceptance
   criteria, exclusions, and both adviser receipts or the reported hold.
   An optional adviser note may be deferred or rejected in a `Decisions` row
   with the draft unchanged; it needs no new adviser pair. Changed draft text,
   a blocking finding, or a high-stakes decision requires fresh receipts on
   the new revision.
4. **Obtain the specification checkpoint.** The driver owns the draft and the
   user approves it; adviser input cannot grant approval. High-stakes decisions
   require `axstack-advisor-astra` and a fresh `axstack-escalation-fable`
   session to return plain AGREE. Present one
   reviewable, identified revision for this checkpoint. Its user approval
   creates the execution baseline.
   Before user approval, dispatch `axstack-diligence` under
   [Diligence](../axstack/references/diligence.md) to check the draft against
   the Align decisions for anything dropped, added, or softened.
5. **Snapshot the baseline.** Record the approved revision identity and a
   concise repository Markdown counterpart. In Linear mode, the native
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
