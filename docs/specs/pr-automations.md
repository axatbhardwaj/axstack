# PR automations — specification

Status: revision 4, approved baseline (revision 3 approved by the user on
2026-09-16; revision 4 carries the authored-review corrections of PR #70's
Sol receipt and changes no decision). Supersedes
`docs/specs/orca-automations.md` (revisions 1–5) for the defi-com pair once
approved; that document stays in the tree as history and is not amended
further. Decisions S1–S4 and Q1–Q5 were settled by the user on 2026-09-16 in
the align run record `20260917-automations-simplify`. Revision 1 (`cbd811b`)
received Astra AGREE-WITH-AMENDMENTS (15) and Fable AGREE-WITH-AMENDMENTS (16);
every accepted amendment is absorbed below and the rejected one is named in
"Adviser synthesis". Revision 3 restores review-feedback-triggered repair by
the user's decision of 2026-09-16 (Astra A15). Nothing is enabled until the
acceptance checks pass and the old pair is settled and disabled.

## Purpose

Two native Orca automations keep the user's defi-com pull requests moving with
as little machinery as possible:

- **driver** (every 15 minutes) discovers work on GitHub, and for each PR that
  needs attention creates one Orca worktree in that project's own clone and
  dispatches one Axstack agent there, then exits. It never reviews or repairs in
  its own session. The one GitHub write it performs itself is executing an
  already-approved decision (one `gh pr review` or one fast-forward push of a
  preserved candidate), because that is a mechanical call, not review work.
- **watchdog** (hourly, distinct minute) is a shell precheck with no model. It
  checks four liveness facts and sends one Telegram message when one trips.

Escalations to the user are two-way: a Telegram reply carrying a decision
token is full authority for the action the token names.

Orca owns scheduling, sessions, worktrees, dispatch and run history. GitHub
owns PR, review and head state. Axstack owns policy and a small run record.
There is no obligations table, no review-budget hold, no watch deadline, no
terminal hygiene and no global busy guard.

## Identity and scope

- **Self** is `gh api user --jq .login`, resolved on every run, never
  hardcoded.
- **Review allowlist:** `defi-com/monorepo`, `defi-com/mobile`,
  `defi-com/azure-next-hybrid`, `defi-com/ci-workflows`. **Repair allowlist:**
  `defi-com/monorepo`, `defi-com/mobile`. Both are stated verbatim in the
  driver's automation prompt. `defi-com/azure-next-hybrid` and
  `defi-com/ci-workflows` own PRs are recorded and never repaired or pushed
  to. Outside both lists the driver records only, and such PRs never
  enter the fingerprint.
- **Own PR:** open, authored by self, on the repair allowlist, not a draft.
  Authority equals the user at the keyboard: repair, test, commit,
  fast-forward `git push` (no lease, no force).
- **Peer PR:** open, on the review allowlist, authored by someone other than
  self, and either self is officially review-requested or a comment by someone
  other than self contains `@<self>` together with a request to review or
  respond (review, PTAL, respond, "can you look"); the driver session judges
  the comment and records its id and reading in `progress.md`. An incidental
  mention is discovery data. Peer code is read-only; the review agent may
  install dependencies and run the repository's tests in its worktree (Q4).
- **Prohibited everywhere:** force-push, rebase, merge, close, any `gh stack`
  sync/restack/rebase/merge/link/submit, `COMMENT` reviews, and any GitHub
  write by the watchdog or by Hermes. A need for one is a recorded hold.

## Discovery and wake (driver precheck, shell, no model)

The precheck runs every 15 minutes and exits 0 only when there is work.

1. **Overlap guard.** If `cursor.json.tick_started_at` is newer than
   `tick_done_at` and younger than 1 h, log `running` and exit 3. This guards
   the driver against itself only; it inspects no terminal.
2. Resolve self. Run four searches with
   `gh search prs --state open --limit 100 --json url,number,repository,updatedAt`:
   `--author @me`, `--review-requested @me`, `--mentions @me`, and
   `--reviewed-by @me --review changes_requested`. A count equal to the limit
   is a truncation, logged `error`, exit 2, fingerprint not written.
   Deduplicate by URL, own-PR first, and drop every PR outside the union of the
   two allowlists.
