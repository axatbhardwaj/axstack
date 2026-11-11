<!-- Markdown counterpart of issue #180 approved rev 2 (SHA-256 e953d4733b534c0b8db828100df3680ef4c1fe52e750ced9d10002034ee66156) -->
# Design lens for Align, with an all-family design arena

**Status:** Approved rev 2 (2026-09-24). **Repository:** `axatbhardwaj/axstack`. **Source baseline:** `d3bdda1` (v0.20.21). **Align record:** private run `20260924-design-lens-align` (Q1–Q3, D1–D2; research note; four-candidate arena with two judges).

## Outcome

When a change warrants design, Align settles a good software design with the user interactively before spec and implementation. It asks focused question rounds, each with a recommendation, from a shared design vocabulary. The settled shape is a short sketch in the spec that tickets, implementation, review, and improve all use. Hard-to-reverse designs are proposed independently by every configured agent family in an arena, scored by two judges, and chosen by the user. Work that stays inside one module's existing interface pays no design cost.

## Delivery

A bottom-up `gh stack` of two PRs:

- **A. Design lens.** New `design-lens.md` reference, Align entry, downstream hooks (scope 1–5).
- **B. All-family design arena.** Arena widening, two new candidate roles, presets, installer, docs (scope 6).

## Scope

1. **Shared reference `skills/axstack/references/design-lens.md`** (about 3.5k characters, shaped like `blast-radius.md`). It holds the ladder, question areas, vocabulary, sketch format, and a list of candidate rubric criteria. For each arena, the driver picks three to six of these and tailors them into that question's rubric, as Align already requires. `lifecycle.md` gains nothing. `routing.md` gains one sentence in its Unclear bullet (trimmed to stay under 7800): a change that meets Rung 1 is Unclear and clarifies through `axstack-align`.

2. **Align "Design the shape" entry** in `skills/axstack-align/SKILL.md`, which loads the reference only when the ladder triggers.
   - **Rung 0, skip:** the change stays inside one module's existing interface, ownership, data flow, and failure guarantees. It gets zero design questions and carries no sketch. "Might be small" is not a reason to skip.
   - **Rung 1, design questions:** any change that fails Rung 0. Typical triggers: it crosses a module boundary; adds a module, service, interface, or external dependency; changes an existing interface or failure guarantee; or changes data ownership, a schema, or a wire or persisted format.
   - A design question does not by itself reclassify the work, so Rung 1 work can stay small. Routing's existing rule still applies: reassess size when a material design question is unsettled.
   - **Rung 2, arena:** a Rung 1 design that also meets the existing ADR test (hard to reverse, non-obvious trade-off).
   - The rung is settled from facts during research, never asked. There is no file-count or class-count threshold.

3. **Question rounds.** Ordinary numbered `Qn` questions, 1–3 per round, each with a recommendation, reason, and trade-off. They are asked only for unresolved areas and use Align's existing adviser critique. Design and arena questions count within Align's existing budget, which is unchanged: 20 normally, a justified extension up to 35, and an opt-in refinement of at most five. Order:
   1. **Scope:** what exists, the minimum change, and what is explicitly not built.
   2. **Caller first:** a realistic call site or usage is written before the shape.
   3. **Shape:** boundaries, module depth, ownership, invariants, seams, and adapters.
   4. **Flow and failure:** data flow, plus one realistic production failure per materially new path and its observable behavior.
   5. **Reversibility:** compatibility or migration commitments, alternatives rejected, "we accept X for Y".

   **Vocabulary** (in the reference): deep module, shallow module, interface as test surface, seam (one adapter is hypothetical, two make it real), locality, ownership, deletion test, red flags (shallow module, information leakage, temporal decomposition, pass-through), boring by default, reversible over clever. The red flags are prompts for evidence, not automatic defects.

4. **Design sketch.** Rung 1 and Rung 2 designs record a fixed text block, in the spec's `Design` section for substantial work or in the small-change intent that Align returns for small work:

   ```text
   Usage: <call site or command as the caller writes it>
   Shape: <signatures or a <=10-line ASCII/Mermaid diagram>
   Binding: <which lines are committed; the rest is illustrative>
   Flow + failure: <path -> one realistic failure -> observable behavior>
   We accept: <X> for <Y>
   Rejected: <alternative -> why>
   Open: <question?>
   ```

   Other records are unchanged: `CONTEXT.md` stays a glossary, ADRs keep their existing test, and settled choices stay `Decisions` rows. There is no design doc, ledger, HTML report, rules file, or stub phase.

5. **Downstream hooks** (one pointer each to the reference). Each applies only when the scope identity carries a sketch. Rung 0 work, and peer or codebase review with no sketch, are unchanged:
   - **Spec:** the sketch is part of the approved revision; acceptance includes the `Usage` line.
   - **Tickets:** tasks follow the sketch's modules; the named failure enters capability acceptance; a task spanning a sketch boundary is a split signal.
   - **Implement:** the author brief carries the sketch; on the normal behavior path the first red check targets `Usage` (the structure-preserving path is unchanged). Scrap on friction: a repeated workaround, or a boundary the sketch did not name, stops the author, who returns a sketch conflict; the driver reopens only the affected decision through Align under the existing material-revision rule.
   - **Review:** the architecture angle compares the candidate with the sketch and red flags. A deviation from a `Binding` line without an accepted spec revision is a finding.
   - **Improve:** uses the same vocabulary and red flags, and returns candidates in sketch form.

