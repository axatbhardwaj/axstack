---
name: axstack-spec
description: When agreed work needs an approved baseline, use axstack-spec to write and snapshot the execution specification.
---

# Specification baseline

Produce one user-approved specification whose exact revision can govern
ticketing and execution.

Before specification work, load [Standing contracts](../axstack/references/contracts.md).
Follow its required path through [Shared lifecycle](../axstack/references/lifecycle.md)
and the lifecycle's [audit skill](../axstack-audit/SKILL.md) hook.

## Procedure

1. **Select the authoritative store.** Use a native Linear document by
   default, or repository Markdown when the user explicitly selects it.
   Name the store before writing; one recorded choice leaves no implicit
   fallback.
2. **Preflight Linear access.** In Linear mode, verify that the current
   session can read, create, and update documents before any document write.
   Missing access is an actionable setup gap: report it and stop this phase
   without writing or changing stores. Linear drafting starts only when all
   three operations are available; a later tickets-phase check cannot replace
   this one. Markdown mode skips this preflight.
3. **Draft with decision evidence.** Write observable acceptance criteria
   and explicit exclusions in the selected store. First record the driver's
   independent assessment, then load
   [Orca runtime](../axstack/references/orca-runtime.md) before dispatching the
   configured `axstack-advisor-astra` and `axstack-advisor-fable` independently,
   without cross-reading, with the same bounded evidence and question. The
   driver synthesizes disagreements. Cache both receipts with the draft and
   reuse unchanged receipts only while their evidence, scope, and question
   remain unchanged. If either adviser is unavailable, hold Spec without
   substitution. A reviewable draft covers the agreed outcome, acceptance
   criteria, exclusions, and both adviser receipts or the reported hold.
4. **Obtain the specification checkpoint.** The driver owns the draft and the
   user approves it; adviser input cannot grant approval. High-stakes decisions
   require both advisers' plain AGREE. Present one
   reviewable, identified revision for this checkpoint. Its user approval
   creates the execution baseline.
5. **Snapshot the baseline.** Record the approved revision identity and a
   concise repository Markdown counterpart. In Linear mode, the native
   document remains authoritative; in Markdown mode, the agreed repository
   path does. Use this shape:

```text
Approved spec: <title> rev <id> (<date>)
Authoritative store: <Linear document URL | repo Markdown path>
Markdown counterpart: <repo path + ref>
Baseline preserved at: <ref>
Material change: <none | description + affected PRs/tasks + hold state>
```

   The snapshot is ready for ticketing when its authoritative revision,
   counterpart, and preserved ref resolve to the approved content. Return that
   exact identity; routine execution of the settled plan needs no repeat adviser
   consultation or spec approval.

## Material revisions

For a material change, preserve the previous baseline, identify affected
tasks and PRs, and propose the revised scope and plan. Hold affected code
changes until the user accepts the revision; unrelated safe work may continue.
A revised baseline exists only after acceptance and a new snapshot in the
same format above.
