# Audit record schema

Write one record per audited run or checkpoint in the field order below. Every
count includes its denominator and evidence reference. Use `UNKNOWN` with the
reason when evidence is missing; missing evidence is never a pass.

```text
Run: <run identity + scope/authority + audit mode (end-of-run | checkpoint)>
Baseline: <approved spec rev | peer mode | research mode | maintenance scope>
Acceptance: <passed / failed / unverified + test + SHA traces>
Steps: <completed / deviated + why + approval per deviation>
Advisers: <Astra/Fable coverage + same-question receipts + high-stakes AGREE status>
Debug: <rung reached + loop command + fix attempts + adviser and investigator receipts + isolation evidence | n/a>
TDD: <applicable evidence path: normal real red-green | accepted structure-preserving old revision green before edits + same checks new revision green; absent proof: noncompliance | unavailable records: UNKNOWN with reason>
Review: <exact-rev independent review status + unresolved findings>
Rework: <cycles + causes>
Interventions: <avoidable user interventions, or unsupported by records>
Parallelism: <identified vs dispatched + dependency/writer isolation>
Shape: <PRs within band / total PRs + rationale-band cohesion rationale + exception-band full driver exception record; missing measurement: UNKNOWN>
Cost: <model/tool/time/token/cost figures, or unknown otherwise>
Judgment: <execution outcome vs procedural adherence vs measurement coverage>
Proposals: <bounded hypothesized changes with regression-first plan, or none>
Learning candidates: <each candidate's statement + scope + evidence/revision pointers + target instruction surfaces + contradiction/uncertainty + disposition; explicit already-covered no-op or none>
Privacy: <local/private default; sanitized summary only when authorized>
```

The record is complete when its counts reconcile, its judgments remain
separate, every proposal has a regression-first validation path, every learning
candidate is bounded to accepted audited evidence, and all unknowns and
evidence limitations are explicit. Learning candidates are report-only:
promotion is separately authorized, workspace scope targets both workspace
`AGENTS.md` and `CLAUDE.md`, and user-wide scope targets applicable Codex
`$CODEX_HOME/AGENTS.md` and Claude `~/.claude/CLAUDE.md`. Mixed routing requires
semantic parity, preservation of non-Axstack content and ownership, and
rejection of partial promotion; the auditor writes only `audit.md` and makes no
instruction, config, or memory mutation.
