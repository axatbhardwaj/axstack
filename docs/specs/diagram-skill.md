# Spec: `axstack-diagram` with a pinned archify viewer

Status: Draft rev 2 (2026-10-04). Store: this repo Markdown file.
Run: `20261004-diagram-skill`. The private run record holds the research notes, the
diligence report, and the adviser receipts.

## Goal

Axstack can draw accurate, good-looking diagrams. Explanations get an interactive
archify-style viewer for complex systems and Mermaid for chat, GitHub, and docs. Every
drawn node and edge is backed by inspected source or is marked as planned or unknown.

## Research summary (2026-10-04, diligence-checked)

- The current approach in the field: the agent writes a typed JSON spec; a fixed renderer
  draws it and a checker measures it; at most two repair rounds; honest reporting of
  which checks ran. Leaders: `tt-a1i/archify` (MIT, 77k stars), `cathrynlavery/diagram-design`
  (MIT, 43k), `nicobailon/visual-explainer` (MIT, 10k).
- Matt Pocock has no diagram skill; he prefers Mermaid ("far more reliable" than SVG) and
  "If the diagram needs a paragraph to be understood, redraw the diagram". `poteto/how` uses
  Mermaid or ASCII, "clarify, not decorate". `anthropics/skills` has no diagram skill.
- Most reported real-use failure: a diagram that passes every check and is still false.
- T3 Code chat renders ```` ```mermaid ```` fences (`pingdotgg/t3code`
  `apps/web/src/components/ChatMarkdown.tsx`); GitHub renders them natively.
- archify `594f6087358610bd16e64e5602976020871b6bff` runs under Bun 1.3.14: `validate` and
  `render` pass; `finalize` passed all four gates with Chrome (reproduced by diligence).
  With Chrome unavailable it returned `ok:false`, `status: "skipped"`, and exit code 2, so
  the exit code is never trusted. `ARCHIFY_UPDATE_CHECK_DISABLED=1` disables its network
  update check (`archify/bin/delivery-update.mjs:51`). The sparse `archify/` payload
  carries its `LICENSE` and `THIRD_PARTY_NOTICES.md`.
- T3 shows a Mermaid fence as a diagram once the reply settles; while it streams, the raw
  fence is visible.

## Settled decisions

| # | Decision |
|---|---|
| Q1 | Build an archify-like interactive viewer, not prompt-only diagrams. |
| Q2 | Mermaid is a valid format in T3 chat, GitHub, and docs (verified). |
| Q3 | Raise only the aggregate prose-size ceiling by the net bytes added; no `routing.md` line. |
| Q4 | Reuse upstream archify. The installer clones it at a pinned full SHA into a tools directory outside every skill root. This is an explicit exception to "self-contained, no runtime dependencies" for this one external tool only. Pin bumps happen only in a reviewed `chore` PR with a smoke run. |
| Q5 | Support all five archify types: architecture, workflow, sequence, dataflow, lifecycle. |
| Q6 | When the viewer is required and archify or Chrome is unavailable, hold and ask the user. No Mermaid substitute and no unverified HTML. A viewer whose receipt is not `status: "pass"` after two repair rounds is also held, never delivered. |
| Q7 | archify per-node detail cards are exempt from explain's 700-word cap. Each card has at most 40 words and cites its source. Node labels, headings, captions, and all non-card text still count. |
| Q8 | One-way roles: explain owns evidence, claim labels, the word cap, dispatch, and delivery; `axstack-diagram` owns format and visual rules and never calls explain. Direct invocation of `axstack-diagram` keeps the fidelity rules and the rendered QA. |
| D1 | Rejected: vendoring archify (11 MB, non-commercial brand-mark licences, prose budget) and rebuilding it (a large owned renderer). |
| D2 | Success is the `finalize` receipt `status: "pass"`, never the exit code. |
| D3 | Rules are written in Axstack's own words with a one-line credit to archify, diagram-design, visual-explainer, Matt Pocock, and poteto. No upstream templates are copied. |
| D4 | Trace motion, exports, share cards, and brand marks stay off unless the user asks. |

## Design

```text
Usage: axstack-diagram (loaded by axstack-explain or invoked directly) picks the format.
       An explicit viewer request or explain's complex-visual path -> archify HTML.
       Otherwise the destination decides: chat, GitHub, or docs -> Mermaid
       (accTitle/accDescr, no theme init); a large Mermaid diagram is split into views.