3. For each allowlisted PR run
   `gh pr view --json headRefOid,baseRefName,isDraft,statusCheckRollup,author,latestReviews`;
   base SHA via `gh api repos/<repo>/commits/<base>`. Own PRs contribute head,
   base, draft, the check rollup reduced to `{name, conclusion|state}` pairs,
   and the set of `latestReviews` `{id, state}` whose `commit` is the head, so
   a new `CHANGES_REQUESTED` on an unchanged head changes the fingerprint;
   every other PR contributes head and base.
4. **Debounce.** A peer or fourth-search head enters the hashed subset only on
   the second consecutive precheck that observes it; the first observation is
   recorded in `pending.json.seen[]` and not hashed. Own heads are hashed
   immediately. Hash the subset: the **fingerprint**.
5. **Due control work**, read from `cursor.json` and `decisions/`: a decision
   file in state `approved` or `rejected` without `consumed_at`; a `spent`
   file without a receipt (reconciliation); an entry in `deferred[]` whose head
   still matches discovery; an expired repair cap; a dispatch marker older
   than 3 h; an unsettled Orca delivery recorded in `pending_settlement[]`.
   `open` decisions alone are not due; they wait for the user.
6. Write `pending.json` (fingerprint, observed_at, `seen[]`, full discovery
   list, the hashed subset). Append `<ts> changed|due|unchanged|running|error`
   to `precheck.log`. Exit 0 on `changed` or `due`, 1 on `unchanged`.

## Driver tick

The driver session (Opus, fresh session, launched in the host's `root`
folder workspace) does the following in order and exits.

