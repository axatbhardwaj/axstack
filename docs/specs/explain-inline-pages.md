# Spec: explain answers with inline T3 pages

Status: Draft rev 4 (2026-10-07). Store: this repo Markdown file.
Run: `20261007-explain-t3-inline-html`. The private run record holds the Align
decisions, adviser receipts, and host evidence.
Baseline: `2975fd5`.

## Goal

When the user needs to understand something, Axstack answers in the T3 thread
with one page drawn inline above a short reply, instead of a wall of text or a
separate archify viewer. The page uses the user's live T3 theme, fits desktop
and phone, and is checked before it is shown. Interaction is added only when it
carries content.

## Facts

- T3 nightly `0.0.46-nightly.20261006.2752` (pingdotgg/t3code#15968) gives
  agents `html_preview` (headless screenshot, `contentHeight`, console,
  `missingImages`) and `html_render` (publishes a page inline above the caller's
  final reply, in the caller's own thread only; not idempotent). A page is one
  self-contained document of at most 512,000 characters. T3's injected bootstrap
  supplies theme variables, link handling, and size reporting.
- Both tools are available to Claude and Codex threads (Codex probe,
  2026-10-07).
- Host: that nightly runs with `T3CODE_SERVER_BROWSER_SANDBOX=0` because T3 runs
  as root. Client visibility: the server web client was verified by the driver;
  the desktop app was observed by the user after a client update (screenshot
  attachment `d80fc474`, 2026-10-07); Android is pending the user's check on an
  updated client.
- `preview_*` tools open only http(s) or loopback URLs, not files or raw HTML.
- Skills reach the host only through a release and reinstall (`AGENTS.md`).
- Prose budgets at `2975fd5`: aggregate 44 bytes free; always-loaded 0 bytes
  free.

## Settled decisions

| # | Decision |
|---|---|
| Q1 | Host T3 updated to the latest nightly, Chrome sandbox off for T3's browser (done, user authority 2026-10-07). |
| Q2 | A page is made when the user asks how, why, explain, or show; says they don't understand; when a spec is being finalized; or when the agent judges the user needs to understand something. |
| Q3 | Checks before publishing: `html_preview` at 728px dark and 360px light, no console errors or missing images, every claim checked against its source, and a real-browser pass of clicks, keyboard, and expanded states for every interactive page. |
| Q4 | No fixed template: each page chooses its shape from its content. Diagrams and timelines are preferred; grids of bordered boxes are avoided; borders are minimal and color appears only where it means something. |
| D1 | Only the driver thread calls `html_render`. Dispatched roles may call `html_preview` but never publish; every dispatch brief says so. |
| D2 | Pages load no network resources: no CDN scripts, fonts, images, Mermaid, `@import`, `fetch`, XHR, or WebSocket. Images are `data:` URIs; pages contain no absolute local paths, so the checked bytes are the published bytes. Plain `<a href>` links are allowed; source links use GitHub URLs or `path@sha`. Diagrams are inline SVG or CSS with a text alternative. |
| D3 | The 700-word limit covers page and reply together. Page words are the body `textContent` minus `<script>` and `<style>`, including collapsed content and SVG labels. Inline pages have no card exemption; the archify card exemption stays archify-only. |
| D4 | One page per answer, published from exactly the checked bytes. A failed check may be fixed and rerun on the new bytes. If either tool cannot be found after one bounded discovery attempt, or a check, verifier, or required reviewer is unavailable or still fails, explain gives the answer in chat with Mermaid and states the reason. After an ambiguous `html_render` result, never retry: read the thread with `t3_thread_read`; if the page is there, keep it, otherwise fall back to chat. The run evidence keeps the page bytes, SHA-256, and `attachmentId`. |
| D5 | Archify leaves explain's default path. On an explicit viewer request, the `axstack-explainer` role authors archify as today. Nothing is deleted. |
| D6 | Independent `axstack-explainer-review` runs for consequential or complex claims, archify output, or on request. Examples of consequential claims: gap or missing-claim reports, blast-radius safety facts, and spec readbacks. |
| D7 | "Interactive" means the page has script, form controls, or `<details>`. Plain links are not interactive. Static pages are preferred. |
| D8 | Pages use T3 theme variables and follow the live theme. Only an explicit user theme request overrides them; the dark default stays archify-only. |
| D9 | The driver's two `html_preview` runs are a second named author exception to delegated browser checks. With a static scan of the exact bytes for every page (no remote `src`, `srcset`, `href` on loaded resources, `@import`, or `url()`; no `fetch`, XHR, WebSocket, or `EventSource`; local `url(#id)` references such as SVG markers and gradients are allowed), they gate layout, theme, console, `missingImages`, height, network, and word count. The `axstack-ui-verifier` owns the interaction pass. Pages are accessible by construction: semantic elements, labels, visible focus, and sufficient contrast in both themes. |
| D10 | Interaction pass: the brief gives the evidence path and SHA-256 of the exact bytes; the verifier serves them on loopback, opens them with `preview_open` (`open:false`), and checks clicks, keyboard, focus order, screen-reader names, expanded states, reduced motion, and that `performance.getEntriesByType('resource')` is empty. The verifier's detached-checkout rule does not apply to a page with no candidate. Pages use no storage, cookies, modals, or popups. |
| D11 | Frame `height` is the larger `contentHeight` of the two previews, capped at 2000. |
| D12 | The spec readback page shows the revision ID, SHA-256, and store path. Approval binds to that revision, not to the page. |

## Scope

1. **`axstack-explain`.** The description names the Q2 triggers so the skill is
   picked up outside explicit requests. The body replaces the complex-visual
   archify default with the inline page path (D1, D4, D5, D8). It narrows §2.2:
   the chat path is limited to an explicit request for a chat answer, an answer
   with no Q2 trigger, and D4 fallback; a contract test pins this and §3.1 (QA routes to
   `inline-pages.md` for pages, `visual-qa.md` for archify). It keeps the
   explicit-format rule, claim labels, evidence rules, word limit (D3), and the
   blast-radius and show-your-work routes. The reply adds only what the page
   omits.
2. **New `skills/axstack-explain/references/inline-pages.md`.** Page rules: T3
   theme variables (D8), fluid width with no outer frame or banner, no viewport
   heights, fixed chart heights, height (D11), no network (D2), no storage (D10),
   accessibility (D9).
   Layout guidance (Q4): stages → connected diagram, sequence → timeline,
   comparison → side by side or table, separate equal items → list; color only
   where it means something. Inline checks (Q3, D7, D9, D10) and failure rules
   (D4) live here, bound to the page SHA-256.
3. **`visual-qa.md`.** One scoping line: inline pages follow `inline-pages.md`;
   the existing archify checklist is unchanged.
4. **`ui-verification.md` and `t3-runtime.md`.** Add the D9 exception and the D10
   page pass, and rescope the pinned own-detached-checkout sentence to candidate
   checks. The dispatch brief rule adds "never call `html_render`" (D1).
5. **`axstack-spec`.** At the approval checkpoint in a T3 thread, the driver also
   publishes the readback as an inline page under explain's rules (D12).
6. **`axstack-diagram`.** Description and body: archify only on an explicit viewer request; Mermaid for
   chat fallback, GitHub, and docs; inline SVG or CSS inside pages.
7. **Presets, roster, and docs.** Explainer and verifier role notes and user docs
   describe the new path; remove the stale "verifies rendered behavior" note.
8. **Tests.** Update `explain-diagram.test.js`, `diagram.test.js`,
   `owned-support.test.js`, `presets.test.js`, and `t3-runtime.test.js` for the
   new rules, with removal, inversion, and rewording checks. Archify holdouts stay
   pinned. Raise the aggregate prose budget in `prose-size.test.js` by the
   measured net bytes with a dated comment. The always-loaded budget is unchanged
   because no always-loaded file changes.

## Acceptance

Repository (before merge):

- Contract tests encode Q2–Q4 and D1–D12 and fail when any rule is removed or
  inverted. `bun test` passes.
- No instruction still sends explain's default complex visual to archify or a
  dispatched explainer.
- Rehearsal: before the explain PR merges, the driver follows its candidate
  `inline-pages.md` to publish one page in this thread (an explanation of the
  change), with both previews, a clean static scan, a verifier interaction
  verdict when the page is interactive, and recorded bytes, SHA-256, and
  `attachmentId`.

Deployment (pending release and install authority):

- In a fresh T3 thread on the installed release, a plain question that does not
  name the skill (for example "how does X work?") produces
  exactly one inline page above a short reply. Evidence: thread ID,
  `attachmentId` from `t3_thread_read`, page SHA-256, both previews, a clean
  static scan recorded by the driver, and, when interactive, the verifier verdict
  with an empty resource list.
- A spec checkpoint in T3 shows its readback as an inline page.

## Exclusions

- Deleting archify, its installer, roles, or tests.
- Changes to T3 Code itself or further host changes.
- Network resources inside pages (D2).
- Android rendering: the user checks once on an updated client.
- Release and reinstall: they follow the `AGENTS.md` release rule and need their
  own recorded authority. Deployment acceptance stays pending until then.

## Driver additions for the user to confirm

D2 (links and `data:` images), D4 (fix-and-rerun, verifier or reviewer
unavailability also falls back to chat, no retry after an ambiguous render), D7
(definition of interactive), D8 (explicit theme override), D9 (static scan and
accessibility), D10–D12, the presets/roster/docs and `t3-runtime.md` edits, the
prose-budget raise, and the rehearsal were added by the driver from adviser
review, not decided in Align.
Approving this revision accepts them.
