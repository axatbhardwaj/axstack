---
name: axstack-tickets
description: When an approved capability needs executable tasks, use axstack-tickets to map work and track lifecycle state.
---

# Tickets

Produce an executable capability map tied to the exact approved spec revision.
Keep user-visible capabilities in the selected store, keep implementation detail
in the repository, reconcile lifecycle state, and stop before implementation.

Before mapping, load [Standing contracts](../axstack/references/contracts.md).
Follow its required edge to [Shared lifecycle](../axstack/references/lifecycle.md),
including the lifecycle audit hook. Read the
[PR-shape policy](../axstack/references/pr-shape.md) before sizing tasks. Read the
[Orca runtime boundary](../axstack/references/orca-runtime.md) immediately before
an actual checker dispatch, not for ordinary mapping or state reconciliation.

## Procedure

1. **Pin scope and storage.** Confirm the approved spec identity before mapping.
   Hold on unapproved or materially changed scope; a still-valid approval is
   never repeated. Use the explicitly selected Markdown or Linear store. Record
   the exact approved spec revision and selected store.

2. **Preflight the selected store.** Markdown mode works independently. In
   Linear mode, check the actual session's required MCP tools and document
   access. Missing access is an actionable setup gap: preserve the selected
   store, record the gap, and stop affected work. Proceed only with verified
   access; a recorded gap never switches stores.

3. **Map capabilities to execution.** In Linear, issues represent user-visible
   capabilities; one capability may span several tasks and PRs. Keep detailed
   execution breakdowns in the repository. For every capability, derive
   acceptance checks from the pinned spec and identify internal tasks,
   dependencies, PR ownership, and worktrees. For each task the driver records
   one theme and a coarse size estimate from the ownership, interface, and
   dependency map. A task estimated in the exception band is assessed for a
   split at mapping time and split where a green, atomic, reviewable split
   exists. If the driver judges it inseparable, record the coarse planning
   rationale with the task; actual measurement and exception evidence follow in
   the implement receipt. Mapping time requires no actual SHAs or line counts.
   Every capability ends with the fields below and an explicit dependency list.
   These routine mapping and split choices are autonomous driver decisions
   within the approved spec; size alone never requires user approval.

   The driver performs every Linear mutation. Other roles return proposed
   changes and evidence to the driver.

## Template: capability to task map

```text
Spec: <approved revision>
Capability: <Markdown ref or Linear issue URL> <title>
Internal task: <task> -> <PR owner> -> <worktree>
Theme: <one behavior or component>
Size est: <coarse band estimate>
Acceptance: <checks from approved spec rev>
Depends: <task IDs or none>
```

4. **Reconcile lifecycle state.** Compare each run capability with its required
   PR merge evidence and acceptance outputs. A reviewed but unmerged capability
   stays **In Review**; mark Done only after all required PRs merge and the
   capability's acceptance checks pass. Resolve each observed mismatch with
   either a verified driver-owned update or a drift report.

   The checker reports run-scoped discrepancies with evidence and never mutates
   Linear. The driver independently verifies that evidence before applying an
   update. Spec or acceptance changes and conflicting state are decisions, not
   routine sync repairs. With no configured `axstack-checker` profile, hold
   checker dispatch; the driver checks directly or records the gap. Never launch
   a provider default.

### Template: drift report

```text
Capability: <issue>
Observed: <Linear state> vs <PR merge SHAs/URLs + acceptance outputs>
Recommendation: <move to In Review | other> (driver verifies first)
```

5. **Return the mapping.** Report the pinned spec revision, selected store, map
   references, mutations performed by the driver, recorded gaps, and unresolved
   decisions. Stop with a map ready for lifecycle continuation; implementation
   has not started.