1. If `tick_started_at` is newer than `tick_done_at`, append
   `previous tick did not finish` to `cursor.json.health[]`. Write
   `tick_started_at`. Validate the effective identity with Orca runtime
   inspection (`orca automations runs --id <driver>` terminalPtyId matched to
   this session's `ORCA_TERMINAL_HANDLE`, plus the harness transcript model);
   non-Opus or unknown records a hold and exits with `tick_outcome: held`.
2. Bind the persistent orchestration Run with `orca orchestration run-use`.
   Read the inbox. For every `worker_done` whose Task and Dispatch match a
   live dispatch marker: verify its GitHub receipt (review id at the head, or
   push range) or its opened token; release the worker; once the release
   receipt is settled and the runtime reports the process exited, run the
   cleanup defined under "Run directory and state", which proves the worktree
   disposable before removing it; clear the marker. A delivery that cannot be
   verified stays in `pending_settlement[]` and blocks only that PR.
3. **Consume decisions** (the driver is the only consumer; see below).
4. **Expired markers** (older than 3 h): run the runtime's inspection; if the
   worker is live, `worker-stop`; if exited, `worker-abandon`; if liveness is
   unknown or the terminal reports user takeover, retain both worktree and
   marker and block only that PR. An abandon is confirmed by its accepted
   abandon receipt plus proven process exit — there is no release receipt on
   this path. After a confirmed abandon, run the same cleanup with its extra
   clean-tree condition (a dirty or unproven worktree is retained, not
   removed), write one `health[]` line, increment `abandon_count` for that
   head, drop the head from `cursor.json`, and remove the triggering review id
   and digest from `processed_reviews[]` when the dispatch was review-triggered,
   so the PR is retried once through the normal path; a second abandon at the
   same head is a hold, owner user.
5. For each PR whose head, base, draft flag, checks or review state differ
   from `cursor.json`, plus every `deferred[]` entry, in `updatedAt` order,
   oldest first. A PR with a decision file in state `open` or `approved` at its
   current head, or a live dispatch marker, is skipped.
   - **Own PR needing repair** — two triggers, either suffices:
     (a) a failing check whose counterpart on the base commit is observed
     passing, where the counterpart is the base check-run with the same
     `name` **and** the same producing `app.id` (from
     `gh api repos/<repo>/commits/<base>/check-runs`; for a legacy commit
     status, the same `context`); a missing, pending, or same-name
     different-app base check holds the repair; (b) a `CHANGES_REQUESTED`
     review at the current head, by any account, whose review id is not in
     `cursor.json.processed_reviews[]` and whose body digest (sha256 of the
     body) is not already recorded against that PR at that head — both keys
     are required, because a bot that re-posts the same finding under a new
     review id must not re-trigger. Eligible only when additionally: the head
     branch is not in the repository's recorded deploy-on-push set; no live
     repair cap; and it is the lowest PR of its stack that needs repair (an
     own PR whose base branch equals another own PR's head branch is a
     descendant). Create an Orca child worktree of the project clone at the
     head, parented to that project's primary worktree so it appears under
     the project it serves, and dispatch **one**
     `axstack-watch` agent in authored repair mode with the triggering check
     or review findings in its brief; the agent addresses only those findings.
     Record the review id and body digest as processed at dispatch. Each open
     descendant records one `pending restack` hold, owner user, cleared when
     the descendant stops needing repair. The 24 h repair cap starts at
     dispatch and is not refunded by an abandon.
   - **Peer PR** whose debounced head self has not reviewed (read
     `gh pr view --json reviews` first) — create an Orca child worktree at the
     head and dispatch **one** `axstack-review` agent in peer mode. Whenever
     any self review with state `CHANGES_REQUESTED` exists on the PR, from
     whichever search it came, dispatch only if the latest effective,
     non-dismissed self review body contains the line prefix
     `<!-- axstack-automation verdict` or its id is listed in
     `cursor.json.legacy_automation_reviews[]`; otherwise record and skip, so
     a human-placed block is never overwritten. The brief links the prior
     review.
   - Record a **dispatch marker** per PR: task id, dispatch id, worktree,
     head, started_at, reservation (`verdict` or `repair`), and `trigger`
     (`{kind: check, name, app_id}` or `{kind: review, review_id, digest}`),
     so abandon recovery can un-process exactly the triggering review. At most one live
     marker per PR; the marker is the per-PR claim shared by scheduled and
     attended sessions, and revalidation immediately before the external call
     is the second half of it. No exactly-once claim is made against
     concurrent human GitHub actions.
6. **Budgets:** one `verdict` dispatch per tick, oldest first; at most six
   `repair` markers live at once across all repositories; one repair per PR
   per 24 h. Every eligible PR not dispatched on budget is written to
   `deferred[]` (repo, pr, head) and stays due. Reaching a budget records the
   count; it is not a hold.
7. Promote the `pending.json` fingerprint verbatim (it records observation,
   never completion), write `tick_done_at` and `tick_outcome: ok`, exit.

## Agents in worktrees

Each dispatched agent runs in its own Orca child worktree under
the Orca workspaces directory for `<repo>`, pinned to the exact head, with that
project's primary worktree as parent, and reports through the Orca worker
protocol only.

- `axstack-review`, peer mode: two isolated reviewers
  (`axstack-reviewer-primary` Sol, `axstack-reviewer-secondary` Opus, identical
  brief), Luna gate, then a binding verdict. `APPROVE` requires complete
  reviews at the exact head and base, gate `proceed` and zero validated
  blocking findings; `REQUEST_CHANGES` requires the same completeness, gate
  `proceed` and at least one validated blocking finding with evidence and
  consequence. `INCOMPLETE`, unresolved disagreement, an unavailable reviewer
  or gate, or unknown GitHub state publishes nothing and reports a hold.
  Immediately before `gh pr review` the agent re-reads self's reviews at the
  head and skips with the existing id if one exists, and re-checks head, base,
  draft status, authorship and allowlist. The verdict body ends with the marker
  line `<!-- axstack-automation verdict head=<sha> -->`. The body is
  written for the person reading the PR and reads as one reviewer's findings:
  it never names the reviewer count, the brief, the angles, the gate, receipts,
  or which reviewer found what; every validated finding, blocking or not,
  appears in full with evidence and consequence, file and line where they
  exist, and none is dropped for brevity; it never points at the local review
  file or anything the reader cannot open; evidence is stated as what was
  checked and observed — reviewed head and base, CI status, test counts and
  diff size belong, "shape verified" and "pinned CI" do not — and the marker
  line is the only pipeline artefact it carries. Settled 2026-09-17 after a
  colleague pointed at two live reviews: #1092 narrated "two independent
  reviews, identical brief, all six angles"; #1102 referred to "two minor
  maintainability notes" that appeared only in the local review file. The local review file
  is written to the workspace review directory `~/defi/misc/reviews/` under the
  existing convention: `review-PR-<num>.html` with no prefix means
  `defi-com/monorepo`; `review-mobile-PR-<num>.html`,
  `review-azure-next-hybrid-PR-<num>.html` and `review-ci-workflows-PR-<num>.html`
  for the others. A write failure is
  recorded, never withholds the verdict.
- `axstack-watch`, authored repair mode: candidate committed locally, one Sol
  reviewer at the local SHA, Luna gate, zero unresolved validated blockers,
  recorded test evidence (`~/.bun-1.2.2/bin/bun` unit gate for monorepo; a
  suite that cannot run locally is a recorded unverified boundary), remote
  readback (head, base, draft, deploy-on-push set, allowlist), then
  fast-forward push. `escalate` opens a decision token instead of pushing.
- Every reviewer brief ends with the required
  `Escalate to user: yes | no — <criterion> — <reason>` field. Criteria for
  PR work, exactly three: a security concern; a permanent on-chain state
  change; an architectural change in approach. The gate returns exactly one of
  `escalate` / `proceed`.
- `escalate` → the agent opens a token (below), sends the message, and exits;
  it never waits for the reply. Its `worker_done` names the PR, head, action
  taken, GitHub receipt (review id or push range) or the token it opened.
  The driver, not the agent, writes the run record.

## Two-way decisions (Telegram via Hermes)

**Token file.** `decisions/<token>.json`, `<token>` = at least 96 random bits
as lowercase hex (`openssl rand -hex 16`). Immutable bound fields, written
once at creation: `repo`, `pr`, `head`, `base`, `action`
(`approve-verdict` | `request-changes-verdict` | `push`), and for verdicts the
exact `body` and `commit`; for pushes `candidate_sha`, `head_branch`,
`expected_remote_head`. Mutable fields: `state`, `created_at`, `decided_at`,
`decided_message_id`, `consumed_at`, `receipt`, `send` (message_id and
sent/failed/uncertain), `reason`. Files are never deleted.

**Lifecycle, one named writer per transition, each by temp file + rename:**

| transition | writer |
| --- | --- |
| create `open` | the agent that escalated |
| `open → approved` / `open → rejected` | the Hermes script only |
| `approved → spent` / `approved → stale` | the driver only |
| `rejected → closed` | the driver only |
| `spent` + `receipt` | the driver only |

**Opening.** Before creating a `push` token the agent creates the local ref
`refs/axstack/decisions/<token>` at the candidate in the project clone, so the
candidate survives worktree removal; the driver deletes the ref after `spent`
or `stale`. The agent then sends one `hermes send --to telegram` message
naming the PR, the criterion, every reviewer's reason, and the two replies:
`/axstack-decide approve <token>` and `/axstack-decide reject <token>` (the
slash form loads the skill deterministically; the bare `approve <token>` form
is accepted but depends on the gateway agent choosing the skill). The send receipt is stored in the file;
a `failed` send is retried once by the driver next tick, an `uncertain` one is
reconciled against `hermes` output before any retry.

**Receiving.** The Hermes gateway carries an `axstack-decide` skill whose
entire instruction is: when invoked as `/axstack-decide approve|reject <token>`,
or when a message's own text is exactly `approve <token>` or `reject <token>`,
run `~/.hermes/scripts/axstack-decide <token> <verb>` and
relay its one-line result; do nothing else and never run `gh`, `git` or
`orca`. The script, on every call:

- reads the gateway configuration and exits 4 unless `TELEGRAM_ALLOWED_USERS`
  is exactly the user's id and the Telegram home channel is a private chat
  (`chat_id == user_id`); if the runtime exports a sender or chat id to the
  subprocess, it must additionally equal the user's id (acceptance verifies
  which variables exist);
