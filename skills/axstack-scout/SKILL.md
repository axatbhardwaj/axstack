---
name: axstack-scout
description: When an agent needs codebase evidence across several areas or unfamiliar code, use axstack-scout to gather cited findings.
---

# Scout

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.

Before acting, load [Standing contracts](../axstack/references/contracts.md)
and follow its lifecycle and audit pointers. Immediately before dispatch,
read the [T3 runtime boundary](../axstack/references/t3-runtime.md) and
[Role roster](../axstack/references/role-roster.md). A Scout call from an
ordinary chat creates a run with `run-init`.

## 1. Bound the exploration

Use Scout for questions spanning several codebase areas, unfamiliar code, or
claims that something does not exist. A single factual lookup stays in the
current chat. Ordinary file reading also stays in the current chat.
Only a driver or PR owner dispatches Scout. Workers, authors and reviewers
request exploration from their driver; they do not launch a fan-out.

Split the question into 1–3 facets, with each facet searching the whole
repository for its concern, such as definitions, callers, tests or config.
Facet briefs must never restrict the search to one directory. Scale by facet
count; keep every required seat within each facet.

## 2. Dispatch independent seats

Use the run's selected preset and role snapshot. Give seats for one facet the
same brief without cross-reading.

- In mixed, each facet requires an independent Haiku and Luna pair: one
  `axstack-explore-codebase` (Haiku 5.5 high) and one
  `axstack-explore-codebase-luna` (Luna xhigh).
- In codex-only, each facet requires an independent Sol and Luna pair:
  `axstack-explore-codebase` (Sol high) and
  `axstack-explore-codebase-luna` (Luna xhigh).
- In claude-only, each facet requires one Haiku seat:
  `axstack-explore-codebase` (Haiku 5.5 high).

Sol and Luna agreement is not cross-family corroboration. An unavailable or
rejected required seat holds Scout without substitution. The first dispatch
for each provider/model/effort must reach a running or completed run before
siblings launch, and its rejection stops siblings of that configuration.

Reconcile an uncertain dispatch natively before proceeding with Scout.

## 3. Pin evidence and report

Pin each brief to the working tree's content identity. Content identity pins
HEAD SHA, SHA-256 of `git diff --binary HEAD` when dirty, and a path and
SHA-256 for each untracked, non-ignored file from
`git ls-files -o --exclude-standard`. Ignored files are outside the search
scope. Seats search the pinned working tree. Each seat is read-only and
writes only to its private evidence folder.

Each seat report has at most about 15 claims, each labeled `verified`,
`inference`, or `unverified` using Research labels. Every present claim
cites `file:line` evidence. A not-found claim says `not found in <scope>`
and includes the exact search command, scope, and content identity; it never
claims absence beyond that scope.

The driver reconciles per claim without averaging and names disagreements.
Cross-family agreement corroborates but does not prove a claim. Before
relying on an answer-changing not-found claim, the driver rechecks its search.
Reuse findings only while content identity, including untracked file contents,
is unchanged; any identity change requires re-scouting all facets still needed.

Return a compact summary to the driver and store seat reports in the run's
evidence folder. Scout adds no mandatory gate to other phases; they may use
its evidence when useful.
