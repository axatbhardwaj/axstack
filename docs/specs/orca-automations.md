# Orca PR automations — specification

Status: revision 2, presented for user approval. Adviser receipts on rev
656890e: Astra AGREE-WITH-AMENDMENTS (six), Fable AGREE-WITH-AMENDMENTS
(four), both AGREE on record-only discovery outside the allowlist; all ten are
absorbed below (`docs/plans/orca-automations-astra-review.md`,
`docs/plans/orca-automations-fable-review-2.md`). Decisions Q1–Q4 and the
fourth criterion were settled by the user on 2026-09-16. Nothing is enabled
until the acceptance checks pass.

## Purpose and boundary

Two native Orca automations keep the user's GitHub pull requests moving without
a human in the loop, on the VPS Orca runtime, using the installed Axstack
skills. Orca owns scheduling, sessions, retries, and run history. Axstack owns
policy, the run record, and evidence. There is no systemd timer, external
scheduler, custom controller, or relay plugin.

This specification lifts, by user decision, the native-watch hold recorded in
`docs/workflows.md` (native watch capability hold), `skills/axstack-watch`
(§3 and `references/watch-runtime.md`), `skills/axstack/references/lifecycle.md`
(watch health), and the `axstack-monitor` / `axstack-watchdog` role notes in
all presets. The same change also adds a narrowly scoped automation exception
to `skills/axstack-review/SKILL.md` (Standalone owner: no separate
`axstack-owner` is materialized; Authorized submission: the `COMMENT` branch
below, with the existing remote head/base readback and ambiguity handling;
remote confirmation before reviewer dispatch applies to the local immutable
candidate SHA), to `skills/axstack-watch/references/repair-publication.md`
(fast-forward `git push` instead of `gh stack` publication), and to
`docs/workflows.md` (`gh stack` publication does not apply to automation
repairs). The prohibition on `APPROVE` and `REQUEST_CHANGES` is a ban on those
GitHub actions; the review skill's internal verdict vocabulary is unchanged.
The driver automation is a mutating owner, not the independent read-only
monitor those files describe; the watchdog keeps the read-only monitor
contract for GitHub and the run record.

Escalation to the user is the exception. It goes through `axstack-relay`
(native one-way `hermes send` to the `telegram` home channel) only when the
escalation gate returns `escalate`.

## Identity and scope

- **Self** is `gh api user --jq .login` on the VPS, resolved at the start of
  every run and never hardcoded.
- **Own PR**: an open PR authored by self. Babysitting has the same authority
  the user has at the keyboard: repair, test, commit, and fast-forward push to
  the PR branch (`git push`, no lease or force). `gh stack` sync or restack is
  out of scope for the automation.
- **Peer PR**: an open PR where self is officially review-requested, or where a
  PR comment @-mentions self asking for a response. Unsolicited reviews never
  happen. Peer code is read-only.
- **Discovery** covers every repository the account can see, via
  `gh search prs --state open --limit 100` with `--author`, `--review-requested`,
  and `--mentions` for self. A result count equal to the limit is a detectable
  truncation and is logged as `error`. Results are deduplicated canonically by
  PR URL across the three searches with own-PR precedence. A mention counts as
  a peer request only when the driver reads the comment and it explicitly asks
  self to review or respond; an incidental mention is discovery data and never
  review authority.
- **Mutation allowlist**, stated verbatim in the automation prompt so it is
  auditable through `orca automations show`: initially `axatbhardwaj/axstack`.
  Outside the allowlist the automation discovers and records only: the precheck
  writes the full discovery list to the sidecar, no review, watch, gate, or
  other model work is launched for an external PR, external changes do not
  enter the wake fingerprint, and external PR contents never produce an
  escalation. This is a deliberate coverage reduction, not an implied clean
  review. Discovery errors themselves remain automation-health findings.
- Prohibited everywhere: force-push, rebase, merge, close, `APPROVE`,
  `REQUEST_CHANGES`. A need for any of these becomes a recorded hold.

## Roles

The automation session is the driver and the owner for every PR it handles; no
separate `axstack-owner` is materialized. Review modes follow
`skills/axstack-review`:

- Peer PR → peer mode: `axstack-reviewer-primary` and
  `axstack-reviewer-secondary`, isolated, no cross-reading.
- Own-PR repair → authored mode: the repair is authored by the automation
  session (provider `claude`), so exactly one cross-family reviewer is selected
  from actual provenance (`axstack-reviewer-primary`, Sol, in `mixed`). If the
  repair is delegated to `axstack-author` (Sol), the reviewer is
  `axstack-reviewer-secondary`.
- "Every mode-required reviewer" below means both reviewers in peer mode and
  the one selected reviewer in authored mode.
- Gate → `axstack-auditor` (Luna max in `mixed` and `codex-only`, Sonnet xhigh
  in `claude-only`).

Every reviewer brief ends with a required field, exactly:
`Escalate to user: yes | no — <criterion> — <reason>`.

## Escalation gate

