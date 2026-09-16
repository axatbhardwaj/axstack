# Axstack workflows

Chat drives execution. Orca is the only supported active runtime and owns
worktrees, sessions, supervised dispatch, messaging, settlement, and handoff.
Axstack owns workflow policy, role data, evidence, and the private derived run
record. It adds no daemon, scheduler, runtime database, or escalation engine.

The bundled skills are self-contained. Retiring another skill does not claim
Axstack implements that skill's specialist capability.

## Routing and scope identity

`axstack` classifies the request and loads only the applicable phase plus shared
references for routing, lifecycle, Orca runtime boundaries, role/model/risk
contracts, the run record, and PR shape.

Direct routes need no spec ceremony:

- `axstack-research` answers one bounded source-backed question.
- `axstack-explain` separates implemented, intended, tested, live, and unknown
  behavior; complex visuals receive exact-artifact QA where applicable.
- `axstack-improve` returns a small ranked set of evidenced improvement
  candidates without editing code.
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
`{ "version": 1, "roles": [...] }` and the same 17 stable IDs.

The current chat drives on whatever model runs it; no preset carries a driver
role.

| Preset | Author | Ordered peer reviewers | Astra / Fable advisers | Auditor |
| --- | --- | --- | --- | --- |
| `mixed` | Sol medium | Sol medium; Opus medium | Astra high / Fable high | Luna max |
| `codex-only` | Sol medium | Sol medium; Terra xhigh | Astra high / unavailable | Luna max |
| `claude-only` | Opus medium | Opus medium; Sonnet xhigh | unavailable / Fable high | Sonnet xhigh |

The installed `<skills-dir>/axstack/roles.json` adds the selected preset name:
`{ "version": 1, "preset": "<name>", "roles": [...] }`. The runtime reads it
relative to the actually loaded `axstack` skill and records the whole table for
a new run. Active runs retain their snapshot after later installation changes.

Peer roles keep the stable IDs `axstack-reviewer-primary` and
`axstack-reviewer-secondary`; their provider/model mappings come only from the
selected preset.

The unavailable adviser in each single-provider preset stays explicitly
`model: null` within that provider's bounds. Installer readiness accepts that
intentional absence, but Align and Spec hold because both independent receipts
are required. The mixed checker also stays explicitly `model: null`; checker work holds instead of
launching a provider default. Missing or unavailable roles hold only affected
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
  question. It synthesizes disagreements and reuses unchanged receipts.
- `axstack-spec` writes observable acceptance, exclusions, decisions, and one
  user-approved revision baseline.
- `axstack-tickets` maps user-visible capabilities to dependency-aware internal
  tasks. Linear is the default selected store with access preflight; repository
  Markdown is explicit fallback. Only the driver mutates lifecycle state.
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
  repair authority. Repairs return to the original author and receive refreshed
  authored review before scoped `gh stack` publication.
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
current Orca conversation is the fallback. The relay delivers one-way through
native `hermes send`: it checks CLI lookup and the configured target, binds the
recipient, deduplicates on the run record, records the returned `message_id`,
and treats Telegram replies as neither receipts nor authority. Delivery failure
never clears the underlying hold.

Healthy watch observations remain quiet and monitor/watchdog roles never send.

## Native watch automations

The accepted monitoring contract is a five-minute driver automation, an hourly
watchdog, quiet healthy snapshots, deduplicated actionable events, verified
handshakes, one owner, and one shared default 24-hour deadline.

The user lifted the native-watch hold by user decision on 2026-09-16. The driver
automation is a mutating owner for the PRs it handles; the watchdog keeps the
independent read-only contract. Native Orca automations still select only a
provider, so the driver records its model identity every tick and the watchdog
treats a mismatch as a safety hold. Axstack adds no custom scheduler, polling
loop, or historical runtime fallback.

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
