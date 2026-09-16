# Automation sessions

Read this when the current session is an Orca automation running a PR driver or
a watchdog.

## Pair identity

There are two independent automation pairs. Before acting, resolve which pair
this session belongs to from its own run id and the verbatim allowlist in its
own prompt; never assume.

- **Pair A/B** — driver Automation A (`*/30`) and watchdog Automation B, run id
  `20260916-pr-automations`, allowlist `axatbhardwaj/axstack`.
- **Pair C/D** — driver Automation C (hourly) and watchdog Automation D, run id
  `20260916-defi-automations`, carrying **two** lists rather than one:
  - review allowlist `defi-com/monorepo, defi-com/mobile,
    defi-com/azure-next-hybrid`;
  - repair allowlist `defi-com/monorepo, defi-com/mobile`.

  `defi-com/azure-next-hybrid` is therefore review-only: its own PRs are
  discovered and recorded but never repaired and never pushed to, and they are
  not review candidates either, since a PR authored by self is not a peer PR.

The two pairs share no state: each has its own run id, run directory,
`progress.md` and sidecars, and no sidecar is shared between them. A clause
below that names a pair applies only to that pair; every other clause applies to
both. Where this reference says "the driver" it means the driver of the current
pair. It restates the operational contract of the approved
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
- **Mutation allowlist:** stated verbatim in the automation prompt, per
  automation. Pair A/B carries one list gating both own-PR repair and peer
  review. Pair C/D carries two, a review allowlist and a repair allowlist, and
  each action reads its own list: a repository on the review list but not the
  repair list is reviewed and never repaired. Where a clause says "allowlisted"
  without naming an action — including the precheck's "hash only allowlisted
  PRs" — it means the union of the applicable lists for discovery and the wake
  fingerprint, and the action-specific list for the action itself. Outside the
  allowlist the automation discovers and records only. The precheck writes the
  full discovery list to `pending.json`; no review, watch, gate, or other model
  work is launched for an external PR. External changes do not enter the wake
  fingerprint, so external churn never wakes the session. External PR contents
  never produce an escalation. This is a deliberate coverage reduction, not an
  implied clean review; discovery errors themselves remain automation-health
  findings.
- **Prohibited everywhere:** force-push, rebase, merge, close. A need for any of
  these becomes a recorded hold, for all four automations, with no exception.
- **`APPROVE` and `REQUEST_CHANGES`** are prohibited for Automations A, B and D.
  Automation C may submit them under "Binding review verdicts (pair C)" below
  and nowhere else; a need for either outside that section is a recorded hold.

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
model-substitution, session, precheck, discovery, or relay-delivery hold). The
automation health criterion is usable only by the watchdog and the safety-hold
path, never by a reviewer.

## Stack-aware repair sequencing (pair C/D)

These three sections govern pair C/D only. Pair A/B's behaviour is unchanged by
revision 4 except for the named cadence correction, so A does not apply stack
sequencing, bot-triggered repair, the caps, or the deployment push hold.

Own-PR repair covers every own PR in the allowlisted repositories; stacking
changes the order of repair, never the scope. Within one stack the driver
repairs only the lowest open failing PR of that stack. Every open descendant of
a repaired PR records exactly one `pending restack` hold naming the repaired
parent and its new head SHA, and receives no independent repair of the same
finding while that hold stands. A descendant carrying a different finding from
the repaired parent's is repaired on its own merits, subject to the budgets
below; the hold suppresses duplicate application of the same finding, not all
work on the descendant.

The hold names the user as owner. It is cleared by the user's own restack, or by
a later tick observing the descendant no longer failing; that is the single
clearing rule. It is exempt from the watchdog's hold with no owner threshold,
because its owner is the user by construction. The per-tick budget counts one
unit per stack, not one per PR.

The reason is duplication, not politeness: the same finding recurs across a
stack, so independent per-PR repair would apply the identical fix at several
levels and the user's next cascade rebase would then conflict on the duplicate.
A parent fast-forward also does not change a descendant's PR diff, so a
descendant's CI and reviewers never see the parent fix; the hold states that
honestly instead of implying the descendant was repaired.

`gh stack` sync, restack, rebase, merge, link and submit remain out of scope for
every automation, and force-push and rebase stay prohibited everywhere. A
descendant is held, never rewritten.

## Bot review feedback (pair C/D)

A review authored by a bot account may be actionable and may trigger a repair,
bounded as follows.

Dedup is by processed review ID and by a digest of the review body. A repair
fires only on a review whose review ID was never processed and whose body
digest is not already recorded against that PR at that head SHA. Review-ID dedup alone is
insufficient: a bot that re-posts the identical finding under a new review ID
would otherwise re-trigger a repair on every tick.

