# Axstack workflows

Chat drives execution; the CLI installs and checks assets. Paseo owns
sessions, workspaces, delegation, notifications, schedules, and heartbeats.
No Axstack daemon, multi-host scheduler, or dependency on Matt Pocock or
Poteto skills. Native handoff uses Paseo’s own skills.

Axstack ships its own self-contained skills. Design inspiration comes from
disciplined user alignment and accountable PR ownership workflows; those
principles are restated in Axstack's own words, not copied. Retiring
specialist skills does not claim their domain capabilities are
reimplemented by Axstack.

## Routing

The entry (`axstack`) classifies the request first and loads only the
phase skill needed, plus the shared bundled references
(`skills/axstack/references/`): routing, lifecycle and receipts, Paseo
launch materialization, and standing scope/model/risk/authority
contracts.

Direct routes need no spec ceremony — no alignment interview, approved
spec, or ticket mapping:

- `axstack-research` — one bounded question at a time. Verify primary
  sources and code, cite material claims and limitations, save the
  requested artifact. One question needs no panel and no implementation;
  fan out distinct questions only when useful.
- `axstack-explain` — source-backed explanations of systems, changes, current
  versus intended behavior, and implementation gaps. Simple requests stay in
  the current chat; complex visuals use the explainer profiles. Use project
  documentation as evidence where relevant. Preserve requested format and theme,
  verify rendered behavior where applicable, and report unavailable evidence.
  Publication needs its own authority. If an ordinary upgrade leaves the old
  `axstack-docs` skill installed, `axstack-explain` supersedes it; do not route
  both. Use the documented uninstall/install migration below.
- `axstack-improve` — bounded, report-only discovery of evidenced
  maintainability, architecture, and testability improvements. It may find no
  worthwhile change. Selecting a candidate does not authorize refactoring;
  unresolved design returns through alignment, while clear authorized work may
  use its settled proportional scope identity.
