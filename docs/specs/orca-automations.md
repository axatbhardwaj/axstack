# Orca PR automations — specification

Status: superseded for the defi-com pair by `docs/specs/pr-automations.md`
revision 3 (approved 2026-09-16); kept as history and not amended further.

Previous status: revision 5 (amendment to revision 4, splitting C/D's review and repair
scope per repository, authorizing real review submission for C/D, and recording
the workspace paths and green-gate corrections found during the first host
setup), with the revision 5.1 clarifications of 2026-09-16 inline under
"Binding review verdicts": every C review is a verdict, and one verdict per tick. Revision 4's text is preserved below and remains the baseline wherever
revision 5 does not contradict it; see "Revision 5" immediately before the
Automations C and D section. Revision 4 was (amendment to revision 3, extending
coverage to the defi-com repositories as a second, independent automation
pair). Revision 3
remains the approved baseline for the axstack pair (Automations A and B) and is
unchanged by this amendment except where a clause below names it. Revision 4 rests on
decisions D1-D14 recorded in the align run record
`20260916-automation-coverage`. D1-D7 are user decisions settled on 2026-09-16.
D8-D14 are driver decisions. **D14 requires the user's explicit attention at
this checkpoint**: it adjusts the mechanics of user-owned D5 ("repair all own
PRs, no stack rule") by sequencing repair within a stack, and approving this
revision approves that adjustment. D14 reduces no scope; every own PR remains
eligible. Adviser receipts are three alignment rounds plus one draft review
from `axstack-advisor-astra` and `axstack-advisor-fable`, cached in the same
run record; both returned AGREE WITH AMENDMENTS on the draft and neither
escalated. Nothing in the new pair
is enabled until the acceptance checks in "Acceptance before enabling the
defi-com pair" pass.

Named amendment to revision 3, correcting recorded drift: Automation A's
trigger is `*/30 * * * *` as configured live on automation
`a19b68d1-2973-4aca-8d56-b732df93144d`. The revision-3 heading "every five
minutes" is superseded by this line. A's live schedule is not changed; only the
specification text is corrected, because A's acceptance check 1 and D8's
dispatch-minute rule are checkable only against its real cadence.

## Purpose and boundary

Two automation *pairs* — four native Orca automations — keep the user's GitHub
pull requests moving without a human in the loop, on the VPS Orca runtime, using
the installed Axstack skills. Pair 1 (Automations A and B) serves
`axatbhardwaj/axstack` and is governed by revision 3. Pair 2 (Automations C and
D) serves the defi-com repositories and is governed by this revision. The pairs
share no state: separate allowlists, run ids, sidecars, cadences and dispatch
minutes, so a failure in one never degrades the other. Orca owns scheduling, sessions, retries, and run history. Axstack owns
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
- **Mutation allowlist**, stated verbatim in each automation prompt so it is
  auditable through `orca automations show`. It is per-automation, not global:
  Automation A's is `axatbhardwaj/axstack`; Automation C's is
  `defi-com/monorepo, defi-com/mobile, defi-com/azure-next-hybrid`. One
  allowlist gates both own-PR repair and peer review for its own automation;
  there is no separate review-only list.
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

## Automation A — driver (`*/30`; see the revision-4 named amendment above)

- Created against the VPS runtime with `--environment vps`, trigger
  `*/30 * * * *` (corrected by the revision-4 named amendment; it was recorded
  as `*/5 * * * *` while the live automation has always run `*/30`),
  `--workspace <dedicated existing worktree>`, provider
  `claude`, `--disabled` until acceptance. `--reuse-session` is set but,
  verified on 2026-09-16 (scheduled runs 7 and 8), Orca launches a fresh
  session for every dispatched tick on this host. The normal mode is therefore
  one fresh session per changed tick, reconciled from the run record and
  sidecars; the precheck closes the previous ticks' idle driver terminals with
  `--tab` before dispatching and treats a still-working driver terminal as
  `busy`. Ownership is A's own recorded `terminalPtyId` from its run history,
  never a terminal title: Orca rewrites a Claude terminal's title to the
  agent's current task summary, so a real driver's title drifts while an
  unrelated session can acquire one that reads like a driver. Identity
  matching keeps a drifted driver inside the busy guard, leaves B's terminals
  untouched — B is a separate automation on the same dispatch minute and
  reports `tui-idle` while it boots, so a title sweep closed it seconds after
  launch (observed 2026-09-16, runs 8-10 dispatched and wrote nothing) — and
  cannot reach a bystander. `--tab` is required; without it the pane closes but
  the session stays listed and is never reclaimed, which also makes an
  over-match destructive rather than merely useless. An unreadable ownership
  source is `error`, never a silent empty sweep. A scheduler-launched session
  whose terminal matches its own Orca handle is expected, not a fallback.
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
- Session identity: every session reconciles from the run record and
  validates its effective identity by runtime inspection before acting. A
  session that is neither scheduler-launched (run history `trigger` and pty
  match) nor operator-launched in the automation conversation is a safety
  hold.

## Automation B — watchdog (hourly)

- Same VPS runtime and worktree, trigger `hourly`, `--fresh-session`, provider
  `claude`, role `axstack-watchdog`. Its dispatch minute must not coincide with
  A's: Orca was observed firing `FREQ=HOURLY;BYMINUTE=0` at `:30`, so the
  schedule is pinned to an explicit offset cron expression rather than a
  named hourly rule, and the two automations never contend for the same
  minute. It never mutates GitHub and never writes
  `progress.md` or `cursor.json`; it owns `watchdog.json` in the run directory.
- Before its gate dispatch it validates its own effective session identity
  through Orca runtime inspection; unknown identity holds the dispatch and is
  itself recorded in `watchdog.json`.
- Thresholds: three consecutive `error` lines in `precheck.log`; three
  consecutive failed A runs; no successful A run within two hours while the
  precheck logged `changed` or `due`; any unknown-provenance session or
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

## Revision 5 — per-repo scope, authorized review submission, workspace paths

Revision 5 amends revision 4 after the user reviewed the first host setup on
2026-09-16. Revision 4 stays the baseline for everything it is not contradicted
on here, and pair A/B is still unchanged throughout.

### Two lists, not one

Revision 4 gave pair C/D a single mutation allowlist gating review and repair
together. The user has since scoped them separately, so C/D carries two lists,
each stated verbatim in C's prompt and auditable through `orca automations show`:

- **Review allowlist:** `defi-com/monorepo`, `defi-com/mobile`,
  `defi-com/azure-next-hybrid`.
- **Repair allowlist:** `defi-com/monorepo`, `defi-com/mobile`.

`defi-com/azure-next-hybrid` is therefore review-only. Its PRs authored by self
are discovered and recorded but never repaired and never pushed to, and they are
not review candidates either, since a PR authored by self is not a peer PR. Its
peer PRs are reviewed on the ordinary triggers: self officially
review-requested, or a comment that explicitly asks self to review or respond. A repository absent from both lists is record-only exactly as before.
Every clause revision 4 wrote about own-PR repair now reads against the repair
allowlist, and every clause about peer review reads against the review
allowlist. Where revision 3 or 4 says "allowlisted" without naming an action —
including the precheck's "hash only allowlisted PRs" — it means the union of the
two lists for discovery and for the wake fingerprint, and the action-specific
list for the action itself. So a change on an azure-next-hybrid peer PR wakes C,
while a change on an azure-next-hybrid own PR does not, because no action is
available for it.

### Authorized review submission replaces COMMENT-only

Revision 3 prohibited `APPROVE` and `REQUEST_CHANGES` as GitHub actions for
every automation, and revision 4 kept the automation publication branch at one
`COMMENT` review. The user has explicitly authorized pair C/D to submit a real
review verdict instead: after the mode-required reviewers settle and the gate
returns `proceed`, C submits one owner-synthesized review carrying the actual
verdict — `APPROVE` or `REQUEST_CHANGES` — bound to the reviewed commit,
through the `axstack-review` authorized-submission branch rather than its
automation `COMMENT` exception.

This is an authority expansion with outward effect on other people's pull
requests, so it is bounded:

- It applies to pair C/D only. Pair A/B keeps the `COMMENT`-only exception.
- Every other prohibition is untouched: no force-push, no rebase, no merge, no
  close, by any automation, anywhere.
- **Peer PRs only, only Automation C.** Every review C publishes is a binding
  verdict; C has no `COMMENT` path. A peer PR reached through the qualifying
  mention trigger — a comment that explicitly asks self to review or respond —
  takes a verdict exactly as an officially-requested one does. An incidental
  mention remains discovery data and never review authority, so the mention
  trigger still cannot be used to place a block by name-dropping. The only
  authorship restriction is GitHub's own: a PR authored by self never receives a
  verdict from self. (Revision 5.1, 2026-09-16: replaces the earlier
  `COMMENT`-for-mentions rule after the first attended run, where the two paths
  proved indistinguishable in practice and the budget below is the real brake.)
- **One binding review verdict per tick.** Because C has no `COMMENT` path, an
  unbudgeted first tick over a backlog would place binding verdicts on every
  discovered peer PR at once, unattended and on other people's work. C therefore
  submits at most **one** verdict per tick; the rest wait for the next tick,
  oldest `updatedAt` first, so the backlog drains in a stable order. Reaching the
  budget records a hold naming it and the value reached, owned by the budget.
  The user may lift the budget for an attended session in the Orca conversation;
  that override is recorded in the run record and applies to that session only.
- **An open obligation carries its own authority to resolve itself.** Submitting
  a review removes self from the review request, so requiring a current official
  request for every submission would deadlock: C could place a block and then be
  permanently unable to submit the follow-up `APPROVE` that clears it. Therefore
  an obligation created by an official request keeps a narrow, named authority
  for as long as it stays open: C may submit exactly one superseding verdict on
  that PR, including a clearing `APPROVE`, without a fresh review request. That
  authority extends to nothing else — not to a different PR, not to a PR whose
  obligation is already discharged, and not past the one-supersede-per-head cap.
  It does, however, **follow the obligation chain**: an obligation opened by a
  verdict that was itself submitted under this authority inherits it, so the
  authority persists on that one PR until the PR merges, closes, or its block is
  resolved. Without that inheritance the deadlock returns one head later in the
  ordinary multi-push case — C blocks at head 1 on request, the teammate pushes
  head 2 without fixing, the honest re-review blocks again at head 2 under
  obligation authority, and C could then never clear the block it placed there.
  GitHub rejects `APPROVE` and `REQUEST_CHANGES` from a PR's own
  author, so an authored-mode review of the automation's own repair stays
  internal and gates only the push, exactly as before. Automation D never
  writes to GitHub at all; its no-mutation rule is untouched.
- **The two verdicts have different preconditions**, and the earlier drafting
  of this clause made `REQUEST_CHANGES` impossible by requiring the absence of
  blockers for any submission:
  - `APPROVE` requires a complete mode-required review at the exact head SHA
    with a current base, the gate's `proceed`, and **zero** unresolved
    validated blocking findings.
  - `REQUEST_CHANGES` requires the same completeness and gate token, and **at
    least one** validated blocking finding carrying its evidence and
    consequence. It is the verdict that reports blockers; it is not gated on
    their absence.
  - `INCOMPLETE`, unresolved material disagreement, an unavailable required
    reviewer, or a gate `escalate` submits nothing and records a hold.
- The remote head and base readback immediately before submit is unchanged, as
  is the never-submit-twice rule for an unchanged head SHA.
- **A submitted `REQUEST_CHANGES` blocks the PR.** `defi-com/monorepo`'s `dev`
  protection carries required pull-request reviews with
  `dismiss_stale_reviews: false`, so a `REQUEST_CHANGES` under the user's login
  keeps blocking until that same login approves or dismisses it, and a
  teammate's later push does not clear it. `APPROVE` has no comparable tail.
  Therefore: when a PR carrying the automation's own unresolved
  `REQUEST_CHANGES` is observed at a superseded head, re-review is **due control
  work, exempt from the per-tick push budget**, so the automation cannot leave
  its own block standing merely because a tick was busy. If the re-review
  cannot complete within that tick, the automation records a hold owned by the
  user naming the blocked PR and the blocking review. Dismissal stays
  prohibited: only the human clears a stale block.
- **An outstanding obligation is due control work at the precheck.** Obligation
  polling runs inside C, but the precheck decides whether C runs at all, so an
  unchanged discovery fingerprint would otherwise leave a blocked and
  now-undiscoverable PR unvisited and the three-failed-poll health path would
  never fire. C's precheck therefore reads outstanding obligations from
  `cursor.json` and exits 0 — waking C with the forge otherwise unchanged — when
  any obligation is outstanding. Stated plainly rather than as three conditions
  that collapse into one: while C holds any unresolved blocking review, every
  scheduled tick wakes it, whether or not the forge changed. That is deliberate —
  an unresolved block under the user's login is exactly the state that must not
  go unvisited. Obligations join watch deadlines, failed-relay retries and
  expired repair caps in the due-work list.
- **A blocked PR is tracked durably, outside discovery.** Submitting a review
  removes self from GitHub's `review-requested` results, so a PR that C has just
  blocked can vanish from the three discovery searches on the very next tick —
  and C would then never see the PR again to clear its own block. Discovery
  alone therefore cannot carry this. C records every unresolved blocking review
  it submits in `cursor.json` as an open obligation holding the PR URL, the
  review id, the head SHA it was bound to, and the submission timestamp, and on
  every tick it polls those PRs directly by URL regardless of whether they still
  satisfy any discovery trigger. An obligation is discharged only by observing
  the PR merged, closed, or its blocking review resolved or superseded. A poll
  that fails leaves the obligation open and retries on the next tick; an
  obligation that cannot be polled or re-reviewed for three consecutive ticks is
  a health finding routed to the gate like any other, because a block the
  automation can no longer reach is exactly the failure the user would want to
  hear about.
- The never-submit-twice rule is scoped to an unchanged head **and** an
  unchanged verdict basis. A corrected finding or a base change at an unchanged
  head is new work and may produce a superseding verdict; without this the
  automation could never retract its own blocking review.
- **Supersession is capped**, because two non-deterministic reviewers re-run
  hourly could otherwise flip `APPROVE` and `REQUEST_CHANGES` at one head
  forever, every flip binding under the user's login. At most **one** superseding
  verdict per head SHA. A supersede at an unchanged head and unchanged base
  additionally requires a recorded finding-level reason naming what changed
  about the finding, not merely a differing reviewer opinion; without that
  reason the automation records a hold and submits nothing.
- The review is submitted under the user's own GitHub identity. This
  specification does not require the review body to disclose that it was
  produced by an automation; the user has not been asked that question
  separately and it remains open for a later revision. Nothing here claims the
  user waived disclosure.

### Workspace paths

defi-com repositories live under `~/defi/`, personal projects under `~/dev/`.
C/D's per-PR child worktrees are created from the `~/defi/` clones. The `~/defi/` workspace carries its own `CLAUDE.md`, which states a
never-auto-post review policy, delegates that policy to `~/.claude/CLAUDE.md`
— where the text no longer appears — and points at a convention memory file
whose path names a different home and does not exist on this host. The user was
shown all of this on 2026-09-16 and chose automatic submission for the
automation anyway.

The submitted body is written for the person reading the PR and reads as one
reviewer's findings. It never names the reviewer count, the brief, the six
angles, the gate, receipts, or which reviewer found what — those are pipeline
facts, not review content. It is self-contained: every finding it refers to
is stated in full in the body, with file and line where they exist, and it
never points at the local review file or anything the reader cannot open.
Evidence appears as what was checked and observed, not as who ran it. This
was settled on 2026-09-17 after a colleague pointed at two live reviews: one
narrated "two independent reviews, identical brief, all six angles", and the
other referred to "two minor maintainability notes" that appeared only in the
local review file and nowhere the reader could see. The marker line is the
only pipeline artefact the body carries.

That choice is scoped narrowly. It overrides the never-auto-post policy **for
pair C/D's automated reviews only**. Interactive sessions working under
`~/defi/` keep that policy unchanged, as do human-authored reviews and the
`~/defi/misc/reviews/` HTML naming conventions, which this specification does
not touch. The user settled the remaining question on 2026-09-16: Automation C **does**
also write the local review file alongside its submitted verdict, so the
workspace convention is preserved rather than bypassed. C writes
`~/defi/misc/reviews/review-PR-<num>.html` for `defi-com/monorepo` with no
prefix — the unprefixed name means monorepo by definition — and the prefixed
form for every other repository, `review-azure-next-hybrid-PR-<num>.html` and
`review-mobile-PR-<num>.html`. The file is written for every review C publishes,
verdict or `COMMENT`, and it carries the same findings and evidence as the
submitted review plus the reviewed SHA. A failure to write the file is a
recorded hold and does not by itself retract a submitted review; a review is
never withheld because the file could not be written, and the mismatch is
visible rather than silent.

### What counts as green for a repair

`bun run test` is not a usable gate for `defi-com/monorepo` on this host:
`apps/defi-app`'s `e2e/backup-gating.spec.ts` fails because
`startHermeticAppServer` times out, an environment gap on a host that runs no
app services, not a repository defect. Verified 2026-09-16 against `dev` at
`611abaa65`; the unit level is green at 315 files and 4662 tests.

A repair therefore gates on the repository's unit-level test command plus the
PR's CI check rollup. For `defi-com/monorepo` that command is run from the
package that owns the failing test, using the pinned interpreter at
`~/.bun-1.2.2/bin/bun` rather than the host default: the repository pins
`packageManager: bun@1.2.2`, and `bun install --frozen-lockfile` fails under the
host's 1.4.2 with "overrides in package.json changed since bun.lock was saved".
The pinned installation is deliberately kept off the default `PATH` so it never
becomes the host default for other repositories, `axatbhardwaj/axstack` among
them, whose `engines` require bun >= 1.3.14.

Local end-to-end suites that require services this host does not run are a
recorded unverified boundary rather than a failure to repair. A check the
automation cannot run locally is never reported as passing, and the repair's
evidence names every suite it could not execute and why.

### Inherited failures

A repair addresses only a failure the PR itself introduced. The PR head's check
rollup is compared against the same checks on its base, but a rollup comparison
alone does not establish causation: the same named check can fail at head and at
base for different reasons. So the rule is conservative in both directions.

- A check failing at head and passing on the base is treated as introduced by
  the PR and is eligible for repair.
- A check failing at head whose same-named check also fails on the base is an
  inherited-failure hold naming the base SHA and its conclusion. It consumes no
  repair cap and is never repaired on the user's branch. If the automation can
  show from the failure output that the head failure has a different cause than
  the base failure, it records that evidence and the check becomes eligible;
  absent that evidence the hold stands.
- A base whose checks are missing, still running, or otherwise not comparable
  yields unknown causation, which is a hold, never an assumed repair.

This rule governs check-triggered repair. It does not constrain the
review-feedback trigger, which is the only repair trigger available in
`defi-com/mobile` because that repository has no workflows at all; actionable
review feedback is repaired there on its own terms with no rollup comparison.

### Clauses of revisions 3 and 4 that revision 5 supersedes

These are named explicitly, because "baseline unless contradicted" is not good
enough when the older text is still readable and would otherwise win at runtime:

- **Identity and scope, mutation allowlist:** "there is no separate review-only
  list" is superseded for pair C/D by "Two lists, not one". It still holds for
  pair A/B, which keeps one list.
- **Automations C and D, scope and topology:** revision 4's single
  "Mutation allowlist, verbatim: `defi-com/monorepo`, `defi-com/mobile`,
  `defi-com/azure-next-hybrid`" is superseded by the two verbatim lists above.
  Only one verbatim text may appear in C's prompt, and it is the pair of lists.
- **Prohibited everywhere:** `APPROVE` and `REQUEST_CHANGES` remain prohibited
  for Automations A, B and D. For Automation C they are permitted exactly under
  "Authorized review submission" and nowhere else. Force-push, rebase, merge and
  close stay prohibited for all four, with no exception.
- **Automations C and D, scope and topology, credential bullet:** its sentence
  that the prohibitions on `APPROVE` and `REQUEST_CHANGES` "remain prompt-level
  only" for C is superseded to the extent that those two actions are no longer
  prohibited for C at all; every other prohibition it names is unchanged and
  still prompt-level.
- **Acceptance check 10** required C's peer path to publish "exactly one
  `COMMENT` review". It is superseded by check 15: C submits the actual verdict.
  Pair A/B's `COMMENT`-only path is unchanged and check 10 still describes it.
- **Prerequisites** still said monorepo carries two submodules; corrected below.

### A skill amendment is required before C is enabled

C loads `skills/axstack-review/SKILL.md`, which in turn loads
`skills/axstack/references/automations.md`. Three places still assert the
opposite of "Authorized review submission", so the contradiction would be live
at runtime rather than theoretical, and naming only the first would leave it
standing:

- `skills/axstack-review/SKILL.md`: the `COMMENT` branch "is the only submission
  the Orca driver automation makes". Its automation publication branch must be
  scoped to pair A/B, with pair C routed to the authorized-submission branch.
- `skills/axstack/references/automations.md`: "Prohibited everywhere:
  force-push, rebase, merge, close, `APPROVE`, `REQUEST_CHANGES`" must become
  pair-scoped; the driver tick's "one owner-synthesized `COMMENT` review" must
  route pair C's officially-requested peer PRs to a binding verdict while pair
  A/B and C's mention-triggered reviews keep `COMMENT`; and the precheck's
  due-work list must gain the outstanding blocking-review obligation described
  above, since that reference is where the due-work list an automation session
  actually reads is written.
- The contract tests that currently assert COMMENT-only for automations —
  `tests/workflows/review-modes.test.js` and
  `tests/workflows/automation-contracts.test.js` — must be updated to assert the
  pair-scoped rule. They are the guard that would otherwise fail an unscoped
  edit, and they must keep asserting A/B's COMMENT-only behaviour.

Revision 3 listed its skill amendments in "Purpose and boundary"; revision 5
adds these. They are tracked as their own task and are a precondition of
acceptance check 15.

### Corrections to revision 4

- `defi-com/monorepo` has **one** submodule, `packages/contracts`. Revision 4's
  Prerequisites said two, and that sentence is corrected rather than merely
  contradicted. `.gitmodules` also declares
  `packages/database/domains-json`, but the committed tree holds a 31-byte
  regular file at that path rather than a gitlink, so `git submodule update`
  correctly skips it. Verified upstream on `dev`.
- Acceptance check 2's submodule clause reads "its one real submodule" instead
  of "both monorepo submodules".

## Automations C and D — defi-com pair

Automation C is the defi-com driver; Automation D is its own watchdog. They are
structurally the clauses of Automations A and B with the deltas below, and
nothing here changes A or B.

### Scope and topology

- Mutation allowlist, verbatim: `defi-com/monorepo`, `defi-com/mobile`,
  `defi-com/azure-next-hybrid`. Every other repository the account can see,
  including the remaining defi-com repositories, stays record-only under the
  existing allowlist clause.
- Discovery is unchanged and remains involvement-based
  (`--author`, `--review-requested`, `--mentions`). It is not a repository
  sweep. A defi-com repository where self authors no PR, is requested on none,
  and is mentioned in none is invisible to the automation by design.
- Private-source egress: reviewing and repairing these repositories sends
  private defi-com source to the configured reviewer roles, of which
  `axstack-reviewer-primary` is a non-Anthropic provider. The user explicitly
  permitted this on 2026-09-16 (D1) after being shown the provider binding in
  `roles.json`. It is recorded here so the approval is informed, and it is not
  re-litigated per tick.
- Credential: the host's existing local `gh` authentication. This is the user's
  personal automation and the user selected this credential on 2026-09-16 after
  being shown that the token is a classic PAT carrying `admin:org`,
  `delete_repo`, `workflow`, `admin:repo_hook` and `audit_log`, and that feature
  branches in all three repositories carry no ruleset. The consequence is
  recorded, not mitigated: the prohibitions on force-push, rebase, merge, close,
  `APPROVE` and `REQUEST_CHANGES` remain prompt-level only.
- Cadence: hourly for C. C and D take two dispatch minutes distinct from each
  other and from A and B, so no two of the four automations share a minute.
- Run id `20260916-defi-automations`. C and D are single automations serving
  three repositories, so they need one home, not three. That home is a
  dedicated driver worktree of `axatbhardwaj/axstack` — the same arrangement A
  already uses — passed as C's and D's `--workspace`. The run directory is
  `<axstack git-common-dir>/axstack/runs/20260916-defi-automations/`, holding
  this pair's own `progress.md`, `pending.json`, `cursor.json`, `precheck.log`
  and `watchdog.json`. No sidecar is shared with the A/B pair.
- Each of the three defi-com repositories is separately registered in Orca as a
  repo, used only as the parent for per-PR child worktrees. As for A, C's driver
  worktree never checks out a PR branch; a repair runs in a per-PR child
  worktree of the relevant defi-com repo created through `orca-cli`. Each new
  worktree requires the one-time Claude Code trust grant by the user, as
  revision 3 records for A.

### Stack-aware repair sequencing

Own-PR repair covers every own PR in the allowlisted repositories; stacking
changes the order of repair, never the scope. Within one stack:

- Repair only the lowest open failing PR of that stack.
- Every open descendant of a repaired PR records exactly one `pending restack`
  hold naming the repaired parent and its new head SHA, and receives no
  independent repair of the same finding while that hold stands.
- A descendant carrying a *different* finding from the repaired parent's is not
  covered by the hold and is repaired on its own merits, subject to the budgets
  below. The hold suppresses duplicate application of the *same* finding, not
  all work on the descendant.
- The hold names the user as owner. It is cleared by the user's own restack, or
  by a later tick observing the descendant no longer failing; the driver may
  therefore clear it on observed resolution, and this is the single clearing
  rule. It is exempt from the watchdog's `hold with no owner` threshold, because
  its owner is the user by construction.
- The per-tick budget counts one unit per stack, not one per PR.

Rationale, from the round-3 advisory and verified on 2026-09-16: 12 of 18 own
monorepo PRs have a non-default base, one stack is 12 deep, and the same
`defi-bot` finding recurs across the stack. Independent per-PR repair would
apply the identical fix at several levels and the user's next cascade rebase
would then conflict on the duplicate. A parent fast-forward also does not change
a descendant's PR diff, so a descendant's CI and reviewers never see the parent
fix; the `pending restack` hold states that honestly instead of implying the
descendant was repaired.

### `gh stack` and history rewriting

`gh stack` (github/gh-stack v0.1.1) is installed on the host. The automation
does not use `rebase`, `sync`, `merge`, `link` or `submit`. The revision-3
prohibition on force-push, rebase and merge stands unchanged for the new pair,
and `gh stack` sync or restack remains out of scope for every automation.

This was settled as a high-stakes decision on 2026-09-16 with both advisers
returning AGREE to withholding the authority. The decisive verified evidence:
`yep365` holds an `APPROVED` review on every branch of the 12-deep stack
`#1078`-`#1089`, and those feature branches carry no branch protection or
ruleset at all, so no stale-review dismissal applies to them. (The
`dismiss_stale_reviews: false` setting belongs to `dev`'s protection, not to the
stack branches.) Either way a restack force-push would leave a teammate's
approval attached to code that teammate never reviewed; the absence of any
protection on the stack branches makes this stronger, not weaker.

A bounded exception requires a further explicit user decision and a new
revision. Its bounds are already specified and must be carried verbatim into
that revision if it is ever granted: `gh stack rebase --no-trunk --upstack` from
the repaired branch only; only when no human has force-pushed any branch of that
stack in the previous 24 hours; only after the repaired parent's checks are
green; at most once per stack per 24 hours; the receipt records the old and new
SHA of every rewritten branch; abort-on-divergence is retained.

### Bot review feedback

The reviewer with login `defi-bot` reviews monorepo PRs and is the current
blocking `CHANGES_REQUESTED` on several of them. Its backing application is
presumed to be `defi-com/defi-review-agent`; that attribution is unverified and
nothing in this specification depends on it. The rules below key on the review
author being a bot account, not on a specific repository. By user decision its
feedback is actionable and may trigger a repair, bounded as follows:

- Dedup is by processed review ID **and** by a digest of the review body. A
  repair fires only on a review whose ID was never processed and whose content
  digest is not already recorded against that PR at that head SHA. Review-ID
  dedup alone is insufficient: a bot that re-posts the identical finding under a
  new review ID would otherwise re-trigger a repair on every tick.
- At most **one** repair per PR per 24 hours, counted regardless of trigger.
- A per-tick push budget of **six** pushes across all three repositories
  combined, so a cascading failure cannot spend a whole tick's capacity on one
  stack. Six is derived from the hourly cadence and the observed ~16 executed
  check contexts per monorepo PR push, and may be changed by the user without a
  new revision; the acceptance checks read the configured value rather than the
  literal six.
- For Automation C only, a per-tick **review** budget of **one** binding
  verdict, as stated under "Binding review verdicts" above.
- Reaching any of the three caps records a hold naming the cap and the value
  reached, rather than silently dropping the work. Capped work is due control work: the
  precheck wakes the driver when a per-PR 24-hour cap expires even if GitHub is
  unchanged, so capped work is never stranded.

A bot review never satisfies the peer-PR trigger: peer review still requires
self to be officially review-requested, or a comment that explicitly asks self
to review or respond. `defi-bot` output is never treated as a review request.

### Deployment safety

The rule is general and branch-name-agnostic: a repair never pushes to a PR
whose head branch appears in that repository's enumerated deploy-on-push set,
and attempting to do so is a recorded hold.

The set is derived from the workflow files, not assumed. Verified on
2026-09-16:

- `defi-com/monorepo`: `nlayer-env` (`ci.yml` maps a push there to
  `deploy-dev-apps`) and `dev` (`docs-pages.yml` deploys GitHub Pages on a push
  to `dev` touching `docs/**` or that workflow). Other deploy and
  infrastructure-apply jobs run only on `workflow_dispatch` or a push to `main`.
- `defi-com/azure-next-hybrid`: `main` (`ci.yml` triggers on a push to `main`;
  its CD stages are further gated behind `workflow_dispatch` inputs).
- `defi-com/mobile`: empty — the repository has no `.github` directory and no
  workflows at all.

An earlier draft of this revision asserted that `nlayer-env` was the only
deploy-triggering branch in the three repositories. That was wrong, and
`docs-pages.yml` is the counter-example; the enumerated set above replaces it.
Because a PR head branch is normally a feature branch, this rule is expected to
bind rarely; it exists for the case where a PR's head is itself one of these
branches. The enumeration is re-verified before enabling and on any later
allowlist change, and the acceptance check below covers it.

### Watch window

The 24-hour watch window from first observation is replaced, for the defi-com
pair only, by a rolling window: a PR is in scope while it is open and eligible,
and leaves scope on merge or close. There is no expiry and no re-arming.
`cursor.json` for this pair stores no deadlines; `expired` is not a state it can
reach.

Automation A keeps the revision-3 24-hour window from first observation
unchanged, including its `expired` list and its re-arm requirement. The two
pairs deliberately differ: A serves one low-volume repository where expiry is
cheap, while C would otherwise start 20+ simultaneous clocks on first
observation and go dark a day later.

Because the rolling window removes expiry as a cost brake, the per-PR and
per-tick budgets above and Automation D are the only brakes, and D's thresholds
are retuned accordingly: with ~27 hashed PRs and teammate pushes, nearly every
tick is legitimately `changed`, so the revision-3 threshold "no successful
driver run within two hours while the precheck logged `changed` or `due`" is
re-derived against the observed tick duration before enabling rather than
carried over as a literal.

### PR eligibility for repair

- A draft PR is discovered and recorded but never repaired. It becomes eligible
  when it is marked ready for review, which the ordinary event state observes as
  new work.
- A PR that already has a human reviewer requested **is** eligible for repair
  and is not excluded. This is deliberate: most own monorepo PRs carry a
  requested human reviewer, and excluding them would empty the feature.
- `defi-com/mobile` has no `.github` directory and therefore no CI, so a repair
  there has no check signal. Repair on `mobile` is triggered only by actionable
  review feedback. If CI is later added, the ordinary check-rollup trigger
  applies with no specification change.

### Prerequisites

These are host setup gaps verified open on 2026-09-16, and each blocks enabling:

- Toolchain version skew, corrected 2026-09-16: `bun` **is** installed on the
  host, under the user's `~/.bun/bin`, version 1.4.2. An earlier draft of this
  revision recorded it as absent; that reading came from a non-login shell
  whose `PATH` omits that directory, and it was wrong. Two real skews remain
  and are resolved by acceptance check 2 rather than assumed: `defi-com/monorepo`
  pins `packageManager: bun@1.2.2` while the host has 1.4.2, and carries both
  `bun.lock` and `bun.lockb`; and its `engines.node` names 24 while the host runs
  v26. If the repository's test command does not run clean under the host
  toolchain in a child worktree, the pinned versions are installed alongside
  rather than replacing the host's. Either way the automation prompt names no
  version; it runs the repository's own command. The driver worktree and every
  child worktree must have `~/.bun/bin` on `PATH`, since a non-login shell does
  not.
- `defi-com/monorepo` carries one real submodule, `defi-com/contracts` (checked
  out over the Git remote protocol already configured on the host). `.gitmodules`
  also declares `stealth-project-22/domains-json`, but the committed tree holds a
  regular file at that path, so it is not a submodule and is not provisioned. Access to both was verified; provisioning
  them in the driver and child worktrees is a setup task.
- Per-repository setup hooks and their environment are **unverified** for
  `defi-com/mobile` and `defi-com/azure-next-hybrid` as of 2026-09-16. Before
  enabling, each repository's setup and test hooks are inspected and recorded,
  with the executable command and its expected exit behaviour named, and it is
  established that no setup or test hook receives deployment credentials. This
  is acceptance check 9, not an assertion.
- `defi-com/mobile` has an unprotected `dev`; its repair trigger is covered
  under "PR eligibility for repair".

## Run record

The clauses in this section are written for a single pair. They apply to each
pair independently: each of A/B and C/D has its own run id, run directory,
`progress.md` and sidecars, and no state is shared between them. Where a clause
below mentions watch deadlines or `expired`, it describes the A/B pair only;
C/D's rolling window stores neither, per "Watch window".

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

- A session of unknown provenance, or a recorded model different from the
  expected one: mutation pauses for that run, the fact is recorded, and the
  finding goes to the watchdog path.
- GitHub API errors leave the PR state unknown; nothing is pushed or published
  on unknown state.
- A hold is cleared only by a later run observing the condition resolved, or by
  the user in the Orca conversation. Silence never clears a hold. A
  `pending restack` hold is the one hold whose owner is the user by
  construction; it is exempt from the watchdog's hold-with-no-owner threshold.
  It is cleared by the user's restack or by an observed resolution, per the
  single clearing rule in "Stack-aware repair sequencing".
- A budget hold (per-PR repair cap or per-tick push budget reached) names the
  budget as its owner and is cleared by the next tick in which the budget has
  room. It is likewise exempt from the hold-with-no-owner threshold.
- Deployment safety, applying to the defi-com pair: a repair never pushes to any
  branch that a workflow in that repository maps to a deployment on push. The
  set is enumerated per repository from the workflow files, recorded, and
  re-verified before enabling and on any later allowlist change. It is never
  hardcoded to a single branch name.

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
8. Verified on the VPS before enabling (2026-09-16): run history exposes
   `precheckResult` only for scheduled runs (`orca automations run` skips the
   precheck and never reuses a session); run `status: completed` means
   dispatched, not finished; usage tracking is off, so effective identity is
   proven by `orca terminal show` (agent identity plus the rendered model
   line) and the absence of a `--model` override; `--reuse-session` does not
   reuse, hence the precheck's terminal hygiene; the sole-writer guard caught
   an out-of-band sidecar edit (INTEGRITY-1); the worktree needs a one-time
   Claude Code trust grant by the user.

Only then are both automations enabled.

## Acceptance before enabling the defi-com pair

Revision 3's acceptance list governs Automations A and B and is not re-run.
For C and D, all of the following, on the VPS runtime:

1. C and D exist disabled with the settings above, four distinct dispatch
   minutes across all four automations (`orca automations show`).
2. All three repositories are registered in Orca as repos, and C/D have one
   driver worktree of `axatbhardwaj/axstack` as their shared home — the
   defi-com repos are parents for per-PR child worktrees only, never driver
   homes. `bun` resolves on `PATH` in the driver worktree and in a child
   worktree, monorepo's one real submodule (`packages/contracts`) checks out in
   a child worktree, and the monorepo unit-level test command runs to completion
   there under the pinned `~/.bun-1.2.2/bin/bun`, which is off the default
   `PATH`; the host's 1.4.2 fails `bun install --frozen-lockfile` there, and
   that failure is itself part of this check.
3. C's stored precheck exits non-zero on an unchanged fingerprint, zero after a
   synthetic allowlisted own-PR push, non-zero when only a non-allowlisted PR
   changed, and non-zero with an `error` line when a search returns exactly the
   limit. It stores no deadlines.
4. A synthetic two-deep own stack produces exactly one repair, on the lower PR,
   and exactly one `pending restack` hold on the upper PR; a second tick on the
   same state produces no new push, no duplicate hold, and no repair of the
   upper PR.
5. A synthetic PR whose head branch is `nlayer-env` produces a recorded hold and
   zero pushes. The deploy-trigger mapping is re-verified for all three
   repositories and recorded.
6. Bot-feedback and budget behaviour, all four parts:
   (a) a repeated identical `defi-bot` review, reposted under a NEW review ID
   with byte-identical body, produces zero additional repairs — dedup is by
   review ID *and* by content digest, so a re-posted identical finding never
   re-triggers;
   (b) the per-PR 24h cap produces a hold naming the cap after the first
   repair;
   (c) with the configured per-tick push budget set to 1 for the test, a tick
   with two eligible PRs performs exactly one push and records one budget hold
   naming the value reached;
   (d) a per-PR cap that has expired wakes the driver as due control work with
   GitHub otherwise unchanged.
7. A merged PR leaves scope on the next tick with no expiry path taken, and
   C's `cursor.json` contains no deadline field. A PR moved from draft to ready
   becomes eligible on the next tick. A PR with a human reviewer already
   requested is repaired, not skipped.
8. Still-applicable revision-3 driver checks, re-run against C because
   inherited behaviour needs its own evidence: a new failing check at an
   unchanged head exits the precheck 0 and produces exactly one unit of work; a
   due failed-relay retry exits 0 with no PR change; an unauthenticated `gh`
   produces a non-zero exit and an `error` log line; a manual run records C's
   effective session identity; a second manual run on unchanged state performs
   no duplicate work.
9. Setup-hook inspection recorded for all three repositories per
   "Prerequisites", each with its executable command and expected exit
   behaviour, and evidence that no setup or test hook receives deployment
   credentials.
10. Peer-PR path on an allowlisted repository: two isolated reviews at the head
    SHA produce exactly one `COMMENT` review bound to the reviewed commit, and
    an unavailable required reviewer publishes nothing and records a hold.
    Private defi-com source reaching the configured cross-family reviewer is
    the user's approved D1 decision and is recorded, not re-litigated.
11. A base change on an own PR invalidates the affected review receipt and
    produces new work at the unchanged head.
12. Cross-pair isolation: a C tick leaves A's terminals, sidecars and run
    record untouched, and C's terminal hygiene closes only C's own driver
    terminals by recorded `terminalPtyId`.
13. Watchdog D: one manual run on a healthy state records one line and sends
    nothing; C unable to run (three synthetic `error` lines) produces a health
    finding, a gate decision and, on `escalate`, exactly one relay receipt in
    D's `watchdog.json`; with the gate unavailable the finding stays held and
    visible with no send; a resolved-then-recurring finding produces a second
    occurrence. D's `no successful run in 2h while changed` threshold is
    re-derived before enabling as `max(2h, 3 x the 95th-percentile observed C
    tick duration over at least 10 ticks)`, and the computed value and its
    sample are recorded. Neither a `pending restack` hold nor a budget hold
    trips D's hold-with-no-owner threshold.

14. Revision 5 scope split: a PR in `defi-com/azure-next-hybrid` authored by
    self produces zero repairs and zero pushes, while a review-requested PR in
    the same repository produces a review; a repository in neither list stays
    record-only.
15. Revision 5 submission. These repositories are private and the peer PRs are
    real teammates' work, so a "synthetic" peer PR does not exist and the check
    is split by whether it writes to GitHub. Fabricating a finding, editing peer
    code, or manufacturing a state on someone else's PR is forbidden here as
    everywhere.

    **15A — no-write coverage, run first, deterministic.** Against recorded
    fixtures and the submission boundary with the GitHub call captured rather
    than sent, assert the payload and that nothing is transmitted for each of:
    an `APPROVE` payload from a complete review with zero validated blockers; a
    `REQUEST_CHANGES` payload from a complete review with at least one validated
    blocking finding carrying evidence; no call at all for `INCOMPLETE`, an
    unavailable required reviewer, or a gate `escalate`; no call for a PR
    authored by self; a `COMMENT` payload, never a verdict, for a
    mention-triggered peer PR; no second call at an unchanged head and unchanged
    verdict basis; exactly one superseding call at a changed basis and none for
    a second supersede at the same head; the superseded-head re-review path
    running as due control work exempt from the per-tick budget; the durable
    blocking-obligation record being written, polled by URL when discovery no
    longer returns the PR, discharged on merge/close/resolution, and becoming a
    gate-routed health finding after three unpollable ticks; and zero GitHub
    writes by Automation D throughout. It additionally covers the three cases
    that only appear once a block exists: an unchanged discovery fingerprint
    with an outstanding obligation still exits the precheck 0 and wakes C; a PR
    whose review request has been removed — as submitting a review does — still
    accepts exactly one honest clearing `APPROVE` under the obligation's own
    authority and no second one; three failed polls across scheduled ticks
    produce exactly one gate-routed health finding; and the obligation chain —
    a block at head 1 from an official request, an honest re-block at head 2
    after a teammate push, and a clearing `APPROVE` at head 3 submitted under
    the inherited authority with no fresh review request.

    **15B — one live submission, on a PR the user designates.** The user
    designated `defi-com/monorepo#1108` (authored by `yep365`, self officially
    review-requested) on 2026-09-16 and accepted that a genuine review verdict
    will land on it. C reviews it honestly and
    submits whichever verdict that review truthfully yields — the check does not
    require a particular verdict, and an `APPROVE` satisfies it as fully as a
    `REQUEST_CHANGES`. The remote receipt must confirm exactly one review bound
    to the reviewed commit. If the honest verdict is `REQUEST_CHANGES`, the user
    is told at once that a real block now stands under their login and that only
    they can clear it, and the resulting obligation is followed through the
    tracking rules above. The local review file required above is written for
    this review too, and its presence and naming are part of the check.

    **15C — precondition.** The skill, reference and test amendments named in
    "A skill amendment is required before C is enabled" are complete, and pair
    A/B, run on equivalent states, still submits `COMMENT` only. Without 15C,
    C is not enabled and 15B is not attempted.

16. Revision 5 green gate and inherited failures: a check failing at head and
    passing on the base is repaired; a same-named check failing on both is an
    inherited-failure hold naming the base SHA that consumes no repair cap; a
    base whose checks are missing or still running yields a hold, not an
    assumed repair; two failures sharing a check name but differing in cause
    are distinguished only on recorded output evidence; `defi-com/mobile`
    repairs from review feedback with no rollup comparison; and a local suite
    that cannot run for want of host services is recorded as an unverified
    boundary and never reported as passing.

Only then are C and D enabled.
