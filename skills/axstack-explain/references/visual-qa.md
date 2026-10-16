# Visual QA checklist

For inline pages, follow [Inline pages](inline-pages.md) instead of this checklist.

Design review against [design.md](design.md) covers every inline HTML page and every Publish article adaptation.
For inline pages, the reviewer itself renders exact bytes with `html_preview` at
728px dark and 360px light as a non-publishing self-check.
This supplements the driver's required previews and any verifier pass.
For Publish, the reviewer opens `axstack-ui-verifier` PNGs at 728px dark and
360px light plus 390px mobile and 1440px desktop, covering all four widths in both themes,
with paths bound to the artifact SHA-256 and recorded before review.
Inspect the 1440px desktop screenshot for balanced composition, intentional horizontal margins,
bounded prose measure, typography, section spacing and chart legibility.
Inspect the 360px and 390px mobile screenshots for gutters, readable text and chart labels.
Check every width and theme for clipping and horizontal scroll, recording defects and observations.
The driver forwards those paths and SHA-256; changed bytes require fresh screenshots and review.
Apply [Delivery](delivery.md)'s one-round design repair, disclosed cosmetic exception and unknown-render holds.
Chat Mermaid, anatomy and explicitly requested standalone HTML files keep their existing review and Visual QA.
Interaction checks remain with `axstack-ui-verifier`; source-fidelity review is unchanged.

Use this checklist for every HTML explanation and other visual artifacts where
rendering matters.

Browser and visual checks must run in the delegated `axstack-ui-verifier` in its own detached checkout; outputs go to its private evidence folder, never the driver worktree.

1. Identify the final artifact bytes and theme. The explicit user theme wins;
   otherwise use `prefers-color-scheme`.
2. Delegate the rendered pass through [UI verification](../../axstack/references/ui-verification.md).
   Record actual desktop and mobile observations, or name the missing layout
   check.
3. Have the verifier exercise relevant interactions, keyboard and screen-reader
   accessibility, and reduced-motion behavior. Report each unavailable check
   honestly.
4. The explainer reviewer checks text and source fidelity, including every node
   and edge against source. Keep source
   correctness, tests, rendered behavior, independent review, and publication
   evidence separate.
5. Bind review to the exact artifact identity. Any byte change invalidates the
   affected approval and requires fresh QA and review.
