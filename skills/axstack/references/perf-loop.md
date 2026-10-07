# Performance loop

Keep one writer per candidate.

Follow this ordered loop:

1. **Freeze and prove sensitivity.**
   Freeze the workload, command and environment before the baseline.
   Prove that the measurement harness can detect a change.
   If the harness cannot detect a change, hold the loop.
2. **Measure the baseline.**
   Capture the baseline.
   Vet every number with [Performance checklist](performance-checklist.md).
3. **Set acceptance checks.**
   Set a target, a noise criterion and a finite attempt budget as acceptance checks in the owning phase.
   The noise criterion is the minimum gain that distinguishes a win from measurement variation.
4. **Choose the cheapest hypothesis.**
   Try these mantras in order, cheapest first:

   - don't do it
   - don't do it again
   - do it less
   - do it later
   - do it when they're not looking
   - do it concurrently
   - do it cheaper

   Stop when an earlier mantra meets the target.
5. **Test one experiment.**
   Verify one change at a time.
   Keep unchanged correctness checks green.
   Keep a change only when its gain exceeds the noise criterion.
   Revert a rejected experiment before the next one.
   Record each rejected experiment with its measured number in the run record and implement receipt.
6. **Keep accepted wins.**
   Make one commit per accepted win.
   A changed harness invalidates earlier comparisons.
7. **Stop and report.**
   Stop at the target or when the budget is spent.
   Report the baseline, post-change number, delta and artifact path in the run record and implement receipt.
   Report an unmet target as unmet.

Ideas paraphrased from pstack's perf-issue and hillclimb
[playbooks](https://github.com/cursor/plugins/blob/d0ef80d86795816da932a153458c5dbe192d294e/pstack/skills/poteto-mode/playbooks/) (MIT).
