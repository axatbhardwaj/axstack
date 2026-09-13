# Audit record schema

Write one record per audited run or checkpoint in the field order below. Every
count includes its denominator and evidence reference. Use `UNKNOWN` with the
reason when evidence is missing; missing evidence is never a pass.

```text
Run: <run identity + scope/authority + audit mode (end-of-run | checkpoint)>
Baseline: <approved spec rev | peer mode | research mode | maintenance scope>
Acceptance: <passed / failed / unverified + test + SHA traces>
Steps: <completed / deviated + why + approval per deviation>
Fable: <coverage across creation/revision/design/consequential + receipts>
TDD: <applicable evidence path: normal real red-green | accepted structure-preserving old revision green before edits + same checks new revision green; absent proof: noncompliance | unavailable records: UNKNOWN with reason>
Review: <exact-rev independent review status + unresolved findings>
Rework: <cycles + causes>
Interventions: <avoidable user interventions, or unsupported by records>
Parallelism: <identified vs dispatched + dependency/writer isolation>
Cost: <model/tool/time/token/cost figures, or unknown otherwise>
Judgment: <execution outcome vs procedural adherence vs measurement coverage>
Proposals: <bounded hypothesized changes with regression-first plan, or none>
Privacy: <local/private default; sanitized summary only when authorized>
```

The record is complete when its counts reconcile, its judgments remain
separate, every proposal has a regression-first validation path, and all
unknowns and evidence limitations are explicit.
