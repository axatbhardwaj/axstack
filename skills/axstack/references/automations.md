# Automation sessions

Read this when the current session is the native Orca PR **driver** or its
**watchdog**. The approved contract is
`docs/specs/pr-automations.md` revision 5; this reference restates the parts an
automation session must execute and does not widen them.

Pair A/B is retired for this contract; its artefacts remain untouched.

## Roles and authority

- **driver** — every 15 minutes, fresh Opus session in the host's `root`
  folder workspace, which is not a git repository and belongs to no project. It discovers GitHub work, binds the persistent Orca
  Run, checks each selected PR's head out into a free project-local slot, dispatches the
  matching Axstack agent, reconciles completions and decisions, then exits. The
  driver is the automation session itself, with no `axstack-monitor` or
  `axstack-owner` role row. It never performs review or repair in its own
  session. Its only direct GitHub mutation is an already-approved decision:
  one `gh pr review` or one fast-forward push of a preserved candidate.
- **watchdog** — hourly at a distinct minute. It is a shell precheck with no
  model, never launches an agent session, never mutates GitHub, and only sends
  the health notifications defined below.
- `axstack-monitor` remains an optional read-only observer that never sends.

Self is resolved on every run with `gh api user --jq .login`; never hardcode
it. The review allowlist is `defi-com/monorepo`, `defi-com/mobile`,
`defi-com/azure-next-hybrid`, and `defi-com/ci-workflows`. The repair allowlist
is `defi-com/monorepo` and `defi-com/mobile`. State both lists verbatim in the driver prompt. An own PR is
open, authored by self, on the repair allowlist, and not a draft. A peer PR is
open, on the review allowlist, authored by someone else, and either officially
review-requested from self or has a non-self comment that both mentions self
and asks for review or response. The driver reads and records the comment id
and its interpretation; incidental mentions are discovery only.

Outside the union of both allowlists, record only and exclude the PR from the
fingerprint. Peer code is read-only, though its worktree may install
dependencies and run repository tests. Own-PR authority permits repair, test,
commit, and fast-forward `git push` without lease or force. Force-push, rebase,
merge, close, every `gh stack` sync/restack/rebase/merge/link/submit action,
`COMMENT` reviews, and every GitHub write by the watchdog or Hermes are
prohibited.

## Discovery and wake

The bounded driver precheck contains no model and exits 0 only for changed or
due work.

1. If `cursor.json.tick_started_at` is newer than `tick_done_at` and younger
   than 1 h, append `running` to `precheck.log` and exit 3. This overlap guard
   inspects no terminal.
2. Resolve self, then run exactly four `gh search prs --state open --limit 100
   --json url,number,repository,updatedAt` searches: `--author @me`,
   `--review-requested @me`, `--mentions @me`, and
   `--reviewed-by @me --review changes_requested`. A result count equal to 100
   is truncation: append `error`, exit 2, and do not write a fingerprint.
   Deduplicate by URL with own-PR precedence and drop repositories outside the
   allowlist union.
3. For each retained PR, read `gh pr view --json headRefOid,baseRefName,isDraft,
   statusCheckRollup,author,latestReviews` and resolve the base SHA with
   `gh api repos/<repo>/commits/<base>`. Own PRs contribute head, base, draft,
   checks reduced to `{name, conclusion|state}` pairs, and the set of
   `latestReviews` `{id, state}` whose `commit` is the head; others contribute
   head and base.
4. Debounce peer and fourth-search heads: they enter the hashed subset only on
   the second consecutive precheck that observes them. The first observation
   goes in `pending.json.seen[]`. Own heads enter immediately. Hash this subset
   as the fingerprint.

### Due control work

Read `cursor.json` and `decisions/`. Work is due for:

- a decision in `approved` or `rejected` without `consumed_at`;
- a `spent` decision without a receipt, which needs reconciliation;
- a `deferred[]` entry whose head still matches discovery;
- an expired repair cap;
- a dispatch marker older than 3 h;
- an unsettled Orca delivery in `pending_settlement[]`;
- a `runtime_refusal` record, because its re-test needs a launched tick.