Shape: skills/axstack-diagram/SKILL.md (short router) + references/archify.md (IR authoring
       for the five types, finalize contract, holds) + references/fidelity.md (source
       rules, density, labels). One pin constant in src/. Installer: `install` sparse-clones
       archify/ at the pin into <tools-dir>/archify-<sha> (default ~/.axstack/tools,
       flag --tools-dir, test override AXSTACK_ARCHIFY_REPO) and writes the owned record
       skills/axstack-diagram/archify.json {path, sha}. The copy keeps an owners file
       <tools-dir>/archify-<sha>.owners.json listing each skills root that uses it.
       `uninstall` drops its owner; it removes the copy only when no owner remains and
       `git status --porcelain` is empty. A pin bump releases the old copy the same way.
       `check` reports the record, the checked-out SHA, and Chrome (ARCHIFY_CHROME honoured).
       An offline, git-less, or failed clone still installs the skills, prints
       "archify: unavailable (<reason>)", and `check` exits non-zero for that gap.
Binding: the skill reads archify.json and verifies `git -C <path> rev-parse HEAD` equals the
         recorded SHA; missing record, missing copy, mismatch, or missing Chrome -> hold and ask.
         Every call sets ARCHIFY_UPDATE_CHECK_DISABLED=1 and writes the IR, the HTML, and
         the receipt only inside the dispatch's private evidence folder.
         Factual nodes and edges map to an inspected path at a recorded full revision
         (archify --repo-root pins); unsupported factual elements are dropped. Proposed or
         unknown elements are allowed only when labelled: dashed style plus a legend entry.
         Uncommitted sources use explain's content hash, and their pins are marked unknown.
         The source map stays outside the reader view; the display shows the short SHA.
         About 9 core nodes signals a split, not a hard gate; 1-2 accent nodes; the viewer
         opens dark unless the user names a theme.
         The author runs `finalize --quality showcase --json` as a build gate. Pass means
         receipt status "pass", never the exit code. At most two repair rounds; then
         hold with the remaining defects. archify's own headless measurement never
         replaces the rendered pass: axstack-ui-verifier checks the receipt's
         artifact.sha256 bytes on desktop and 390px mobile, keyboard, reduced motion, and
         the text alternative; explainer-review always checks every node AND edge against
         source for archify output. Any byte change needs fresh checks.
         Diagrams are not written into repo docs unless the user asks.
Flow + failure: Chrome missing -> receipt status "skipped" (exit 2) -> the skill reports
         "viewer not verified: Chrome missing" and holds; it never reports a pass.
We accept: the installer's first network and git step, and a Node-oriented tool run by Bun,
         as a narrow exception recorded in AGENTS.md.
Rejected: vendoring; an own renderer; upstream `npx skills add` (unpinned, needs Node, adds
         a competing skill); falling back to Mermaid when the viewer was required.
