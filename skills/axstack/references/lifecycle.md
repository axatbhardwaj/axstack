# Shared lifecycle and receipts

Loaded by entry, review, and watch; reached from every other phase
through the conditional pointers in [Standing contracts](contracts.md).

## Roster (compact)

- Driver: current chat. Owns scope, decisions, cross-PR dependencies,
  and all mutations. Coordinates via existing shared contracts only.
- Owner (`axstack-owner`): one persistent owner per PR. Only the owner
  launches the writer, reviewers, monitor, and watchdog.
- Author: exactly one writer per candidate at a time. Accepted fixes
  return to the original author. Workers launch no recursive teams.
- Reviewers: exactly two independent final reviewers (Sol + Opus), same
  brief, no first-pass cross-read.
- Monitor / watchdog: independent, read-only Opus medium sessions on
  native Paseo timers.
- Auditor (`axstack-auditor`): read-only evidence collection only; never
  edits, merges, or activates anything. See audit hook below.

Prefer independent parallel subagent work with bounded tasks: one
writer per candidate, default two active PRs, no redundant workers.

## Ownership

One persistent owner per PR, accountable for candidate, fixes,
verification evidence, and monitoring. Exactly one writer per candidate
at a time. Peer code under review stays readonly; the reviewer never
edits it.

## Receipts (bind each decision to evidence)

- Session receipt: agent and workspace IDs run the requested
  provider/model for the requested role. Persist actual IDs; reuse on
  resume instead of spawning replacements.
- Review receipt: reviewer, candidate SHA, verdict
  (APPROVE | REQUEST_CHANGES | INCOMPLETE), coverage, limitations,
  findings. Changed code needs a refreshed receipt for the new revision.
- Submission receipt: the actual commit parameter bound, the
  consolidated review submitted, and the remote confirmation. On
  ambiguous submission, lookup before retry — never resubmit blindly.
- Audit receipt: scope, outcome evidence with counts and denominators
  (PASS/FAIL/UNKNOWN), and any improvement proposals. Raw run records
  stay local; only sanitized summaries publish, and only with authority.

## Deadline (one rule for every owned timer)

The configured default 24h deadline applies to all task-owned timers —
monitor and watchdog alike, including still-open PRs. Both stop at the
deadline; work remaining gets a resumable handoff, never a silent
renewal. Merge-ready is an observed state, distinct from merged; the
human merges by default.

## Watch health

Monitor and watchdog are independent, read-only, Opus medium sessions
on native Paseo timers. Require initial verified handshakes; healthy
ticks are snapshot-only and never wake the driver. Dedup event IDs;
uncertain sends are reconciled before any retry; restart reuses prior
watch state instead of registering duplicates.

## Audit hook (end of run and meaningful checkpoints)

At end of run and at meaningful checkpoints, the driver may dispatch
the auditor (`axstack-auditor`) for read-only evidence collection
against the run record: scope, outcome evidence, and metric counts with
denominators. Findings are PASS/FAIL/UNKNOWN with evidence — never
invented numbers, including cost figures. Improvement proposals change
nothing by themselves: the driver follows each accepted proposal up as
ordinary tested, independently reviewed work, delivered as PRs the
human merges. No automatic self-edit, merge, or activation. Raw run
records stay local (user privacy); sanitized publication needs its own
authority.

## Idle-complete archive and retain

After actual work is done — all required PRs merged or handed off, all
owned timers stopped and receipts verified — the driver archives the
run record (scope, revisions, evidence, receipts, timer expiries) and
retains it locally. Archive only idle-complete runs: never active or
waiting workers, never reassign ownership on idle, no global sweeps.
Only task-owned records are archived; unrelated host state is untouched.
