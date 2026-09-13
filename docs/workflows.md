# Axstack workflows

Chat drives execution; the CLI installs and checks assets. Paseo owns
sessions, workspaces, delegation, notifications, schedules, and heartbeats.
No Axstack daemon, multi-host scheduler, or upstream skill dependency.

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
- `axstack-docs` — source-backed prose and requested visual
  explanations. Preserve the requested format and theme; verify actual
  rendered behavior where applicable and report unavailable evidence.
  Publication needs its own authority.
- `axstack-handoff` — compact handoffs, resume reconciliation, and
  routing back into the lifecycle.

## Phase skills

Progressive loading: invoke only the phase needed. Every lifecycle phase
loads the shared bundled references (`skills/axstack/references/`):
Paseo launch materialization and standing scope/model/risk/authority
contracts, plus routing and lifecycle/receipt references.

- `axstack` — entry router: lifecycle, holds, one host, two PRs, one owner per PR.
- `axstack-align` — interview and resolve factual questions.
- `axstack-spec` — observable acceptance criteria, exclusions, approved revision baseline.
- `axstack-tickets` — Linear native document preflight per session (missing access is a setup gap), explicit Markdown fallback, capability to task map, report-only checker, driver-owned updates. Reviewed-but-unmerged stays **In Review**; Done needs all required PRs merged plus acceptance checks passing.
- `axstack-implement` — strict red-green-refactor with revision-tied evidence; exclusive writers; `gh stack` coordination; restart reconciliation (ambiguity never authorizes a duplicate writer).
- `axstack-review` — peer mode accepts the PR description, linked issue,
  and repository requirements as intent with no Axstack-created approved
  spec; authored mode retains the approved baseline and accepts an
  adopted maintenance scope snapshot without repeated approval. Exactly
  two independent Sol and Opus final reviewers, same six-angle brief, no
  first-pass cross-reading, no votes. Completeness is separate from the
  recommendation: complete evidence with validated defects submits
  REQUEST_CHANGES, complete evidence with no blockers submits APPROVE,
  incomplete review submits nothing. Report-only writes nothing to
  GitHub but records an internal verdict; authorized submission binds
  the actual commit parameter with lookup before retry on ambiguity.
  Peer code stays readonly. Prompt-only urgent escalation holds approval
  and dangerous actions but never blocks reporting validated risk;
  Hermes relay is optional with Paseo chat fallback.
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

## Role profiles

`profiles/paseo.json` (`version: 1`, `agentProfiles` array, `axstack-*`
IDs with `name` fields matching the live list_profiles schema) covers the preferred driver (current chat stays
driver; never auto-launch), Fable advisor (claude `plan`, involved in
spec creation/revision, solution design, and consequential decisions;
driver owns the decision, user approves the spec, cached receipts avoid
repeat consultation), Opus owner
(claude `default`), Sol author (codex `auto`), independent Opus
(claude) and Sol (codex) reviewers, and the report-only checker. The
checker model stays null until user setup and must never dispatch a
provider default. Namespaced role defaults extend the same file for
research requirements/code/web, docs authorship, visual explanation and
its review, codebase and execution exploration, the monitor and
watchdog roles, and the read-only Luna auditor (evidence with counts
and denominators; proposals return as tested, reviewed PRs for human
merge; raw run records stay local). Conservative presets are claude `default` and codex
`auto`; validate model availability at launch. An
unavailable model pauses affected work pending user decision — never
automatic substitution. Selected live profiles are authoritative; the
bundled file ships setup defaults only. Launch order per the bundled reference:
list_profiles, list_providers, list_models (selected provider only),
inspect_provider, create_workspace, create_agent as
`${provider}/${model}`; verify session model/ownership receipts and
persist actual IDs. Configure permissions explicitly and validate
capability (including Linear MCP access) per session. No selected model
is a claim of actual runtime availability.

## Compatibility

A compatibility claim requires evidence for the actual adapter, model
configuration, skill loading, and tools. An installable skill alone is not
proof of end-to-end support.

## Runtime

Bun >= 1.3.14 only; no Node.js runtime. Workflow checks run with
`bun test tests/workflows/`. The only approved Node-builtin exception is
filesystem access via node:fs and node:fs/promises (Bun-implemented); no
total namespace-purity claim is made beyond that exception.
