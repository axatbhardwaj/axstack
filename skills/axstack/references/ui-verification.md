# UI verification

Every Playwright, browser, or rendered-UI check outside the three named author
exceptions, including a "confirm it in the browser" step, goes through async
`delegate_task` to `axstack-ui-verifier` from the run's role snapshot. Give it the exact build, URL, or artifact and the private
dispatch's evidence folder. The verifier is read-only: it never edits source.
The PR writer remains the sole writer.

Before using a PR preview URL, the UI verifier must read [PR previews](preview.md).

The first named author browser exception is archify `finalize` as a headless build gate.
Keep finalize outputs only in the private evidence folder.
Never replace the verifier's rendered pass with finalize.

The second named author browser exception is the driver's two `html_preview`
runs at 728px dark and 360px light.
Scan the exact bytes of every page for remote src, srcset, and href on loaded
resources, `@import`, `url()`, `fetch`, XHR, WebSocket, EventSource, and meta refresh.
Reject scan matches except local url(#id) references such as SVG markers and gradients.
Require correct layout, theme, zero console errors, empty `missingImages`,
height, network, and word count.
Never replace the verifier's interaction pass with `html_preview`.
Follow [Inline pages](../../axstack-explain/references/inline-pages.md) for the page checks.

The third named author browser exception permits dispatched roles to use
`html_preview` as a non-publishing self-check.
Dispatched-role self-checks never replace the driver's two previews or the `axstack-ui-verifier` pass.
Dispatched roles never call `html_render`.
All other browser checks outside the three named exceptions remain delegated to `axstack-ui-verifier`.

Read the [T3 runtime boundary](t3-runtime.md) before dispatch; for candidate
checks use its driver-made disposable detached checkout at the pinned candidate SHA.
The verifier uses T3 `preview_*` tools for rendered checks.
Candidate browser and visual checks must run in the delegated `axstack-ui-verifier` in its own detached checkout; outputs go to its private evidence folder, never the driver worktree.

For every interactive page, require a real-browser `axstack-ui-verifier` interaction pass.
Give the evidence path and SHA-256 of the exact bytes in the verifier brief.
The verifier serves the exact bytes on loopback.
Open the page with `preview_open` using `open:false`.
Check clicks, keyboard, focus order, screen-reader names, expanded states, and reduced motion.
Require that `performance.getEntriesByType('resource')` is empty.
The detached-checkout rule does not apply to a page without a candidate.

Ask for screenshots and observed interactions, accessibility, desktop and
mobile layouts, and reduced-motion behavior where relevant. The verifier
returns a verdict with evidence paths and names checks it could not run.
Keep the verdict tied to the exact artifact or revision; changed bytes need a
fresh rendered pass.

Use a present `verify-<app>` skill for affected behavior.
If a PR changes a mapped feature, its author updates the feature file in the same PR.
For a missing skill, add "suggest `axstack-verify create`" to the receipt's `Unverified:` line.
Never generate a verification skill automatically.
For a broken or stale recipe, report the gap.
Never let a broken or stale recipe waive existing acceptance obligations.
Keep browser recipes tool-neutral for the verifier.

## Proof standards

Apply these standards to the verifier's candidate checks and inline-page interaction pass.

Drive the real user path.
Capture the action, the resulting state and its side effects.
For a dry-run claim, verify what it skips by observing files, network calls or Git refs.
Keep evidence in the private evidence folder after cleanup.

Ideas paraphrased from pstack's
[create-verification-skill](https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/create-verification-skill/SKILL.md) (MIT).
