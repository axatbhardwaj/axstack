# Plan: model classes (spec #210 rev 2, SHA-256 d2903d3455661765e724c44b93ab84ef45382124d0e4ef27f80ab95bb63706e8)
Store: GitHub Issues (axatbhardwaj/axstack)

Capability: https://github.com/axatbhardwaj/axstack/issues/211 (A schema and validation)
Internal task: T-A -> axstack-author (Codex gpt-6-sol high) -> worktree mc-a
Theme: role row schema, class derivation, installer validation, upgrade field report (presets unchanged)
Size est: small (~250-400 lines incl. tests and docs/specs/plans copies)
Files: src/roles.js (validation, derivation), src/installer.js (upgrade field report), tests/installer/*, docs/specs/model-classes.md, docs/plans/model-classes.md
Depends: none

Capability: https://github.com/axatbhardwaj/axstack/issues/212 (B pairing)
Internal task: T-B -> author -> worktree mc-b (stacked on A)
Theme: class-keyed AUTHORED_ROUTES, provenance-to-class, distinct-reviewer check, pairing tables
Size est: small (~200-350 lines)
Files: src/roles.js, skills/axstack/references/role-roster.md, skills/axstack-review/SKILL.md, skills/axstack-audit/SKILL.md, tests (review-modes, roles, presets)
Depends: T-A

Capability: https://github.com/axatbhardwaj/axstack/issues/213 (C resolution and activation)
Internal task: T-C -> author -> worktree mc-c (stacked on B); driver runs the feasibility receipt before dispatch
Theme: resolver script, Claude read-back, snapshot and fallback contracts, presets to modelClass, docs
Size est: medium (~400-700 lines)
Files: skills/axstack/scripts/resolve-models.js, routing.md, contracts.md, orca-runtime.md, axstack-review/SKILL.md, profiles/presets/*.json (+notes), README, docs/installation.md, docs/workflows.md, tests (resolver fixtures, contracts)
Depends: T-B
