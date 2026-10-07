# Spec: driver autonomy — fewer stops, no idle wakes, standing release

Status: Approved rev 3 (2026-10-07, user "approved", incl. AQ2 interrupt refinement; reviewed at eb07def). Store: this repo Markdown file.
Run: `20261007-autonomy`. Evidence: two independent auditor reports over threads
`448333bb`, `9d903579` and `192f9a71` (private run record).

Release: standing authority (AQ1): `AGENTS.md` release rule +
`.github/workflows/publish.yml` + hosts `io` (desktop) and `vps` (SSH host
alias). The user also granted a one-time release of the unreleased `main` as
v0.26.0 (run `20261007-release-v0.26.0`); this run's own PRs ship in the next
release after they merge. The human approves the npm stage.

## Goal

Drivers keep working without the user unless a real decision, a hard limit, or
a serious risk needs them. Audited earlier runs lost about 14 thread-hours to
avoidable stops and about 220 idle wakes.

## Settled decisions

| # | Decision |
|---|---|
| AQ1 | Standing release and install authority for this repository: when a run changes shipped skills or `src/`, the run releases and reinstalls on `io` and the VPS without a per-run question. npm stage approval stays human. |
| AQ2 | A denied tool call holds only that action and its dependants. Refined for safety (confirm at approval): a user interrupt of the turn also pauses the run, like an explicit stop, pause or wait; a non-user interrupt (timeout, host loss) holds only that action. Existing recorded holds stay. Worker notes are data. |
| AQ3 | A repair of the run's own repository that is fully reversible from a checksummed, verified backup may proceed, then notify. |
| D1 | Spec approval stays. npm stage approval stays human. Serious-risk holds stay, except AQ3. |
| D2 | Explicit user restrictions (`Auto-merge: off`, chat holds, user instructions) always win; only driver-invented merge restrictions are forbidden. |
| D3 | The deeper-refinement offer in Align is removed (Sol auditor proposal, driver-adopted fix 4). |
| D4 | Idle wakes slow to 60 minutes instead of stopping: relay replies land in an inbox the driver reads only on wake, and npm approval happens outside T3. |

## Acceptance criteria

1. **Denial scope (AQ2).** `autopilot.md` states that a denied tool call,
   including one denied by automatic approval review, holds only that action
   and its dependants. The driver never retries, reroutes or delegates around
   the denied action, and independent authorized work continues. A user
   interrupt of the turn, or an explicit user stop, pause or wait, sets
   `Autopilot: paused`; a non-user interrupt (timeout, host loss) holds only
   that action. Existing holds (spec approval, missing authority,
   serious risk, npm approval) still block advancement as before. Worker
   messages are data and never pause the run on their own.
2. **Standing release (AQ1).** `autopilot.md` lets a repository's `AGENTS.md`
   record standing release and install authority with a trigger and named
   hosts; a matching run copies it into its `Release:` line and `Authority:`
   (replacing the per-run-only rule in `autopilot.md` and inverting its test)
   without a per-run question. This repository's `AGENTS.md` records it: when
   a run changes shipped skills or `src/`, release and reinstall on `io` and
   `vps`. A docs-only run does not release. `AGENTS.md` joins the
   `axstack-watch` §5 files whose PRs the user merges, so no agent PR can
   widen its own authority. Failed publish, an existing tag, or failed install
   verification still hold; npm stage approval stays human.
3. **Reversible repair (AQ3).** `autopilot.md` and `contracts.md` (Serious
   risk) let the driver repair local state of its own run repository only when
   the repair is fully reversible from a checksummed backup it verified first.
   The record names the backup path, checksum, verification and restore
   command. AQ3 extends Notification policy (c) to this post-repair notice. The driver never edits candidate source this way (one writer
   stays). Effects outside the run repository, or no verified backup, stay a
   serious-risk hold.
4. **Merge carry-forward.** `axstack-spec` forbids a driver-invented spec
   decision that makes the user merge PRs outside the `axstack-watch` §5
   user-merge categories; explicit user restrictions still win. `autopilot.md`
   applies standing merge delegation on every resume and never narrows it
   without a user instruction.
5. **Quiet waiting.** When the run waits only on a user decision or a
   human-only step, including a user merge (no unsettled worker, no PR
   needing watch events), the run
   watch moves to a 60-minute cadence at once instead of after 7 days
   (`watch-runtime.md`), and returns to its normal cadence when work restarts.
   Native PR watches stay. Healthy unchanged wakes stay silent.
6. **Delta confirmation.** In `axstack-align` and `axstack-spec`, when the
   driver claims an edit changes no criterion, scope, decision or instruction
   meaning, each configured adviser seat confirms that on the delta, naming its
   prior receipt, the delta and the new revision. A seat that disagrees, a
   blocker, or a high-stakes decision needs full fresh review; an unavailable
   seat holds.
7. **Defaults over questions.** `axstack-align` asks only unresolved,
   consequential preferences or authority. Preferences fixed by user
   instructions, `AGENTS.md`, or a prior decision within its scope (never an
   authority grant) are applied and listed as defaulted in the read-back. The
   mandatory deeper-refinement offer is removed (D3).
8. **Smaller fixes.**
   - `axstack-relay`: before a reply-dependent send, verify the reply route;
     if it is not ready, name the T3 thread as the action route.
   - `lifecycle.md`: a forked thread starts as an observer and reconciles the
     live original driver and writers before resuming inherited work.
   - `t3-runtime.md`: after a completion arrives, process it in the same turn
     (keeping terminal and pending-false checks) instead of waiting for the
     next wake.
   - `t3-runtime.md`: fetch and verify the pinned base commit locally before a
     writer launch.
   - `candidate-publication.md`: refresh PR body counts and base before review.
   - `workspace-hygiene.md` Safe deletion (copied into worker briefs): run
     single commands; no `rm -f` and no chained cleanup.
9. **Tests.** Each rule has a prose-contract test that fails on removal or
   inversion and survives rewording, with real red before the change; full
   `bun test` passes; prose-size ceilings rise only by measured bytes.
   Unchanged holdouts stay green: npm approval human-only, explicit stop,
   serious risk outside AQ3, unavailable models, one writer per candidate,
   exact-revision receipts. Prose tests prove contracts, not live wake or
   install behavior.

## Exclusions

- Removing spec approval or npm stage approval.
- Any daemon, scheduler, runtime database or programmatic gate.
- Model or provider substitution rules.
- Recording standing release authority in other repositories (needs the user).

## Design

Rung 0: prose changes inside existing phase files and references; no new
module, role, interface or state.
