# Spec prototyping

Revision: r7 (draft, 2026-11-14)
Authoritative store: this repository file, `docs/specs/spec-prototype.md`
Source: Matt Pocock, "Don't waste time on specs: /prototype instead" and
`mattpocock/skills` `skills/engineering/prototype` (main, read 2026-11-14).

## Decision brief

**Problem.** Align and Spec settle every design question in prose. Questions
about how something should look, how it should behave, or what a state model
should allow are hard to answer on paper. The user approves a spec they
cannot try, and the implementer guesses from prose.

**Change.** Align may defer such a question to Spec, tagged
`Open (prototype):`. Before the first draft adviser round, Spec builds a
throwaway prototype that answers it. The user tries it and gives a verdict.
Each verdict becomes a `Decisions` row. The prototype is kept on an unmerged
`prototype-axstack-<slug>` branch, and the spec links its pinned commit so the
implementer can read and reuse it.

**Before / after.**

- Before: Align asks "group search results by diagram, or show them inline?"
  The user guesses. The spec says "inline". The implementer builds something else.
- After: Spec shows three variants. The user says "search box from A, layout
  from C". A second round confirms it. The spec records the decision and links
  the pinned prototype commit.

**Included.**

- Align: the deferral tag, and asking its questions in Spec.
- Spec: a bounded prototype step (3a), with a new `references/prototype.md`.
- One narrow pre-approval exception for a prototype author and one create-only
  branch push, stated in the shared contracts that would otherwise forbid it.
- Tickets and Implement: read the pinned prototype as reference only.
- Prose-contract tests for the safety rules, and a release.

**Excluded.**

- No standalone prototype skill, no new phase, no new role.
- No prototype for small-change work or questions discussion can settle.
- No prototype in planning-only, read-only, or stop-after-phase runs, including
  "write the spec and stop": Align settles those questions by discussion.
- `axstack-brainstorm` stays report-only and keeps its no-prototype rule.
- No PR, merge, or cherry-pick of a prototype branch; no prototype-branch cleanup.
- No change to the question ceilings (20, justified 35). Only deferred
  `Open (prototype):` items skip the refinement opt-in (SP-1).
- Questions raised after spec approval follow Material revisions.

**Risks and trade-offs.**

- **Cost.** Token cost per prototype is unmeasured. SP-5 caps bound user
  rounds and author work, not tokens.
- **Pre-approval writes** before gate 1, bounded by SP-5 Authority and SP-6.
- **Phone review.** Real-page variants reach the phone as screenshots. When the
  user must interact and cannot reach the app, the mock tier applies (SP-3).
- **Unverified:** no live round has run; T3 inline pages with stateful
  scripts and phone review are untested.

**Decisions needed from the user.** None open. D1 to D4 are yours. D5 to D11
are defaults; override any at approval. The ones with real alternatives:

- D5 store: repo Markdown (alt: GitHub issue).
- D8 caps: 3 rounds, 2 questions (alt: 1 build + 1 revision, cheaper, no A/B/C→D loop).
- D11 inline prototype pages skip explainer review, design review, the
  word cap, and Delivery's design-repair loop (alt: keep them, slower and
  costlier per round).

## Decisions

| ID | Decision | Source |
| --- | --- | --- |
| D1 | Prototype only open look, behave, or state-model questions discussion cannot settle (delivery runs only: SP-1, adviser narrowing) | User, Q1 |
| D2 | Two kinds: UI variants in the real page with a switcher (fallback tiers: SP-3), and a logic demo shown inline | User, Q2 |
| D3 | Keep each prototype on an unmerged branch linked from the spec (push timing and abandoned prototypes: D10) | User, Q3 |
| D4 | Remote branch name is `prototype-axstack-<slug>` | User, chat |
| D5 | Store this spec as repository Markdown under `docs/specs/` | Default: repo precedent |
| D6 | `axstack-author` builds and commits on its encoded branch; the driver pushes that SHA | Default: advisers |
| D7 | Each decision presented counts as one `Qn` in Align's cumulative count | Default: advisers |
| D8 | Caps: per question 3 review rounds and 3 build-or-revise sends with 1 repair each; 2 prototyped questions per spec | Default: Claude adviser |
| D9 | `Decisions` rows bind; the prototype illustrates | Default: sketch `Binding` rule |
| D10 | Push once, at the verdict, create-only; abandoned prototypes are not pushed | Default: advisers |
| D11 | Inline prototype pages skip explainer review, design review, the word cap, and Delivery's design-repair loop | Default: Claude adviser; Codex preferred keeping them |