- resolves only `<run dir>/decisions/<token>.json` where `<token>` matches
  `^[0-9a-f]{24,}$`; anything else exits 2 without I/O;
- requires `state: open` under a per-token lock, re-reading inside the lock;
  a spent, decided, unknown or malformed token exits 3;
- writes `state`, `decided_at` and the message id when present, and prints one
  line, exit 0.

Authentication is the Hermes gateway's allowlist, enforced before any agent
turn, plus the script's own equality check of `HERMES_SESSION_USER_ID` and
`HERMES_SESSION_CHAT_ID` against the configured user id; the gateway exports
these (and `HERMES_SESSION_CHAT_TYPE`, observed but not checked) to the script,
verified at cutover under acceptance 8. The token is the capability. A
group source is never valid; the runtime config check above fails closed if
the home channel stops being private.

**Consuming (driver only).** For each `approved` file the driver revalidates,
immediately before acting: the PR is open and not merged; head and base equal
the bound values; for verdicts no self review exists at that head; for pushes
the remote head equals `expected_remote_head` and `candidate_sha` is
reachable; the file is `approved`. It then writes `spent` **before** the
GitHub call, performs exactly the bound action with no second gate, and stores
the receipt. A `spent` file without a receipt is reconciliation work: the
driver matches the exact bound review commit and body, or the exact
destination ref and candidate SHA, on GitHub; a match records the receipt, a
proven non-execution retries once under the same approval, and anything
ambiguous stays held with the reason. Any revalidation failure marks the file
`stale` with the reason and drops the PR's head from `cursor.json` so the PR
re-enters the normal path (new agent, new gate, new token if it escalates
again); the driver never mints a token itself. A `rejected` file becomes
`closed`; the PR is skipped at that head. Approval authorizes only its bound
action; it waives none of the invariants above.

