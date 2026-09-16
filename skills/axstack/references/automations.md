# Automation sessions

Read this when the current session is an Orca automation running the PR
driver or the watchdog. It restates the operational contract of the approved
`docs/specs/orca-automations.md`; that spec is authoritative, and nothing here
widens it. Orca owns scheduling, sessions, retries, and run history. Axstack
owns policy, the run record, and evidence.

## Identity and scope

- **Self** is `gh api user --jq .login`, resolved at the start of every run and
  never hardcoded.
- **Own PR:** an open PR authored by self. Authority equals the user at the
  keyboard: repair, test, commit, and fast-forward push to the PR branch
  (`git push`, no lease or force). `gh stack` sync or restack is out of scope.
- **Peer PR:** an open PR where self is officially review-requested, or where a
  PR comment @-mentions self asking for a response. Unsolicited reviews never
  happen. Peer code is read-only. A mention counts as a peer request only when
  the driver reads the comment and it explicitly asks self to review or
  respond. An incidental mention is discovery data and never review authority.
- **Discovery** covers every repository the account can see:
  `gh search prs --state open --limit 100` with `--author @me`,
  `--review-requested @me`, and `--mentions @me`. A result count equal to the
  limit is a detectable truncation and is logged as `error`. Results are
  deduplicated canonically by PR URL across the three searches with own-PR
  precedence.
- **Mutation allowlist:** stated verbatim in the automation prompt. Outside the
  allowlist the automation discovers and records only. The precheck writes the
  full discovery list to `pending.json`; no review, watch, gate, or other model
  work is launched for an external PR. External changes do not enter the wake
  fingerprint, so external churn never wakes the session. External PR contents
  never produce an escalation. This is a deliberate coverage reduction, not an
  implied clean review; discovery errors themselves remain automation-health
  findings.
- **Prohibited everywhere:** force-push, rebase, merge, close, `APPROVE`,
  `REQUEST_CHANGES`. A need for any of these becomes a recorded hold.

## Roles per mode

The automation session is the driver and the owner for every PR it handles;
the driver is the automation session itself, with no `axstack-monitor` or
`axstack-owner` role row materialized, and the standalone-owner branches
of `axstack-watch` and `axstack-review` do not fire. `axstack-monitor` stays
an optional read-only observer that never sends.

- Peer PR → peer mode of [axstack-review](../../axstack-review/SKILL.md):
  `axstack-reviewer-primary` and `axstack-reviewer-secondary`, isolated.
- Own-PR repair → authored mode: the repair author is the automation session
  (provider `claude`), so the one cross-family reviewer comes from actual
  provenance (`axstack-reviewer-primary`, Sol, in `mixed`). A repair delegated
  to `axstack-author` (Sol) takes `axstack-reviewer-secondary`.
- "Every mode-required reviewer" means both reviewers in peer mode and the one
  selected reviewer in authored mode.
- Gate → `axstack-auditor`.
- Watchdog → `axstack-watchdog`, which never mutates GitHub and performs
  exactly one kind of send, a gate-authorized automation-health escalation
  recorded in `watchdog.json`.

## Reviewer brief and criteria

Every reviewer brief ends with a required field, exactly:

```text
Escalate to user: yes | no — <criterion> — <reason>
```

Criteria, exactly four: a security concern; a permanent on-chain state change;
an architectural change in approach; and automation health (a
model-substitution, session, precheck, or relay-delivery hold). The automation
health criterion is usable only by the watchdog and the safety-hold path, never
by a reviewer.

## Escalation gate

After every mode-required reviewer settles, the driver spawns `axstack-auditor`
with the verdicts and the candidate revision, instructing it to act as the
escalation gate. It returns exactly one literal token, `escalate` or `proceed`.

- The gate decides only whether the user is notified. Reviewer "yes" is input,
  not a veto.
- `escalate` → records the hold, then one `hermes send` through
  [axstack-relay](../../axstack-relay/SKILL.md) naming the PR, the criterion,
  every reviewer's reason, where the user acts (Orca conversation, worktree, or
  PR), and the hold; it publishes nothing.
- `proceed` → no notification; a push or `COMMENT` publication then
  additionally requires no unresolved validated blocking finding, because
  `proceed` never overrides a validated blocking finding. A reviewer security
  "yes" that the gate does not escalate is recorded as rejected-with-evidence
  or returned to the author before any mutation.
- Only `proceed` plus no unresolved validated blocking finding permits a push
  or publication; a push before the gate settles is forbidden.
