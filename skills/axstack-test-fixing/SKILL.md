---
name: axstack-test-fixing
description: When an existing test is failing, flaky, or weak, use axstack-test-fixing for a scoped repair that preserves its contract.
---

# Test Fixing

Drivers follow [Ready work](../axstack/references/parallel-first.md#ready-work)
at intake and dependency or completion transitions.

Start at the named existing test and its observable contract. Use
[Test value](../axstack/references/test-value.md) for assertion quality and
repair and deletion proof. Audit-only requests stay report-only.

1. **Establish the baseline.** For a failing test, run the original check and
   capture the expected versus actual result. For flakes, record the command,
   environment, seed when available, and failure count over a bounded run.
   For a weak green, name the regression and show how the check misses it with
   a targeted disposable mutation. Restore the original bytes.
2. **Find the owner.** Inspect the test, fixtures and runner against the
   contract. Classify the cause as a product regression, test defect, or
   harness/CI fault. Use [Debug](../axstack-debug/SKILL.md) for unresolved
   causes and suspected product regressions. Hand off confirmed product
   regressions with their repro for scoped [Implement](../axstack-implement/SKILL.md) work.
3. **Repair within scope.** Deliver authorized assertion, fixture, or harness
   repairs through Implement. Preserve the contract and every unique regression
   protection. Skips, retries, and looser assertions can hide the failure.
4. **Prove the repair.** Rerun the original check and the affected suite. For
   a weak assertion use the shared [F proof](../axstack/references/test-value.md#f-proof).
   For consolidation or removal apply the shared
   [deletion proof](../axstack/references/test-value.md#deletion-proof).
   If a test moves or is replaced, trace CI jobs, filters, and commands to
   prove the remaining check runs and its failure fails the applicable gate.
   Keep the original protection when this is unverified.

Report the cause, preserved contract, before/after command results, and
unverified CI behavior.
