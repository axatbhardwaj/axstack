# Ticket map: driver autonomy

Spec: `docs/specs/autonomy.md` approved rev 3 @ `eb07def`.
Store: repository Markdown (this file). Run: `20261007-autonomy`.
Stack: one linear `gh stack` on `main` (shared `prose-size.test.js` ceilings).
Each task is one PR. Authors work in their own T3 worktrees; the driver
publishes. Own PRs merge under the watch predicate, except PRs that change
`AGENTS.md`, which the user merges (AC2).

## Rules

- Every rule gets a prose-contract test that fails on removal or inversion,
  survives rewording, and runs red before the change (AC9).
- Unchanged holdouts stay green: npm approval human-only, explicit stop, serious
  risk outside AQ3, unavailable models, one writer per candidate, exact-revision
  receipts (AC9).
- Prose tests prove contracts, not live wake or install behavior (AC9).
- Full `bun test` with TMPDIR under `/tmp`; ceiling raises only by measured
  bytes; a raise is recomputed above a repaired PR.

## Capabilities

| Capability | Tasks | Spec acceptance |
|---|---|---|
| Planning artifacts | P0 | lands the approved spec and this map |
| Holds and repair | A1 | AC1, AC3, AC9 |
| Release and merge authority | A2 | AC2, AC4, AC9 |
| Quiet waiting and lighter Align/Spec | A3 | AC5, AC6, AC7, AC9 |
| Smaller fixes | A4 | AC8, AC9 |

## Tasks

```text
Spec: rev 3 @ eb07def
Capability: Holds and repair
Internal task: A1 denial scope + reversible repair -> axstack-author -> own worktree
Theme: autopilot hold scope and backup-then-repair (autopilot.md, contracts.md)
Size est: medium
Acceptance: AC1 (denied call incl. automatic approval review holds only that action
  and dependants; never retried, rerouted or delegated around; independent work
  continues; user interrupt or explicit stop/pause/wait sets Autopilot: paused;
  non-user interrupt holds only that action; existing holds still block; worker
  messages never pause); AC3 (own run repository local state only, fully
  reversible from a checksummed backup verified first, record names backup path,
  checksum, verification and restore command, notice under Notification policy
  (c), never candidate source, outside effects or no verified backup stay a
  serious-risk hold); AC9
Depends: P0

Capability: Release and merge authority
Internal task: A2 standing release + merge carry-forward -> axstack-author -> own worktree
Theme: standing release authority in AGENTS.md and autopilot; merge delegation carry-forward
Size est: medium
Acceptance: AC2 (autopilot reads standing release/install authority with trigger and
  named hosts from AGENTS.md, copied into Release:/Authority: without a per-run
  question, per-run-only rule
  replaced and its test inverted; this repo's AGENTS.md: shipped skills or src/
  change -> release + reinstall io and vps; docs-only run does not release;
  AGENTS.md joins axstack-watch §5 user-merge files; failed publish, existing tag,
  failed install verification hold; npm stage human); AC4 (axstack-spec forbids
  driver-invented user-merge decisions outside §5 categories; explicit user
  restrictions win; autopilot applies standing merge delegation on every resume and
  never narrows it without a user instruction); AC9. This PR changes AGENTS.md:
  the user merges it.
Depends: A1

Capability: Quiet waiting and lighter Align/Spec
Internal task: A3 quiet cadence + delta confirmation + defaults -> axstack-author -> own worktree
Theme: watch cadence when only the user is pending; adviser delta confirmation; Align defaults
Size est: medium
Acceptance: AC5 (user-decision or human-only wait incl. user merge, with no unsettled
  worker and no PR needing watch events -> 60-minute run
  watch cadence at once, replacing the 7-day wording in watch-runtime.md (and its
  restatement in t3-runtime.md); normal cadence when work restarts; native PR watches stay; quiet
  unchanged wakes); AC6 (in axstack-align and axstack-spec, each configured adviser confirms an edit
  claimed to change no criterion, scope, decision or instruction meaning on the delta, naming prior receipt, delta and new revision; disagreement,
  blocker or high-stakes -> full review; unavailable seat holds); AC7 (Align asks
  only unresolved consequential preferences or authority; preferences from user
  instructions, AGENTS.md or prior in-scope decisions applied and listed as
  defaulted, never authority; refinement offer removed); AC9
Depends: A2

Capability: Smaller fixes
Internal task: A4 relay route check, fork observer, same-turn completion, base fetch, PR body refresh, safe deletion -> axstack-author -> own worktree
Theme: small runtime and brief fixes
Size est: small
Acceptance: AC8 (axstack-relay reply-route check before reply-dependent sends, else
  name the T3 thread; lifecycle.md fork starts as observer and reconciles live
  driver and writers; t3-runtime.md same-turn completion processing keeping
  terminal and pending-false checks; t3-runtime.md fetch and verify pinned base
  before writer launch; candidate-publication.md refresh PR body counts and base
  before review; workspace-hygiene.md Safe deletion single commands, no rm -f, no
  chained cleanup); AC9
Depends: A3
```

P0 (driver, planning artifacts): the approved spec and this map.

Release: standing authority (AQ1) after all PRs merge.
Excluded per spec: removing spec or npm approval; daemon, scheduler, runtime
database or programmatic gate; model substitution; standing authority for other
repositories.