6. **All-family design arena (PR B).**
   - Align's arena, for Rung 2 designs only, fans out one candidate per configured family, each authored independently without cross-reading from the same brief: `axstack-advisor-astra` (Codex), `axstack-advisor-fable` (Claude), and new `axstack-arena-candidate-grok` (Grok) and `axstack-arena-candidate-antigravity` (Antigravity/Gemini).
   - The judges stay `axstack-arena-judge-astra` and `axstack-arena-judge-fable`, and score anonymized, relabeled candidates against the rubric criteria from the reference. The driver picks per the existing arena procedure, and the user decides.
   - Non-Rung-2 design questions keep the existing two-adviser critique.
   - **Seat availability:** no new exception. Every candidate and judge seat follows the existing contract (`contracts.md` Model discipline, `orca-runtime.md` launch reconciliation). An unavailable seat, meaning an Orca launch refusal or a failed worker receipt, pauses that question and is recorded. The user decides whether to proceed without it. An unsettled or uncertain dispatch is reconciled natively, never treated as absent. Align's hold sentence widens from "either adviser or judge seat" to any configured candidate or judge seat.
   - **New roles** in all three presets (24 → 26 role IDs), shaped like the existing `axstack-research-x` and `axstack-research-web-google` rows (launch by agent id, `model: null` with a note). In `codex-only` and `claude-only` they are intentional single-provider absences (preset provider, `model: null`, "(unavailable)"), exactly like `axstack-research-x` there. Those presets already hold the arena because their second adviser and judge are null, so their behavior does not change.
   - **Updates (full 24 → 26 sweep):**
     - installer: `src/roles.js` intentional-absence allowlist for all three presets;
     - docs and references: the role list and "24 role IDs" in `routing.md` (trimmed to stay under 7800), `orca-runtime.md:41`, `docs/installation.md:74,174`, `docs/workflows.md:51`, and README where `presets.test.js` checks it;
     - preset notes: every preset's judge notes ("both candidates" → "every candidate");
     - tests: `presets.test.js`, `roles.test.js`, `structural.test.js`, `owned-core.test.js`, `pending-repairs.test.js`, and `align-arena.test.js` (which currently pins two seats and says "small or routine questions never enter the arena");
     - scenario corpora: the role counts in `debug-scenarios.json:3` and `routing-scenarios.json:77-78`.

## Acceptance criteria (merge-ready)

- **Contract tests** (`bun:test` prose contracts) fail on the baseline text and pass after the change for:
  - the ladder: Rung 1 defined as failing Rung 0, the skip rule, no numeric threshold, and small Rung 1 allowed;
  - the Unclear pointer in `routing.md`;
  - the ordered question areas and the unchanged budget (20, 35, and 5);
  - the vocabulary and red flags;
  - candidate rubric criteria tailored by the driver;
  - the sketch block, including `Binding`;
  - each downstream hook and its "only when a sketch exists" condition, including the normal-path-only usage-first red check and affected-decision-only reopening;
  - the Rung 2-only all-family arena with anonymized judging and hold-on-unavailable seats;
  - the two new role IDs.
- **Scenario corpora** (structural only: schema and required fields, validated by the existing corpus tests; they are not behavioral proof):
  - new cases in `align-grilling-scenarios.json`: in-module change → Rung 0 with no questions; new external dependency → Rung 1; hard-to-reverse data-model choice → Rung 2 arena with four families under `mixed`; unavailable Grok seat → pause and ask the user; single-provider presets → the arena holds;
  - `review-modes-scenarios.json`: an unrevised `Binding` deviation is a finding;
  - `implement-loop-evaluator-inputs.json`: a repeated workaround reopens only the affected decision.
- **Installer tests:**
  - every preset installs 26 roles;
  - the new rows in single-provider presets pass as intentional absences;
  - installing over an existing 24-row `roles.json` yields 26 rows and reports the two added IDs.
- **Suite and budgets:** `env -u TMPDIR bun test` passes, and `routing.md` and `lifecycle.md` stay under 7800 characters.

## Verification (after release; separate host-mutation authority)

- Install on desktop and VPS; `roles.json` shows 26 roles.
- A live Align on one real Rung 1 change asks design questions and records a sketch.
- One Rung 2 arena launches four family candidates in the mixed preset and two judges.
- **Stays unverified until exercised live:** the seat-unavailable pause, `Binding`-deviation findings, and friction reopening. The scenario corpora do not prove them.

## Exclusions

- **Not added:** a separate design skill or phase, file-count or complexity gates, HTML reports, decision-ledger files, rules files, stub-first code, mandatory diagrams, and Conway checks.
- **Unchanged:** Align's question budget, the ADR test, the two judge seats, the model-discipline hold on unavailable seats, and the user approval checkpoint.
- **No new runtime pieces:** no daemon, scheduler, runtime database, state machine, or programmatic gate.
