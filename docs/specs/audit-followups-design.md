# Audit follow-ups and Explain design guidance

**Status:** Approved rev 4 (2026-10-15, user approval in chat; reviewed content SHA-256 1d419f59c0ce3b134a44914c2f75ac77c58f5961127479e5f04f780f445fc803). **Repository:** `axatbhardwaj/axstack`. **Source baseline:** `9698c8e` (v0.40.0; owned skill prose is unchanged on `main` at `32ee66b`). **Align record:** private run `20261014-mode-skill-audit`. It holds Q1–Q6, three Align adviser rounds, three spec adviser rounds, spec diligence, and these research notes: mine-a, mine-b, audit, product-audit and threads-gate-census. Host, project and thread details for D3 stay in that private record.

## Outcome

The audit found four problems worth fixing now. After this work:

- Parallel runs no longer collide on an exact prose-size number, and contract text is never trimmed to fit a ceiling.
- Close-out checks a settle read-back for every delegated child and launched writer. Each unsettled exception needs a hold the user accepted. This extends the existing same-turn settle rule in `workspace-hygiene.md`.
- About 456 completed delegated threads from the 2026-10-15 census are either settled or held per host and project, apart from recorded exclusions.
- The quiet review-manager gate gets a dated keep-or-retire decision from measured data.
- Explain HTML pages and published articles get deliberate, subject-specific visual design. A short Axstack design guide carries the taste-skill rules in Axstack's own words, and Anthropic's frontend-design is vendored as a reference.

## Delivery

An ordinary PR chain off `main`:

1. **PR B. Prose-size budget.** Merges first.
2. **PR D. Settlement as a checked step.** Starts from `main` after B merges.
3. **PR E. Design guidance.** Also starts from `main` after B merges. It has two commits:
   1. the vendored payload, provenance, source-proof test and path lists;
   2. the owned guidance, pointers, presets and contract tests.
4. **Release.** One `chore(release)` after B, D and E merge.

D and E do not depend on each other, and neither edits `prose-size.test.js`.

Approving this spec records release and host-mutation authority for this run: reinstall and verify on io, iobook, iobox and axat-vps. The user approves the npm stage. An unreachable host is held with a resume command, and the other hosts proceed.

Two items are operational, not PRs:
- **D3:** the one-time settlement backlog.
- **C:** the quiet-gate decision.

## Design

```text
B: Rung 0 (one test file). C: Rung 0 (no interface change; changed from Align Rung 1 because logging is deferred).
D
Usage: dispatch row `| <key> | … | settled: true (t3_thread_read <UTC>) |` or `| <key> | … | held: <reason> |`;
  close-out row `| Every run-owned delegated child and launched writer settled | passed | <inventory ref> | none |`
Shape: run-record dispatch table +1 column; close-out template +1 mandatory row; lifecycle close-out (1) +1 sentence;
  hygiene +1 pinned-child rule; brainstorm (arena.md synthesis) +1 pointer to the same-turn settle rule
Binding: column name, mandatory row, "task completion is not settlement", pinned children still settle; wording illustrative
Flow + failure: accept completion -> settle -> read back -> column; T3 refuses (for example parent_not_active, meaning the
  calling driver's own run is not live) -> column holds with the
  error -> close-out stays pending unless the user accepts that hold; never reactivate a parent
We accept: one column and one row of record overhead for a checkable settle step; settle may clear a pin the user put on a
  run-owned child without asking to keep it, and the user can re-pin it
Rejected: settle helper or collector schedule (no-daemon rule; the collector lives in a separate repository); t3-runtime.md edits
Resolved (measured on axat-vps, T3 0.0.46-nightly.20261014.3118): settle clears the pin; t3_thread_read and t3_thread_list
  show createdAt but no pin. Each local D3 driver confirms this on its own host with its first settle.
E
Usage: explainer brief "Load references/design.md; for this HTML page also read references/frontend-design/FRONTEND-DESIGN.md";
  reviewer brief: exact bytes + SHA-256 + render source, "judge renders at 728 dark and 360 light against design.md"
Shape: references/design.md (owned, ~1.5 KB) + references/frontend-design/{FRONTEND-DESIGN.md, LICENSE.txt} (vendored)
  + references/frontend-design/PROVENANCE.md (owned)
Binding: paths, pinned blob, precedence, carve-outs, cosmetic-tell exception, system fonts, no notes
Flow + failure: author -> driver checks and previews -> reviewer views renders -> tell -> one design round -> fresh renders ->
  tell remains -> delivered with the tell named (cosmetic only); render missing or stale -> design unknown -> held
We accept: ~10.9 KB extra context per page-authoring turn for subject-specific design
Rejected: verbatim taste references (43 KB, dead library pointers, web fonts); host-installed upstream skills; taste's scored loop
Open: can the installed explainer-review seat view html_preview images? The E seat probe answers this before the Usage examples.
```

