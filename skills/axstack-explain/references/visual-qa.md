# Visual QA checklist

Use this checklist for every HTML explanation and other visual artifacts where
rendering matters.

1. Identify the final artifact bytes and theme. The explicit user theme wins;
   otherwise use the dark default.
2. Render the final artifact at desktop and mobile widths. Record actual
   observations for both, or name the missing layout check.
3. Exercise relevant interactions, keyboard and screen-reader accessibility,
   and reduced-motion behavior. Report each unavailable check honestly.
4. Keep source correctness, tests, rendered behavior, independent review, and
   publication evidence separate.
5. Bind review to the exact artifact identity. Any byte change invalidates the
   affected approval and requires fresh QA and review.