After every mode-required reviewer settles, the driver spawns the gate with the
verdicts and the candidate revision, instructing it to act as the escalation
gate. It returns exactly one literal token, `escalate` or `proceed`.

- The gate decides only whether the user is notified. Reviewer "yes" is input,
  not a veto.
- `escalate` → one `hermes send` naming the PR, the criterion, every
  reviewer's reason, where the user acts (Orca conversation, worktree, or PR),
  and the hold. The hold is recorded.
- `proceed` → no notification. It never overrides a validated blocking finding:
  a push or `COMMENT` publication additionally requires no unresolved validated
  blocking finding. A reviewer security "yes" that the gate does not escalate
  is recorded as rejected-with-evidence or returned to the author before any
  mutation.
- Criteria, exactly four: a security concern; a permanent on-chain state
  change; an architectural change in approach; and automation health (a
  model-substitution, session, precheck, discovery, or relay-delivery hold),
  usable only by the watchdog and the safety-hold path, never by a reviewer.
- Credible serious risk found by a reviewer still produces the standing
  internal prompt and dependent-action hold of the contracts reference
  immediately; the gate governs only external notification.
- The health gate takes a watchdog finding and its evidence, not reviewer
  verdicts or a candidate; the same two tokens apply.
- An unavailable gate or required reviewer records a hold, pauses mutation for
  that PR, and is recorded as a health finding. An unavailable gate cannot be
  escalated through itself: the hold stays, the gap is visible in Orca run
  history and the sidecar, and no substitute or unauthorized send occurs.

## Automation A — driver (every five minutes)

- Created against the VPS runtime with `--environment vps`, trigger
  `*/5 * * * *`, `--workspace <dedicated existing worktree>` with
  `--reuse-session`, provider `claude`, `--disabled` until acceptance.
- Model and effort cannot be set on an automation; the provider default is
  used. Before any repair or publication the driver validates its effective
  session identity through Orca runtime inspection (the exact fields are
  verified in acceptance 8) and records it; a self-written label is not
  evidence. Expected model: Opus. A mismatch or unknown identity holds repair
  and publication for that run and is a health finding.
- The driver worktree never checks out a PR branch; it hosts the run record.
  A repair runs in a per-PR child worktree created through `orca-cli`.
- **Precheck** (bounded shell, `--precheck-timeout 60`, no model): resolve
  self; run the three searches with `--json url,number,repository,updatedAt`;
  write the full discovery list to `pending.json`; for each allowlisted,
  non-expired own PR add head SHA, base SHA, and the check rollup of that head
  via `gh pr view --json headRefOid,baseRefOid,statusCheckRollup` (check state
  is data; only authentication, command, and network errors are `error`);
  hash only allowlisted PRs; read `cursor.json` for the last processed
  fingerprint and for due control work (a watch deadline at or before now, or
  a pending failed-relay retry). Exit 0 when the hash differs or control work is
  due; otherwise exit non-zero. Exit non-zero without running when the previous
  run of A is still active, or on `error`. Append one line
  `<ts> <changed|due|unchanged|error|busy>` to `precheck.log`. The observed
  fingerprint is written to `pending.json`; the driver promotes exactly that
  value, never a recomputed one, so an event landing during a run is processed
  on the following tick.
- **Run**, for each changed PR:
  - own PR → `axstack-watch` on the exact head SHA. Failing checks or
    actionable review feedback produce a repair candidate committed locally in
    the child worktree, reviewed in authored mode at its local SHA, gated, and
    pushed fast-forward only after `proceed` with no unresolved blocking
    finding, with the publication readback of
    `axstack-watch/references/repair-publication.md` immediately before the
    push.
  - peer PR → two isolated `axstack-review` passes on the exact head SHA. After
    the gate, the owner synthesizes one `COMMENT` review bound to the reviewed
    commit, with both receipts current for the head SHA and a head/base
    readback before submit. `INCOMPLETE` (unresolved material disagreement) or
    an unavailable required reviewer records a hold and publishes nothing.
- Watch window: 24 hours per own PR from first observation, ending early on
  merge or close. The deadline is stored in `cursor.json`; a due deadline wakes
  the driver through the precheck even when GitHub is unchanged, and the driver
  rechecks the deadline immediately before any publication. Expiry marks the
  PR `expired` in the record and sidecar, records a resumable handoff, and
  stops silently. The driver skips an expired PR until the user re-arms it in
  the automation session; the precheck ignores it.
- Per-PR event state: head SHA, base SHA, check rollup, and processed request
  and comment IDs. A review receipt is reused only when head, base, and scope
  are unchanged; a new failing check, base change, review request, or
  qualifying comment at an unchanged head is new work.
- Session growth: the user may run `--fresh-session` at will; a fresh session
  reconciles from the run record and is not itself a fallback hold. An
  unrequested fallback to a fresh session is a safety hold.

## Automation B — watchdog (hourly)

- Same VPS runtime and worktree, trigger `hourly`, `--fresh-session`, provider
  `claude`, role `axstack-watchdog`. It never mutates GitHub and never writes
  `progress.md` or `cursor.json`; it owns `watchdog.json` in the run directory.