## Scope and acceptance

### B. Prose-size budget

1. The aggregate owned-prose check uses a ceiling of 500,000 bytes. The always-loaded check (`contracts.md`, `lifecycle.md`, `routing.md`) uses a ceiling of 30,000 bytes.
2. The per-PR "+N bytes" comment history is replaced by one comment. It states both ceilings and this rule: the PR that would cross a ceiling raises it by a round step (+100,000 aggregate, +5,000 always-loaded), with a one-line reason in the PR body and commit message. Contract text is never trimmed to fit.
3. Prose-contract tests for semantic instructions stay unchanged.

Acceptance:
- **Red at the PR base:** a temporary one-byte addition outside the always-loaded set fails the test, and so does one inside it. The probe byte is never committed.
- **Green:** the same two additions pass at the new ceilings.
- **Mutation check:** lowering either new ceiling below the measured value fails the test.
- PR D and PR E merge without editing `prose-size.test.js`.
- Fixtures use an owned 0700 `TMPDIR` outside `$HOME`.

### C. Quiet-gate decision

1. **No code or prompt change.** `review-manager-prompt.md` and `automations.md` stay unchanged until the verdict, so the measurement window stays clean. A keep verdict may add quiet/full and trigger logging later, as its own small change.
2. **Trigger.** Approving this spec authorizes one T3 interval schedule bound to this driver thread. It first fires at or after 2026-10-27T15:04Z and is deleted in the turn it fires. This is an exception to the 24-hour task-deadline default; the run-watch schedule is the precedent. Whether or not the schedule is created, `Pending:` holds the date, the scheduledTaskId and a ready-to-paste resume prompt. After the release the run stays open, paused with `Next:` C. Close-out, including schedule retirement, follows C's receipt.
3. **Measurement.** On axat-vps, the driver runs the saved census script, which is private run evidence, with its per-pass output sent to a private evidence path. From those rows it computes two windows with the same pricing method:
   - baseline: 2026-10-09T13:00Z → 2026-10-13T15:04Z;
   - after: 2026-10-13T15:04Z → run time.

   For each window it reports:
   - idle passes (passes that admitted no child jobs);
   - idle coordinator cost per elapsed day, and mean idle-pass cost;
   - quiet idle passes as a share of all idle passes;
   - coordinator cost of passes that admitted work.

   Before classifying a pass as idle, the driver reconciles the script's child-record count with the admission evidence. A missing child record must not turn an admitting pass into an idle one.

   Missed events come from the manager's `MISSED EVENT` lines and from event and admission timestamps, attributed to quiet or full passes. A missing marker does not prove there was no miss. The script produces numbers only; the driver applies the thresholds.
4. **Verdict.**
   - **Keep:** idle $/day falls at least 25%, the quiet share is at least 40%, and no miss comes only from quiet passes.
   - **Retire:** the idle saving is under 15%, or any miss comes only from quiet passes.
   - **Inconclusive:** any other result, or insufficient evidence. It goes to the user with the missing evidence and the next check.

   A retire verdict becomes its own small change.

