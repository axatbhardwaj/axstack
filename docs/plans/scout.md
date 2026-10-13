# Scout: ticket map

Spec: https://github.com/axatbhardwaj/axstack/issues/438 rev 5 (body sha256
0de49f0446dd32ed304c379833813184c0419aa74e4c7bd39ce7b220918e701f); counterpart
docs/specs/scout.md.
Store: repository Markdown.

## C1 Scout roles in every preset

Capability: docs/plans/scout.md#c1 "Scout roles in every preset"
Internal task: T1 -> launched writer (axstack-author) -> branch axstack/20261012-scout/t1-roles, stacked on the spec PR
Theme: role data and its validation (presets, `src/roles.js` absence lists, role roster, role prose docs, installer and preset tests)
Size est: small-medium (three preset JSON files, one source list, roster and two docs, about five test files)
Acceptance: spec acceptance 1 and scope 1.
- `axstack-explore-codebase-luna` (codex, class `luna`, `xhigh`, `full-access`) in mixed and codex-only; intentional absence in claude-only (provider `claude`, `bypassPermissions`).
- `axstack-explore-codebase-flash` (antigravity, `gemini-3.8-flash-medium`, `medium`, no `modelClass`, `full-access`) in mixed; intentional absences in codex-only (`codex`, `full-access`) and claude-only (`claude`, `bypassPermissions`).
- `axstack-explore-codebase` unchanged (Haiku 5.5 high pinned; Sol high in codex-only).
- New roles use the existing preset key order.
- `src/roles.js` absence lists and the exact claude-only absence-list test updated; ordered role IDs in `presets.test.js`; `preset-selection` and `resolve-models` tests; `docs/workflows.md` and `docs/installation.md` role prose.
- Role roster lists `-flash` as optional and names the required Scout seats per preset.
- `bun run test:all` passes, including readiness for each preset.
Depends: spec PR

## C2 The Scout skill

Capability: docs/plans/scout.md#c2 "The Scout skill"
Internal task: T2 -> same writer as T1 -> branch axstack/20261012-scout/t2-skill, stacked on T1
Theme: the new phase skill and its prose contract (skill, README row and count, installed skill lists, prose-contract tests); skill and tests in separate commits
Size est: medium (one skill, README, two test lists, one new test file)
Acceptance: spec acceptance 2 and 3 and scope 2-5.
- `skills/axstack-scout/SKILL.md` exists, installs with the other phase skills, and is listed in the README with the count updated.
- Prose-contract tests fail when any acceptance 3 rule is removed or inverted, including: single lookups in-chat; driver or owner dispatch only; 1-3 facets searching the whole repository; Haiku+Luna per facet in mixed, Sol+Luna in codex-only, Haiku in claude-only; required-seat hold without substitution; Flash launch failure/trust/prompt block records `absent (<reason>)` and Scout continues; Flash hold covers only Flash; first-launch rejection stops siblings; uncertain dispatch reconciled; not-found claims carry command, scope and content identity; content identity includes `git diff --binary HEAD` and untracked file hashes; at most about 15 claims per report with Research labels; per-claim reconciliation without averaging; driver re-checks answer-changing not-found claims; reuse only while content identity, including untracked file contents, is unchanged; Sol+Luna agreement is not cross-family corroboration.
- Skill prose also states: seats are read-only and write only their private evidence folder; Scout returns a compact summary and stores seat reports in the run evidence folder; a call from ordinary chat creates a run with `run-init`; scaling by facet count never drops required seats; Scout adds no mandatory gate to other phases.
Depends: T1

## C3 Research and Improve use Scout

Capability: docs/plans/scout.md#c3 "Research and Improve use Scout"
Internal task: T3 -> same writer -> branch axstack/20261012-scout/t3-integration, stacked on T2
Theme: callers of broad codebase mapping (Research, Improve, Explain boundary) and their tests
Size est: small (two skill edits, `owned-support.test.js`, one description test)
Acceptance: spec acceptance 4 and scope 6.
- Research and Improve route broad mapping through Scout; Improve's "create no new profile" line updated; `owned-support.test.js` updated for Research's wording.
- A test asserts Scout's description names evidence gathering for an agent and contains none of Explain's user triggers (owned here, per spec Delivery C).
- Explain's existing description tests unchanged and passing.
- `research-code`, `explore-execution` and their `-sol` pairs unchanged.
Depends: T2

## C4 Release, reinstall and live proof (driver)

Capability: docs/plans/scout.md#c4 "Release, reinstall and live proof"
Internal task: R1 -> driver -> release branch after T3 merges; host install under standing AGENTS.md authority
Theme: release mechanics and live acceptance
Size est: small (version bump) plus host steps
Acceptance: spec acceptance 5 and 6.
- 5(a): `dispatch-plan --kind task` exits 0 for each Scout role with a branch-built mixed roles file, saved capabilities, codex and claude pickers, and `{"chosenInstanceId":"antigravity"}`; emits `claude-haiku-5-5` high, `gpt-6-luna` xhigh, `gemini-3.8-flash-medium`.
- 5(b): after reinstall, one live mixed Scout run with 3 facets on this repository dispatches through T3, verifies each seat by `t3_thread_configuration`, records first-launch receipts, and stores 7 seat reports (or 6 plus a recorded Flash absence or hold).
- 6: release published; the human approves the npm stage; run `Release:` field filled; `axstack --version` matches on io, iobook, iobox and VPS.
Depends: T3

## Exclusions (from the spec, untouched by this map)

- No helper script, threshold calculator, daemon or programmatic trigger.
- `axstack-research-code`, `axstack-explore-execution` and their `-sol` pairs.
- Research's other branches (requirements, web, web-google, X).
- Active runs keep their role snapshots.
- No cost, latency or recall measurement harness.
