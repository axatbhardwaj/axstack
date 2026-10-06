# UI verification

Every Playwright, browser, or rendered-UI check, including a "confirm it in the
browser" step, goes through async `delegate_task` to `axstack-ui-verifier` from the
run's role snapshot. Give it the exact build, URL, or artifact and the private
dispatch's evidence folder. The verifier is read-only: it never edits source.
The PR writer remains the sole writer.

Before using a PR preview URL, the UI verifier must read [PR previews](preview.md).

The sole author browser exception is archify `finalize` as a headless build gate.
Keep finalize outputs only in the private evidence folder.
Never replace the verifier's rendered pass with finalize.
All other browser checks remain delegated to `axstack-ui-verifier`.

Read the [T3 runtime boundary](t3-runtime.md) before dispatch and use its
driver-made disposable detached checkout at the pinned candidate SHA.
The verifier uses T3 `preview_*` tools for rendered checks.
Browser and visual checks must run in the delegated `axstack-ui-verifier` in its own detached checkout; outputs go to its private evidence folder, never the driver worktree.

Ask for screenshots and observed interactions, accessibility, desktop and
mobile layouts, and reduced-motion behavior where relevant. The verifier
returns a verdict with evidence paths and names checks it could not run.
Keep the verdict tied to the exact artifact or revision; changed bytes need a
fresh rendered pass.