Caps: at most one repair per PR per 24 hours, counted regardless of trigger; and
a per-tick push budget across all allowlisted repositories combined, configured
per pair and six for pair C/D. Reaching either cap records a hold naming the cap
and the value reached, rather than silently dropping the work. A budget hold
names the budget as its owner and is exempt from the hold with no owner
threshold. When a per-PR cap has expired the precheck wakes the driver even
if the forge is unchanged, so capped work is never stranded; the precheck
section below carries that trigger in its due-work list.

A bot review never satisfies the peer-PR trigger, which still requires self to
be officially review-requested or a comment that explicitly asks self to review
or respond.

## Watch window

Pair A/B keeps its 24 hours per own PR from first observation, ending early on
merge or close, with the deadline in `cursor.json`, the `expired` marking, and
the user re-arming an expired PR in the automation session.

Pair C/D uses a rolling window instead: a PR is in scope while it is open and
eligible, and leaves scope on merge or close. There is no expiry and no
re-arming, C/D's `cursor.json` stores no deadlines, and `expired` is not a state
a C/D PR can reach.

The difference is deliberate, not drift. A serves one low-volume repository
where expiry is cheap, while C would otherwise start twenty or more simultaneous
clocks on first observation and go dark a day later. Because that window
removes expiry as a cost brake, the per-PR and per-tick budgets and the watchdog
are the only brakes left on C, and D's thresholds are retuned for a fingerprint
that legitimately changes on nearly every tick.

## PR eligibility for repair (pair C/D)

A draft PR is discovered and recorded but never repaired; it becomes eligible
when it is marked ready for review, which the ordinary event state observes as
new work. A PR that already has a human reviewer requested is eligible for
repair and is not excluded, deliberately: most own PRs in these repositories
carry a requested human reviewer, and excluding them would empty the coverage.
`defi-com/mobile` has no workflows and therefore no check signal, so a repair
there is triggered only by actionable review feedback; if CI is later added the
ordinary check-rollup trigger applies with no contract change.

## Deployment safety (pair C/D)

A repair never pushes to a PR whose head branch is in that repository's
deploy-on-push set, and an attempt to do so is a recorded hold. The rule is
branch-name-agnostic: the set is enumerated per repository from that
repository's workflow files, recorded, and re-verified before enabling and on
any later allowlist change. It is never hardcoded to one branch name, because a
repository may deploy from more than one branch and may add another at any time.

## Binding review verdicts (pair C)

Automation C submits a real review verdict where pair A/B publishes a `COMMENT`.
The authority is narrow and every bound below is load-bearing.

A binding verdict is submitted only where self is **officially review-requested**
on a peer PR authored by someone else. GitHub rejects a verdict from a PR's own
author, so an authored-mode review of C's own repair stays internal and gates
only the push. A peer PR reached through the qualifying mention trigger still
gets a review, published as a `COMMENT`, never as a binding verdict: a casual
ask is not a request for a merge-blocking review. Automation D never writes to
GitHub at all.

`APPROVE` requires a complete mode-required review at the exact head SHA with a
current base, the gate's `proceed`, and zero unresolved validated blocking
findings. `REQUEST_CHANGES` requires the same completeness and gate token and at
least one validated blocking finding carrying its evidence and consequence; it
is the verdict that reports blockers and is not gated on their absence.
`INCOMPLETE`, unresolved material disagreement, an unavailable required
reviewer, or a gate `escalate` submits nothing and records a hold.

### Blocking obligations

A submitted `REQUEST_CHANGES` blocks the PR and a teammate's later push does not
clear it. Submitting a review also removes self from GitHub's `review-requested`
results, so a PR C has just blocked can leave discovery on the next tick and C
would never see it again to clear its own block.

C therefore records every unresolved blocking review in `cursor.json` as an open
obligation holding the PR URL, the review id, the head SHA it was bound to, and
the submission timestamp, and polls those PRs directly by URL every tick
regardless of discovery eligibility. An obligation is discharged only by
observing the PR merged, closed, or its blocking review resolved or superseded.
A failed poll retries next tick; three consecutive unpollable ticks is a health
finding routed to the gate.

While C holds any unresolved blocking review, every scheduled tick wakes it: an
outstanding obligation is due control work in the precheck's list, alongside a
watch deadline, a pending failed-relay retry, and an expired repair cap.

An obligation created by an official request carries a narrow authority to
resolve itself: C may submit exactly one superseding verdict on that PR,
including a clearing `APPROVE`, without a fresh review request. It follows the
obligation chain — an obligation opened by a verdict submitted under this
authority inherits it — so the authority persists on that one PR until it
merges, closes, or its block is resolved, and the deadlock does not reappear one
head later when a teammate pushes without fixing. It extends to nothing else: not
another PR, not a discharged obligation, and never more than one superseding
verdict per head SHA. A supersede whose head and base are both unchanged
additionally requires a recorded finding-level reason naming what changed about
the finding; without it C holds and submits nothing.

