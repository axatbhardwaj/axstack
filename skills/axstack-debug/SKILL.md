---
name: axstack-debug
description: When a bug, failing test, regression, or wrong behavior needs a root cause and a red loop is wanted, use axstack-debug to diagnose, escalate through adviser-directed investigators, and hand off a classified repair.
---

# Debug

Produce a diagnosis record with a red-capable loop, a confirmed root cause or
an honest UNKNOWN, and a classified hand-off. This skill never lands, commits,
pushes, or publishes a product change; the repair goes to `axstack-implement`.
`axstack-explain` answers how a system works; use this skill when something is
wrong and a red loop is wanted.

Before starting, load [Standing contracts](../axstack/references/contracts.md)
and the lifecycle it requires. Shapes for the evidence packet, investigator
brief, receipt, and diagnosis record are in [packet.md](references/packet.md);
read it before phase 7 and before any fan-out.

Redact secrets before showing any command, output, or artifact; build loops
against environment variables so credentials never appear in what is shown.

## Phases

Each phase has an observable completion criterion. Skip one only with a
recorded reason.

1. **Loop.** Produce one agent-runnable command that goes red on the user's
   exact symptom and is fast and deterministic. Prefer, in order: a failing
   test at the nearest seam, an HTTP or CLI invocation diffed against a
   known-good output, a headless browser script, a replayed captured trace, a
   throwaway harness, a property loop, a bisection harness, a differential run.
   For a flaky bug pin the sample count, observed failures, duration, seed and
   environment, and the comparison criterion; a bare "high reproduction rate"
   cannot support a later green claim. Narrow code reading needed to find the
   entry point is allowed; forming a theory before the loop exists is not. If a
   loop cannot be built, stop and ask the user for an environment, a redacted
   artifact, or instrumentation permission. Done when the command has run once
   and its red output is recorded.
2. **Reproduce and minimise.** Confirm the loop reproduces the user's failure
   and not a neighbour. Remove inputs, callers, config, data, and steps one at
   a time within a stated budget until the repro is the smallest practical;
   keep the original loop as well. Done when each remaining element is
   load-bearing or the budget is spent and recorded.
3. **State and recent change.** Before reading code, inspect persistent
   state, environment drift, caches, locks, config, and `git diff` and
   `git log` since the last known-good revision. Record findings or none.
4. **Hypothesise.** Rank the falsifiable hypotheses the evidence supports,
   each with the prediction it makes. One strongly supported hypothesis is
   enough; never invent alternatives to reach a quota. Show the ranking to the
   user and proceed without blocking. If the user re-ranks mid-wave, finish
   the wave and re-rank before the next.
5. **Probe.** One probe per prediction, one variable at a time, every debug
   log tagged with a unique prefix so cleanup is a single search. Use a
   debugger or REPL before logs where available and bisection where history
   exists. For a performance regression measure a baseline before any change.
   A failed probe is not a failed fix.
6. **Root cause and seam.** Trace the bad value backward to its origin. Name
   the regression-test seam, or record NONE as a finding. Sweep the codebase
   for the same pattern elsewhere and list the sites.
7. **Record and hand off.** Emit the diagnosis record, classify the repair,
   remove tagged instrumentation and throwaway harnesses or list them for the
   implementer, and preserve the loop and minimal repro. Done when the record
   is complete and the hand-off names its class.

Anti-patterns to name and refuse: bypass flags, retry loops that mask
diagnosis (bounded repeated trials for flaky reproduction are not this),
shotgun changes, guards without a why, symptom fixes, theory before the loop,
and "one more attempt" after the ladder says escalate.

## Fix attempts

A **fix attempt** is one coherent repair, predicted by the diagnosis record to
turn the loop green, evaluated by the driver against the original symptom loop
and the minimised repro. A change that failed because of an implementation
slip (wrong file, bad test, setup failure) returns to the author under the
existing repair contract and does not count. A diagnostic probe never counts.
The per-bug ledger (revision, hypothesis, loop result, regression result, new
failures introduced) carries across this skill, `axstack-implement`, and
resume; a new invocation imports known attempts instead of resetting.

## Ladder

