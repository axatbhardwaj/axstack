# Axstack workflows

The current T3 thread drives execution. T3 Code is the only supported active
runtime and owns worktrees, threads, runs, delegated tasks, messaging, and
native schedules.
Axstack owns workflow policy, role data, evidence, and the private derived run
record. It adds no daemon, scheduler, runtime database, or escalation engine.

The bundled skills are self-contained. Retiring another skill does not claim
Axstack implements that skill's specialist capability.

## Routing and scope identity

The directly invoked phase loads the applicable shared references for routing,
lifecycle, T3 runtime boundaries, role/model/risk contracts, the run record,
and PR shape.

For the picker score, account eligibility, dispatch exits and driver stay rule,
see [Account selection](concepts.md#account-selection). Follow
[Provider bindings](../skills/axstack/references/t3-runtime.md#preflight-and-binding)
immediately before dispatch or account re-selection.

Direct routes need no spec ceremony:

- `axstack-research` answers one bounded source-backed question.
- `axstack-correct` reports repeated mistakes and proposes stronger checks.
  Only the user invokes it.
- `axstack-explain` separates implemented, intended, tested, live, and unknown
  behavior; complex visuals receive exact-artifact QA where applicable.
- [axstack-diagram](../skills/axstack-diagram/SKILL.md) selects Mermaid for chat,
  GitHub, and docs, or an interactive viewer for required complex visuals.
  Explain loads it for every diagram. Viewers use
  [archify](https://github.com/tt-a1i/archify) (MIT) with a pinned tool,
  a passing finalize receipt, rendered QA, and node-and-edge source review.
- `axstack-improve` returns a small ranked set of evidenced improvement
  candidates without editing code. Its test-audit lens marks every declaration
  in one owner boundary R/F/C/D, reports reviewed and eligible counts, and routes
  authorized, proven cleanup to Implement as structure-preserving work through
  independent review.
- Manual `axstack-review` can inspect existing code at an exact revision within
  a named scope. Both configured codebase reviewers inspect six lenses independently;
  the driver reports validated defects and risks, improvement opportunities,
  unverified leads, and `COMPLETE` or `INCOMPLETE` coverage. This report does
  not approve a PR or publish findings.
- `axstack-debug` builds a red loop, diagnoses to root cause, escalates hard
  bugs through adviser-directed investigator fan-out, and hands off a
  classified repair without landing a change.
- `axstack-cleanup` runs inline in the driver after accepted worker, Task, or
  Run completion, or against an explicitly bounded backlog. It dispatches no
  cleanup worker and preserves protected or uncertain resources.
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

## Weekly test-audit activation

The packaged [weekly prompt](../skills/axstack/references/test-audit-weekly.md)
is repo-agnostic policy. No automation is created by this delivery; scheduling
starts later for each repository the user names.

1. Record the repository and test-path allowlist, a finite pass budget, and
   standing edit and PR-open authority. Zero deletions is normal; proven F
   repairs are eligible.
2. Configure that repository's dedicated T3 project and lane thread under the
   [T3 runtime boundary](../skills/axstack/references/t3-runtime.md). Set and
   read back its role binding, then use `schedule_task` with the packaged prompt
   and activation values, `bindToCurrentThread:false`, and a stable
   `clientRequestId`. Do not add a scheduler or cursor.
3. Before enabling the schedule, pass the
   [native activation canary](../skills/axstack/references/automations.md): fresh
   pass threads, overlap admission, killed-predecessor recovery, capacity and
   bounded retained worktrees. Preserve runtime receipts; source checks alone
   do not establish these facts.
4. Missing authority, or no passing native canary, holds activation. Each pass
   derives one boundary from test-audit PR history, skips open PRs, overlap with
   live T3 thread/run and worktree ownership, unsafe baselines or empty candidate sets,
   and opens at most one independently reviewed test-only PR per week through
   the driver. Workers never push; the owning watch thread applies the
   [watch predicate](../skills/axstack-watch/SKILL.md#5-state-readiness-precisely).

## Nightly PR-triage activation

Use the packaged [nightly prompt](../skills/axstack/references/pr-triage-nightly.md)
and [setup guidance](../skills/axstack/references/automations.md#nightly-pr-triage-setup).
Read existing schedules before creating the single unbound native T3 schedule
at 02:00 host time; reuse it instead of creating a duplicate.
Keep the host timezone, schedule ID, prompt, and repository set in a durable
activation record outside run records so Close-out preserves them.
Each pass reports all own open PRs in its own T3 thread, with forge state or
`UNKNOWN`, PRs inactive for 7 days, and the top three to act on.
The pass stays read-only and never declares merge-ready.
This delivery creates no live schedule; source tests do not prove activation.

## Role presets

Installation requires one explicit canonical preset. The three bundle files
under `profiles/presets/` each contain exactly
`{ "version": 1, "roles": [...] }` and list all role IDs in the same order.

The current chat drives on whatever model runs it; no preset carries a driver
role.

| Preset | Author | Ordered peer reviewers | Astra / Opus advisers | Auditor |
| --- | --- | --- | --- | --- |
| `mixed` | Sol high | Sol high; Sol high | Astra high / Opus xhigh | Sonnet high + Sol high |
| `codex-only` | Sol high | Sol high; Luna xhigh | Astra high / unavailable | Luna xhigh + Sol high |
| `claude-only` | Opus medium | Opus medium; Sonnet high | unavailable / Opus xhigh | Sonnet high (Sol absent) |

In `mixed` and `claude-only`, `axstack-auditor`, `axstack-research-requirements`,
`axstack-research-code`, `axstack-research-web`, `axstack-explore-execution`,
and `axstack-monitor` use the Claude Sonnet class at high effort. `codex-only` keeps its Codex
assignments for those roles. Mixed web-google and X retain their source-specific
Antigravity and Grok routes.
The new `-sol` auditor, research-code, and explore-execution seats use Sol high
in `mixed` and `codex-only`; `claude-only` records each as intentionally absent.
Dispatch the base and Sol seats independently on the same brief, then reconcile
their findings per claim without averaging.

The installed `<skills-dir>/axstack/roles.json` adds the selected preset name:
`{ "version": 1, "preset": "<name>", "roles": [...] }`. The runtime reads it
from the installed shared root `skills/axstack/` and records the whole table for
a new run. Per role it records class, exact ID, source, and time. Codex and
Claude classes resolve to the newest matching ID from the saved T3 capabilities
catalog using `skills/axstack/scripts/resolve-models.js --provider <provider> --capabilities <path> (--class <class> | --model <model>) --effort <effort>`; missing or
malformed catalogs hold. Active runs and resume reuse their snapshot after
later installation changes without re-resolution.

Peer roles use the stable IDs `axstack-reviewer-primary` and
`axstack-reviewer-peer`; their provider/class mappings come only from the
selected preset. The mixed peer coordinator and review-lane binding
`axstack-owner` uses Sol high and never reviews. `axstack-reviewer-secondary`
is used in the authored mapping and, alongside `axstack-reviewer-primary`,
in codebase findings mode.

The unavailable adviser in each single-provider preset stays explicitly
`model: null` within that provider's bounds. Installer readiness accepts that
intentional absence, but Align and Spec hold because both independent receipts
are required. The mixed checker and Google web-research route use provider
`antigravity`; the X route uses `grok`. Those agent-ID routes retain
`model: null` notes and resolve the exact model from the first provider entry
in saved T3 capabilities. Empty Antigravity catalogs hold. Missing or
unavailable roles hold only affected work. Requested model, effort, and
permission values need actual T3 configuration read-back; stored `modeId` is
neither permission parity nor a sandbox. Rejection, timeout, quota, and auth
failures hold; outside bounded same-provider, same-model account selection among
one driver's instances via `pick-instance.js`, no subscription inference, quota
routing, or alternative retry applies.

## T3 runtime boundary

Immediately before dispatch, receipt consumption, or recovery, load the shared
[T3 runtime reference](../skills/axstack/references/t3-runtime.md). The driver
saves `orchestrator_capabilities` JSON and follows the advertised tool schema.
The reference owns role dispatch, provider options, receipts, questions,
launch recovery, run-watch waits, ownership transfer, and cleanup.
Capability discovery alone is not execution proof.

All subagent, delegated-worker, reviewer, and cross-harness work uses T3
orchestration through the `t3-code` MCP. Do not use harness-native subagent
tools. Read-only roles use async `delegate_task`; reviewers and investigators
receive driver-made disposable detached checkouts pinned to candidate and base.
Authors use `t3_thread_launch` in their own SHA-pinned worktrees. Repairs return
to the same author and worktree. The current T3 driver owns coordination and
forge mutations and never writes an author's tracked files.

Preserve native `taskId/childThreadId/childRunId` or
`threadId/runId/worktree/branch/base SHA`, dispatch key, requested/effective
configuration, and private evidence. Persist `task_status` before
`t3_thread_read`; delegated completion needs terminal success, available result,
settled child runs, and the current `AXSTACK-DONE` marker. Launched writers
send their marker to the driver, which also verifies terminal `t3_thread_wait`,
a clean tree, non-empty diff, and red/green logs. An older attempt never
completes a newer one. Questions remain incomplete until the resumed run settles.

Trust, permission, authentication, and provider safety prompts are holds;
never answer trust or permission prompts for a worker. Unknown liveness,
silence, or a missing status never proves exit or authorizes a second writer.
Ordinary resume keeps the owner, author, attempt, worktree, and pending receipts.
The runtime reference defines exact-title recovery and recipient acceptance
for explicit ownership transfer.

## Phases

- `axstack-align` maps facts and dependencies, asks prioritized questions, and
  consults Astra and Opus independently with the same bounded evidence and
  question. It synthesizes disagreements and reuses unchanged receipts. For a
  Rung 1 or 2 design question it loads `axstack-brainstorm` inline and reuses
  its receipt instead of consulting twice; Align owns the interview.
- `axstack-brainstorm` validates an approach standalone or inline in the driver,
  report-only. Every invocation compares independent Astra, Opus, Grok and
  Antigravity candidates, including premise and smallest-change/do-nothing
  checks. The driver scores, picks and grafts; Rung 1 uses no judges. At Rung 2,
  `axstack-arena-judge-opus` judges round 1; disagreement on the base or caller
  re-invocation with the user's rejection triggers fresh Fable/Astra round 2.
  It returns a verdict, sketch and proposed questions, with no interview,
  prototype or execution approval. Required seats hold; optional dropouts are
  fenced. Fable also serves the bounded triggers in
  [Standing contracts](../skills/axstack/references/contracts.md).
- `axstack-spec` writes observable acceptance, exclusions, decisions, and one
  user-approved revision baseline. Linear through the executor MCP is the
  default only for `defi-com` repositories; GitHub Issues and repository
  Markdown are explicit alternatives and the stores for other repositories.
  A GitHub baseline pins the issue URL and approved body digest. Preflight
  Linear document access separately through executor; a missing operation
  holds only that operation without mutation or a store switch. Notion also
  uses executor, including both accounts.
- `axstack-tickets` maps user-visible capabilities to dependency-aware internal
  tasks in the selected Markdown, GitHub Issues, or Linear store under the same
  organization boundary. Only the driver mutates lifecycle state.
- `axstack-implement` uses strict behavioral RED, GREEN, then refactor. The
  narrow accepted structure-preserving route uses old-green and the same check
  new-green. One author writes and returns a local receipt without pushing. The
  owner reconciles it, publishes the unchanged commits through `gh stack`, and
  confirms the remote SHA before review. Local green and CI green remain
  separate evidence. Authors apply the shared
  [test-value gate](../skills/axstack/references/test-value.md) to each new or
  changed test; reviewers check added, changed, and removed test hunks, including
  the named keepers or vacuity/obsolescence evidence for removals.
- `axstack-review` gives peer PRs two isolated same-brief reviewers and authored
  PRs one eligible cross-family/preset-mapped reviewer. Every reviewer runs in
  a separate detached checkout, with private evidence preserved before
  removal. All cover security,
  correctness, integration, requirements, design, and simplicity. Report-only
  never publishes; authorized submission binds the exact commit.
- `axstack-watch` adopts an existing PR under observation-only, peer, or
  authorized-maintenance scope. A changed head or comment is an event, not
  repair authority. Within an implementation run, fixes return to the original
  author and follow its publish-before-review loop. Manual adopted-PR repair
  reviews the exact local SHA and reply bodies before `gh stack` publication
  and remote readback.
- `axstack-audit` separates execution outcome, procedure, and measurement
  coverage with evidenced denominators; it proposes but never self-edits.
- `axstack-cleanup` settles inline in the driver. Confirm descendants settled,
  read back private evidence, salvage dirty or ignored non-cache content,
  archive the exact eligible thread, then remove its exact worktree without
  force and delete only eligible local branches. T3 metadata actions do not
  remove worktrees. Accepted writer or delegated completion settles thread
  metadata only. Author threads and worktrees remain retained and unarchived
  until their PR merges or closes; the current pass, unsettled descendants,
  and user-taken-over threads remain protected.

One T3 host/server owns a run, one persistent owner owns each PR, and one
writer owns each candidate. Fanout has no fixed PR count; it follows real
dependencies, writer isolation, host capacity, and spending limits. Each PR has
one theme and a measured size under the shared
[PR-shape policy](../skills/axstack/references/pr-shape.md).
For own PRs, automatic merge is the default under the
[watch predicate](../skills/axstack-watch/SKILL.md#5-state-readiness-precisely).
Review approval alone never grants merge authority.
Treat size flags as informational only.
Size alone must never block review, reject a PR, require split attempts or
cohesion/exception rationale, or hold approval.
Review the actual footprint, complexity, and required context, incrementally when needed.
Approval requires sufficient review coverage.
Report INCOMPLETE when required coverage is missing.
Shape choices remain autonomous driver decisions; size alone never requires user approval.

## Explicit handoff

Only an explicit user request transfers ownership. Record the intended
recipient, exact scope, revisions, authority, and pending request, then follow
the [T3 runtime transfer contract](../skills/axstack/references/t3-runtime.md).
Input acceptance and turn start do not transfer ownership. The recipient must explicitly accept the exact handoff;
only then does the prior owner stop. Missing capability or ambiguous acceptance
keeps the current owner and a resumable record.

## Notifications and relay

Serious security, downtime, data-loss, and major-design risks are raised in a
prompt immediately and hold dependent dangerous work. This is not a runtime
gate. An applicable `Notification policy` may use `axstack-relay` only for a
user-decision hold (including spec or npm approval and a genuine blocker after
bounded safe recovery), a serious-risk hold immediately, or at most two merge-ready/merged milestones per run.
Routine questions stay in the T3 driver thread. Progress, CI pending, and
completion always stay in the T3 driver thread.
Only the bounded categories—user-decision holds (including spec approval),
serious-risk holds, and at most two merge-ready/merged milestones per run—may
be relayed under the recorded Notification policy. See [Relay operations](host-operations.md#notifications-and-relay) for native
delivery, deduplication, and verified reply handling.

Healthy watch observations remain quiet. The optional `axstack-monitor` is a
read-only observer for standalone watches and never sends.

## Chat-run PR watch

For authorized engineering delivery, [Autopilot](../skills/axstack/references/autopilot.md)
continues from Align through the eligible phase sequence in the same chat.
The human approves substantial specs, release PRs, peer and deploying-base
merges, and the npm stage. The recorded owning watch thread is the merge actor,
including `axstack-owner` for standalone authorized maintenance and small or
adopted work. Apply the full
[watch merge predicate](../skills/axstack-watch/SKILL.md#5-state-readiness-precisely).
Managers, workers, reviewers, monitors, and nightly triage never merge.
Observation-only and peer watches never merge. An open
hold pauses the run.
After verified publication readback of every own PR from any Axstack phase,
the driver arms or joins its chat-run watch in authorized maintain mode.
Explicit stop-after-publication and observation-only requests still apply.
Release and install run only under recorded per-run authority.
Close-out follows their verified receipts and the watch's end.

Use `axstack-watch` chat-run mode to watch every PR raised by this run,
including later verified publications and PRs explicitly adopted by the driver.
See [Watch activation](host-operations.md#chat-run-watch-activation) for wake
cadence, schedule identity, and exact deletion checks. Independent PRs can repair in parallel
with one writer per PR; a changed stack ancestor invalidates child evidence.
An incomplete scan leaves readiness `UNKNOWN`.

The chat-run watch never expires or waits for re-authorization while PRs remain open.
The chat-run watch ends only when all watched PRs merge or close, launched work
is settled, and release is settled or not applicable, or the user cancels.
A required PR closed without merging keeps its decision hold and wake.
Follow [Chat-run watch runtime](../skills/axstack-watch/references/watch-runtime.md#chat-run-watch)
for native lifetime re-arming and quiet cadence changes on the recorded schedule ID.
Implementation candidates are published and read back before independent
authored review. Adopted own-PR maintenance receives independent exact-local-SHA
review before driver publication and remote readback. Watch §5 governs merges. Installed instructions do not prove scheduled observation or driver wake.


## Automatic merge boundaries

Solo approval is current-head-and-base cross-provider authored-review `APPROVE`
plus diligence `PASS`. The reviewer differs from every receipt-recorded provider
that authored or repaired `merge-base..head` commits. Team approval also needs a
counted non-author collaborator review at the current head. Axstack automation
votes never count. Unknown or mixed provenance and manually authored PRs need a
merge card. New heads need fresh authored review, diligence, and CI. A collaborator
approval carries over only across an unchanged stable patch-id rebase, recorded
for both heads, while the forge still counts it.

Team auto-merge targets only documented non-production `dev`; solo targets `main`
or another documented `integration` base. Unknown classification means
`deploying`. Re-read approval mode and classification before merging and on resume.
For a stack, only the bottom base must qualify; every upper base is its next-lower
branch at the reviewed head. Every planned member must be published and satisfy
the remaining terms and exclusions. Never retarget reviewed members for eligibility.

Merge cards report cases that fail approval, base, exclusion, or `Auto-merge: off`
rules. On own integration-base PRs, a user card reply permits the guarded actor to
merge, subject to watch §5's exceptions.
In solo mode the user's merge-card reply authorizes the guarded merge of
user-written PRs or PRs with unknown or mixed provenance.
In team mode it clears only an ineligible base, auto-merge turned off, and an open
human or bot comment; it never replaces collaborator approval. CI and manifest changes,
merge-authority text and non-`clean` revert PRs are user-merged on
the forge. Promotion, release, deploying-base, and peer PRs are also user-merged.
Test sources stay eligible; `.github/`, workflow-invoked paths, manifests and
lockfiles, runner config, branch protection and rulesets, `CODEOWNERS`, and
merge-authority text are excluded from auto-merge. Non-agent comments hold it
until human clearance under the packaged comment rules. The revert gate reads the declaration starting
with `Revert:` at line start; a quoted format inside a bullet is not a declaration.

User merges are bottom-up for a stack.
This policy grants no release, npm publish, or host install
authority. See [Preview authority and operations](host-operations.md#private-pr-previews).

Excluded: CLI proxy, account pooling behind a proxy or shared session, and IP
routing; local CI contention handling is deferred. Quota-driven scheduling or
model routing (provider/model substitution) is excluded. Per-dispatch selection
among the user's own same-provider, same-model accounts is permitted. Automatic
merge of promotion, release, deploying-base, and peer PRs is excluded. Previews
outside the VPS, public previews, and production data are excluded. Nightly triage
never sends relay messages.

Accepted risks: two agents can miss the same defect while CI is green; spec
approval is the user's main checkpoint. A head guard does not atomically guard
base freshness; the concurrent-merge race is held by the post-merge push-failure
rule. A watch waking every 5 minutes (60 when quiet) until PRs land has an accepted
token cost. Preview code runs under the same VPS user as agents and is not isolated;
tests already do, so the added risk is small.

## Optional native peer-review automation

The optional native review manager runs bounded peer-review passes; see
[Host operations](host-operations.md#optional-native-peer-review-automation)
for lane setup, schedule activation, capacity checks, and canaries.
Manual review and user-driven `axstack-watch` remain outside this schedule.
Review automation never merges peer PRs; the user does.

## Run record and evidence

Substantive delegated or resumable work uses one compact `progress.md` rooted at
`git rev-parse --path-format=absolute --git-common-dir`. It is shared across
worktrees but never tracked. The driver alone writes it; actual T3 state, Git
revisions, forge state, and approved scope remain authoritative.

Structural checks verify packaging and declared policy, not agent behavior.
Predeclared scenario evaluation is qualitative behavior evidence, not deterministic proof. Runtime
compatibility requires capability discovery, configuration read-back, native
thread/run/task and worktree receipts, completion delivery, and cleanup as
applicable. Mobile completion and reply behavior remain unverified for routes
without matching live receipts.
End-to-end compatibility remains unverified for any route without matching
runtime receipts; evidence from one route does not establish support for all roles.

## Runtime

Bun >=1.3.14, with no runtime dependencies. Workflow checks use
`bun test tests/workflows/`; the only approved Node built-ins are Bun-backed
`node:fs` and `node:fs/promises`.