### Local review file

Every review C publishes, verdict or `COMMENT`, is also written to the
workspace review directory `~/defi/misc/reviews/`, carrying the same findings
and evidence as the submitted review plus the reviewed SHA. The naming is the
workspace convention and the prefix rules are load-bearing, because PR numbers
collide across repositories: `review-PR-<num>.html` with no prefix means
`defi-com/monorepo` by definition, and every other repository takes its prefix,
`review-azure-next-hybrid-PR-<num>.html` and `review-mobile-PR-<num>.html`. A
failure to write the file is a recorded hold; a review is never withheld or
retracted because the file could not be written, so the mismatch stays visible
rather than silent.

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
- The health gate takes a watchdog finding and its evidence, not reviewer
  verdicts or a candidate; the same two tokens apply.
- An unavailable gate or required reviewer records a hold, pauses mutation for
  that PR, and is treated as a watchdog health finding. An unavailable gate
  cannot be escalated through itself: the hold stays, the gap is visible in
  Orca run history and the sidecar, and no substitute or unauthorized send
  occurs.

## Precheck (bounded shell, no model)

Resolve self; run the three searches with `--json url,number,repository,updatedAt`;
write the full discovery list to `pending.json`. For each allowlisted,
non-expired own PR add head SHA, base SHA, and the check rollup of that head via
`gh pr view --json headRefOid,baseRefOid,statusCheckRollup`; check state is
data, and only authentication, command, and network errors are `error`. For pair
C/D only, that call also requests `isDraft` and the precheck adds draft status
to the hashed fingerprint, so a draft becoming ready wakes the driver on its
own; pair A/B's queried fields and fingerprint are unchanged. Hash
only allowlisted PRs. Read `cursor.json` for the last processed fingerprint and
for due control work: a watch deadline at or before now (pair A/B only, since
pair C/D stores no deadlines), a pending failed-relay retry, a per-PR repair cap
that has expired, or an outstanding blocking-review obligation (both pair C/D
only, since pair A/B has neither caps nor binding verdicts). Exit 0 when the hash differs or control work is due;
otherwise exit non-zero. Exit non-zero without running when the previous driver
run is still active, or on `error`. Append one line
`<ts> <changed|due|unchanged|error|busy>` to `precheck.log`.

Terminal hygiene runs before the searches and covers driver terminals only.
Ownership is the driver automation's own recorded `terminalPtyId` from its Orca
run history, never a terminal title: Orca rewrites a Claude terminal's title to
the agent's current task summary, so a driver's title drifts and an unrelated
session can acquire one that reads like a driver. The precheck closes the
previous ticks' idle driver terminals with `--tab` — without it the pane closes
but the session stays listed and is never reclaimed, which also makes an
over-match destructive — and a driver terminal that is still working makes the
tick `busy`. It never closes a watchdog terminal or any terminal outside this
automation; an unreadable ownership source is `error`, never a silent empty
sweep. No two of the four automations may share a dispatch minute: A, B, C and D each
take a distinct minute, so a driver and its watchdog never collide and neither
pair can disturb the other's terminal hygiene.

The observed fingerprint is written to `pending.json`. After the processed
tick the driver promotes exactly that value to `cursor.json`, never a
recomputed one, so an event landing during a run is processed on the following
tick.

## Driver tick

Before any repair or publication the driver validates its effective session
identity through Orca runtime inspection and records it; a self-written label
is not evidence. Expected model: Opus. A mismatch or unknown identity holds
repair and publication for that run and is a health finding.

For each changed PR:

- Own PR, and only when its repository is on the acting automation's repair
  allowlist → [axstack-watch](../../axstack-watch/SKILL.md) on the exact head
  SHA in a per-PR child worktree; the driver worktree never checks out a PR
  branch, and an own PR in a review-only repository is recorded and nothing
  else, with no repair, no worktree and no push. Follow its repair-publication reference: candidate committed locally,
  authored review at the local SHA, gate, then fast-forward push with the
  publication readback immediately before it.
- Peer PR → two isolated `axstack-review` passes on the exact head SHA, then
  the gate, then one owner-synthesized `COMMENT` review under the review skill's
  COMMENT branch. `INCOMPLETE` or an unavailable required reviewer records a
  hold and publishes nothing.