## Design

```text
Usage: Align read-back: "Open (prototype): how should search results group?"
       Spec 3a records:
       Prototype: prototype-axstack-diagram-search (never merge)
         https://github.com/<owner>/<repo>/tree/<sha> | entry: <cmd or file>
         | <question> | <verdict>
Shape: Align deferral -> Spec 3a (author worktree -> show -> Qn rounds)
       -> driver create-only push -> Decisions rows -> first adviser round
       -> Tickets copy the line -> Implement reads the pinned commit
Binding: carrier tag, gate, caps, authority exception, author/driver split,
         create-only push, no-merge rule, no-verdict exits, binding rule
Flow + failure: push rejected (ref exists) -> next suffix; protected or
                ambiguous -> capture held; start command fails -> mock tier
We accept: pre-approval writes and one pushed branch for higher-fidelity decisions
Rejected: draft PR (conflicts with D3 and no-draft rule); evidence-only bundle
          (other hosts cannot reach it); new prototyper role; PR preview URL
          (preview.md is bound to PRs)
Open: none
```

Rung: 1. The change crosses Align, Spec, Tickets, Implement, and shared rules.

## Execution requirements

One outcome: the prototype step ships whole. SP-1 to SP-8 are its parts;
SP-2 and SP-4 are rules inside SP-3 and SP-5.

### SP-1 Deferral and gate

- Align defers a look, behave, or state-model question only in a delivery run
  whose substantial work continues to Spec. Otherwise it settles the question
  by discussion as today. Rung does not gate deferral.
- The carrier is `Open (prototype): <question>`, on the sketch's `Open:` line
  or as a tagged read-back item. A plain `Open:` keeps its existing meaning.
- A deferral does not block Align completion. Questions about a deferred item
  are asked in Spec, inside Align's cumulative count, and need no refinement
  opt-in.
- Produces: tagged items. Consumes: Align read-back.
- Acceptance: tests fail when the gate, the tag, or the in-count rule is
  removed or inverted.

### SP-2 Question first

- Before dispatch, the driver writes the question in one sentence; it appears
  at the top of the prototype. One prototype answers one question.
- When the question is also a brainstorm question, the brainstorm runs first;
  the prototype then tests the chosen candidate with the user.

### SP-3 Kinds

- **UI kind**, three tiers:
  1. About three variants (at most five) in the real page that disagree about
     structure, not colour, with a variant switcher (for example a
     `?variant=` parameter or a floating bar).
  2. One self-contained HTML mock with a variant switcher, shown inline with
     its fidelity limits at the top, when the app cannot run on the run's host,
     or when the user must interact and cannot reach the app.
  3. When neither answers the question, the question takes a no-verdict exit
     (SP-5).
  The author runs the documented start command first and falls to tier 2 in
  the same dispatch if it fails. The step never re-routes the run.
- **Logic kind.** One self-contained HTML file, shown inline under SP-5a:
  visible state, controls to drive it, and examples where useful. The logic is
  a small pure module with no DOM code, in its own script block in that file.
- Pick the kind from the question; if unclear, match the surrounding code
  (page or component: UI; module: logic) and state the assumption at the top.
- Use the smallest presentation that answers the question.
- Produces: a runnable prototype. Consumes: the one-sentence question.
- Acceptance: a test fails when the variant switcher or the no-re-route rule
  is removed.

### SP-4 Rules for both kinds

- Marked as a prototype and located next to the code it informs.
- Starts with one command or one double-click.
- State in memory. When persistence is the question, use a local scratch file
  or database named `PROTOTYPE-wipe-me`; inline copies never use storage.
- No automated test suite and no speculative reusable framework. Runnable and
  interaction checks in SP-5 still apply.
- Variants are read-only and stub every mutation. Use only
  repository-documented dev or test data sources, never production secrets.
  Prototype status grants no production data, credential, transaction, or
  infrastructure authority.
