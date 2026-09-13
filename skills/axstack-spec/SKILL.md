---
name: axstack-spec
description: When agreed work needs an approved baseline, use axstack-spec to write and snapshot the execution specification.
---

# Specification baseline

Produce one user-approved specification whose exact revision can govern
ticketing and execution.

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md), including its
  required lifecycle and audit path

## Procedure

1. **Select the authoritative store.** Use a native Linear document by
   default, or repository Markdown when the user explicitly selects it.
   Record the selection before writing. This step is complete when one store
   is named and no implicit fallback remains.
2. **Preflight Linear access.** In Linear mode, verify that the current
   session can read, create, and update documents before any document write.
   Missing access is an actionable setup gap: report it and stop this phase
   without writing or changing stores. This step is complete only when all
   three operations are available; a later tickets-phase check cannot replace
   it. Skip this step in Markdown mode.
3. **Draft with decision evidence.** Write observable acceptance criteria and
   explicit exclusions in the selected store. Involve the Fable advisor in
   spec creation and revision, solution design, and consequential decisions
   under [Standing contracts](../axstack/references/contracts.md): the driver
   records an independent assessment first, then advisor evidence, and caches
   the receipt with the draft. Reuse a receipt only while its evidence and
   scope remain unchanged. This step is complete when the draft covers the
   agreed outcome, acceptance criteria, exclusions, and every required Fable
   receipt or reported consultation gap.
4. **Obtain the specification checkpoint.** The driver owns the draft and the
   user approves it; advisor input cannot grant approval. Ask for this one spec
   approval only after the draft is reviewable. This step is complete when the
   user has approved an identified revision.
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

   This step is complete when the authoritative revision, counterpart, and
   preserved ref resolve to the approved content. Return that exact identity
   to ticketing; routine execution of the settled plan needs no repeat Fable
   consultation or spec approval.

## Material revisions

For a material change, preserve the previous baseline, identify affected
tasks and PRs, and propose the revised scope and plan. Hold affected code
changes until the user accepts the revision; unrelated safe work may continue.
The revision is complete only after acceptance and a new snapshot in the same
format above.