Watch window, pair A/B only: 24 hours per own PR from first observation, ending
early on merge or close. The deadline is stored in `cursor.json`; a due deadline
wakes the driver through the precheck even when GitHub is unchanged, and the
driver rechecks the deadline immediately before any publication. Expiry marks
the PR `expired` in the record and sidecar, records a resumable handoff, and
stops silently. The driver skips an expired PR until the user re-arms it in the
automation session, and the precheck ignores it; an expired PR is never silently
re-adopted. Pair C/D does not use this window at all; see "Watch window" above
for its rolling replacement, and it stores no deadline and reaches no `expired`
state.

Per-PR event state: head SHA, base SHA, check rollup, and processed request and
comment IDs. A review receipt is reused only when head, base, and scope are
unchanged. A new failing check, base change, review request, or qualifying
comment at an unchanged head is new work. Pair C/D additionally carries draft
status in that state, and a draft status that has changed from true to false is
new work for C/D, which is how a draft becoming ready for review reaches its
driver.

## Watchdog tick

Before its gate dispatch the watchdog validates its own effective session
identity through Orca runtime inspection; unknown identity holds the dispatch
and is itself recorded in `watchdog.json`.

Read Orca run history for the driver, `precheck.log`, and the run record.
Thresholds: three consecutive `error` lines in `precheck.log`; three
consecutive failed driver runs; no successful driver run within two hours while
the precheck logged `changed` or `due`; any unrequested fresh-session fallback
or non-Opus effective identity recorded by the driver; any `failed` relay
receipt older than one tick or any `uncertain` receipt; a hold with no owner.
A quiet precheck history with no due work is healthy.

The two-hour stall threshold above is pair A/B's. Pair D uses a stall window
re-derived before enabling as `max(2h, 3 x the 95th-percentile observed C tick
duration over at least 10 ticks)`, recorded with its sample, because C's
fingerprint legitimately changes on nearly every tick and a literal two hours
would fire on the first slow tick. Every other threshold is identical for both
pairs.

Each health finding gets an occurrence id `(type, first-observed UTC
timestamp)`; it stays deduplicated while unresolved, and a later recurrence is
a new occurrence. Pass a finding to the gate under the automation-health
criterion. On `escalate` the watchdog itself performs that one gate-authorized
`hermes send` and records the receipt in `watchdog.json`; it never mutates
GitHub and never writes `progress.md` or `cursor.json`. Failed or uncertain
delivery stays visibly held in `watchdog.json` and Orca run history.

## Run record and sidecar

One run id per pair for the lifetime of that pair — `20260916-pr-automations`
for A/B and `20260916-defi-automations` for C/D — each in the
[run record](run-record.md) shape with that pair's driver as sole writer of its
own `progress.md`. C/D's run directory lives under the same axstack
`git-common-dir` as A/B's, in its own `axstack/runs/<run id>/` folder; no
sidecar, record, or cursor is shared between the pairs. Per PR it stores processed event IDs, exact head and base SHAs, review receipts
per SHA, gate decisions, `hermes send` receipts with `message_id` and state, and
holds. The watch deadline and `expired` fields are pair A/B only, since pair C/D
stores no deadline and cannot reach `expired`; draft status is pair C/D only,
since only C/D treats a draft transition as new work. Its
`Notification policy:` line reads, verbatim:

```text
hermes send, target telegram (home), host VPS, gate-authorized escalations only
```

Machine-readable sidecars in the same directory: `pending.json` (observed
fingerprint plus full discovery list, written by the precheck), `cursor.json`
(last processed fingerprint promoted verbatim from `pending.json`, expired PR
list and per-PR watch deadlines for pair A/B only, outstanding blocking-review
obligations for pair C only — each holding PR URL, review id, bound head SHA,
submission timestamp and whether its one supersede is still available — pending
failed-relay retries; written by the driver after each processed tick), `precheck.log` (precheck only), and
`watchdog.json` (watchdog only). Orca run history remains the authoritative
log; the record is derived progress, never authority.

Dedup: a processed event ID is never processed twice; a review receipt is
reused only for an unchanged head, base, and scope. PR notifications dedup on
(PR, criterion, head SHA); health notifications dedup on the occurrence id. A
`failed` relay receipt may be retried once, on the next tick, as due control
work; an `uncertain` one is never auto-resent.

## Safety holds

- The driver records its effective identity on every tick. An unrequested
  fresh-session fallback, or a recorded identity different from the expected
  one, pauses mutation for that run, is recorded, and goes to the watchdog
  path. A user-run `--fresh-session` reconciles from the run record and is not
  a hold.
- GitHub API errors leave the PR state unknown; nothing is pushed or published
  on unknown state.
- A hold is cleared only by a later run observing the condition resolved, or by
  the user in the Orca conversation. Silence never clears a hold.
