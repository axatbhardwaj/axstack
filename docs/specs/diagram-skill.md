# Spec: `axstack-diagram` with a pinned archify viewer

Status: Draft rev 1 (2026-10-04). Store: this repo Markdown file.
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
  `render` pass; `finalize` passed all four gates with Chrome. Without Chrome `finalize`
  exits 0 with `ok:false` and `browser-check: skipped`.

## Settled decisions

| # | Decision |
|---|---|
| Q1 | Build an archify-like interactive viewer, not prompt-only diagrams. |
| Q2 | Mermaid is a valid format in T3 chat, GitHub, and docs (verified). |
| Q3 | Raise only the aggregate prose-size ceiling by the net bytes added; no `routing.md` line. |
| Q4 | Reuse upstream archify. The installer clones it at a pinned full SHA into a tools directory outside every skill root. This is an explicit exception to "self-contained, no runtime dependencies" for this one external tool only. Pin bumps happen only in a reviewed `chore` PR with a smoke run. |
| Q5 | Support all five archify types: architecture, workflow, sequence, dataflow, lifecycle. |
| Q6 | When the viewer is required and archify or Chrome is unavailable, hold and ask the user. No Mermaid substitute and no unverified HTML. |
| Q7 | archify per-node detail cards are exempt from explain's 700-word cap; they stay short and source-backed. |
| D1 | Rejected: vendoring archify (11 MB, non-commercial brand-mark licences, prose budget) and rebuilding it (a large owned renderer). |
| D2 | Success is the `finalize` receipt `status: "pass"`, never the exit code. |
| D3 | Rules are written in Axstack's own words with a one-line credit to archify, diagram-design, visual-explainer, Matt Pocock, and poteto. No upstream templates are copied. |
| D4 | Trace motion, exports, share cards, and brand marks stay off unless the user asks. |

## Design

```text
Usage: axstack-diagram (loaded by axstack-explain or invoked directly) picks the format by
       destination: chat, GitHub, or docs -> Mermaid (accTitle/accDescr, no theme init);
       a complex visual or an explicit viewer request -> archify HTML.
Shape: skills/axstack-diagram/SKILL.md (short router) + references/archify.md (IR authoring,
       finalize contract, pin, holds) + references/fidelity.md (source rules, density,
       labels). Installer: `install` clones archify at the pinned SHA into
       <tools-dir>/archify-<sha> (default ~/.axstack/tools, flag --tools-dir) and records it
       in the ownership manifest; `uninstall` removes only that recorded copy; `check`
       reports the archify pin and Chrome availability.
Binding: every material node and edge maps to an inspected path at a recorded revision
         (archify --repo-root pins), or is styled planned or unknown; elements without
         evidence are dropped. The source map stays outside the reader view.
         About 9 core nodes is a signal to split views, not a hard gate; 1-2 accent
         nodes. finalize runs with --quality showcase --json; at most two repair rounds,
         then remaining defects are reported. Missing archify, a pin mismatch, or missing
         Chrome holds and asks. The rendered HTML still goes through axstack-ui-verifier
         (desktop, 390px mobile, keyboard, reduced motion) and explainer-review checks
         every node AND edge against source. Each diagram records its short source SHA;
         diagrams are not written into repo docs unless the user asks.
Flow + failure: finalize returns ok:false with browser-check skipped -> the skill reports
         "viewer not verified: Chrome missing" and holds; it never reports a pass.
We accept: the installer's first network and git step, and a Node-oriented tool run by Bun.
Rejected: vendoring; an own renderer; upstream `npx skills add` (unpinned, needs Node, adds
         a competing skill); falling back to Mermaid when the viewer was required.
Open: archify's update-check opt-out is identified during C1 and disabled in every call.
```

## Capabilities

| # | Capability | Content |
|---|---|---|
| C1 | Pinned archify provisioning | Installer clones the pinned SHA (sparse `archify/`) into `<tools-dir>/archify-<sha>`, verifies the checked-out SHA, records it in the manifest, and is idempotent. `uninstall` removes only the recorded copy. `check` reports archify pin status and Chrome (`ARCHIFY_CHROME` honoured). Home-guard and `--yes` rules apply to `--tools-dir`. Tests use a local git fixture and no network. `docs/installation.md` documents it. |
| C2 | `axstack-diagram` skill | The Design `Shape` files. Format routing by destination, the archify finalize contract and holds, the fidelity rules, the credits. Bundle discovery lists the new skill; prose-size aggregate ceiling raised by the net bytes. |
| C3 | Explain integration | `axstack-explain` routes every diagram through `axstack-diagram`: simple chat answers use its Mermaid rules inline with no agent; complex visuals are authored by `axstack-explainer` through the archify path. The 700-word cap exempts archify node detail cards. `visual-qa.md` adds the finalize receipt and the source-map review. README and `docs/workflows.md` list the skill. |

## Acceptance

1. `axstack install` with a fixture repo clones the pinned SHA into the tools directory, records it, and a second install is a no-op; a SHA mismatch fails with a clear error; `uninstall` removes only the recorded copy; `check` reports archify and Chrome status. Installer tests cover each case without network.
2. `skills/axstack-diagram/SKILL.md` and its two references exist and bind every Design `Binding` line. Prose-contract tests fail on removal or inversion of: format by destination; source-fidelity (nodes and edges); receipt `status: "pass"` as the only pass; the hold on missing archify, pin mismatch, or Chrome; two repair rounds then honest report; ui-verifier and node-and-edge review still required. Tests survive rewording.
3. Explain loads `axstack-diagram` for every diagram, keeps evidence labels and dispatch ownership, and exempts archify node cards from the 700-word cap. Tests fail on removal or inversion.
4. A smoke test renders one archify example under Bun with `finalize` when the pinned copy and Chrome exist, and skips with a stated reason otherwise.
5. Bundle discovery lists 16 skills; the prose-size comment records the raise and its reason; README, `docs/workflows.md`, and `docs/installation.md` describe the skill and the tools directory.
6. `bun test` is green with TMPDIR under `/tmp`.
7. A release is published and installed on desktop and VPS after the user's release decision; the version follows the minor rule (a `feat` lands). Each host's `axstack check` shows the archify pin.

## Delivery order

One linear `gh stack`: C1 installer -> C2 skill and tests -> C3 explain integration and docs
-> release.

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
