# Inline pages

Use this reference for Explain's inline T3 answer path.
The driver publishes the page in its own thread.

## Shape and theme

Use T3 theme variables and follow the live theme.
Only an explicit user theme request overrides the page theme.
Use `--background`, `--foreground`, `--muted-foreground`, `--ring`,
`--font-sans`, and `--font-mono` for their named purposes.
The dark default stays archify-only.

Use fluid width, with zero outer horizontal padding.
Never use an outer frame, banner, or viewport heights.
Let content set the page height. Use fixed chart heights.
Set frame `height` to the larger contentHeight of the two previews, capped at 2000.

Choose the page shape from its content rather than a fixed template.
Map stages to a connected diagram, sequence to a timeline, comparison to side
by side or table, and separate equal items to a list.
Prefer diagrams and timelines. Avoid grids of bordered boxes.
Keep borders minimal and use color only where it has meaning.

## Page rules

Write one self-contained HTML document with inline styles and scripts.
Never load network resources, including CDN scripts, fonts, images, or Mermaid.
Use images as `data:` URIs. Never include absolute local paths in page bytes.
Allow plain `<a href>` links, with GitHub URLs or `path@<sha>` for source links.
Use inline SVG or CSS for diagrams, with a text alternative.

Count page and reply together under the 700-word cap.
Use body `textContent` minus script and style, including collapsed content and SVG labels.
Inline pages have no card exemption.

Prefer static pages.
Interactive means the page has script, form controls, or `<details>`.
Plain links are not interactive.
Use semantic elements, labels, visible focus, and sufficient contrast in both themes.
Pages never use storage, cookies, modals, or popups.

## Check the exact bytes

Keep page bytes, SHA-256, and attachmentId in run evidence.
Scan the exact bytes of every page for remote `src`, `srcset`, and `href` on loaded resources.
Scan for `@import`, `url()`, `fetch`, XHR, WebSocket, EventSource, and meta refresh.
Reject scan matches except local `url(#id)` references such as SVG markers and gradients.

Before publishing, run `html_preview` at 728px dark and 360px light.
The driver's two previews are an author exception to delegated browser checks.
Require correct layout, theme, height, network, word count, zero console errors,
and empty `missingImages`.
Check every claim against its source.
Inspect both screenshots for clipping, overflow, and readable labels.
For an explicit theme override, also check that requested theme.

For every interactive page, require a real-browser `axstack-ui-verifier` pass
for clicks, keyboard, and expanded states.
Give the evidence path and SHA-256 of the exact bytes in the verifier brief.
Follow [UI verification](../../axstack/references/ui-verification.md) for that pass.
The pass covers focus order, screen-reader names, reduced motion, and an empty
`performance.getEntriesByType('resource')` list.

## Publish or fall back

Publish one page per answer.
Publish with `html_render` from exactly the checked bytes.
Fix a failed check and rerun on the new bytes.
A byte change invalidates affected checks and review.
If either tool cannot be found after one bounded discovery attempt, fall back
to chat with Mermaid and state the reason.
If a check, verifier, or required reviewer is unavailable or still fails, fall
back to chat with Mermaid and state the reason.
After an ambiguous `html_render` result, never retry.
After an ambiguous `html_render` result, read `t3_thread_read`, keep the page
if present, and otherwise fall back to chat.
