---
name: axstack-tickets
description: When an approved capability needs executable tasks, use axstack-tickets to map work and track lifecycle state.
---

# Tickets

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)

Requires an approved spec baseline (entry or standalone). Confirm the
approved spec identity before mapping; hold on unapproved or changed scope.
A still-valid approval is never repeated. Use the explicitly selected Markdown
or Linear store; missing Linear access never silently changes that choice.

## Session preflight

Before use, check the actual session's required MCP tools and access.
Missing Linear document access is a setup gap: report it as actionable,
do not silently switch stores. Markdown mode works independently when explicitly selected.

## Mapping

- Linear issues are user-visible capabilities. One capability may span several implementation tasks and PRs. Detailed breakdowns live in the repository.
- The driver owns every Linear mutation. A small inexpensive checker only reports discrepancies in run issues, with evidence. It never mutates Linear. With no configured `axstack-checker` profile, hold checker dispatch; the driver checks directly or reports the gap. Never launch a provider default.

## Template: capability to task map

```text
Capability: <Markdown ref or Linear issue URL> <title>
Internal tasks: <task> -> <PR owner> -> <worktree>
Acceptance: <checks from approved spec rev>
Depends: <task IDs or none>
```

## Done rule (exact)

A reviewed but unmerged capability stays **In Review**; never mark Done
before all required PRs merge and the capability's acceptance checks pass.

## Drift reports

The checker reports run-scoped discrepancies with evidence only. The
driver independently verifies that evidence before applying any update.
Spec or acceptance changes and conflicting state are decisions, not
routine sync repairs.

### Template: drift report

```text
Capability: <issue>
Observed: <Linear state> vs <PR merge SHAs/URLs + acceptance outputs>
Recommendation: <move to In Review | other> (driver verifies first)
```
