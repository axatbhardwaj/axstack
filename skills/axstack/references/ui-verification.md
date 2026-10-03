# UI verification

Every Playwright, browser, or rendered-UI check, including a "confirm it in the
browser" step, goes through async `delegate_task` to `axstack-ui-verifier` from the
run's role snapshot. Give it the exact build, URL, or artifact and the private
dispatch's evidence folder. The verifier is read-only: it never edits source.
The PR writer remains the sole writer.
Read the [T3 runtime boundary](t3-runtime.md) before dispatch and use its
driver-made disposable detached checkout at the pinned candidate SHA.
The verifier uses T3 `preview_*` tools for rendered checks.

Ask for screenshots and observed interactions, accessibility, desktop and
mobile layouts, and reduced-motion behavior where relevant. The verifier
returns a verdict with evidence paths and names checks it could not run.
Keep the verdict tied to the exact artifact or revision; changed bytes need a
fresh rendered pass.
