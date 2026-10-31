---
name: axstack-explain
description: When the user asks how, why, explain, or show, asks to diagram, visualize, draw or defend, requests a whiteboard defense, says they do not understand, a spec is being finalized, or you judge they need to understand something, use axstack-explain to show how it works and what exists, is missing, or remains unverified.
---

# Explain

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.

Explain a system, change, current behavior, intended behavior, or implementation
gap from inspected evidence. This direct route needs no spec ceremony. Use
project documentation as evidence where relevant. It supersedes `axstack-docs`; if a stale install
exposes both skills, route the request here only.
For a stale `axstack-diagram` install, route requests here only.

Before acting, load [Standing contracts](../axstack/references/contracts.md),
then follow its required lifecycle and audit pointers. Explanation work has no
scope baseline. Ordinary work in the current chat needs no launch preflight;
load the [T3 runtime boundary](../axstack/references/t3-runtime.md) only
immediately before an actual profile dispatch.

For explicit local non-repository work, apply
[Local artifacts](../axstack/references/local-artifacts.md) before native dispatch.
Preserve this phase's independent source/fact and exact-byte review requirements.

## 1. Bound the question and evidence

1. Identify the audience, question, requested format, theme, and publication
   boundary.
2. Record the inspected paths. Use an exact revision for Git sources; for a
   non-versioned file, screenshot, or exported snippet, use a stable source
   identity or content hash. Record any live target and observation method.
   Record the history window when available; unavailable history is a named
   limitation, never an invented window. Trace the relevant flow, boundaries,
   dependencies, and actual behavior before comparing current versus intended
   behavior.
3. Mark material claims independently as **source implemented**, **tested**,
   **live observed**, **planned/proposed**, or **unknown**. These dimensions can
   coexist; none implies another.
4. For every gap, cite its inspected scope and applicable revision, stable
   source identity, or content hash. “Not found” never means app-wide missing
   without app-wide evidence; anything outside the inspected scope is unknown.
5. For "what could this break" or "blast radius of X", follow
   [Blast radius](../axstack/references/blast-radius.md): find the breakage
   beyond the diff and prove the one safety fact by running real code, or
   mark it unproven.
6. For "show me your work" on existing work (a run, PR, branch, or change),
   reconstruct the decision trail rather than re-describing the diff: read the
   run record's `Decisions` and `Learnings`
   ([run record](../axstack/references/run-record.md)), then the commits, PR
   body, review receipts, and ADRs. Present each consequential choice as what
   was chosen, why, the evidence pointer, and its result; separate what the
   record proves from what is inferred, and list choices with no recorded
   reason as open rather than inventing one.

## 2. Choose proportional output

Explain owns evidence gathering, claim labels, the 700-word cap, dispatch, and delivery.
Choose the best visual for the concept: flowchart, sequence, state, architecture
map, timeline, comparison or bespoke SVG are examples, not a taxonomy.
Follow [Fidelity](references/fidelity.md) for every visual.
For whole-work understanding or defense, follow [Whiteboard defense](references/whiteboard-defense.md).
Dispatch every visual Explain delivers to `axstack-explainer` with a bounded
evidence brief, including inline pages, chat Mermaid and anatomy figures.
The `axstack-explainer` loads [design.md](references/design.md) and reads
[FRONTEND-DESIGN.md](references/frontend-design/FRONTEND-DESIGN.md) for every inline HTML page
and every Publish article adaptation, using frontend-design as the sole design authority
subject to design.md's hard rules.
Never load either reference for chat Mermaid or anatomy figures.
Explicitly requested standalone HTML files keep their existing review and Visual QA.
Plain-prose answers stay driver-written; other phases retain their own Mermaid
owners, and README/docs diagram edits go through Implement under these rules.
Use inline SVG or CSS inside inline pages. Never use Mermaid in inline pages.
Use Mermaid for chat, GitHub, and docs.
Include `accTitle` and `accDescr` in each Mermaid view.
Never use theme init in Mermaid. Split large Mermaid diagrams into views.
Use anatomy only on an explicit isometric, physical-object or anatomy request,
through [Anatomy](../axstack-anatomy/SKILL.md).

1. Keep the primary reader-facing explanation to a maximum of 700 words in
   chat, HTML, and every other requested format. Preserve in that primary view
   the answer or purpose, key rationale, meaningful alternatives, main data or
   operational boundary, status and uncertainty, and live reader questions
   with evidence-supported answers, labeling any question the inspected
   evidence does not answer as **unknown** or **open** rather than inventing an
   answer. Count the primary artifact's reader-visible words, including
   headings, table text, and diagram or figure labels and captions. An appendix
   or collapsible content in the same artifact counts toward the 700-word
   maximum. If the draft is longer, compress repetition first and move only
   supporting detail to a separate linked ticket or appendix. Essential answers
   must not be hidden behind links, and evidence must not be silently discarded.
   Count node labels, headings, captions, and all page text.
2. Use chat only for an explicit chat request, an answer outside the description's conditions,
   or inline-page fallback.
   Use a compact diagram when useful.
3. For the conditions in the description, create an inline page by default.
   Honor an explicitly requested artifact format.
   The reply adds only what the page omits.
4. Profile IDs are presets, not availability proof. Before dispatch, follow the
   launch sequence and preserve the configured model, mode, and effort. Report
   an unavailable route; never substitute a model.

## 3. Verify and deliver

1. For inline pages, follow [Inline pages](references/inline-pages.md).
   For every explicitly requested HTML or visual artifact
   outside inline T3 pages, follow [Visual QA](references/visual-qa.md).
2. Require independent `axstack-explainer-review` for consequential or complex
   claims or on request.
   The `axstack-explainer-review` always reviews every visual at its exact final
   bytes before delivery.
   For inline HTML pages and Publish article adaptations, include the
   [design review](references/visual-qa.md) and [Delivery](references/delivery.md) rules.
   Consequential claims include gap or missing-claim reports, blast-radius
   safety facts, spec readbacks, and every whiteboard-defense explanation in chat too.
   Bind it to the exact artifact identity.
   Any byte change invalidates
   that review and requires a fresh check. In `claude-only`, separate Sonnet
   author high and reviewer high sessions are allowed for explanations and every visual as
   session independence only. This exception never permits same-model code
   review or a cross-provider-independence claim.
3. Report source, tests, rendered observations, independent review, and
   publication as separate evidence. Name every missing or unavailable check.
4. For a public artifact, remove private paths, identifiers, prompts,
   credentials, messages, and internal records. Local creation does not grant
   authority to publish.
5. Follow [Delivery](references/delivery.md) for fallback and repair holds.
   Deliver the smallest useful explanation. Explanation causes no automatic
   design and no automatic implementation; route later change work separately
   only when the user requests it.

Ideas: [archify](https://github.com/tt-a1i/archify), [diagram-design](https://github.com/cathrynlavery/diagram-design), [visual-explainer](https://github.com/nicobailon/visual-explainer), [Matt Pocock](https://github.com/mattpocock/skills), and [poteto](https://github.com/poteto/how); guidance uses Axstack's own words.

Vendored reference: [frontend-design](references/frontend-design/PROVENANCE.md), Apache-2.0.