Tokens do not expire. The watchdog reports one older than 24 hours.

## Watchdog (hourly, shell precheck only)

The watchdog automation's precheck performs the whole check and always exits
non-zero, so no agent session is ever launched. It reads `cursor.json`,
`precheck.log`, `decisions/` and `orca automations runs --id <driver>`:

| check | trips when |
| --- | --- |
| driver stuck | a `changed`/`due` precheck line older than 1 h with no later `tick_done_at`, including a driver that never wrote `tick_started_at` (Orca run status alone is not evidence of completion) |
| precheck failing | the last three `precheck.log` lines are `error` |
| worker stuck | a dispatch marker older than 3 h 30 min that the driver has not cleared |
| decision waiting | a `decisions/*.json` in state `open` older than 24 h |

Each trip is an occurrence `(check, first_observed)`; it is recorded once in
`watchdog.log` (one JSON line per tick, `{ts, checks, trips, sent}`), sent
once through `hermes send --to telegram` with the send receipt persisted
(`sent` | `failed` | `uncertain`; `failed` retries next tick, `uncertain`
reconciles first), and re-sent only as a new occurrence after the check has
been observed clear. Evidence that cannot be read is an `unknown` occurrence,
never `ok`. A healthy tick writes its line and sends nothing. There is no gate
for health findings.

## Run directory and state

The driver and watchdog run from the host's `root` folder workspace rather
than an axstack worktree, so no project owns the automation and each child
worktree nests under the project it serves (settled by the user on
2026-09-17). That workspace is not a git repository, so the run directory is
private host state, `~/.local/share/axstack/runs/<run id>/`, and holds:

