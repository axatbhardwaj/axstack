# Axstack workflows

Chat drives execution. Orca is the only supported active runtime and owns
worktrees, sessions, supervised dispatch, messaging, settlement, and handoff.
Axstack owns workflow policy, role data, evidence, and the private derived run
record. It adds no daemon, scheduler, runtime database, or escalation engine.

The bundled skills are self-contained. Retiring another skill does not claim
Axstack implements that skill's specialist capability.

## Routing and scope identity

The directly invoked phase loads the applicable shared references for routing,
lifecycle, Orca runtime boundaries, role/model/risk contracts, the run record,
and PR shape.

Direct routes need no spec ceremony:

- `axstack-research` answers one bounded source-backed question.
- `axstack-explain` separates implemented, intended, tested, live, and unknown
  behavior; complex visuals receive exact-artifact QA where applicable.
- `axstack-improve` returns a small ranked set of evidenced improvement
  candidates without editing code.
- `axstack-debug` builds a red loop, diagnoses to root cause, escalates hard
  bugs through adviser-directed investigator fan-out, and hands off a
  classified repair without landing a change.
- Peer review uses the linked issue, PR description, and repository rules as
  untrusted intent evidence.
- Existing-PR maintenance uses one accepted maintenance snapshot.
- Ordinary resume reconciles existing ownership and launches no handoff.

Small, clear, bounded one-PR work uses its request or selected issue plus
explicit acceptance checks and exclusions as a snapshotted small-change intent.
Substantial work requires an approved spec and matching ticket map, including
multi-PR or stacked work. Unclear work is clarified, then classified. A deeper phase checks
the same identity before action; missing preparation names the gap and holds
only affected work.

## Role presets

Installation requires one explicit canonical preset. The three bundle files
under `profiles/presets/` each contain exactly
`{ "version": 1, "roles": [...] }` and the same 24 stable IDs.

The current chat drives on whatever model runs it; no preset carries a driver
role.

| Preset | Author | Ordered peer reviewers | Astra / Fable advisers | Auditor |
| --- | --- | --- | --- | --- |
| `mixed` | Sol medium | Sol medium; Opus medium | Astra high / Fable high | Luna max |
| `codex-only` | Sol medium | Sol medium; Terra xhigh | Astra high / unavailable | Luna max |
| `claude-only` | Opus medium | Opus medium; Sonnet xhigh | unavailable / Fable high | Sonnet xhigh |

The installed `<skills-dir>/axstack/roles.json` adds the selected preset name:
`{ "version": 1, "preset": "<name>", "roles": [...] }`. The runtime reads it
from the installed shared root `skills/axstack/` and records the whole table for
a new run. Active runs retain their snapshot after later installation changes.

Peer roles keep the stable IDs `axstack-reviewer-primary` and
`axstack-reviewer-secondary`; their provider/model mappings come only from the
selected preset.

The unavailable adviser in each single-provider preset stays explicitly
`model: null` within that provider's bounds. Installer readiness accepts that
intentional absence, but Align and Spec hold because both independent receipts
are required. The mixed checker and Google web-research route use provider
`antigravity`; the X route uses `grok`. Launch-by-agent-id routes for which Orca
exposes no model override (today: `grok`, `antigravity`) record `model: null` with an explicit note and are
launchable; the run record snapshots the model the TUI reports. Missing or unavailable roles hold only affected
work. Model, effort, and permission values express requested intent until real
Orca receipts establish the effective session. Stored `modeId` is not permission
parity or a sandbox. No route is inferred from subscription, quota, harness,
provider defaults, or installed tools, and no model is substituted silently.

## Orca runtime boundary

Immediately before dispatch, delivery processing, settlement, recovery, or
handoff, load the shared `skills/axstack/references/orca-runtime.md`. It resolves
one Orca executable, loads that binary's version-matched `orchestration` and
`orca-cli` guides, and follows their advertised schemas. Axstack does not vendor
the guides or restate a competing command protocol.