- Acceptance: a test fails when the mutation stub or no-authority rule is removed.

### SP-5 Build, review, iterate

- **Authority.** One bounded pre-baseline exception, in delivery runs only:
  one author per question, the files the brief names and nothing else, and one
  create-only push of a never-merged ref. The dispatch binds to the deferred
  question and the current draft revision in place of an approved identity.
  The driver records it on the run record's `Authority:` line.
- **Build.** The driver dispatches `axstack-author` through `delegate_task`
  with `isolation:"worktree"` on its encoded branch from a pinned base SHA.
  Prototype commits include `[skip ci]`.
- **Completion.** Terminal checks, non-empty diff, clean tree, and run
  evidence (start command and observed output). No red/green logs.
- **Show.** Static look: one screenshot per variant at 390x844 and 1440x900,
  captured by `axstack-ui-verifier` on a detached checkout of the prototype
  SHA, shown inline. Observed behaviour: add a short GIF. Interaction needed:
  follow the SP-3 tier; a reachable real app is used directly, otherwise the
  tier 2 mock or logic page is shown inline under SP-5a.
- **Review.** Each decision presented, including the cap question, is one
  `Qn` under Align's focused-round rule with a driver recommendation, reason,
  and trade-off. It is not an advised hold. Keep `Autopilot: on` and record the
  wait in `Next:`; use `paused` only when no other authorized work can advance.
- **Caps.** Per question: one author, at most 3 review rounds, and at most
  3 build-or-revise sends to that author, each with at most one verification
  repair. Per spec: at most 2 prototyped questions. The driver records these
  caps in the dispatch brief. Before spending the last question in the
  applicable ceiling (20, or the justified 35), the driver stops. At any
  cap, ask once (as a `Qn`, if budget remains): extend by one bounded round,
  settle by discussion, or drop. Record dispatches and rounds
  per question.
- **No-verdict exits.** Tier 3, abandonment, drop, or a spent budget
  each return the question to discussion as an ordinary `Qn`. With the budget
  spent, the question goes under "Decisions needed from the user" in the brief
  so spec approval settles it. It never appears settled.
- **Later questions.** A new deferred question found during drafting or
  adviser review re-enters this step within the same caps. A verdict that
  changes draft meaning refreshes adviser and diligence receipts under the
  existing rules. A verdict never approves the spec.
- Produces: verdicts and `Decisions` rows. Consumes: tagged items, draft revision.
- Acceptance: tests fail when the authority limits, the author-commits /
  driver-pushes split, the completion exemption, the caps, or the no-verdict
  rule is removed or inverted.

### SP-5a Inline prototype pages

- Prototype pages follow every `inline-pages.md` rule except
  `axstack-explainer-review`, design review, the word cap, and Delivery's
  design and decency repair loop. Every other failed check is still
  repaired, within `prototype.md` caps. A check still failing at a cap holds
  the page, and the question takes a no-verdict exit (SP-5). The page says "prototype"
  at the top. Colours use `var(--x, <fallback>)` so the file also works
  standalone.
- Produces: an inline page. Consumes: the prototype file.
- Kept rules, named for tests (not exhaustive; every other `inline-pages.md`
  rule also stays): self-contained bytes, no network, no storage, no modals or
  popups, the exact-byte scan, both driver previews (layout, theme, height,
  network, zero console errors, empty `missingImages`), semantic and
  accessible markup, the interactive `axstack-ui-verifier` pass, and
  driver-only `html_render` from exactly the checked bytes.
- Acceptance: a test fails when the exemption list is not exactly these four
  (one removed or another added), or when a named kept rule is exempted for
  prototype pages.

### SP-6 Capture

- **Slug.** Normalise as for encoded branch segments.
- **Scan.** Before the push, scan the diff for secrets and personal data. A
  failed scan holds the push.
- **Push.** The driver pushes once, at the verdict, create-only; the author
  never pushes:
  `git push --force-with-lease=refs/heads/prototype-axstack-<slug>: origin <sha>:refs/heads/prototype-axstack-<slug>`.
  It creates an absent ref and never changes an existing ref. On rejection
  because the ref exists, use the next suffix (`-2`, `-3`). An existing
  identical tip may report up to date; that is not proof this push created
  it, so use the next suffix. Tell creation by `[new branch]` in the output,
  not the exit code. Then read the remote ref back and confirm it equals the
  author head. A protected or ambiguous result holds capture only and records
  `Prototype: capture held (<reason>)`; inspect remote state before any retry.
  Never open a PR or merge.