Open: none.
```

## Capabilities

| # | Capability | Content |
|---|---|---|
| C1 | Pinned archify provisioning | The Design installer lines: pin constant, sparse clone, SHA check, owned `archify.json` record, owners file, guarded uninstall and pin bump, unavailable path, `check` output. The manifest gains the out-of-root owned copy without breaking older manifests. Home-guard and `--yes` rules apply to `--tools-dir`. AGENTS.md `Interfaces` records the archify exception. Tests use a local git fixture through `AXSTACK_ARCHIFY_REPO` and no network. `docs/installation.md` documents it. Commits stay near 200 lines. |
| C2 | `axstack-diagram` skill | The Design `Shape` files, the Binding rules, Q8, and the credits. Bundle discovery lists the new skill; the prose-size aggregate ceiling rises by the net bytes. `ui-verification.md` states that archify `finalize` is an author build gate and never replaces the verifier's rendered pass. |
| C3 | Explain integration | `axstack-explain` routes every diagram through `axstack-diagram`: simple chat answers use its Mermaid rules inline with no agent; complex visuals are authored by `axstack-explainer` through the archify path. The Q7 card rule. `visual-qa.md` binds the verifier and the review to the receipt's `artifact.sha256` and makes the node-and-edge review mandatory for archify output. README and `docs/workflows.md` list the skill and credit archify. |

## Acceptance

1. Installer tests, with a fixture repo and no network: install clones the pinned SHA, writes `archify.json`, and adds its owner; a second install is a no-op; a SHA mismatch fails clearly; two skills roots share one copy, and uninstalling one keeps it; the last uninstall removes an unmodified copy and keeps a modified one; a pin bump releases the old copy; an unreachable repo still installs the skills and reports `archify: unavailable`; `check` reports record, SHA, and Chrome and exits non-zero on a gap; home-guard refuses an unconfirmed home `--tools-dir`; older manifests still load.
2. `skills/axstack-diagram/SKILL.md` and its two references exist. Prose-contract tests fail on removal or inversion of: format choice; record-and-SHA verification; hold on missing archify, mismatch, Chrome, or a non-pass receipt; `status: "pass"` as the only pass, with exit codes never trusted; `ARCHIFY_UPDATE_CHECK_DISABLED=1` on every call; outputs only in the evidence folder; factual nodes and edges need source pins, proposals and unknowns need labels; two repair rounds then hold; the ui-verifier pass including 390px mobile; the mandatory node-and-edge review; no call to explain; direct use keeps fidelity and QA. Tests survive rewording.
3. Explain loads `axstack-diagram` for every diagram, keeps evidence labels and dispatch ownership, and applies Q7 (40-word cards exempt; labels and other text counted). Tests fail on removal or inversion.
4. A smoke test runs `finalize` for one shipped example of each of the five types when the pinned copy (found through an env var) and Chrome exist; it skips with a stated reason otherwise, and a sandbox or Chrome failure is a skip, never a pass. A skipped smoke does not satisfy acceptance 5.
5. One real explanation of this repository's installer flow is produced through explain -> `axstack-diagram` -> archify on the desktop host, with a `status: "pass"` receipt, a ui-verifier verdict (desktop, mobile, keyboard, search or focus, reach, theme), and a node-and-edge review. Findings are fixed or recorded with the user's decision.
6. Bundle discovery lists 16 skills; the prose-size comment records the raise and its reason; README, `docs/workflows.md`, `docs/installation.md`, and AGENTS.md describe the skill, the tools directory, and the exception.
7. `bun test` is green with TMPDIR under `/tmp`.
8. A release is published and installed on desktop and VPS after the user's release decision; the version follows the minor rule (a `feat` lands). Each host's `axstack check` shows the archify pin.

## Delivery order

One linear `gh stack`: C1 installer -> C2 skill and tests -> C3 explain integration and docs
-> acceptance 5 demonstration -> release.

## Exclusions

- An own renderer, vendored archify code or templates, and upstream `npx skills add`.
- Using `axstack-diagram` from spec, review, PR bodies, or `design-lens.md` (later work).
- Persisting diagrams into repo docs by default; archify exports, motion, share cards.
- Automatic archify updates or a scheduled pin check.
- Mobile layout changes inside archify itself (the ui-verifier reports mobile findings).

## Authority requested at approval

- Release: AGENTS.md "Cut a release" rule and `.github/workflows/publish.yml`; hosts desktop
  and VPS; tag and install after the user merges the release PR; the user approves the npm stage.
- Host mutation: installing the released package on both hosts, which clones the pinned
  archify into each host's tools directory.

Credits: archify (tt-a1i, MIT), diagram-design (Cathryn Lavery, MIT), visual-explainer
(nicobailon, MIT), Matt Pocock, poteto.
