# Plan: design lens (spec #180 rev 2)

Spec: https://github.com/axatbhardwaj/axstack/issues/180 rev 2, SHA-256 e953d4733b534c0b8db828100df3680ef4c1fe52e750ced9d10002034ee66156
Store: GitHub Issues (axatbhardwaj/axstack)

Capability: https://github.com/axatbhardwaj/axstack/issues/181 Design lens in Align: ladder, question rounds, sketch, downstream hooks
Internal task: T-A -> axstack-author (mixed high-stakes route) -> new Orca worktree, branch axatbhardwaj/design-lens-a
Theme: design-lens reference and the pointers that consume it
Size est: small (~400-600 lines: reference ~60, Align section ~15, five hook pointers, routing Unclear sentence, contract test ~150, scenario cases ~80, docs/specs + docs/plans copies ~200)
Files: skills/axstack/references/design-lens.md (new); skills/axstack-align, -spec, -tickets, -implement, -review, -improve SKILL.md; skills/axstack/references/routing.md (Unclear bullet, trim); tests/workflows/design-lens.test.js (new); align-grilling-scenarios.json, review-modes-scenarios.json, implement-loop-evaluator-inputs.json; docs/specs/design-lens.md, docs/plans/design-lens.md
Acceptance: #181 checks (spec rev 2 acceptance, capability A items)
Depends: none

Capability: https://github.com/axatbhardwaj/axstack/issues/182 All-family design arena with Grok and Antigravity candidate roles
Internal task: T-B -> axstack-author (same owner session as T-A) -> worktree stacked on T-A, branch axatbhardwaj/design-lens-b
Theme: arena widening and the 24->26 role roster
Size est: small (~300-500 lines: Align arena section, three presets x2 rows + judge notes, src/roles.js allowlist, routing/orca-runtime/docs count sweep, installer + workflow tests, scenario cases)
Files: skills/axstack-align/SKILL.md (arena); skills/axstack/references/design-lens.md (Rung 2 pointer); profiles/presets/*.json; src/roles.js; routing.md, orca-runtime.md, docs/installation.md, docs/workflows.md, README.md; tests/installer/roles.test.js and installer upgrade test; tests/workflows/align-arena.test.js, presets.test.js, structural.test.js, owned-core.test.js, pending-repairs.test.js; debug-scenarios.json, routing-scenarios.json, align-grilling-scenarios.json
Acceptance: #182 checks
Depends: T-A (gh stack child)