- **Not candidate publication.** This push skips candidate-publication
  diligence, review, and PR rules, only because the ref never merges.
- **Record.** In the spec's `Design` section, or Evidence and history when
  no sketch exists, per question: branch (marked never-merge), pinned
  `https://github.com/<owner>/<repo>/tree/<sha>` URL, entry point, question,
  and verdict. Each verdict `Decisions` row cites its `Qn`.
- **Worktree.** Removable when the remote readback matches the author head,
  or when the prototype is abandoned and its tree is clean. Keep the local
  branch. Existing terminal, ownership, and evidence guards still apply.
- Produces: pushed ref and record line. Consumes: author head.
- Acceptance: tests fail when the create-only push, the no-PR/no-merge rule,
  or the not-candidate-publication scope is removed.

### SP-7 Downstream use

- Tickets copy the prototype record line into each affected task.
- Implement reads the pinned commit as reference. It may copy code into the
  real change under strict TDD and ordinary review, including cross-model
  review. It never merges or
  cherry-picks the prototype branch.
- `Decisions` rows bind; where the prototype shows something no row captures,
  follow the rows. An unfetchable SHA makes the reference unavailable, not a hold.
- Produces: task reference lines. Consumes: the SP-6 record and `Decisions` rows.
- Acceptance: tests fail when the no-merge/no-cherry-pick rule, the
  rows-bind rule, or the ordinary-review rule for copied code is removed.

### SP-8 Delivery surfaces

- `skills/axstack-align/SKILL.md`, `skills/axstack/references/design-lens.md`: SP-1.
- `skills/axstack-spec/SKILL.md`: step 3a before the first draft adviser round.
- `skills/axstack-spec/references/prototype.md`: SP-2 to SP-6.
- `skills/axstack-spec/references/format.md`: the record line.
- `skills/axstack-tickets/SKILL.md`, `skills/axstack-implement/SKILL.md`: SP-7.
- `skills/axstack/references/contracts.md`: the pre-baseline exception pointer.
- `skills/axstack/references/lifecycle.md` and `t3-runtime.md`: completion
  exemption and dispatch binding for prototype authors; runtime author retention.
- `skills/axstack/references/candidate-publication.md`: SP-6 scope clause.
- `skills/axstack/references/workspace-hygiene.md`: worktree endpoints.
- `skills/axstack-explain/references/inline-pages.md`,
  `skills/axstack-explain/references/delivery.md`, and
  `skills/axstack-explain/SKILL.md` §3: SP-5a.
- `docs/workflows.md`: matching description; Brainstorm's line unchanged.
- Tests under `tests/workflows/`, red before the prose change, failing on
  removal or inversion and surviving rewording. Raise the prose-size ceiling
  rather than compress unrelated text.

## Verification decision

No runnable app behaviour changes; this is shipped skill prose.
`verify-axstack` covers package contents. Verification is `bun run test:all`
plus `verify-axstack` package checks.

Release: `AGENTS.md:82` standing release and install authority, via
`.github/workflows/publish.yml`, then reinstall and verify on io, iobook,
iobox, iosatellite, and vps. Each host reports its `axstack-default-sync`
timer and pool drop-in state; iosatellite also reports provisioning and
closed-lid state separately.

## Evidence and history

- r1 (sha256 6283711e...5943): first draft after Align Q1 to Q3 and the
  branch-name instruction.
- r1 advisers: Codex AGREE-WITH-CHANGES (3H, 6M); Claude AGREE-WITH-CHANGES
  (5H, 10M, 7L). All accepted.
- r2 (sha256 5e6c6440...bc01). Advisers: Codex AGREE-WITH-CHANGES (2H F1-F2,
  5M F3-F7, 2 KISS); Claude AGREE-WITH-CHANGES (1H N1, 5M N2-N6, 9L).
  Diligence FINDINGS (5M F1-F5, 6L).