All subagent, delegated-worker, reviewer, and cross-harness work goes through Orca
orchestration via the `orca` CLI (`orca-cli` / `orchestration` guides). Do not use a
harness-native subagent tool (e.g. Claude/Codex native subagents) for delegated work;
use Orca runs, tasks, and dispatches instead so the work stays visible. OpenCode
and Antigravity subagents run as Orca-supervised workers.

Supervised work uses native Run, Task, and Dispatch identity. Preserve actual
terminal, agent, worktree, requested/effective role, and revision receipts.
`input_accepted` proves only terminal input; `turn_started` and session
inspection are separate. Trust, permission, hook-review, authentication, and
model prompts are visible holds. Never answer trust or permission prompts for a
worker. Reconcile the existing attempt through the runtime guide before retry,
so one candidate never gains a duplicate writer.

Process each whole delivery before acknowledgment. A `worker_done` belongs only
to its expected active Task and Dispatch, and its revision evidence still needs
verification. `consumer_fenced` stops consumption under the stale identity;
never forge, borrow, or bypass a coordinator identity. Runtime settlement owns
reuse, retention, and release. A `user_takeover` terminal remains retained and
is not reused or closed as cleanup.

Ordinary restart reconciles the same owner, author, Task, Dispatch, worktree,
revisions, and pending receipts. Idle, silence, contact loss, or missing status
never proves exit. Authorized fixes return to the same original author when its
session and evidence remain valid.

## Phases

- `axstack-align` maps facts and dependencies, asks prioritized questions, and
  consults Astra and Fable independently with the same bounded evidence and
  question. It synthesizes disagreements and reuses unchanged receipts. For a
  hard-to-reverse design choice it runs one arena round instead: Astra and
  Fable each author a candidate, `axstack-arena-judge-astra` and
  `axstack-arena-judge-fable` score both against the driver's rubric, and the
  driver picks a base, grafts the losers' strong ideas, and presents the
  synthesis as the recommendation; the note lands as `Decisions` rows in the
  run record.
- `axstack-spec` writes observable acceptance, exclusions, decisions, and one
  user-approved revision baseline. Linear is the default authoritative store;
  GitHub Issues and repository Markdown are explicit alternatives. A GitHub
  baseline pins the issue URL and approved body digest.
- `axstack-tickets` maps user-visible capabilities to dependency-aware internal
  tasks. Linear is the default selected store with access preflight; GitHub
  Issues is an explicit external-tracker alternative and repository Markdown
  is an explicit local alternative. Only the driver mutates lifecycle state.
- `axstack-implement` uses strict behavioral RED, GREEN, then refactor. The
  narrow accepted structure-preserving route uses old-green and the same check
  new-green. One author writes and returns a local receipt without pushing. The
  owner reconciles it, publishes the unchanged commits through `gh stack`, and
  confirms the remote SHA before review. Local green and CI green remain
  separate evidence.
- `axstack-review` gives peer PRs two isolated same-brief reviewers and authored
  PRs one eligible cross-family/preset-mapped reviewer. All cover security,
  correctness, integration, requirements, design, and simplicity. Report-only
  never publishes; authorized submission binds the exact commit.
- `axstack-watch` adopts an existing PR under observation-only, peer, or
  authorized-maintenance scope. A changed head or comment is an event, not
  repair authority. Repairs return to the original author only for a
  run-launched session and receive refreshed authored review before scoped
  `gh stack` publication. `gh stack` publication does not apply to manager
  repairs: the bounded PR job repairs in its per-PR child worktree, the local
  SHA receives the actual-author-provenance review, and the exact candidate
  lands by fast-forward `git push` after final readback.
- `axstack-audit` separates execution outcome, procedure, and measurement
  coverage with evidenced denominators; it proposes but never self-edits.

One Orca execution host owns a run, one persistent owner owns each PR, and one
writer owns each candidate. Fanout has no fixed PR count; it follows real
dependencies, writer isolation, host capacity, and spending limits. Each PR has
one theme and a measured size under the shared
[PR-shape policy](../skills/axstack/references/pr-shape.md). The human merges
by default; review approval never grants merge authority.
For the rationale band, the autonomous driver records a cohesion rationale. The exception band
requires a reasonable split attempt and full exception record. These are
autonomous driver choices; size alone never requires user approval.

