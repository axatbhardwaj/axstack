---
name: axstack-implement
description: Build candidates with strict TDD, exclusive writers, owner accountability, and stack discipline.
---

# Implement

Load before acting:

- [Paseo launch](../axstack/references/paseo-launch.md)
- [Standing contracts](../axstack/references/contracts.md)
- [Shared routing](../axstack/references/routing.md)
- [Lifecycle and receipts](../axstack/references/lifecycle.md)

Requires a scope identity matching the mode (see
[Shared routing](../axstack/references/routing.md) and
[Lifecycle](../axstack/references/lifecycle.md)): new implementation
confirms the approved spec identity before building and holds on
unapproved scope; repairs to an adopted own PR proceed on its accepted
user-authorized maintenance snapshot with no new spec or ticket
ceremony. Material scope changes still hold affected work.

## Strict TDD (red, green, refactor)

1. Define a behavior check from approved acceptance criteria, failure behavior, or an integration boundary. Do not restate source text or mirror the implementation.
2. Execute it and observe the intended behavioral failure (real red). A missing-module import error or unrelated setup failure is not red.
3. Implement the smallest change that satisfies it (green), then refactor while green.
4. Capture failing and passing evidence tied to the candidate revision.

Historical noncompliance cannot be erased: tests added after code never
retroactively prove TDD. Report the noncompliance honestly; any corrective
work starts from a new real red followed by green.

## Meaningful acceptance checks

Derive executable checks from the spec and ticket acceptance: the commands
run, outputs observed, and states verified. Cover the affected integration
boundary, and add rendered interaction evidence for UI work when relevant.
Name every boundary you did not verify (unavailable OS, harness, or
credential) instead of implying coverage.

## Ownership and parallelism

- One persistent owner per PR, accountable for candidate, fixes, verification evidence, monitoring. The owner may delegate coding but never edits a worker-owned candidate concurrently. Exactly one writer per candidate.
- Default two active PRs; the driver queues dependent or conflicting work.
- Dependent PRs build on reviewed parent candidates via `gh stack`. When the parent changes: hold the child merge and reliance on stale child evidence, update the child onto the new parent rev, re-run affected checks, and re-verify. Do not hold the merge of an independently reviewed parent for the child's sake; a green parent never proves the combined stack.
- Author repair continuity: accepted review fixes return to the author session where evidence allows.

## Restart reconciliation

On restart or resume, reconcile recorded ownership with actual Paseo
sessions, Git revisions, GitHub state, and the approved spec. Reuse owners
and workers where appropriate. Reporting an ambiguous launch is not
permission to create another writer: resolve ownership first and report
unresolved launch state before any duplicate writer. Also reconcile Linear
issue state per `axstack-tickets` and watch registrations per
`axstack-watch`.

## Template: compact handoff

```text
PR: <URL> rev <sha> owner <profile> worktree <path>
Spec: <approved rev> capability <issue>
State: <checks + evidence links>
Unverified: <boundaries not verified + why>
Next: <actions + who>
```