An `open` decision is not due. Write `pending.json` with the fingerprint,
`observed_at`, `seen[]`, full discovery list, and hashed subset. Append
`<ts> changed|due|unchanged|running|error` to `precheck.log`; exit 0 for
`changed` or `due`, 1 for `unchanged`, 2 for `error`, and 3 for `running`.

## Driver tick

The driver performs this order and exits:

1. If `tick_started_at` is newer than `tick_done_at`, add `previous tick did
   not finish` to `cursor.json.health[]`. Write `tick_started_at`. Match this
   session's `ORCA_TERMINAL_HANDLE` to the driver's `terminalPtyId` from
   `orca automations runs --id <driver>`, then verify the transcript model.
   Non-Opus or unknown identity records a hold and `tick_outcome: held`, and
   dispatches nothing.
2. Bind the persistent Run with `orca orchestration run-use` and read the
   inbox. For a `worker_done` matching a live marker, verify the review id at
   the bound head, push range, or opened token. Release the worker; once its
   release receipt is settled and the process has exited, run the cleanup
   under "Run directory" below, which proves the slot disposable before
   resetting it; then clear the marker. Unverifiable delivery stays in
   `pending_settlement[]` and blocks only that PR.
3. Consume decisions as their sole consumer under "Decision tokens" below.
4. Reconcile every marker older than 3 h. A live worker gets `worker-stop`; an
   exited worker gets `worker-abandon`. Unknown liveness or user takeover
   retains worktree and marker and blocks only that PR. An abandon is
   confirmed by its accepted abandon receipt plus proven process exit; there
   is no release receipt on this path. After confirmed abandon, run the same
   cleanup under "Run directory" below with its extra clean-tree condition — a
   dirty or unproven worktree is retained, not removed — append one health
   line, increment the head's `abandon_count`, and drop that head so normal
   selection retries once. For a
   review-triggered dispatch, use the marker's `trigger` to remove exactly its
   review id and digest from `processed_reviews[]`. A second abandon at that
   head is a user-owned hold.
5. Select changed PRs and matching `deferred[]` entries oldest `updatedAt`
   first. Skip a current-head decision in `open` or `approved`, and skip a live
   marker. Dispatch within the repair and review rules below.
6. Promote the `pending.json` fingerprint verbatim, because it records
   observation rather than completion. Write `tick_done_at` and
   `tick_outcome: ok`, then close your own terminal tab and exit: each tick is
   a fresh session and there is no hygiene sweep, so a tab left open outlives
   the tick as a stray terminal in the root workspace.

## Dispatch and repair selection

