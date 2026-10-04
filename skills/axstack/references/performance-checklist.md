# Performance checklist

Use this checklist only for performance claims.
Keep workflow count accounting with axstack-audit.
A limiter is the resource or code path that bounds performance.

1. **Limiter: What bounds the result?**
   Identify the resource or code path that limits the result from profiles or counters captured during a run.
2. **Tuning: Did each option use suitable settings?**
   Check each option with comparable production settings, versions, and data.
3. **Limits: Is the result physically plausible?**
   Compare the result with hardware limits and the changed code's share of total elapsed time.
4. **Errors: Did the run succeed?**
   Verify successful work and correct outputs using error counts from the measurement run.
5. **Reproducibility: Does the difference repeat?**
   Report the median and range from repeated, alternating runs of each option.
6. **Relevance: Does the result matter to users?**
   Measure the end-to-end user path with realistic data and concurrency.
7. **Work happened: Did the timed work finish?**
   Verify that the intended work completed inside the timed region.

Ideas paraphrased from [pstack benchmark-checklist](https://github.com/cursor/plugins/blob/e43c7ee26e0038c6c1fa8380dd34ce86ff94cb2a/pstack/skills/benchmark-checklist/SKILL.md) (MIT), using Brendan Gregg's seven benchmark questions.
