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

## Proof standards

Drive the real user path.
Capture the action, the resulting state and its side effects.
For a dry-run claim, verify what it skips by observing files, network calls or Git refs.
Keep evidence in the private evidence folder after cleanup.

Ideas paraphrased from pstack's
[create-verification-skill](https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/create-verification-skill/SKILL.md) (MIT).
