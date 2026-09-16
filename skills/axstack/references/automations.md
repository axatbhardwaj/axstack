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
  happen. Peer code is read-only.
- **Discovery** covers every repository the account can see:
  `gh search prs --state open` with `--author @me`, `--review-requested @me`,
  and `--mentions @me`.
- **Mutation allowlist:** stated verbatim in the automation prompt. Outside it
  a PR still receives report-only review (needed to judge a criterion) but no
  push and no publication.
- **Prohibited everywhere:** force-push, rebase, merge, close, `APPROVE`,
  `REQUEST_CHANGES`. A need for any of these becomes a recorded hold.

## Roles per mode

The automation session is the driver and the owner for every PR it handles;
no separate `axstack-owner` is materialized and the standalone-owner branches
of `axstack-watch` and `axstack-review` do not fire.

- Peer PR → peer mode of [axstack-review](../../axstack-review/SKILL.md):
  `axstack-reviewer-primary` and `axstack-reviewer-secondary`, isolated.
- Own-PR repair → authored mode: the repair author is the automation session
  (provider `claude`), so the one cross-family reviewer comes from actual
  provenance (`axstack-reviewer-primary`, Sol, in `mixed`). A repair delegated
  to `axstack-author` (Sol) takes `axstack-reviewer-secondary`.
- "Every mode-required reviewer" means both reviewers in peer mode and the one
  selected reviewer in authored mode.
- Gate → `axstack-auditor`.
- Watchdog → `axstack-watchdog`, read-only.

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
- `escalate` → one `hermes send` through [axstack-relay](../../axstack-relay/SKILL.md)
  naming the PR, the criterion, every reviewer's reason, where the user acts
  (Orca conversation, worktree, or PR), and the hold. Record the hold.
- `proceed` → no notification. `proceed` never overrides a validated blocking
  finding: a push or `COMMENT` publication additionally requires no unresolved
  validated blocking finding. A reviewer security "yes" that the gate does not
  escalate is recorded as rejected-with-evidence or returned to the author
  before any mutation.
- Push or publish only after `proceed`; a push before the gate settles is
  forbidden.
- An unavailable gate or required reviewer records a hold, pauses mutation for
  that PR, and is treated as a watchdog health finding.

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
or close. Expiry marks the PR `expired` in the record and sidecar, records a
resumable handoff, and stops silently. The driver skips an expired PR until the
user re-arms it in the automation session, and the precheck ignores it; an
expired PR is never silently re-adopted.

## Watchdog tick

Read Orca run history for the driver and the run record: last successful tick,
stuck or repeatedly failed runs, consecutive precheck errors, duplicated event
handling, reused-session fallback, a recorded model different from the expected
one, and unresolved `failed` or `uncertain` relay receipts. Pass a finding to
the gate under the automation-health criterion. The watchdog never sends and
never mutates GitHub.

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

A machine-readable sidecar in the same directory — `cursor.json` (last
fingerprint, expired PR list) and `precheck.log` (one `<ts> <changed|unchanged|error|busy>`
line per precheck) — is written by the driver after each processed tick and
read by the precheck. Orca run history remains the authoritative log; the record
is derived progress, never authority.

Dedup: an event ID or a review receipt for an unchanged head SHA is never
processed twice. PR notifications dedup on (PR, criterion, head SHA); non-PR
findings dedup on (finding type, first-observed run id). A `failed` relay
receipt may be retried once on the next tick; an `uncertain` one is never
auto-resent.

## Safety holds

- The driver records its own model identity on every tick. An unrequested
  fresh-session fallback, or a recorded model different from the expected one,
  pauses mutation for that run, is recorded, and goes to the watchdog path. A
  user-run `--fresh-session` reconciles from the run record and is not a hold.
- GitHub API errors leave the PR state unknown; nothing is pushed or published
  on unknown state.
- A hold is cleared only by a later run observing the condition resolved, or by
  the user in the Orca conversation. Silence never clears a hold.
