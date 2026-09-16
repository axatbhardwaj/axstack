# PR automations — specification

Status: revision 1, draft for user approval. Supersedes
`docs/specs/orca-automations.md` (revisions 1–5) in full once approved; that
document stays in the tree as history and is not amended further. Decisions
S1–S4 and Q1–Q5 were settled by the user on 2026-09-16 in the align run record
`20260917-automations-simplify`; adviser receipts (Astra, Fable, both
AGREE-WITH-AMENDMENTS) are cached there. Nothing is enabled until the
acceptance checks pass and the old pair is disabled.

## Purpose

Two native Orca automations keep the user's defi-com pull requests moving with
as little machinery as possible:

- **driver** (every 15 minutes) discovers work on GitHub, and for each PR that
  needs attention creates one Orca worktree in that project's own clone and
  dispatches one Axstack agent there, then exits. It never reviews or repairs in
  its own session.
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
  `defi-com/azure-next-hybrid`. **Repair allowlist:** `defi-com/monorepo`,
  `defi-com/mobile`. Both are stated verbatim in the driver's automation
  prompt. `defi-com/azure-next-hybrid` own PRs are recorded and never repaired
  or pushed to. Outside both lists the driver records only.
- **Own PR:** open, authored by self, on the repair allowlist, not a draft.
  Authority equals the user at the keyboard: repair, test, commit,
  fast-forward `git push` (no lease, no force).
- **Peer PR:** open, on the review allowlist, self officially review-requested,
  or a PR comment that explicitly asks self to review or respond. An incidental
  mention is discovery data. Peer code is read-only; the review agent may
  install dependencies and run the repository's tests in its worktree (Q4).
- **Prohibited everywhere:** force-push, rebase, merge, close, any `gh stack`
  sync/restack/rebase/merge/link/submit, `COMMENT` reviews, and any GitHub
  write by the watchdog or by Hermes. A need for one is a recorded hold.

## Discovery and wake (driver precheck, shell, no model)

The precheck runs every 15 minutes and exits 0 only when there is work.

1. Resolve self. Run four searches with
   `gh search prs --state open --limit 100 --json url,number,repository,updatedAt,headRefOid`:
   `--author @me`, `--review-requested @me`, `--mentions @me`, and
   `--reviewed-by @me --review changes_requested`. A count equal to the limit
   is a truncation and is logged `error`. Deduplicate by URL, own-PR first.
2. For each allowlisted own PR add head SHA, base SHA, draft flag and the check
   rollup. For each allowlisted peer PR and each PR from the fourth search add
   the head SHA. Hash that set: the **fingerprint**.
3. Due control work, read from `cursor.json`: a decision file in `decisions/`
   whose `state` is `open`; a repair cap that has expired; a dispatch marker
   older than its TTL (below). Any of these wakes the driver with an unchanged
   fingerprint.
4. Write `pending.json` (fingerprint, observed_at, full discovery list, the
   hashed subset). Append `<ts> changed|due|unchanged|error` to `precheck.log`.
   Exit 0 on `changed` or `due`.

**Debounce:** a peer head is reviewable only when it was unchanged across two
consecutive prechecks, so a push storm costs one review.

## Driver tick

The driver session (Opus, fresh session, launched in the dedicated
automations worktree) does the following and exits.

1. Write `tick_started_at` to `cursor.json`. Validate its effective identity
   through Orca runtime inspection; a non-Opus or unknown identity records a
   hold and exits with `tick_done_at` and `tick_outcome: held`.
2. Bind to the persistent orchestration Run for these automations with
   `orca orchestration run-use`; read the inbox; settle every `worker_done`
   from previous ticks (verify the GitHub receipt, release the worker, remove
   its child worktree, clear its dispatch marker).
3. Consume open decision files (see "Two-way decisions").
4. For each PR in `pending.json` that differs from `cursor.json`, in
   `updatedAt` order, oldest first:
   - **Own PR with a failing check** (not failing on the base, head branch not
     in the repository's deploy-on-push set, no live repair cap, lowest failing
     PR of its stack): create an Orca child worktree of the project clone at the
     head, parented to the driver worktree, and dispatch **one** `axstack-watch`
     agent (authored repair mode: its own Sol reviewer and Luna gate, then
     fast-forward push). Descendants in the same stack get a `pending restack`
     hold, owner user, cleared when the descendant stops failing.
   - **Peer PR** whose head is debounced and which self has not already
     reviewed at that head (read `gh pr view --json reviews` first; GitHub is
     the lock): create an Orca child worktree at the head and dispatch **one**
     `axstack-review` agent in peer mode (two isolated reviewers, Luna gate,
     binding verdict, local review file). A PR from the fourth search is
     re-dispatched only when the latest self review at any head carries the
     automation marker in its body; a human-placed block is never re-reviewed.
     The brief links the prior review.
   - Record a **dispatch marker** per PR: task id, dispatch id, worktree,
     head, started_at. At most one live marker per PR.
