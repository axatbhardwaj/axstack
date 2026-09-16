# Orca PR automations — specification

Status: revised after the Fable adviser review (AGREE-WITH-AMENDMENTS,
2026-09-16); decisions Q1–Q4 and the fourth criterion settled by the user on
2026-09-16. Nothing is enabled until the acceptance checks pass.

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
all presets. Those files are updated in the same change. The driver automation
is a mutating owner, not the independent read-only monitor those files
describe; the watchdog keeps the read-only monitor contract.

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
  `gh search prs --state open` with `--author @me`, `--review-requested @me`,
  and `--mentions @me`.
- **Mutation allowlist**, stated verbatim in the automation prompt so it is
  auditable through `orca automations show`: initially `axatbhardwaj/axstack`.
  Outside the allowlist a PR still receives report-only review (needed to judge
  a criterion) but no push and no publication.
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
  model-substitution, session, precheck, or relay-delivery hold), usable only
  by the watchdog and the safety-hold path, never by a reviewer.
- An unavailable gate or required reviewer records a hold, pauses mutation for
  that PR, and is treated as a watchdog health finding.

## Automation A — driver (every five minutes)

- Created against the VPS runtime with `--environment vps`, trigger
  `*/5 * * * *`, `--workspace <dedicated existing worktree>` with
  `--reuse-session`, provider `claude`, `--disabled` until acceptance.
- Model and effort cannot be set on an automation; the provider default is
  used. The driver records its own model identity in the run record on every
  tick; the watchdog compares it with the expected model (Opus). A mismatch is
  a safety hold.
- The driver worktree never checks out a PR branch; it hosts the run record.
  A repair runs in a per-PR child worktree created through `orca-cli`.
- **Precheck** (bounded shell, `--precheck-timeout 60`, no model): resolve
  self; run the three searches with `--json url,number,repository,updatedAt`;
  for each own PR add the head SHA and the check-rollup state of that SHA
  (`gh pr checks`); drop PRs marked `expired` in the sidecar; hash the result;
  compare with `cursor.json` in the run directory. Exit non-zero when equal,
  when the previous run of A is still active, or when `gh` fails. Append one
  line `<ts> <changed|unchanged|error|busy>` to `precheck.log` so a broken
  `gh auth` is distinguishable from a quiet week.
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
  merge or close. Expiry marks the PR `expired` in the record and sidecar,
  records a resumable handoff, and stops silently. The driver skips an expired
  PR until the user re-arms it in the automation session; the precheck ignores
  it.
- Session growth: the user may run `--fresh-session` at will; a fresh session
  reconciles from the run record and is not itself a fallback hold. An
  unrequested fallback to a fresh session is a safety hold.

## Automation B — watchdog (hourly)

- Same VPS runtime and worktree, trigger `hourly`, `--fresh-session`, provider
  `claude`, role `axstack-watchdog`, read-only.
- Checks Orca run history for A and the run record: last successful tick,
  stuck or repeatedly failed runs, N consecutive precheck errors, duplicated
  event handling, reused-session fallback, recorded model different from the
  expected one, and unresolved `failed` or `uncertain` relay receipts.
- A finding is passed to the gate under the automation-health criterion; the
  watchdog never sends and never mutates GitHub.

## Run record

One run id for the lifetime of the automations (`20260916-pr-automations`),
in the `run-record.md` shape, with the driver as sole writer of `progress.md`.
It stores, per PR: processed event IDs, exact head and base SHAs, review
receipts per SHA, gate decisions, `hermes send` receipts with `message_id`
and state, watch deadline, `expired`, and holds. Its `Notification policy:`
line reads, verbatim in the automation prompt:
`hermes send, target telegram (home), host VPS, gate-authorized escalations only`.

A machine-readable sidecar in the same directory — `cursor.json` (last
fingerprint, expired PR list) and `precheck.log` — is written by the driver
after each processed tick and read by the precheck. Orca run history remains
the authoritative log of sessions and outcomes; the record is derived
progress, never authority.

Dedup: an event ID or a review receipt for an unchanged head SHA is never
processed twice. PR notifications dedup on (PR, criterion, head SHA); non-PR
findings dedup on (finding type, first-observed run id). A `failed` relay
receipt may be retried once on the next tick; an `uncertain` one is never
auto-resent.

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
   unchanged fingerprint, zero after a synthetic own-PR push, and non-zero with
   an `error` log line when `gh` is unauthenticated.
3. One manual run of A on a synthetic own PR shows a launched session that
   records the expected model, one watch receipt bound to the head SHA, and a
   run-record and sidecar update.
4. A second manual run on the same state performs no duplicate work: zero new
   pushes, reviews, or relay receipts on GitHub/Hermes readback, and an
   unchanged record apart from `Updated:`.
5. A manual run with a forced 24-hour-old first observation marks the PR
   `expired`, records the handoff, and stops; the next precheck ignores it.
6. One manual run of B reports the healthy state without sending.
7. Gate contract, split: (a) given a synthetic pair of verdicts the gate
   returns exactly one of the two literal tokens; (b) a record carrying a
   recorded `escalate` decision produces exactly one relay receipt with state
   `sent`; (c) a recorded `proceed` produces zero.
8. Verified on the VPS before enabling: run-history JSON fields, whether
   `orca automations run` honors the precheck, and overlap behaviour with
   `--reuse-session`.

Only then are both automations enabled.
