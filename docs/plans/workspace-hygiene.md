# Workspace hygiene execution map

Spec: #160 rev 2, body SHA-256 aba5748ed68b54f831fabe832ac71ff077ffafc71e57ce89a1e4e87b36f91158. Store: GitHub Issues.

Capability: https://github.com/axatbhardwaj/axstack/issues/161 scheduled passes keep compact continuity and close their own terminal
Internal task: T-A -> driver-owned, axstack-author (codex) -> worktree `hygiene-a` (branch axatbhardwaj/hygiene-a, base main)
Theme: scheduled-pass continuity template and own-terminal close
Size est: small (~150-250 lines: automations.md, run-record.md, review-manager-prompt.md, watch-runtime.md, tests, docs/specs + docs/plans counterparts)
Acceptance: #161 checks
Depends: none

Capability: https://github.com/axatbhardwaj/axstack/issues/162 completed work leaves only driver sessions and worktrees
Internal task: T-B -> driver-owned, axstack-author (codex) -> worktree `hygiene-b` (branch axatbhardwaj/hygiene-b, stacked on T-A)
Theme: settlement invariant, evidence location, salvage, driver-start sweep, bookkeeping rules
Size est: medium (~400-700 lines: new workspace-hygiene.md, pointers in lifecycle/routing/orca-runtime/axstack-cleanup/phase skills, run-record field, contract tests, 11-case scenario fixture)
Acceptance: #162 checks
Depends: T-A

Capability: https://github.com/axatbhardwaj/axstack/issues/163 readable Axstack rows in the Orca sidebar
Internal task: T-C -> driver-owned, axstack-author (codex) -> worktree `hygiene-c` (branch axatbhardwaj/hygiene-c, stacked on T-B)
Theme: display names, status comments, ownership lineage
Size est: small (~150-300 lines: workspace-hygiene.md naming section, orca-runtime/phase-skill pointers, tests)
Acceptance: #163 checks
Depends: T-B