- `cursor.json` — driver only, with these exact keys because the precheck
  and the watchdog read them: `fingerprint`, `tick_started_at`,
  `tick_done_at`, `tick_outcome`, `prs{url: {head, base, draft, checks,
  reviews, last_self_review}}`, `dispatch_markers[]` (`pr`, `task_id`,
  `dispatch_id`, `worktree`, `head`, `started_at`, `reservation`, `trigger`),
  `deferred[]`, `pending_settlement[]`, `repair_caps{url: {expires_at}}`,
  `abandon_count{head: n}`, `processed_reviews[]` (`review_id`, `pr`, `head`,
  `digest`), `deploy_on_push{repo: [branches]}`,
  `legacy_automation_reviews[]`, `health[]`. Timestamps are UTC
  `YYYY-MM-DDTHH:MM:SSZ`; an unparsable timestamp is an `error` for the
  precheck and `unknown` for the watchdog, never silently ignored.
- `pending.json`, `precheck.log` — driver precheck only.
- `decisions/<token>.json` — per the lifecycle table.
- `watchdog.log` and `watchdog-state.json` (occurrence `first_observed` values
  and send receipts) — watchdog only.
- `progress.md` — driver only, one line per tick plus holds and mention
  readings; no per-PR prose.

Orca run history is the authoritative log. The launch workspace is the host's
`root` folder workspace: nobody develops there, it is not a git repository,
and no project owns the automation. Briefs and the escalation template are
read from the axstack checkout at an absolute path given in the prompt. After
a worker settles the driver releases it and, once the worker is settled (a settled
release receipt, or on the abandon path an accepted abandon receipt, either
with proven process exit) and the worktree is proven disposable — HEAD is the
pinned head or a candidate durably reachable by push, tested only after a
successful targeted fetch of that exact remote branch into a per-dispatch
ref (never `FETCH_HEAD`, which a concurrent fetch in the shared clone can
replace) with a failed fetch retaining the worktree, or by a `refs/axstack/decisions/<token>` ref, and on
the abandon path there are no uncommitted changes — closes any
terminal tab still listed, clears untracked artefacts, removes the child
worktree and its directory, deletes the branch the worktree created, and
verifies the directory is gone. An abandoned worktree that is dirty or holds
an unproven candidate is retained, recorded in `health[]` with path and SHA,
and blocks only that PR with the user as owner. Anything else that outlives
its dispatch is a health finding (settled by the user on 2026-09-17).

## Safety holds

- Non-Opus or unknown driver identity: no dispatch that tick, recorded.
- GitHub API error: PR state unknown, nothing is pushed or published for it.
- Deploy-on-push: the set is enumerated from each repository's workflow files
  at enabling, stored in `cursor.json`, and re-verified on any allowlist
  change; a repair never pushes to a head branch in that set.
- A hold is cleared only by a later tick observing the condition resolved or
  by the user; silence never clears a hold.

## Acceptance before enabling

Fixtures are the run directory and, where GitHub is involved, read-only calls
against live PRs; no production PR is mutated to manufacture a test case.

1. Precheck: the literal production command returns the current open
   allowlisted PRs, logs one line, exit codes match the table; a forced
   truncation logs `error` and writes no fingerprint; a synthetic
   `tick_started_at` newer than `tick_done_at` logs `running`.
2. Debounce and deferral: a new peer head is hashed only on its second
   consecutive observation; a two-PR verdict backlog drains one per tick
   through `deferred[]` with GitHub unchanged.
