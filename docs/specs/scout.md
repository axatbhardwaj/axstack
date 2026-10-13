<!-- Markdown counterpart of GitHub issue #438 rev 5; body SHA-256 0de49f0446dd32ed304c379833813184c0419aa74e4c7bd39ce7b220918e701f. -->
# Scout: multi-model codebase exploration

**Status:** Approved rev 5 (2026-10-13, user approval in chat). **Repository:** `axatbhardwaj/axstack`. **Source baseline:** `c0c0f54` (v0.35.0). **Align record:** private run `20261012-scout-skill-align` (Q1–Q3, one Align adviser round, five spec adviser rounds).

## Outcome

A driver that needs to know what a codebase contains, across several areas or in unfamiliar code, invokes `axstack-scout`. Scout fans out cheap, read-only explorers from different model families on 1–3 facets of the question. It returns a compact, cited picture of what is present, what was not found (and where it was looked for), and what remains unverified. The driver acts on that picture instead of reading many files itself or trusting one model's map.

## Delivery

Ordinary PR chain, bottom-up, commits around 200 lines:

- **A. Roles.** Two new roles in all three presets; `src/roles.js` absence lists; role roster; `docs/workflows.md` and `docs/installation.md` role prose; installer and preset tests (ordered role IDs, claude-only absence-list test).
- **B. Skill.** New `skills/axstack-scout/SKILL.md`; README row and skill count; installed skill lists in structural and installer tests; prose-contract tests. Skill and tests land in separate commits.
- **C. Integration.** Research and Improve route broad mapping through Scout; `owned-support.test.js` updated for Research's new wording; Scout's description is distinct from Explain's.
- **D. Release.** `chore(release)` under the standing release authority in `AGENTS.md`; reinstall on io, iobook, iobox and VPS.

## Scope

1. **Roles (three IDs).**
   - `axstack-explore-codebase` stays the base seat: Haiku 5.5 high pinned (`claude-haiku-5-5`) in mixed and claude-only; Sol high in codex-only. Its ID is unchanged, so preset and installer tests that name it remain valid; tests asserting Research's direct dispatch change in PR C.
   - Codex and Antigravity Scout seats use `modeId: "full-access"`; Claude seats, including claude-only absences, use `modeId: "bypassPermissions"`, matching existing roles.
   - New `axstack-explore-codebase-luna`: codex, class `luna`, `thinkingOptionId: "xhigh"` in mixed and codex-only; intentional absence in claude-only.
   - New `axstack-explore-codebase-flash`: antigravity, `model: "gemini-3.8-flash-medium"`, `thinkingOptionId: "medium"`, no `modelClass`, in mixed; intentional absence in codex-only and claude-only. (Antigravity encodes effort in the model ID; `high` with this model does not resolve.)
   - Intentional absences are added to the `src/roles.js` absence lists so readiness passes.
   - The role roster lists `-flash` among optional seats and names the required Scout seats per preset (scope 3).
2. **Trigger (driver guidance, no helper or gate).**
   - Use Scout for questions spanning several areas of a codebase, unfamiliar code, or claims that something does not exist.
   - A single factual lookup and ordinary file reading stay in-chat; they never dispatch Scout.
   - Only a driver or a PR owner dispatches Scout. Workers, authors and reviewers request exploration from their driver and never launch a fan-out.
3. **Topology and seat availability.**
   - The driver splits the question into 1–3 facets (for example definitions, callers, tests, config). Every facet brief searches the whole repository for that facet, never one directory.
   - **Mixed:** each facet gets one `axstack-explore-codebase` (Haiku) and one `-luna` seat, independently on the same brief without cross-reading. One `-flash` seat per Scout call covers the whole question, looking for boundaries the facets miss and counterexamples. Ceiling: 3 facets, 7 seats. Haiku and Luna are required.
   - **Codex-only:** each facet gets one `axstack-explore-codebase` (Sol high) and one `-luna` seat; both are required. Sol and Luna are independent seats, but their agreement is same-family and is not cross-family corroboration.
   - **Claude-only:** each facet gets one `axstack-explore-codebase` (Haiku) seat; it is required.
   - Scale only by facet count; required seats within a facet are never dropped.
   - The first dispatch for each provider/model/effort reaches a running or completed run before its siblings launch. A rejection stops siblings of that configuration.
   - An unavailable or rejected required seat holds Scout without substitution.
   - The optional `-flash` seat follows the existing optional-seat rule: a launch failure, trust/login prompt or prompt block records `absent (<reason>)` and Scout continues. A Flash model missing from saved capabilities follows the existing unavailable-model rule (hold that seat, no substitution); this spec adds no new absence reason. The hold covers only the Flash seat: Scout returns the other seats' summary and names the Flash hold. An uncertain dispatch is reconciled, not called absent.
4. **Report contract (per seat).**
   - Each brief pins the content identity searched: HEAD SHA plus, when the tree is dirty, the SHA-256 of `git diff --binary HEAD` and a path-and-SHA-256 list of untracked, non-ignored files (`git ls-files -o --exclude-standard`). Ignored files are outside the search scope. Seats search the working tree as pinned.
   - At most about 15 claims. Each present claim carries `file:line` evidence. Every claim carries the Research label `verified`, `inference` or `unverified`.
   - A not-found claim is written `not found in <scope>` and carries the exact search command, scope and content identity; it never claims absence beyond that scope.
   - Seats are read-only and write only their private evidence folder.
