# Audit record schema

One record per audited run or checkpoint, using the field order below.
Counts always carry denominators; missing evidence is recorded, never a pass.

```text
Run: <run identity + scope/authority + audit mode (end-of-run | checkpoint)>
Baseline: <approved spec rev | peer mode | research mode | maintenance scope>
Acceptance: <passed / failed / unverified + test + SHA traces>
Steps: <completed / deviated + why + approval per deviation>
Fable: <coverage across creation/revision/design/consequential + receipts>
TDD: <red-green proof or recorded noncompliance>
Review: <exact-rev independent review status + unresolved findings>
Rework: <cycles + causes>
Interventions: <avoidable user interventions, or unsupported by records>
Parallelism: <identified vs dispatched + dependency/writer isolation>
Cost: <model/tool/time/token/cost figures, or unknown otherwise>
Judgment: <execution outcome vs procedural adherence vs measurement coverage>
Proposals: <bounded hypothesized changes with regression-first plan, or none>
Privacy: <local/private default; sanitized summary only when authorized>
```