| Rung | Trigger | Who | Output |
| --- | --- | --- | --- |
| L0 | entry | driver alone | phases 1–7; at most one fix attempt through `axstack-implement` |
| L1 | the L0 fix attempt failed; or phases 1–3 complete plus at least one discriminating probe (or a recorded reason no safe probe exists) and no hypothesis ranks | the preset's configured advisers, independently, same evidence packet | ranked hypotheses and one investigator brief per hypothesis |
| L1 fan-out | driver merges the adviser plans | `axstack-debug-investigator-1..4`, identical packet, distinct briefs, no cross-reading | one receipt per brief |
| L2 | the L1 fix attempt failed (second failure overall); or each fix reveals a new symptom elsewhere | the configured advisers on architecture, then the user | wrong-architecture finding, bounded refactor proposal, or one bounded next diagnostic action; the user decides before any third attempt |

L1 is inadmissible without a red loop. Ordinary diagnosis is not a high-stakes
decision: in `mixed` both advisers are consulted and both receipts are
required; a single-provider preset consults its one configured adviser and
records the other as an intentional absence. Whenever a run exposes a
high-stakes architecture choice, serious security, downtime, or data-loss
risk, the standing high-stakes and serious-risk contracts override this rule,
including the single-provider high-stakes hold. An adviser configured but
unavailable at launch holds L1 and L2 without substitution; L0 continues.
Reuse an adviser receipt while the packet is unchanged; a changed packet needs
a fresh receipt.

**Plan merge.** The driver de-duplicates the advisers' hypotheses, ranks the
union with reasons, drops hypotheses both advisers refute, assigns the top N to
the N live investigators (briefs ≤ seats per wave), and records the remainder
as untested (queued). A second wave on the same roles is allowed on changed
evidence. If every probe is refuted or inconclusive, one bounded adviser replan
on the new evidence, then hold for the user; never unbounded.

**Fan-out floor and completion.** At least two configured investigators must
start with verified identity, or the fan-out is held with no substitution; a
single available seat may run safe fact work but does not satisfy L1. L1 is
complete only when at least two usable independent investigator receipts exist
and every decisive conclusion has sufficient evidence. Account for every
planned hypothesis as confirmed, refuted, inconclusive, blocked (probe could
not run), or untested; accounting is reporting, not investigation, and two
peripheral receipts do not clear a missing decisive probe. If a seat drops
mid-wave, keep completed receipts and hold only dependent conclusions. Held
briefs may be run serially by the driver at L0 authority, recorded as
driver-run; driver-run probes supplement the evidence but never replace the
two independent receipts or clear the hold. Reconcile contradictory receipts
by evidence or one discriminating rerun, never by vote.

Immediately before an actual adviser or investigator dispatch, load and follow
[Orca runtime](../axstack/references/orca-runtime.md).

## Isolation

Each investigator gets its own disposable worktree at the pinned revision plus
the recorded dirty patch and packet artifacts, materialised and hash-verified
there, and re-runs the original loop red (for a flaky loop, meeting the phase 1
pinned sample criterion) before probing. It may edit that worktree for probes
and never commits, pushes, publishes, or creates children. Before
driver-verified cleanup, the exact probe diff or script, command and output,
and the receipt are preserved as redacted receipt artifacts under the run
directory (the driver remains the sole `progress.md` writer); only then is the
worktree discarded. The loop must be hermetic (worktree-local). A worktree
isolates files, not shared or live systems: if the loop touches shared state
(database, port, cache, lock), parameterise it per investigator, or serialise
the wave against an explicitly authorised resource with recorded reset and
restore steps between probes; if neither is possible, hold that probe. The
bundle's mode convention stays; record requested and effective settings
separately, and hold on an unsupported requested mode.

## Hand-off

Classify the repair in the diagnosis record. A confirmed bounded repair
supplies the small-change intent to `axstack-implement`; a substantial repair
takes the approved-spec and ticket route; an unresolved diagnosis stays
investigation. NONE seam is an explicit TDD gap that needs a scoped decision,
not permission to fix without a meaningful red. The implementer verifies
against both the original loop and the minimised repro. Returning to a phase
transfers no PR ownership and grants no new mutation authority. Record one
lesson line when the bug changed your understanding; it authorises no memory
or skill edits.