3. Follow-up rule: the fourth search returns monorepo#1092, #1108 and
   mobile#1; with their review ids in `legacy_automation_reviews[]` they are
   eligible and the human-placed blocks (#884, #740, #576, #512,
   azure-next-hybrid#198) are skipped; a dismissed block and a self-approved
   PR are skipped.
4. Driver tick on a test fingerprint: one child worktree in the correct clone
   at the exact head, one dispatch, one marker, fingerprint promoted verbatim,
   `tick_done_at` written; the first tick over a backlog dispatches at most
   the live-repair cap.
5. Fresh session: `run-use` binds the persistent Run, a `worker_done` left by
   a previous tick is verified, the worker released and its worktree removed
   only after confirmed exit.
6. Idempotence: a second dispatch for a head self already reviewed is skipped
   with the review id recorded; an agent that finds a self review immediately
   before submitting skips.
7. TTL: a marker back-dated 3 h with a live worker is stopped; with an exited
   worker abandoned and cleaned; with unknown liveness or user takeover
   retained; a second abandon at one head becomes a hold.
8. Decision round trip: a test token bound to a nonexistent head is sent to
   Telegram; the user types `approve <token>`; the script writes `approved`;
   the driver revalidates, marks it `stale` with the reason and drops the head;
   a second `approve` exits 3; a malformed token exits 2 with no file touched;
   `TELEGRAM_ALLOWED_USERS` equals the user's id, the home channel is private,
   and the script exits 4 when either is changed; the set of Hermes runtime
   variables visible to the script is recorded. The `spent` path is proven by
   the first real escalation and recorded in `progress.md`.
9. Push token: a candidate ref created by an agent survives worktree removal
   and is deleted after `stale` and after `spent`.
10. Watchdog: each check tripped artificially sends exactly one message and
    writes one occurrence; a repeated tick sends nothing; a healthy tick sends
    nothing and exits non-zero; a never-started driver after a `changed` line
    trips `driver stuck`; repeated non-zero prechecks do not cause Orca to
    disable the automation.
11. Deploy-on-push sets are present in `cursor.json` for both repair
    repositories before enabling.
12. Feedback repair dedup: a `CHANGES_REQUESTED` review at a head triggers one
    dispatch; the same review id, or a new id with an identical body digest at
    that head, triggers nothing; a superseded head with a new review triggers
    again subject to the 24 h cap. A new `CHANGES_REQUESTED` on an own PR with
    an unchanged head changes the precheck fingerprint (`changed`); an
    abandoned review-triggered dispatch is retried once and its second abandon
    is a hold. A failing check whose base counterpart (same `name` and
    `app.id`) is absent or pending holds the repair, and a same-name base
    check-run from a different app does not authorize it.
13. Cutover, in this order: the new pair exists disabled; the amended skills
    and references are installed so no agent loads the superseded rules;
    automations C and D are disabled; every old driver and worker attempt is
    reconciled to confirmed settlement and any unfinished candidate preserved;
    the old worktree is removed and the old run directory made read-only; the
    new pair is enabled at distinct minutes; the first real driver tick is
    recorded. A failed cutover leaves the new pair disabled; both pairs never
    run together. Pair A/B artefacts are untouched.

## Adviser synthesis (round 1 on revision 1)

Accepted from both: search field fix (A1); debounce/deferral wake (A2, F1,
F2); single consumer and lifecycle table (A3, F3); preserved push candidate
(A6, F4); no driver-minted token, retry-once then hold (F5); overlap guard
(F6); marker rule across all searches with legacy ids (A9, F7); skip while a
decision is pending (F8); agent-side re-read (F9); live-repair cap and cap
start (A11, F10, F11); TTL with confirmed exit and takeover retention (A8);
spent-without-receipt reconciliation (A5); per-PR claim wording (A7);
publication preconditions restated (A10); gateway boundary re-checked at
runtime and acceptance for group/edited sources (A12, F13); watchdog
never-started driver and send receipts (A13); worker-stuck at 3 h 30 (F12);
non-mutating acceptance 8 (F14); named procedures (F15); crashed-tick health
line (F16); cutover settlement order (A14); base-check evidence (A15).

Rejected: A4's "driver assigns one agent to execute the approved action" —
the bound action is one mechanical GitHub call; a second dispatch per decision
adds a worker, a worktree and a settlement for no safety gain, so the driver
executes it itself and the Purpose section says so. A15's request to retain
review-feedback-triggered repair was surfaced to the user at revision 2 and
accepted: revision 3 restores it with id + body-digest dedup.

## Exclusions

No COMMENT reviews. No obligations table, supersede counter or review-budget
hold. No watch deadline or `expired` state. No terminal hygiene or global busy
guard. No terminal nudge from Hermes. No Hermes access to `gh`, `git` or
`orca`. No re-review of human-placed blocks. No per-project state. No changes
to the retired pair A/B artefacts. No Luna gate for health findings.
