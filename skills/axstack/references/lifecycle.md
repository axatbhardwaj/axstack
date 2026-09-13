# Shared lifecycle and receipts (every owned phase loads this)

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
- Submission receipt: the exact commit bound, the consolidated review
  submitted, and the remote confirmation. On ambiguous submission,
  lookup before retry — never resubmit blindly.

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
