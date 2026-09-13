---
name: axstack-tickets
description: Map capabilities to tasks with Linear preflight, report-only checker, driver-owned updates, In Review Done rule.
---

# Tickets

Linear is the default integration; repository Markdown is an explicit alternative.

## Session preflight

Before use, check the actual session's required MCP tools and access.
Missing Linear document access is a setup gap: report it as actionable,
do not silently switch stores. Markdown mode works independently when explicitly selected.

## Mapping

- Linear issues are user-visible capabilities. One capability may span several implementation tasks and PRs. Detailed breakdowns live in the repository.
- The driver owns every Linear mutation. A small inexpensive checker only reports discrepancies in run issues, with evidence. It never mutates Linear.

## Template: capability to task map

```text
Capability: <Linear issue URL> <title>
Internal tasks: <task> -> <PR owner> -> <worktree>
Acceptance: <checks from approved spec rev>
```

## Done rule (exact)

A reviewed but unmerged capability stays **In Review** — never
in-progress/not-done as a substitute, never Done. Done requires all
required PRs merged plus the capability's acceptance checks passing.

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