- r3 dispositions:
  - Accepted: Codex F1-F7, K2; Claude N1-N6, L1-L9, KISS cuts 1-4;
    diligence F1-F5 and lows (variant count from upstream, scratch
    persistence restored, defaults shown with options, D1 wording,
    stop-after-phase stated).
  - Disagreement Codex K1 vs Claude N5 (inline review exemptions): took
    Claude's explicit exemption as D11, shown to the user as an overridable
    default, because SP-4 bans test suites and reusable frameworks and existing cosmetic
    text is already non-blocking.
  - Codex 8 vs Claude M5 (hold type): settled as a `Qn`, not an advised hold,
    with Autopilot kept `on` (Codex F6, Claude L1 agree).
  - Acceptance trimmed to safety rules (Claude KISS 4); reviewers catch the rest.
- r3 (sha256 80185dde...b389). Advisers: Codex AGREE-WITH-CHANGES (3L);
  Claude AGREE-WITH-CHANGES (7L). Diligence FINDINGS (3M, 10L).
- r4 dispositions: all accepted. Selector restored as a required switcher
  with example forms (diligence F1, Codex N3, Claude K3). Produces/Consumes
  and acceptance added to SP-3, SP-5a, SP-7; D6 split now tested (diligence
  F2). SP-5a rewritten by reference with the word cap exempt and disclosed
  (diligence F3, Claude R1). Push wording (Codex N1), Show follows tier
  (Codex N2, diligence L4), one author with 3 sends (Claude R2, diligence L5),
  Rung clause (Claude R3), D5 to D11 (Claude R4, diligence L9), skip removed
  (Claude R5), record location and never-merge mark (Claude R6, diligence L10),
  ceiling and script-block wording (Claude R7), opt-in wording (diligence L7),
  Implement review gate (diligence L8), 100k estimate cut (Codex KISS),
  worktree-endpoint test cut (Claude K2). Diligence r3 L3 (budget before
  dispatch) and L6 (D11 rationale) carried to r5.
- r4 (sha256 ad0d62d4...2272). Advisers: Codex AGREE (0 findings); Claude
  AGREE-WITH-CHANGES (7L S1-S7). Diligence PASS (6L La-Lf).
- r5 wording pass, meaning-preserving: D2 row wording (La); one-outcome line
  (Lb, S6); repair exemption scoped to the design loop with hard rules kept
  (Lc); D8 numbers (Ld); D11 rationale (Le, S7); named history (Lf); SP-5a
  acceptance names kept checks (S1); copied-code review moved into the rule
  and tested (S2); never-merge mark in Usage (S3); D1/D3 point to adviser
  defaults (S4); driver-only push and `[new branch]` signal (S5); line wrap
  (S7).
- r5 (sha256 43abb4fb...c2c5). Delta confirmation: Claude CONFIRM (3 nits);
  Codex DISAGREE: SP-5a acceptance replaced "widens or narrows" with a
  finite subset, weakening coverage of e.g. a new storage exemption.
- r6: SP-5a lists every kept rule and tests that none is exempted. This is
  finite, so testable (Claude r4 S1), and covers all widening (Codex r5).
  Claude nits N1 (D2 tier pointer) and N2 (no exhaustive hard-rule list in
  the repair sentence) applied. Full adviser round required (seat disagreed).
- r6 (sha256 2968214b...068e). Codex DISAGREE (F1 medium: kept list
  incomplete, widening not fully guarded); Claude AGREE-WITH-CHANGES (T1-T3
  low, same gap); diligence FINDINGS (F1 medium same gap; F2-F4 low).
- r7: SP-5a closes the exemption list at exactly four, tested with the
  bounded-list pattern in `tests/workflows/analysis-pairs.test.js`, and
  names the kept rules its tests cover (Codex F1, Claude T1/T2, diligence F1).
  The r6 claim "covers all widening" is withdrawn; the closed list replaces
  it. Cap end state added (diligence F3). D3 points to D10 for abandoned
  prototypes (diligence F4). Not applied, by disposition: diligence r4 Ld's
  pre-build reachability check (adds a requirement; SP-3 already preflights
  the start command), and diligence r3 L4/L10 cosmetic residuals (rule
  restatement across sections). Claude N3 line wraps are cosmetic.
