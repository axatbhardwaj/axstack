---
name: axstack-correct
description: When repeated mistakes need evidence and stronger checks, use axstack-correct to report correction proposals.
disable-model-invocation: true
---

# Correct

Usage: /axstack-correct ["<correction>"] [runs=<ids> | last=<N, default 10>]

Run only at the user's request.
Write a report only.
Never edit files.
Never dispatch workers.
Never merge.
Never read transcripts.

Read [run records](../axstack/references/run-record.md): Decisions, deviations, Learnings, FAILED receipts, audit proposals.
Read git history bounded by selected runs.
Read only PR reviews named in those records.
Record selected runs and git bounds.
Report inaccessible evidence.

A class needs at least two distinct incidents.
Each incident needs a distinct pointer: run id + attempt or file:line, SHA, or PR or review URL.
Count an incident echoed in several records once.
If a pointer is missing, report recurrence UNKNOWN and keep the class open.

Try fixes in this order: remove copied pattern > script or helper error naming the fix > brief or receipt template > bun test > prose.
Label each rule `shipped` or `runtime: advisory`.
Use `shipped` only when a check fails in CI on the mistake itself.
When only audit can observe a rule, label it `runtime: advisory`.
A prose-contract test alone leaves a rule `runtime: advisory`.
Propose fixes through a small-change intent and [axstack-implement](../axstack-implement/SKILL.md).

The `## Enforced rules` table in the target repo's AGENTS.md changes only in the PR that adds its check.
The first row's PR adds a test that fails when any row's enforcement path disappears.
If a `shipped` check missed a later recorded recurrence, report `enforcement failed`.
For that failure, propose relabelling the row `runtime: advisory` in a separately reviewed PR.
