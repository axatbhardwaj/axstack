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
3. **Draft with decision evidence.** Write observable acceptance criteria and
   explicit exclusions in the selected store. For Fable involvement, first
   record the driver's independent assessment, then load
   [Paseo launch](../axstack/references/paseo-launch.md) before dispatching the
   advisor. Involve Fable in spec creation and revision, solution design, and
   consequential decisions under Standing contracts, and cache the receipt
   with the draft. Reuse it only while its evidence and scope remain unchanged.
   A reviewable draft covers the agreed outcome, acceptance criteria,
   exclusions, and every required Fable receipt or reported consultation gap.
4. **Obtain the specification checkpoint.** The driver owns the draft and the
   user approves it; advisor input cannot grant approval. Present one
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
   exact identity; routine execution of the settled plan needs no repeat Fable
   consultation or spec approval.

## Material revisions

For a material change, preserve the previous baseline, identify affected
tasks and PRs, and propose the revised scope and plan. Hold affected code
changes until the user accepts the revision; unrelated safe work may continue.
A revised baseline exists only after acceptance and a new snapshot in the
same format above.
