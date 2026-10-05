# Visual QA checklist

Use this checklist for every HTML explanation and other visual artifacts where
rendering matters.

Browser and visual checks must run in the delegated `axstack-ui-verifier` in its own detached checkout; outputs go to its private evidence folder, never the driver worktree.

1. Identify the final artifact bytes and theme. The explicit user theme wins;
   otherwise use the dark default.
   For archify output, bind the `axstack-ui-verifier` pass to the finalize receipt's `artifact.sha256`.
   For archify output, bind `axstack-explainer-review` to the same finalize receipt's `artifact.sha256`.
2. Delegate the rendered pass through [UI verification](../../axstack/references/ui-verification.md).
   Record actual desktop and mobile observations, or name the missing layout
   check.
3. Have the verifier exercise relevant interactions, keyboard and screen-reader
   accessibility, and reduced-motion behavior. Report each unavailable check
   honestly.
4. The explainer reviewer checks text and source fidelity. Keep source
   correctness, tests, rendered behavior, independent review, and publication
   evidence separate.
   For archify output, require `axstack-explainer-review` of every node and edge against source.
5. Bind review to the exact artifact identity. Any byte change invalidates the
   affected approval and requires fresh QA and review.