- `paseo-handoff` (provided by Paseo) — transfer the task with the Axstack
  run-record pointer and current authority; see [Native handoff](#native-handoff).
  Resume reconciles existing state through Axstack’s shared lifecycle.

Scope readiness is proportional (2026-09-13, user-requested amendment).
Substantial features and multi-PR or stacked work need an approved spec and a
matching ticket map before execution; a bounded small feature is not
substantial merely because it is labelled a feature. Unclear work is clarified
first, then classified as small or substantial. Small, clear, bounded one-PR
work may instead use its recorded request or existing issue plus explicit
acceptance checks and exclusions, snapshotted once as a small-change intent.
Alignment prepares either handoff and stops; the user invokes `axstack` to execute.
Entry records the size and a brief reason, reports an exact missing-identity
gap, and launches nothing until the applicable identity is present. Each later
phase checks that identity again.

### Routing presets

Installation requires an explicit canonical preset. Assets live under
`profiles/presets/`; `codex` and `claude` are CLI aliases only.

| Preset | Author | Ordered peer reviewers | Advisor / auditor |
| --- | --- | --- | --- |
| `mixed` | Sol medium | `axstack-reviewer-primary` Sol medium; `axstack-reviewer-secondary` Opus medium | Fable medium / Luna max |
| `codex-only` | Sol medium | `axstack-reviewer-primary` Sol medium; `axstack-reviewer-secondary` Terra xhigh | Astra medium / Luna max |
| `claude-only` | Opus medium | `axstack-reviewer-primary` Opus medium; `axstack-reviewer-secondary` Sonnet xhigh | Fable medium / Sonnet xhigh |

The shared role IDs are `axstack-driver`, `axstack-advisor`, `axstack-owner`,
`axstack-author`, `axstack-reviewer-primary`, `axstack-reviewer-secondary`,
`axstack-checker`, the five research/explanation/exploration roles, and
`axstack-monitor`, `axstack-watchdog`, and `axstack-auditor`. Skills define
responsibilities; installed profiles define provider, model, mode, and effort.
Peer review always uses both reviewer roles with identical briefs and isolated
first passes. Authored review follows only the preset's explicit mapping from
actual author provenance; unknown or unsupported provenance is `INCOMPLETE`.

Preset changes apply to new runs only. Active runs retain their recorded
role/model/effort snapshot unless the user explicitly changes that run and its
evidence is revalidated. Missing or unavailable configured routes hold without
fallback, quota routing, or subscription inference. Structural checks validate
assets and prompt text; structural checks are not evidence of agent behavior,
provider compatibility, or live execution.

### Active tracking

Each active execution run has one driver-owned native Paseo heartbeat, created
at execution start with the default `*/10 * * * *` cadence. Its actual ID,
first-tick handshake, and fixed deadline stay in the run record. Heartbeat ticks
and completion notifications both trigger reconciliation; ready work advances
only after actual session state, Git SHAs, receipts, authority, and dependencies
agree. Pause, completion, or the existing 24-hour deadline stops the heartbeat.

Resume reconciles native tool receipts and schedule readback before creating a
timer. Paseo CLI `schedule inspect/ls` excludes heartbeats, so an empty CLI
listing does not prove absence. Native readback such as `scheduleList` can prove
timer identity and show `lastRunAt` and expiry, but those facts have distinct
limits: timer existence is not a tick, a tick is not prompt delivery, and
delivery is not work advancement. Advancement requires a verified run-record
transition with SHAs and receipts.

The scenario fixture and structural tests exercise declared policy only; an
independent scenario evaluation is evidence about evaluated prompt behavior,
not live timers. Live heartbeat creation, prompt delivery, and advancement each
require their own native receipts. Tracking adds no scheduler, merge, release,
or scope authority, and PR monitor/watchdog roles remain separate.

## Phase skills

Progressive loading: invoke only the phase needed. Each phase loads standing contracts and their lifecycle/audit path.
Procedure-specific references are loaded at their point of use, including
Paseo launch materialization before dispatch.

- `axstack` — entry router: lifecycle and holds; no fixed active-PR count.
  Fanout is dependency- and capacity-driven within configured host resource and
  spending limits, with one host per run, one persistent owner per PR, and one
  writer per candidate. Each PR follows the shared
  [PR-shape policy](../skills/axstack/references/pr-shape.md): one theme and a
  measured full size. Routine shape, split, fanout, and exception decisions are
  autonomous driver decisions inside the approved spec; size alone never
  requires user approval. The rationale band requires only a recorded cohesion
  rationale and no split-attempt record. The exception band gets a reasonable
  split attempt and, when cohesion requires proceeding, the full exception
  record. The independent reviewer applies the level matching the measured total
  under angle 6. Weak rationale returns to the author through the normal fix
  loop. Existing material-scope, serious-risk, unavailable-model, and
  human-merge holds remain unchanged.
- `axstack-relay` — optional inline procedure for explicit messages and transport
  tests, urgent issues and blockers under a standing user instruction, and
  other automated messages allowed by a `Notification policy`. It checks
  host-enabled discovery and readiness before use, preserves the caller's
  authority and persistent ownership, and falls back to the current Paseo
  conversation without clearing the hold. It creates no runtime or child role.
- `axstack-align` — research facts, map dependent decisions, and ask prioritized
  rounds of one to three cumulatively numbered questions with a recommendation
  and trade-off for each. The current chat drafts each new frontier, the actual
  configured persistent `axstack-advisor` challenges it, and the driver reconciles
  the advice before asking the user. Twenty presented questions is the normal
  ceiling, not a quota; Align stops earlier when no material choice remains.
  Named material gaps may extend the initial pass to 35, never beyond. An empty
  ready frontier caused by blocked research is not completion. Further
  interview refinement is opt-in, names one area, and gets at most five
  questions without replacing required spec approval or model-availability
  clarification.
  As answers settle, Align follows existing context/glossary/ADR conventions or
  lazily defaults to `CONTEXT.md` and `docs/adr/`. Glossaries contain domain
  terms, not implementation detail; facts, desired behavior, and unresolved
  trade-offs remain distinct. Documentation does not grant implementation or
  spec approval. Partial or capped interviews retain open blockers and never
  claim readiness.
- `axstack-spec` — observable acceptance criteria, exclusions, approved revision baseline.
- `axstack-tickets` — Linear native document preflight per session (missing access is a setup gap), explicit Markdown fallback, capability to task map with a theme and coarse size estimate per task, report-only checker, driver-owned updates. Reviewed-but-unmerged stays **In Review**; Done needs all required PRs merged plus acceptance checks passing.
- `axstack-implement` — strict red-green-refactor with revision-tied evidence; exclusive writers; measured shape receipts; `gh stack` coordination and remeasurement after parent changes; restart reconciliation (ambiguity never authorizes a duplicate writer).
- `axstack-improve` — direct codebase-quality discovery with bounded evidence,
  a small ranked candidate set, and no automatic source edits. It may use
  `axstack-explain` for useful before/after visuals without forcing HTML.
- `axstack-review` — peer mode accepts the PR description, linked issue,
  and repository requirements as intent with no Axstack-created approved
  spec; authored mode retains the approved baseline for substantial work or
  the snapshotted small-change intent for small work, and accepts an adopted
  maintenance scope snapshot without repeated approval. Peer review uses
  exactly two independent configured reviewer roles with an identical
  six-angle brief and first-pass isolation. Authored review uses one eligible
  configured reviewer from the explicit preset mapping and actual author
  provenance. No owner or author session reviews; unknown, mixed, or unsupported
  provenance and unavailable required models are reported to the user without
  invented fallback. An eligible current Sol high checkpoint for
  an Opus high author satisfies authored final review after revalidation,
  without lower effort or a redundant reviewer. Completeness is mode-specific
  and separate from the
  recommendation: complete evidence with validated defects submits
  REQUEST_CHANGES, complete evidence with no blockers submits APPROVE,
  incomplete review submits nothing. Report-only writes nothing to
  GitHub but records an internal verdict; authorized submission binds
  the actual commit parameter with lookup before retry on ambiguity.
  Peer code stays readonly. Prompt-only urgent escalation holds approval
  and dangerous actions but never blocks reporting validated risk; when a
  `Notification policy` is present, `axstack-relay` is optional with Paseo
  chat fallback.
  Under angle 6, reviewers verify recorded PR shape against the pinned head and
  base, then apply the matching rationale or exception level. They judge whether
  a stated split failure is real, not the number itself; missing or weak evidence
  is a normal blocking finding returned to the author, never a routine user
  prompt.
- `axstack-watch` — adopts an existing PR after verifying writable
  ownership and user maintenance authority, into a recorded maintenance
  scope needing no new spec or ticket ceremony; observation-only dispatch
  launches no author and sends no reply, dominating every repair path,
  and peer mode never repairs. Authorized repairs reuse the original
  author with reviewed code and exact reply bodies keyed to feedback
  IDs, confirmed against fresh remote head/base, body identity, and
  feedback freshness (expected-old SHA before any history rewrite, no
  blind overwrite), delivered via scoped `gh stack` with receipt
  verification; unknown send outcomes stay blocked until inspected.
  One persistent owner per PR (materialized standalone as
  `axstack-owner`; only the owner launches writer, reviewers, monitor,
  and watchdog; workers never recurse); independent read-only monitor
  (product state, default 5min) and watchdog (watch health only,
  default hourly) on native Paseo timers with verified handshakes,
  snapshot-only healthy ticks, deduped and acknowledged events, and
  reconciled sends. Owner validates readiness against current required
  checks — a review approval alone is not merge-ready.
  Bounded monitoring (default 24h, open PRs included) ending early on
  full merge; resumable handoff carries PR, revision, owner, spec or
  accepted intent, CI/review states, remaining actions, and resume refs.
  No silent renewal. Merge-ready is an observed state, distinct from
  merged; the human merges.

## Native handoff

Axstack no longer ships `axstack-handoff`. Enable Paseo's native
`paseo-handoff` and its `paseo` prerequisite through Paseo's own skill
management when you need to transfer a run. Axstack's installer does not
install or enable those host-managed skills.

The entry checks that both are discoverable before dispatching. If either is
missing, it reports the setup gap, keeps the current owner, and leaves a
resumable run-record pointer. It does not guess a launch command, silently
choose another model, or claim that installation alone proves availability.

The handoff briefing includes Axstack's scope, acceptance, authority, local
`progress.md` path, exact revisions, evidence references, current owners,
pending external receipts, unresolved decisions and timer expiries. Actual
recipient acceptance and ownership reconciliation precede any driver change.
A native fallback suggestion never overrides the user's model choice.
Paseo owns transfer mechanics; Axstack owns the workflow state being transferred.

## Role profiles

The three `profiles/presets/*.json` assets each contain the same 17 `axstack-*`
role IDs and the canonical preset name. Reviewer IDs are neutral; their
provider/model/effort comes from the selected preset. The mixed checker remains
unset until explicit setup and must never dispatch a provider default; both
single-provider presets configure it. Validate availability at launch. An
unavailable model pauses affected work pending user decision—never automatic
substitution. Selected live profiles are authoritative; bundled files are setup
defaults only. Launch order per the bundled reference:
list_profiles, list_providers, list_models (selected provider only),
inspect_provider, create_workspace, create_agent as
`${provider}/${model}`; verify session model/ownership receipts and
persist actual IDs. Configure permissions explicitly and validate
capability (including Linear MCP access) per session. No selected model
is a claim of actual runtime availability.

## Retired explanation assets

An ordinary upgrade retains stale owned assets, so it can leave both the
`axstack-docs` skill and profile beside `axstack-explain`. The new skill
supersedes that old route. Use the [no-force uninstall/install
cycle](installation.md#retiring-former-skills-and-profiles) to remove pristine
retired assets; edited, custom, and unknown assets survive for explicit
resolution. This migration adds no deletion behavior.

## Compatibility

A compatibility claim requires evidence for the actual adapter, model
configuration, skill loading, and tools. An installable skill alone is not
proof of end-to-end support.

## Run record

Substantive delegated or resumable work uses one compact local `progress.md`.
In Git, its root comes from
`git rev-parse --path-format=absolute --git-common-dir`, which resolves to the
main repository's `.git` for the main checkout and every linked worktree.
Without the absolute path option, the main checkout returns a relative
`.git`, making a persisted path depend on the current working directory. The
resulting `axstack/runs/<UTCdate>-<slug>/progress.md` is shared across worktrees
and is never part of the tracked tree. Non-Git work uses private host state.
The driver is the sole writer; the record supports resume and reconciliation
without adding a runtime engine or lock.

## Runtime

Bun >= 1.3.14 only; no Node.js runtime. Workflow checks run with
`bun test tests/workflows/`. The only approved Node-builtin exception is
filesystem access via node:fs and node:fs/promises (Bun-implemented); no
total namespace-purity claim is made beyond that exception.