- Precedence: credible serious risk found by a reviewer still produces the
  standing internal prompt and dependent-action hold immediately, and the gate
  governs only external notification. That hold is the serious-risk rule of
  [contracts](contracts.md#serious-risk). The internal prompt lands in the run
  record and the automation's Orca conversation; no `hermes send` occurs
  without `escalate`.
- An unavailable gate or required reviewer records a hold, pauses mutation for
  that PR, and is treated as a watchdog health finding.

## Precheck (bounded shell, no model)

Resolve self; run the three searches with `--json url,number,repository,updatedAt`;
write the full discovery list to `pending.json`. For each allowlisted,
non-expired own PR add head SHA, base SHA, and the check rollup of that head via
`gh pr view --json headRefOid,baseRefOid,statusCheckRollup`; check state is
data, and only authentication, command, and network errors are `error`. Hash
only allowlisted PRs. Read `cursor.json` for the last processed fingerprint and
for due control work: a watch deadline at or before now, or a pending
failed-relay retry. Exit 0 when the hash differs or control work is due;
otherwise exit non-zero. Exit non-zero without running when the previous driver
run is still active, or on `error`. Append one line
`<ts> <changed|due|unchanged|error|busy>` to `precheck.log`.

The observed fingerprint is written to `pending.json`. After the processed
tick the driver promotes exactly that value to `cursor.json`, never a
recomputed one, so an event landing during a run is processed on the following
tick.

## Driver tick

For each changed PR:

- Own PR → [axstack-watch](../../axstack-watch/SKILL.md) on the exact head
  SHA in a per-PR child worktree; the driver worktree never checks out a PR
  branch. Follow its repair-publication reference: candidate committed locally,
  authored review at the local SHA, gate, then fast-forward push with the
  publication readback immediately before it.
- Peer PR → two isolated `axstack-review` passes on the exact head SHA, then
  the gate, then one owner-synthesized `COMMENT` review under the review skill's
  COMMENT branch. `INCOMPLETE` or an unavailable required reviewer records a
  hold and publishes nothing.

Watch window: 24 hours per own PR from first observation, ending early on merge
or close. The deadline is stored in `cursor.json`; a due deadline wakes the
driver through the precheck even when GitHub is unchanged, and the driver
rechecks the deadline immediately before any publication. Expiry marks the PR
`expired` in the record and sidecar, records a resumable handoff, and stops
silently. The driver skips an expired PR until the user re-arms it in the
automation session, and the precheck ignores it; an expired PR is never
silently re-adopted.

Per-PR event state: head SHA, base SHA, check rollup, and processed request and
comment IDs. A review receipt is reused only when head, base, and scope are
unchanged. A new failing check, base change, review request, or qualifying
comment at an unchanged head is new work.

## Watchdog tick

Read Orca run history for the driver and the run record: last successful tick,
stuck or repeatedly failed runs, consecutive precheck errors, duplicated event
handling, reused-session fallback, a recorded model different from the expected
one, and unresolved `failed` or `uncertain` relay receipts. Pass a finding to
the gate under the automation-health criterion. On `escalate` the watchdog
itself performs that one gate-authorized `hermes send` and records the receipt
in `watchdog.json`; it never mutates GitHub and never writes `progress.md` or
`cursor.json`.

## Run record and sidecar

One run id for the lifetime of the automations, `20260916-pr-automations`, in
the [run record](run-record.md) shape with the driver as sole writer of
`progress.md`. Per PR it stores processed event IDs, exact head and base SHAs,
review receipts per SHA, gate decisions, `hermes send` receipts with
`message_id` and state, watch deadline, `expired`, and holds. Its
`Notification policy:` line reads, verbatim:

```text
hermes send, target telegram (home), host VPS, gate-authorized escalations only
```

Machine-readable sidecars in the same directory: `pending.json` (observed
fingerprint plus full discovery list, written by the precheck), `cursor.json`
(last processed fingerprint promoted verbatim from `pending.json`, expired PR
list, per-PR watch deadlines, pending failed-relay retries; written by the
driver after each processed tick), `precheck.log` (precheck only), and
`watchdog.json` (watchdog only). Orca run history remains the authoritative
log; the record is derived progress, never authority.

Dedup: a processed event ID is never processed twice; a review receipt is
reused only for an unchanged head, base, and scope. PR notifications dedup on
(PR, criterion, head SHA); health notifications dedup on the occurrence id. A
`failed` relay receipt may be retried once, on the next tick, as due control
work; an `uncertain` one is never auto-resent.

## Safety holds

- The driver records its own model identity on every tick. An unrequested
  fresh-session fallback, or a recorded model different from the expected one,
  pauses mutation for that run, is recorded, and goes to the watchdog path. A
  user-run `--fresh-session` reconciles from the run record and is not a hold.
- GitHub API errors leave the PR state unknown; nothing is pushed or published
  on unknown state.
- A hold is cleared only by a later run observing the condition resolved, or by
  the user in the Orca conversation. Silence never clears a hold.