Acceptance:
- A dated receipt with both windows' numbers, the missed-event attribution, and the verdict.
- The receipt lists coverage gaps: missing transcripts, missing rates, Codex-run passes without transcripts, unknown attribution, and job-thread cost not attributed.

### D. Settlement as a checked step

1. **Dispatch table.** The run-record dispatch table gains a column `Settle readback`. It holds `settled: true` with the `t3_thread_read` evidence, or `held: <reason>`.
2. **Close-out row.** The close-out acceptance table gains a mandatory row covering every run-owned delegated child and launched writer.
   - **Pass:** a current, thread-bound `t3_thread_read` shows `settled: true`. Task completion or `result_available` alone does not pass.
   - **Missing or failed read-back:** this is a hold, not a pass. A plain recorded reason does not satisfy the row. Close-out stays pending unless each unsettled exception has a user-accepted hold linked to its `Decisions` row, under the existing close-out contract.
3. **Lifecycle.** Close-out step (1) gains one sentence: settle each worker thread with `t3_thread_organize` and read back `settled: true`; a finished task does not count.
4. **Pins.** The Settlement section of `workspace-hygiene.md` gains one rule. A pinned run-owned child is still settled. T3's settle clears the pin, including a pin the child inherited from its parent at creation, so there is no separate unpin step. Native T3 tools do not show pins, so the read-back stays `settled: true`. If the user asked to keep a child pinned, hold its settlement with that reason.
5. **Brainstorm.** The synthesis step in `arena.md` gains one pointer to the same-turn settle rule for its candidate and judge threads.
6. **D3, one-time backlog.** This is metadata only: settle, which also clears an inherited pin. No archive, worktree removal, branch deletion or runtime-database write.
   - **Scope:** approving this spec is the user naming each host and project listed in the private run record as an `axstack-cleanup` backlog scope. Anything outside those scopes is reported and never touched.
   - **Selector:** delegated child threads created before 2026-10-15T04:55Z whose latest run is completed, and which are neither settled nor archived.
   - **Eligibility:** a child qualifies only if its parent thread is settled, or its run record is `Archived`. Before each unpin or settle, reconcile a fresh, fully paginated native inventory: ownership, accepted completion, latest run, descendants and queued work.
   - **Exclude:**
     - active or queued work;
     - user-created or user-taken-over threads;
     - drivers and launched writers;
     - children of a thread with an enabled schedule or an active run;
     - unaccepted completions;
     - held, failed, interrupted or cancelled runs;
     - unanswered questions, and FAILED or QUESTION markers;
     - ambiguous ownership.
   - **Refusals:** if T3 refuses a settle (for example `parent_not_active`, which means the calling driver's own run is not live), record that thread as an exclusion with the error. Never unsettle, unarchive or reactivate a parent.
   - **Pins:** before settling a backlog child, read its pin time, its creation time and its parent's pin time with a read-only query of that host's T3 state. Never write to that state.
     - **Inherited:** the pin is earlier than the child's creation, or equal to its parent's pin time. Settle the child.
     - **Any other pin:** treat it as the user's, and exclude that child with the reason, because settling would clear the pin.
     - **Pin time unreadable:** exclude only that child as UNKNOWN.
   - **Host and project execution:** each scope is processed by an authorized T3 driver in that project on that host, using that server's native tools. This axat-vps driver handles only its own project's eligible resources, and reports other projects' resources without changing them. Each scope without a local driver is held with the exact selector and a ready-to-paste resume prompt for the user to start there. No worker transfers this run to another host, and SSH access does not grant remote T3 orchestration.

Acceptance:
- Prose-contract tests fail when any of these is removed or inverted, and they survive rewording:
  - the settle-readback column;
  - the close-out row;
  - "task completion is not settlement";
  - the rule that a plain reason does not satisfy the row;
  - the pinned-child settle rule;
  - the brainstorm pointer.
- A D3 receipt for each host and project scope covers:
  - before and after counts from a fresh native inventory;
  - settled IDs;
  - each pinned child's pin evidence and classification;
  - each excluded thread with its reason, including T3 refusals;
  - zero changes to excluded threads, and zero parent state changes.
- The census counts are discovery denominators, and drift is reconciled explicitly.
- Every scope has either its local driver's receipt or a recorded hold with the selector and resume prompt. An ordinary hold does not satisfy run close-out; item 2's user-accepted rule still applies.

### E. Design guidance for Explain and Publish

1. **Vendor frontend-design.** Copy `anthropics/skills` `skills/frontend-design/SKILL.md` at commit `41bbe19d` unmodified as `skills/axstack-explain/references/frontend-design/FRONTEND-DESIGN.md`. PROVENANCE records the full commit SHA.
   - **Pinned bytes:** the Git blob must be `a5333457c414d20d625f307df945842c0952ecc3`, the bytes saved in this run's evidence. If the upstream bytes differ, hold E1.
   - **Licence and provenance:** add its `LICENSE.txt` and a `PROVENANCE.md` that records "renamed, bytes unchanged".
   - **Reference only:** the file is not registered as a skill.
   - **Path lists:** list exactly `FRONTEND-DESIGN.md` and `LICENSE.txt` in `vendored-paths.js`, `bunfig.toml` and `biome.json`; the lockstep test requires all three. `PROVENANCE.md` stays owned.
   - **Source proof:** add a test like `anatomy-source.test.js` that pins the full SHAs.
2. **Owned guide.** Add `skills/axstack-explain/references/design.md`, about 1.5 KB, in Axstack's own words. It holds the following.
   - **Precedence:**
     1. Axstack page rules, plus this file's subject, colour, motion, font and no-notes rules.
     2. Source fidelity.
     3. The named tells below.
     4. frontend-design, for the approach and everything else.

     Restraint wins on inline pages. Published articles may take a bolder, distinct look each time, within rules 1–3.
   - **Named tells:**
     - eyebrow labels or tiny tracked caps;
     - a single styled accent word;
     - gradients, glass or resting shadows;
     - emoji or decorative blobs;
     - rows of identical cards or bordered boxes;
     - more than two typefaces or five sizes;
     - body text not in full ink, or not left-aligned by default.
   - **Carve-outs:** diagram edges and arrows, timeline order, tables and code paths are content, not ornament. An anatomy figure follows the anatomy kit. A behaviour that a higher-priority rule requires is never a tell.
   - **Colour:**
     - Inline pages use `--background` as the ground, `--foreground` as the ink, `--muted-foreground` only for secondary text, and `--ring` as the single accent.
     - Published articles may use a small named palette, checked in light and dark.
   - **Subject first:** structure comes from the actual subject and question. Explain never stops to confirm the subject.
   - **Motion:** static by default. Any motion is CSS-only and respects reduced motion.
   - **Fonts:** inline pages use only the T3 font variables. Published articles use system font stacks. No font files and no network.
   - **No notes:** keep no design notes or history across pages. frontend-design's note-keeping hint does not apply.
   - **Credit:** taste-skill (MIT, `Leonxlnx/taste-skill` at commit `f624f37a`) and frontend-design.
3. **Who loads it.** `axstack-explainer` loads `design.md` and reads `FRONTEND-DESIGN.md` for every inline HTML page and every Publish article adaptation. It loads neither for chat Mermaid or anatomy figures. Design review (item 4) covers the same pages. Chat Mermaid, anatomy figures and explicitly requested standalone HTML files keep today's review and Visual QA.
   - **Publish:** sends the article adaptation (art direction plus the standalone light and dark theme) to `axstack-explainer` with a bounded brief.
   - **Driver:** coordinates checks and previews, and owns publication.
   - **UI verifier:** Publish's Playwright checks and screenshots stay with `axstack-ui-verifier` under the existing Visual QA routing.
4. **Design review.** `axstack-explainer-review` judges two renders of the exact bytes, at 728 px dark and 360 px light, against `design.md`.
   - **Inline pages:** the reviewer renders the bytes itself with `html_preview`, as a non-publishing self-check. This does not replace the driver's required previews or any verifier pass.
   - **Publish:** the UI verifier captures the final article at 728 px dark and 360 px light before design review. The driver forwards the screenshot paths and their bound artifact SHA-256 to the reviewer. Publish therefore records these screenshots before the review. Any byte change requires fresh screenshots and a fresh review.
   - **Tells:** a named tell is a blocking finding for one design-only repair round with the same author. That round counts within the existing two-round visual-repair limit, and no second design-only round follows. A cosmetic tell still present in fresh, exact-byte renders becomes a disclosed, non-blocking design exception. It is recorded in evidence and named in the delivery, never described as fixed or as a clean design pass. This exception never waives source-fidelity, security, asset, theme, layout, accessibility, interaction or publication requirements. A tell that also causes such a defect keeps that defect's normal hold and repair rules.
   - **Missing renders:** an unavailable, unreadable or stale render leaves design review unknown, and the visual or publication is held under Delivery. Inline delivery may use the existing plain-prose fallback. An unknown check is not a tell that expires after one round.
   - **Overall look:** advisory.
   - **Interaction and fidelity:** interaction checks stay with `axstack-ui-verifier`, and source-fidelity review is unchanged.
   - **Files to update:** `delivery.md` (next to its two-round fallback), Visual QA, Publish's review and hold wording, the role notes in all three presets, and `presets.test.js`.
5. **Attribution.** Explain's attribution line keeps its existing ending ("guidance uses Axstack's own words"). The vendored-reference note goes on its own line.
6. **Unchanged rules.** Inline-page and Publish asset, theme, word-cap and preview-size rules stay as they are.

Acceptance:
- **Contract tests** fail when any of these is removed or inverted, and they survive rewording:
  - the precedence order;
  - the carve-outs;
  - the explainer load and scope instruction;
  - the reviewer render sources;
  - the one-round limit;
  - the cosmetic-tell exception and its non-waiver list;
  - "unknown holds";
  - the system-fonts rule;
  - the no-notes rule.
- **Source proof:** the source-proof test fails when the `FRONTEND-DESIGN.md` bytes differ from blob `a5333457…` or the licence file is missing. `verify-axstack` package contents include the vendored files.
- **Seat probe:** before the Usage examples, the installed `axstack-explainer-review` seat renders a fixed probe page with `html_preview`. It reports one detail that cannot be read from the bytes, such as the colour of a swatch painted with `var(--ring)`. The driver checks the answer against its own preview and records pass or fail for that seat. It also covers Publish's source: the seat opens one `axstack-ui-verifier` PNG by path and reports a number the probe page drew at random. The driver checks that number against the same PNG. If the probe fails, design review stays unknown for that seat, and the Usage acceptance is held for the user's decision.
- **Usage examples:**
  - Record two fixed briefs verbatim before building the "before" pages: one inline technical flow and one published-style article.
  - Build each page before and after the change. The published-style example uses Publish's render source.
  - The "after" pages pass the existing checks: asset scan, theme, word cap, previews at 728 dark and 360 light, and zero console errors.
  - The reviewer records a design verdict from renders it has viewed: passed, or tells named. An unknown design check does not satisfy this item. The "before" pages need only the existing checks.
  - Both receipts identify the artifact SHA-256, the screenshot producer and the matching render paths. Interactive pages keep their real-browser verifier pass.
  - Show each before/after pair as one comparison page, or in separate answers. No page is published.
  - Improvement is reported as a review judgment, not a guarantee.

## Verification decision

`verify-axstack` exists. It covers package contents and helper scripts, which includes E's vendored payload in `npm pack` and B's test change. Prose contracts use `bun:test` with real red-then-green evidence. E's visual result is checked by the seat probe and the Usage examples. No new verification skill is needed.

## Exclusions

- A personal mode skill or a packaged chat-mining generator. The "Working with me" globals are done outside this repository.
- The full taste-skill v2 workflow: direction generator, library, Node inspector and network imagery.
- Embedded or web fonts, and any general website builder.
- Upstream T3 issues, T3 code changes, release batching, and reusing reviews after base-only moves.
- The io thread-collector guard fix. It lives in a separate repository.
- Retiring the quiet gate, or adding manager logging, within this delivery.
- Personal names in the package or in this spec, and fleet data beyond the host names `AGENTS.md` already publishes.

## Decisions

| Decision | Source |
| --- | --- |
| Inline globals instead of a mode file. 12 of 16 paths (8 real files) applied on axat-vps, io and iobox; iobook's 4 paths are pending | User Q1, Q5, Q6; advisers r1–r3 |
| Fixes B, C and D chosen; upstream T3 issues not chosen | User Q2 |
| Product-repo audit done before cutting ceremony; keep review for security, infra, privacy and rollout | User Q3; product-audit note |
| Distill taste-skill; vendor frontend-design unmodified at `41bbe19d` / blob `a5333457` | User Q4; advisers r3 and spec-r2 |
| Explain and Publish only; system fonts | Driver default from the user's wording and the current asset scan; advisers r3 |
| **Changed from Align:** C logging deferred. C is a dated, measured decision with one interval schedule (exception to the 24-hour deadline default), adding a retire threshold and an inconclusive class from census B6. It reports the coordinator cost of passes that admitted work in place of the census's activity-adjusted saving | Driver; Opus spec-r1 S4; Astra spec-r2 accepts; user approval of this spec |
| **Changed from Align:** precedence puts the named tells above frontend-design | Driver; Opus spec-r1 S6; both advisers accept; user approval of this spec |
| **Changed from Align:** a cosmetic tell left after one design round is delivered and named, subject to all other required checks | Driver; Opus spec-r1 S5; Astra accepts with the design-only boundary; user approval of this spec |
| Added: the E seat probe (inline and Publish render sources) can hold the Usage acceptance for the user's decision | Opus spec-r2 R1 and spec-r3 O1; diligence L-c; user approval of this spec |
| Added: "Explain never stops to confirm the subject" overrides frontend-design's confirmation step | Opus Align-r3 receipt B1 (frontend-design conflict list); diligence L-e; user approval of this spec |
| **Changed from Align (mechanism):** the inline design review renders the exact bytes itself (`html_preview` returns images only to the caller). Publish screenshots come from the UI verifier, and Publish reorders previews before review | Opus spec-r1 S5 and spec-r2 R3; Astra spec-r2 #2; diligence F1 and F4; user approval of this spec |
| **Changed from Align:** the explainer authors the Publish article adaptation | Opus spec-r1 S7; diligence F4; user approval of this spec |
| **Changed from Align:** D3 runs per host and project with a local driver, and only on threads whose parent is settled or archived. Scopes without a local driver are held with resume prompts. Approving this spec is the user's acceptance of those holds for close-out, so the run can close with them recorded | Opus spec-r1 S2; Astra spec-r1 #4 and spec-r2 #1; diligence F2; user approval of this spec |
| **Changed from Align:** always-loaded ceiling raised from 27,309 to 30,000 and aggregate from 408,339 to 500,000, with +5,000 and +100,000 step rules | Driver; Opus spec-r1 O1; diligence F3; user approval of this spec |
| The shipped pin rule is "pinned children still settle", because T3's settle clears the pin and native tools do not show pins. The inherited-pin timing test is D3-only and uses read-only state | Opus spec-r3 B1 (measured T3 build); diligence L-b; user approval of this spec |
| Added: brainstorm settle pointer (same defect class as D) | Driver; Opus spec-r1 O9; user approval of this spec |
| Release and host-mutation authority recorded for this run; the user approves the npm stage | `AGENTS.md`; diligence L2; user approval of this spec |