5. Budgets: one binding verdict dispatched per tick (oldest first, the rest
   wait), one repair per PR per 24 hours, six pushes per tick across all
   repositories. Reaching a budget records the count; it is not a hold.
6. Promote the `pending.json` fingerprint verbatim, write `tick_done_at`,
   `tick_outcome: ok`, and exit.

**Dispatch marker TTL is 3 hours, per PR.** On the next tick after expiry the
driver runs `worker-abandon` (or `worker-stop` if live), removes the child
worktree, writes one health line to `cursor.json.health[]`, and clears the
marker. A dead worker never blocks any other PR and never blocks the driver.

**Concurrency:** no busy guard. An attended session coexists with the
schedule because every GitHub action is idempotent on (PR, head, self):
verdicts skip an existing self review at that head; pushes are fast-forward.

## Agents in worktrees

Each dispatched agent runs in its own Orca child worktree under
`/root/orca/workspaces/<repo>/`, pinned to the exact head, with the driver
worktree as parent. It reports through the Orca worker protocol only.

- `axstack-review`, peer mode: two isolated reviewers (`axstack-reviewer-primary`
  Sol, `axstack-reviewer-secondary` Opus, identical brief), Luna gate, then a
  binding verdict. `APPROVE` requires gate `proceed`, a current base and zero
  validated blocking findings; `REQUEST_CHANGES` requires gate `proceed` and at
  least one validated blocking finding with evidence and consequence. `escalate`
  submits nothing and opens a decision token (below). The verdict body ends
  with the automation marker line `<!-- axstack-automation verdict head=<sha> -->`.
  The local review file `~/defi/misc/reviews/review[-<repo>]-PR-<num>.html` is
  written; a write failure is recorded, never withholds the verdict.
- `axstack-watch`, authored repair mode: candidate committed locally, one Sol
  reviewer at the local SHA, Luna gate, remote readback, fast-forward push.
  `escalate` opens a decision token instead of pushing.
- Every reviewer brief ends with the required
  `Escalate to user: yes | no — <criterion> — <reason>` field. Criteria for
  PR work, exactly three: a security concern; a permanent on-chain state
  change; an architectural change in approach. The gate returns exactly one of
  `escalate` / `proceed`.
- The agent's `worker_done` names the PR, head, action taken, GitHub receipt
  (review id or push range) or the token it opened. The driver, not the agent,
  writes the run record.

## Two-way decisions (Telegram via Hermes)

**Opening a token.** On gate `escalate` the agent generates a token of at
least 96 random bits (`openssl rand -hex 12` or stronger), writes
`decisions/<token>.json` with `state: open`, `created_at`, `repo`, `pr`,
`head`, `base`, `action` (`approve-verdict` | `request-changes-verdict` |
`push`), the exact review body or push range, the criterion and every
reviewer's reason, and sends one `hermes send --to telegram` message naming
the PR, the criterion, the reasons, and the two replies that resolve it:
`approve <token>` and `reject <token>`. The send receipt (`message_id`,
state) is stored in the decision file. Decision files are never deleted;
spent files keep their outcome.

**Receiving a reply.** The Hermes gateway carries an `axstack-decide` skill
whose entire instruction is: when a message is exactly `approve <token>` or
`reject <token>`, run `~/.hermes/scripts/axstack-decide <token> <verb>` and
relay its one-line result; do nothing else and never run `gh`, `git` or
`orca`. The script:

- resolves only `<run dir>/decisions/<token>.json` where `<token>` matches
  `^[0-9a-f]{24,}$`; anything else exits 2 without I/O;
- requires `state: open`; a spent, unknown or malformed token exits 3;
- writes `state: approved | rejected`, `decided_at`, and the Hermes
  `HERMES_SESSION_MESSAGE_ID` when present, atomically (temp file + rename);
- prints one line and exits 0.

Authentication is the Hermes gateway's own `TELEGRAM_ALLOWED_USERS`
allowlist, enforced before any agent turn, together with the home channel
being the user's private chat (`chat_id == user_id`). Hermes does not export
sender identity to shell subprocesses, so the script cannot re-check it; the
token is the capability and the allowlist is the identity boundary. The
allowlist must contain exactly the user's id at enabling and on every
acceptance re-run. A group chat is never a valid source; if the home channel
is ever changed to a group this feature is disabled by the acceptance check.