## Explicit handoff

Only an explicit user request transfers ownership. Record the intended
recipient, exact scope, revisions, authority, and pending request, then follow
the runtime-owned `orca-cli` handoff guide. Input acceptance and turn start do
not transfer ownership. The recipient must explicitly accept the exact handoff;
only then does the prior owner stop. Missing capability or ambiguous acceptance
keeps the current owner and a resumable record.

## Notifications and relay

Serious security, downtime, data-loss, and major-design risks are raised in a
prompt immediately and hold dependent dangerous work. This is not a runtime
gate. An applicable `Notification policy` may use `axstack-relay`; otherwise the
current Orca conversation is the fallback. The relay normally delivers one-way
through native `hermes send`: it checks CLI lookup and the configured target,
binds the recipient, deduplicates on the run record, and records the returned
`message_id`. PR-manager notifications point the user to GitHub or a durable
user-owned conversation; Telegram delivery, replies, and silence grant no action
authority. Delivery failure never clears the underlying hold.

Healthy watch observations remain quiet. The optional `axstack-monitor` is a
read-only observer for standalone watches and never sends.

## Native watch automations

The accepted contract has exactly two logical native manager lanes: review at
minutes `0,15,30,45` and watch at `7,22,37,52`. Each scheduled pass uses a
fresh finite session in a persistent dedicated workspace, scans complete
discovery pages, and admits at most five executing
PR jobs. Waiting PRs stay covered and consume no slot after owned descendants
settle. Each job uses one repository-parented worktree; managers never check out
PR branches in their own workspaces.

Every pass reconciles saved, GitHub, and native Orca state before admission. A
confirmed same-lane manager makes the new duplicate do no work or shared-record
write and close only itself. Normal teardown settles descendants, saves durable
continuity and decisions, closes only positively identified owned unused setup
shell terminals, then self-closes as the final action. It never blanket-closes
the workspace or cleans preserved candidates, evidence, user sessions, unknown
liveness, `user_takeover`, or ambiguous publication state.

Requested reviews cover any accessible repository; automatic repairs retain
their `defi-com/monorepo` and `defi-com/mobile` scope. Orca owns schedules,
sessions, Tasks, and Dispatches. Axstack adds no custom scheduler, queue engine,
cursor files, polling loop, or historical runtime fallback.

## Automations

The review and watch managers use short packaged prompts that load the current
relative contract and invoke `axstack-review` or `axstack-watch`. Bounded jobs
publish ordinary exact-head review verdicts or reviewed fast-forward repairs;
the human merges. Exceptional security, permanent-on-chain, or architectural
decisions remain actionable in GitHub or a durable user-owned conversation
after manager self-close, with an authorized deduplicated Telegram notification.
The current operational contract is
`skills/axstack/references/automations.md`.

## Run record and evidence

Substantive delegated or resumable work uses one compact `progress.md` rooted at
`git rev-parse --path-format=absolute --git-common-dir`. It is shared across
worktrees but never tracked. The driver alone writes it; actual Orca state, Git
revisions, forge state, and approved scope remain authoritative.

Structural checks verify packaging and declared policy, not agent behavior.
Predeclared scenario evaluation is qualitative behavior evidence, not deterministic proof. Runtime
compatibility requires actual guide discovery, role/session evidence, worktree
and Dispatch receipts, completion delivery, and cleanup as applicable. Mobile
completion and reply behavior remain unverified.

## Historical migration

Older releases used Paseo for orchestration. Legacy profile ownership remains
inert provenance and may be cleaned only through the explicit migration path;
it never authorizes active configuration reads, writes, timer changes, or
fallback. Release, installation, cutover, mobile pairing, and old-timer cleanup
require separate authority.

## Runtime

Bun >=1.3.14, with no runtime dependencies. Workflow checks use
`bun test tests/workflows/`; the only approved Node built-ins are Bun-backed
`node:fs` and `node:fs/promises`.