5. **Driver reconciliation.**
   - The driver reconciles per claim, never averaging. Cross-family agreement is corroboration, not proof; disagreement is named.
   - Before relying on an answer-changing not-found claim, the driver re-runs its search itself.
   - Findings are reused only while their content identity is unchanged; any identity change invalidates them, and the driver re-scouts all facets it still needs.
   - Scout returns a compact summary to the driver and stores seat reports in the run's evidence folder. A Scout call started from an ordinary chat creates a run with `run-init`.
6. **Integration.**
   - Research and Improve dispatch broad codebase mapping through Scout instead of a direct `axstack-explore-codebase` dispatch. Improve's "create no new profile" instruction is updated accordingly.
   - Explain's description is unchanged. Scout's description names evidence gathering for an agent and does not use Explain's user triggers (how, why, explain, show, does not understand). Explain may use Scout for its evidence.
   - Align, Debug, Implement and other phases may consume Scout evidence; Scout adds no mandatory gate to any phase.

## Acceptance

1. All three presets contain `axstack-explore-codebase-luna` and `axstack-explore-codebase-flash` with the bindings in scope 1, in the existing key order; `bun run test:all` passes, including readiness for each preset and the updated claude-only absence-list test.
2. `skills/axstack-scout/SKILL.md` exists, is installed with the other phase skills, and is listed in the README with the skill count updated.
3. Prose-contract tests fail when any of these is removed or inverted: single lookups stay in-chat; only a driver or owner dispatches; 1–3 facets each searching the whole repository; a Haiku+Luna pair per facet in mixed; an unavailable required seat holds without substitution while a Flash launch failure, trust/login prompt or prompt block records `absent (<reason>)` and Scout continues; not-found claims carry command, scope and content identity; per-claim reconciliation without averaging; the driver re-checks answer-changing not-found claims; findings are reused only while their content identity is unchanged, including untracked file contents; a first-launch rejection stops siblings of that configuration; an uncertain dispatch is reconciled, not called absent; codex-only uses a Sol+Luna pair per facet and claude-only a Haiku seat per facet; Sol+Luna agreement is not cross-family corroboration; a Flash hold covers only the Flash seat and Scout still returns the other seats' summary; each seat report holds at most about 15 claims, each with a Research label.
4. Research and Improve name Scout for broad mapping. A test asserts Scout's description names evidence gathering for an agent and contains none of Explain's user triggers; Explain's existing description tests stay as they are.
5. (a) Using a mixed roles file built from the branch, saved capabilities, saved codex and claude pickers, and an Antigravity picker `{"chosenInstanceId":"antigravity"}`, `dispatch-plan --kind task` exits 0 for each Scout role and emits `claude-haiku-5-5` high, `gpt-6-luna` xhigh and `gemini-3.8-flash-medium`. (b) After reinstall, one live mixed Scout run with 3 facets on this repository dispatches through T3, verifies each seat's configuration by `t3_thread_configuration` read-back, records the first-launch receipt per configuration, and stores 7 seat reports (or 6 plus a recorded Flash absence or Flash hold) in the run evidence folder.
6. Release vX.Y.Z is published under the standing `AGENTS.md` release authority, the human approves the npm stage, the run's `Release:` field is filled, and `axstack --version` matches on io, iobook, iobox and VPS.

## Exclusions

- No helper script, threshold calculator, daemon or programmatic trigger.
- `axstack-research-code`, `axstack-explore-execution` and their `-sol` pairs are unchanged.
- No change to how Research's other branches (requirements, web, web-google, X) dispatch.
- No change to active runs: new roles reach new runs only.
- No measurement harness for cost, latency or recall in this spec.

## Decisions

| Decision | Choice | Source |
| --- | --- | --- |
| Trigger | Threshold guidance, not every exploration | User Q1a |
| Seat count | 1–3 facets, Haiku+Luna pair per facet, one Flash; 7 is the ceiling | User Q2a |
| Single-provider presets | Codex-only Sol+Luna per facet; claude-only Haiku per facet; Flash absent | User Q3a |
| Slicing | By facet with repo-wide search, not by directory | Opus over Astra (Align round): directory scope cannot support not-found claims |
| Labels | Research labels plus `not found in <scope>` with command and content identity | Both advisers, merged |
| Role IDs | Keep `axstack-explore-codebase`; add `-luna`, `-flash` | Opus |
| Content identity | HEAD SHA plus `git diff --binary HEAD` digest and untracked path+hash list when dirty; ignored files out of scope | Astra r1/r2, Opus r2 |
| Flash effort | `gemini-3.8-flash-medium`, `thinkingOptionId: "medium"` | Opus spec r1 probe |
| Codex-only corroboration | Sol+Luna agreement is same-family, not cross-family | Opus spec r1 |
| Flash missing model | Existing unavailable-model rule; no new absence reason | Opus spec r2 (role-roster.md:54-55, routing.md:39) |
| Mode IDs | Codex/Antigravity `full-access`; Claude incl. claude-only absences `bypassPermissions` | Opus spec r3 |
| Flash hold scope | A Flash hold covers only the Flash seat; Scout returns the other seats' summary | Opus spec r3 (routing.md:21-22) |
| Reuse | Any content-identity change re-scouts all needed facets | Opus spec r3 |
| Flash optional in mixed | Flash is an optional seat; Haiku and Luna are required | Opus Align r1 (role-roster.md:50-53, 58-59) |
| Flash job | Whole-question breadth pass for missed boundaries and counterexamples | Astra Align r1 |
| Added tests | Flash-hold-only, claim cap and per-claim labels join acceptance 3 | Opus spec r4, diligence rev 4, Astra delta dispute |