Claude Code trusts a folder per git toplevel and stops at its "Quick safety
check" dialog otherwise, and the driver never answers that dialog for a
worker. So workers run in a fixed pool: every allowlisted project has
exactly two slot worktrees, `slot-1` and `slot-2`, its Orca child worktrees
created once, parented to the project's primary worktree, and trusted once
by the user through that dialog. The driver never creates or removes a
worktree and never writes `~/.claude.json`. A slot is free when no live
dispatch marker names it, it is not in `retained_slots[]`, no terminal is
listed in it, and its tree is clean; no free slot in the project defers the
PR to `deferred[]` like a budget, not a hold. Taking a slot fetches the head into the project clone,
checks the slot out detached at the pinned head, and verifies HEAD equals
it; the marker's worktree is the slot path. The worker is launched by Orca
itself — `worker-start --agent claude --model claude-opus-5 --effort medium`
on that slot — so the runtime owns the process: `worker-release` ends it and
`worker-show` proves it exited, which is what returns the slot to the pool.
Never pre-create the worker's terminal or hand a terminal handle to
`worker-start`: a reused handle is a resource Orca labels `external`, one it
can neither stop nor prove exited, so every such slot ends retained. After
`worker-start` run `worker-show` on the receipt's dispatch id and require
`projection.resource.state == owned`; anything else is a launch Orca does not
own: apply the runtime-refusal recovery rules under "Safety holds" (the
`worker-list` row's `nextAction` argv verbatim; `none` means inspect and
retain), append a `worker not owned` health line and a `retained_slots[]`
entry for the slot, defer the PR, and record no marker. Orca's per-agent default arguments supply
`--dangerously-skip-permissions`; the brief loads the skill files it needs by
path. If `worker-start` reports a failed stage or a visible hold (the "Quick
safety check" trust dialog) the slot is not trusted: name the slot in a health
line, defer the PR, dispatch nothing, never answer the dialog. Project
customizations load as they would for the user; the allowlist is defi-com
only and the user accepted that surface on 2026-09-18.

Every selected PR receives one dispatch marker with task id, dispatch id,
worktree, head, `started_at`, reservation (`verdict` or `repair`), and trigger:
`{kind: check, name, app_id}` or `{kind: review, review_id, digest}`. There is at
most one live marker per PR. The marker is the claim shared by scheduled and
attended sessions; revalidation immediately before an external call is its
second half. It makes no exactly-once claim against concurrent human GitHub
activity.

An own PR needs repair when either trigger applies:

1. a failing check has a base check-run with the same `name` and the same
   producing `app.id` observed passing through
   `gh api repos/<repo>/commits/<base>/check-runs`; for a legacy commit status,
   its counterpart has the same `context`. A missing, pending, or same-name
   different-app base check holds repair;
2. a `CHANGES_REQUESTED` review at the current head, by any account, has both
   a review id absent from `cursor.json.processed_reviews[]` and a SHA-256 body
   digest not recorded for that PR and head. Both keys are required: the same
   finding under a new review id must not re-trigger repair. Record review id
   and body digest when dispatching. A superseded head with a new review
   triggers again subject to the 24 h cap.

Repair also requires no deploy-on-push head branch, no live repair cap, and
selection of the lowest own PR in its stack that needs repair. Take a free
slot of that project (its slots are parented to that project's primary
worktree, so the work appears under the project it serves) at the exact
head, and dispatch one `axstack-watch` agent in authored repair mode. Its
brief contains only the triggering checks or review findings. Each open
descendant records one user-owned `pending restack` hold until it stops needing
repair. The 24 h cap starts at dispatch and an abandon does not refund it.

A debounced peer PR is eligible when self has not reviewed its head. Read
`gh pr view --json reviews` before dispatch. Whenever any self review with
state `CHANGES_REQUESTED` exists on the PR, from whichever search it came,
dispatch only if the latest effective, non-dismissed self review body contains
the line prefix `<!-- axstack-automation verdict` or its id is listed in
`cursor.json.legacy_automation_reviews[]`; otherwise record and skip, so a
human-placed block is never overwritten. A dismissed block and a self-approved
PR are skipped. Dispatch one `axstack-review` agent in peer mode and link the
prior review in its brief.

Budgets are one `verdict` dispatch per tick, oldest first; at most six `repair`
markers live across all repositories; and one repair per PR per 24 h. Put every
eligible PR not dispatched because of a budget in `deferred[]` with repo, PR,
and head. Budget exhaustion records the count and is not a hold.

## Agents and verdicts

Every agent works in a project-local slot worktree checked out detached at
the exact head and reports only through the Orca worker protocol.

Peer review runs the two isolated configured reviewers on the identical brief,
then the Luna gate. `APPROVE` requires complete exact-head/base reviews, gate
`proceed`, and zero validated blockers. `REQUEST_CHANGES` requires the same
completeness and `proceed`, plus at least one evidenced blocking finding.
`INCOMPLETE`, unresolved disagreement, unavailable review or gate, or unknown
GitHub state publishes nothing. Immediately before `gh pr review`, the agent
re-reads self's reviews at the head and skips with the existing id when one is
already present, then re-checks head, base, draft, authorship, and allowlist.
The verdict body ends with this exact marker line:

```text
<!-- axstack-automation verdict head=<sha> -->
```

The verdict body is written for the person reading the PR and reads as one
reviewer's findings. It never names the reviewer count, the brief, the
angles, the gate, receipts, or which reviewer found what: "two independent
reviews", "from secondary", and "the reviewers ran" are pipeline facts, not
review content. It is self-contained: every validated finding, blocking or
not, appears in full in the body — evidence and consequence, file and line
where they exist — so a reader is never told that notes exist without seeing
them, and a finding is never dropped to keep the body short. It never points
at the local review file or at anything the reader cannot open. Evidence
appears as what was checked and observed, not as who ran it: the reviewed
head and base SHAs, CI status, test counts, and diff size are reader-useful
facts and belong; "shape verified" and "pinned CI" are pipeline phrasing and
do not. The marker line is the only pipeline artefact the body carries.

Write the local review file to the workspace review directory
`~/defi/misc/reviews/` under the existing convention:
`review-PR-<num>.html` with no prefix means `defi-com/monorepo`;
`review-mobile-PR-<num>.html`,
`review-azure-next-hybrid-PR-<num>.html` and `review-ci-workflows-PR-<num>.html`
name the other repositories. A write
failure is recorded but does not withhold the verdict.

Authored repair commits a local candidate, obtains one Sol review at that
local SHA and the Luna gate, resolves every validated blocker, records test
evidence, re-reads remote head/base/draft/deploy set/allowlist, then pushes
fast-forward. The monorepo unit gate uses `~/.bun-1.2.2/bin/bun`; a suite that
cannot run locally is an explicit unverified boundary.

Every reviewer brief ends exactly:

```text
Escalate to user: yes | no — <criterion> — <reason>
```

PR work has exactly three criteria: a security concern, a permanent on-chain
state change, or an architectural change in approach. There is no
automation-health criterion for reviewers. The Luna gate returns exactly one
token, `escalate` or `proceed`; there is no gate for health findings.
`escalate` opens a decision token, sends its message, and exits without waiting
for a reply. `proceed` does not override a validated blocker. `worker_done`
names the PR, head, action, GitHub receipt or opened token. The driver alone
writes the run record.

## Decision tokens

Store `decisions/<token>.json`, where `<token>` contains at least 96 random
bits as lowercase hex, produced for example by `openssl rand -hex 16`.
Immutable bound fields are written once: `repo`, `pr`, `head`, `base`,
`action` (`approve-verdict`, `request-changes-verdict`, or `push`), plus exact
`body` and `commit` for verdicts or `candidate_sha`, `head_branch`, and
`expected_remote_head` for a push. Mutable fields are `state`, `created_at`,
`decided_at`, `decided_message_id`, `consumed_at`, `receipt`, `send`, and
`reason`. Never delete a token file.

Lifecycle has one named writer per transition, each by temp file + rename:

| transition | writer |
| --- | --- |
| create `open` | the agent that escalated |
| `open → approved` / `open → rejected` | the Hermes script only |
| `approved → spent` / `approved → stale` | the driver only |
| `rejected → closed` | the driver only |
| `spent` + `receipt` | the driver only |

### Opening

Before opening a `push` token, the repair agent pins its candidate with local
ref `refs/axstack/decisions/<token>` in the project clone, so the candidate
survives worktree removal. It then sends one
`hermes send --to telegram` message naming the PR, criterion, every reviewer's
reason, and the exact replies `/axstack-decide approve <token>` and
`/axstack-decide reject <token>` (the slash form loads the Hermes skill
deterministically; bare `approve <token>` is best effort). Store the
send receipt. The driver retries a `failed` send once next tick and reconciles
an `uncertain` send against Hermes output before any retry.

The Hermes gateway's fixed `axstack-decide` script accepts only those two exact
commands. It validates the private user/channel configuration on every call,
restricts tokens to `^[0-9a-f]{24,}$`, locks and re-reads an `open` token,
writes only its decision fields by temp file and rename, and prints one line.
Hermes never runs `gh`, `git`, or `orca`.

### Consuming

The driver is the only consumer. Immediately before acting it re-reads that
`state == approved`, then revalidates open/unmerged state, bound head/base,
absence of a self review for a verdict, or expected remote head plus reachable
candidate for a push. It writes `spent` before the GitHub call, executes
exactly the bound action with no second gate, then stores the receipt. A spent
token without a receipt is
reconciliation: match the exact review commit/body or destination
ref/candidate on GitHub; record a match, or the driver retries once under the
same approval after proving non-execution, or hold ambiguity. A revalidation
failure writes `stale`
with the reason and drops the PR's head from `cursor.json`; the driver never
mints a token. Close rejected files and skip that head. After `spent` or
`stale`, delete the candidate ref. Tokens do not expire; the watchdog reports
one open longer than 24 h.

## Watchdog

The hourly shell precheck only reads `cursor.json`, `precheck.log`,
`decisions/`, and `orca automations runs --id <driver>`. It performs exactly
these four checks and always exits non-zero, so no model session launches:

| check | trips when |
| --- | --- |
| driver stuck | a `changed` or `due` precheck is older than 1 h with no later `tick_done_at`, including a driver that never wrote `tick_started_at` (Orca run status alone is not evidence of completion) |
| precheck failing | the last three `precheck.log` entries are `error` |
| worker stuck | a dispatch marker is older than 3 h 30 min and remains uncleared |
| decision waiting | an `open` decision is older than 24 h |

Each trip is `(check, first_observed)`. Write one JSON line per tick to
`watchdog.log` with `{ts, checks, trips, sent}` and send each occurrence once
through `hermes send --to telegram`. Persist `sent`, `failed`, or `uncertain`;
retry `failed` next tick and reconcile `uncertain` before retry. Re-send only
after the check was observed clear and later recurs. Unreadable evidence is an
`unknown` occurrence. A healthy tick writes its line and sends nothing. There
is no gate for health findings.

## Run directory

The driver and watchdog run from the host's `root` folder workspace, not a
project worktree: no project owns the automation, and every slot worktree
belongs to the project it serves. That workspace is not a git repository, so
the run directory is private host state, one
`~/.local/share/axstack/runs/<run id>/` directory. Settlement leaves nothing
behind, but never destroys work. Before any destructive step the driver
proves the slot is disposable: the worker is settled — on the release path
a settled release receipt, on the abandon path an accepted abandon receipt,
either with proven process exit; pending or unknown stops here — the
worktree's HEAD is either the pinned head or a candidate that is durably
reachable — pushed to the head branch, tested only after a successful
targeted fetch of that exact remote branch into a per-dispatch ref, never
`FETCH_HEAD`, so neither a stale tracking ref nor a concurrent fetch in the
shared clone can fake durability, a failed fetch retaining the worktree — or held by a
`refs/axstack/decisions/<token>` ref in the project clone; and, on the
abandon path, the worktree has no uncommitted changes.
Only then it closes any terminal tab still listed, resets the slot to the
pinned head, clears untracked artefacts, and verifies the slot is clean, so
it is back in the pool. On the settled path
the worker has finished, so untracked files are artefacts by definition and
are cleared; a candidate there is already pushed or token-held. A slot
whose release is settled but whose HEAD cannot be proven disposable, and an
abandoned slot that is dirty or holds an unproven candidate, are both
**retained**: named in one `health[]` line with path and SHA, and blocking
only that PR with the user as owner. Retention is mechanical on both paths:
the driver appends `retained_slots[]` `{slot, pr, head, reason}`, which the
free predicate excludes for every PR — a clean, terminal-less slot holding
an unpushed candidate would otherwise look free — and an entry is cleared
only by the user after reconciling the candidate. A dirty slot or a terminal that
outlives its dispatch without such a retention record is a health finding. The run directory contains:

- `cursor.json` — driver only, with these exact keys: `fingerprint`,
  `tick_started_at`, `tick_done_at`, `tick_outcome`, `prs{url: {head, base,
  draft, checks, reviews, last_self_review}}`, `dispatch_markers[]` (`pr`,
  `task_id`, `dispatch_id`, `worktree`, `head`, `started_at`, `reservation`,
  `trigger`), `deferred[]`, `pending_settlement[]`,
  `retained_slots[]` (`slot`, `pr`, `head`, `reason`),
  `repair_caps{url: {expires_at}}`, `abandon_count{head: n}`,
  `processed_reviews[]` (`review_id`, `pr`, `head`, `digest`),
  `deploy_on_push{repo: [branches]}`,
  `legacy_automation_reviews[]`, `health[]`,
  `runtime_refusal{code, first_seen, last_seen}` (absent when no runtime
  hold is open);
- `pending.json`, `precheck.log` — driver precheck only;
- `decisions/<token>.json` — writers assigned by the lifecycle table;
- `watchdog.log` and `watchdog-state.json` (occurrence `first_observed` values
  and send receipts) — watchdog only;
- `progress.md` — driver only, one line per tick plus holds and mention
  readings, with no per-PR prose.

Timestamps are UTC `YYYY-MM-DDTHH:MM:SSZ`; an unparsable timestamp is an
`error` for the precheck and `unknown` for the watchdog, never silently
ignored.

Orca run history is the authoritative log. The launch workspace is the host's
`root` folder workspace, not a project worktree: nobody develops there, it is
not a git repository, and no project owns the automation. The briefs and the
escalation template are read from the axstack checkout at an absolute path
given in the prompt, never relative to the launch workspace. Keep this notification-policy edge in the
run record: `Notification policy` authorizes the token and watchdog sends;
delivery uses [axstack-relay](../../axstack-relay/SKILL.md).

## Safety holds

- Non-Opus or unknown driver identity records a hold and dispatches nothing.
- A GitHub API error makes PR state unknown; never publish or push for it.
- Enumerate deploy-on-push branches from both repair repositories before
  enabling and store them in `cursor.json`; re-check on allowlist changes.
- A later tick observing resolution or an explicit user decision clears a
  hold. Silence never clears one. For a hold caused by an Orca runtime
  refusal — a sub-worker dispatch rejected for depth, a launch capability the
  runtime declines — observing resolution means re-attempting the refused
  operation, once per tick, on the next eligible PR: success clears the hold.
  The hold is keyed on Orca's structured error code (for the depth case,
  `nested_worker_depth_exceeded`), stored in `cursor.json` as
  `runtime_refusal {code, first_seen, last_seen}`; the same code keeps the
  hold and updates `last_seen` without a new health line, a different code is
  a new finding. Prose is never the key. When `worker-start` itself is
  refused after the slot was checked out, there is no worker, so the
  settlement proof does not apply; the driver reads the receipt's `failedStage`
  and `residualResources` first. With no Dispatch and no residual resources
  the no-worker branch applies: the worktree's HEAD must equal the pinned
  head and `git status --porcelain` must be empty, and then the slot is simply
  free again in the same tick; there is nothing to remove.
  With a Dispatch or any residual resource the failed start owns runtime
  state, and retaining alone is not recovery: the driver follows the
  runtime's recovery guide. With a Dispatch: `worker-list` for that run, and
  the row's `nextAction` is an object `{kind, argv}` — a non-empty `argv` is
  run verbatim through the same Orca executable and nothing else, while
  `kind: none` authorizes no action beyond inspection and retention. With
  residual resources but no Dispatch there is no row: the mutation itself is
  recovered through `request-show` on the receipt's request id. The no-worker
  branch applies only after the resources are proven gone. It never retries
  in the same tick. Anything unproven retains the worktree with a health line
  naming the stage and the resources. Persisted configuration such
  as `orca-data.json` is never evidence either way; it is a snapshot that
  lags the live setting, and the driver never reads it.

## Cutover

Perform this order: the new pair exists disabled; the amended skills and
references are installed; C and D are disabled; every old driver and worker
attempt is reconciled to confirmed settlement and each unfinished candidate
is preserved; the old worktree is removed; the old run directory is made
read-only; the new pair is enabled at distinct minutes; the first real driver
tick is recorded. A failure leaves the new pair disabled, and both pairs never
run together. Historical artefacts are untouched.

## Exclusions

No obligations table, supersede counter, or review-budget hold. No `COMMENT`
reviews. No watch deadline or `expired` state. No terminal hygiene or global
busy guard. No terminal nudge from Hermes. No Hermes access to `gh`, `git`, or
`orca`. No re-review of human-placed blocks. No per-project state. No changes
to retired artefacts. No gate for health findings.