- Before its gate dispatch it validates its own effective session identity
  through Orca runtime inspection; unknown identity holds the dispatch and is
  itself recorded in `watchdog.json`.
- Thresholds: three consecutive `error` lines in `precheck.log`; three
  consecutive failed A runs; no successful A run within two hours while the
  precheck logged `changed` or `due`; any unrequested fresh-session fallback or
  non-Opus effective identity recorded by A; any `failed` relay receipt older
  than one tick or any `uncertain` receipt; a hold with no owner. A quiet
  precheck history with no due work is healthy.
- Each health finding gets an occurrence id `(type, first-observed UTC
  timestamp)`; it stays deduplicated while unresolved and a later recurrence is
  a new occurrence.
- A finding is passed to the gate under the automation-health criterion. When
  the gate returns `escalate`, the watchdog itself performs that one
  gate-authorized `hermes send` and records the receipt in `watchdog.json`;
  this is the only send the watchdog may perform, because a broken driver
  cannot be relied on to deliver its own failure. Failed or uncertain delivery
  stays visibly held in `watchdog.json` and Orca run history.

## Run record

One run id for the lifetime of the automations (`20260916-pr-automations`),
in the `run-record.md` shape, with the driver as sole writer of `progress.md`.
It stores, per PR: processed event IDs, exact head and base SHAs, review
receipts per SHA, gate decisions, `hermes send` receipts with `message_id`
and state, watch deadline, `expired`, and holds. Its `Notification policy:`
line reads, verbatim in the automation prompt:
`hermes send, target telegram (home), host VPS, gate-authorized escalations only`.

Machine-readable sidecars in the same directory: `pending.json` (observed
fingerprint plus full discovery list, written by the precheck), `cursor.json`
(last processed fingerprint promoted verbatim from `pending.json`, expired PR
list, per-PR watch deadlines, pending failed-relay retries; written by the
driver after each processed tick), `precheck.log` (precheck only), and
`watchdog.json` (watchdog only). Orca run history remains the authoritative
log of sessions and outcomes; the record is derived progress, never authority.

Dedup: a processed event ID is never processed twice; a review receipt is
reused only for an unchanged head, base, and scope. PR notifications dedup on
(PR, criterion, head SHA); health notifications dedup on the occurrence id. A
`failed` relay receipt may be retried once, on the next tick, as due control
work; an `uncertain` one is never auto-resent.

## Safety holds

- Unrequested fresh-session fallback, or a recorded model different from the
  expected one: mutation pauses for that run, the fact is recorded, and the
  finding goes to the watchdog path.
- GitHub API errors leave the PR state unknown; nothing is pushed or published
  on unknown state.
- A hold is cleared only by a later run observing the condition resolved, or by
  the user in the Orca conversation. Silence never clears a hold.

## Acceptance before enabling

1. Both automations exist disabled on the VPS runtime with the settings above
   (`orca automations show`).
2. The stored precheck command, executed directly, exits non-zero on an
   unchanged fingerprint, zero after a synthetic allowlisted own-PR push, zero
   on a synthetic failing check at an unchanged head, zero when a stored
   deadline or failed-relay retry is due with GitHub unchanged, non-zero when
   only an external PR changed, and non-zero with an `error` log line when
   `gh` is unauthenticated or a search returns exactly the limit.
3. One manual run of A on a synthetic own PR shows a launched session that
   records the expected model, one watch receipt bound to the head SHA, and a
   run-record and sidecar update.
4. A second manual run on the same state performs no duplicate work: zero new
   pushes, reviews, or relay receipts on GitHub/Hermes readback, and an
   unchanged record apart from `Updated:`. A change made while a run is in
   progress is processed on the following tick. A new failing check or base
   change at an unchanged head produces exactly one new unit of work.
5. A stored deadline in the past with GitHub unchanged wakes the driver through
   the precheck; the run marks the PR `expired`, records the handoff, and
   stops; the next precheck ignores it. One due failed-relay retry runs without
   a PR change.
6. One manual run of B on a healthy state records one line and sends nothing.
   One run of B with A unable to run (three synthetic `error` lines) produces
   a health finding, a gate decision, and — on `escalate` — exactly one relay
   receipt in `watchdog.json`; with the gate unavailable the finding stays
   held and visible with no send. A resolved-then-recurring finding produces a
   second occurrence.
7. Gate contract, split: (a) given a synthetic pair of verdicts the gate
   returns exactly one of the two literal tokens; (b) a record carrying a
   recorded `escalate` decision produces exactly one relay receipt with state
   `sent`; (c) a recorded `proceed` produces zero.
8. Verified on the VPS before enabling: run-history JSON fields, the runtime
   inspection fields that prove effective session identity (correct, wrong,
   and unknown identities each tested, with affected actions held), whether
   `orca automations run` honors the precheck, and overlap behaviour with
   `--reuse-session`.

Only then are both automations enabled.
