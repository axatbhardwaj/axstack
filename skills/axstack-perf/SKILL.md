---
name: axstack-perf
description: When making something faster, use axstack-perf to route measured performance work to the matching phase.
---

# Performance

Usage: `/axstack-perf make the deploy step faster; target -30%`

Load [Performance loop](../axstack/references/perf-loop.md).

- Route a performance regression to `axstack-debug`.
- Route optimization discovery to `axstack-improve`.
- Route an accepted change to `axstack-implement`.

Record the target, noise criterion and finite attempt budget as acceptance checks in the routed phase.
The routed phase owns scope.
This entry point defines no additional workflow, role or runtime.