**Acting on a decision.** An `approved` file is due work. The driver (or the
still-live agent that opened it) revalidates, immediately before acting, that
the PR is open and not merged, the head and base SHAs equal the bound values,
no self review exists at that head (for verdicts) or the remote head equals the
bound value (for pushes), and the file is still `approved` and unspent. It then
marks the file `spent` **before** the GitHub call, performs exactly the bound
action with no second gate, and stores the GitHub receipt in the file. A crash
between spend and receipt is reconciled next tick by reading self's reviews or
the remote head on GitHub, never by trusting the file. Any revalidation failure
marks the file `stale` with the reason and opens a fresh token if the work is
still due. A `rejected` file closes the hold; the PR is skipped at that head.

Tokens do not expire. The watchdog reports one older than 24 hours.

## Watchdog (hourly, shell precheck only)

The watchdog automation's precheck performs the whole check and always exits
non-zero, so no agent session is ever launched. It reads `cursor.json`,
`precheck.log`, `decisions/` and `orca automations runs --id <driver>`:

| check | trips when |
| --- | --- |
| driver stuck | `tick_started_at` newer than `tick_done_at` and older than 1 h |
| precheck failing | the last three `precheck.log` lines are `error` |
| worker stuck | a dispatch marker older than 3 h that the driver has not cleared |
| decision waiting | a `decisions/*.json` with `state: open` older than 24 h |

Each trip is an occurrence `(check, first_observed)`; it is recorded once in
`watchdog.log` (one JSON line per tick, `{ts, checks, trips, sent}`), sent
once through `hermes send --to telegram`, and re-sent only as a new
occurrence after the check has been observed clear. Evidence that cannot be
read is reported `unknown`, never `ok`. A healthy tick writes its line and
sends nothing. There is no gate for health findings.

## Run directory and state

One run directory under the axstack git-common-dir,
`.git/axstack/runs/<run id>/`, holds:

- `cursor.json` — driver only: fingerprint, `tick_started_at`, `tick_done_at`,
  `tick_outcome`, per-PR state (head, base, draft, checks, last self review
  id and head), dispatch markers, repair caps, deploy-on-push sets per
  repository, `health[]`.
- `pending.json`, `precheck.log` — driver precheck only.
- `decisions/<token>.json` — created by agents, decided by the Hermes script,
  spent by the driver or agent; one writer at a time by state transition.
- `watchdog.log` — watchdog only.
- `progress.md` — driver only, one line per tick plus holds; no per-PR prose.

Orca run history is the authoritative log. The launch worktree is a dedicated
Orca worktree of `axatbhardwaj/axstack` in which nobody develops; the current
`defi-automations` worktree retires with the old pair.

## Safety holds

- Non-Opus or unknown driver identity: no dispatch that tick, recorded.
- GitHub API error: PR state unknown, nothing is pushed or published for it.
- Deploy-on-push: the set is enumerated from each repository's workflow files
  at enabling and re-verified on any allowlist change; a repair never pushes to
  a head branch in that set.
- A hold is cleared only by a later tick observing the condition resolved or
  by the user; silence never clears a hold.

## Acceptance before enabling

1. Precheck dry-run against live GitHub returns the current open PRs, logs one
   line, and exit codes match the table above; a forced truncation logs `error`.
2. The fourth search returns the three automation-placed blocks
   (monorepo#1092, #1108, mobile#1) and the driver's marker rule excludes the
   human-placed ones (#884, #740, #576, #512, azure-next-hybrid#198).
3. A driver tick on a test fingerprint creates one child worktree in the
   correct clone at the exact head, dispatches one agent, writes the marker,
   promotes the fingerprint verbatim, and exits with `tick_done_at`.
4. A fresh driver session binds the persistent Run with `run-use`, reads a
   `worker_done` left by a previous tick, releases the worker and removes its
   worktree.
5. Idempotence: a second dispatch for a head self already reviewed is skipped
   with the review id recorded.
6. TTL: a marker back-dated 3 h is abandoned, its worktree removed, one health
   line written.
7. Decision round trip: a test token sent to Telegram, `approve <token>`
   typed by the user, script writes `approved`; the driver revalidates and
   spends it; a second `approve` of the same token exits 3; a malformed token
   exits 2 with no file touched; `TELEGRAM_ALLOWED_USERS` equals the user's id
   and the home channel is a private chat.
8. Watchdog: each of the four checks tripped artificially sends exactly one
   message and writes one occurrence; a repeated tick sends nothing; a healthy
   tick sends nothing and always exits non-zero.
9. Cutover: automations C and D disabled, their worktree removed, the old run
   directory kept read-only; the new pair enabled at distinct minutes; the
   first real driver tick recorded.

## Exclusions

No COMMENT reviews. No obligations table, supersede counter or review-budget
hold. No watch deadline or `expired` state. No terminal hygiene or global busy
guard. No terminal nudge from Hermes. No Hermes access to `gh`, `git` or
`orca`. No re-review of human-placed blocks. No per-project state. No changes
to the retired pair A/B artefacts. No Luna gate for health findings.
