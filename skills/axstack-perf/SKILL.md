---
name: axstack-perf
description: When making something faster, use axstack-perf to route measured performance work to the matching phase.
---

# Performance

Drivers follow [Parallel-first ready work](../axstack/references/parallel-first.md#ready-work)
at intake and dependency/completion transitions. Workers keep their assigned
scope and never dispatch.

Usage: `/axstack-perf make the deploy step faster; target -30%`

Load [Performance loop](../axstack/references/perf-loop.md).

- Route a performance regression to `axstack-debug`.
- Route optimization discovery to `axstack-improve`.
- Route an accepted change to `axstack-implement`.

Record the target, noise criterion and finite attempt budget as acceptance checks in the routed phase.
The routed phase owns scope.
This entry point defines no additional workflow, role or runtime.

Overlap only non-measuring preparation/analysis or isolated non-contending probes.
Never run concurrent measured attempts within one loop. Preserve the frozen
workload/command/environment, noise criterion, cheapest-first early stop, one
measured change at a time, keep/revert and revert-before-next order. Every
experiment counted by the owning loop, including failed or parallel preparatory
candidate-effect probes, consumes its existing finite budget; early stop still
applies. Contended measurements never support baseline, delta or keep decisions.
