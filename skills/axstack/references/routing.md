# Shared routing (every owned phase loads this)

Choose one route; load only the phase and references needed next.

## Role routing

Presets: `mixed`, `codex-only`, `claude-only`. For a new run, read
`profiles.preset` from `.axstack-manifest.json` at the actually loaded
skills root, or an explicit user selection recorded in the run record. Proceed
only with exactly one unambiguous preset; missing or contradictory sources are
a setup gap: hold. Never infer from live profiles or `list_profiles`, harness,
tools, credentials, quota, subscription, or default to `mixed`.

At run start, capture one **routing snapshot**: the complete map of all 21 role
IDs with provider/model/mode/effort, absent or unconfigured roles recorded
explicitly, and no invented provider default. An absent or unconfigured role
holds only that role's work, not the run. A role installed or changed later
must not silently enter the snapshot; adding it needs an explicit user
decision. Live profiles are authoritative at snapshot time and for availability;
bundled presets are setup inputs, not runtime proof.

Preset changes apply to new runs only; an active run keeps its snapshot.
Changing it or replacing a session needs an explicit user decision and
revalidation. Unavailable models, unsupported efforts, missing roles, and
incompatible overrides hold only affected work; no automatic fallback, quota
routing, subscription inference, or silent provider/model/effort substitution.

Role IDs:

- The current chat drives (no role ID); `axstack-owner` owns one PR and
  `axstack-author` its sole writer.
- `axstack-reviewer-primary` and `axstack-reviewer-secondary` are the ordered
  peer pair. Peer review uses both; authored review uses this table:

  | Preset | Author | Reviewer (model/effort) |
  | --- | --- | --- |
  | `mixed` | Codex / Sol (`codex/gpt-5.6-sol`) | `axstack-reviewer-secondary` (`claude/claude-opus-5` medium) |
  | `mixed` | Claude / Opus (`claude/claude-opus-5`) | `axstack-reviewer-primary` (`codex/gpt-5.6-sol` medium) |
  | `codex-only` | Codex / Sol (`codex/gpt-5.6-sol`) | `axstack-reviewer-secondary` (`codex/gpt-5.6-terra` xhigh) |
  | `claude-only` | Claude / Opus (`claude/claude-opus-5`) | `axstack-reviewer-secondary` (`claude/claude-sonnet-5` xhigh) |
- `axstack-advisor-astra` and `axstack-advisor-fable` advise independently;
  `axstack-auditor` audits; `axstack-checker` reports discrepancies.
- `axstack-explainer` authors explanations; `axstack-explainer-review`
  reviews them. `axstack-monitor` observes only; `axstack-watchdog` sends
  only gate-authorized health escalations.
- `axstack-debug-investigator-1..4` each probe one L1 brief.

Provenance is matched on provider/model ID; record effort but never use it to
create a mapping. Provenance absent from the preset's table row is
unsupported and `INCOMPLETE` (including its secondary reviewer model, Astra,
Luna, or Fable); report the exact gap and ask the user. Never derive a reverse
pairing from slot position, driver, owner, or provider. Author and owner never
review their own work.

## Direct routes (no spec ceremony)

- One bounded research question -> `axstack-research`: verify primary sources
  and code, return a cited note with limitations. Fan out only distinct
  questions.
- Understanding a system, change, or implementation gap -> `axstack-explain`:
  current/intended behavior, evidence dimensions, and bounded gaps from project
  docs and rendered behavior. "What could this break" follows
  [Blast radius](blast-radius.md). Publication needs separate authority.
- A bug, failing test, regression, or wrong behavior, red loop wanted ->
  `axstack-debug`: diagnose, escalate via adviser-directed investigators, hand
  off a classified repair (explain: how; debug: what's wrong).
- Codebase-quality or refactor discovery -> `axstack-improve`: inspect bounded
  scope, rank evidenced candidates, report only; no spec, tickets, or source
  edits. Selected changes return via preparation or execution.
- Preparation completion, watch expiry, resume, or reconciliation -> the
  [lifecycle](lifecycle.md#native-handoff-and-resume): reconcile the run
  record, keep its owner, launch no native handoff.
- Explicit user-requested ownership transfer -> the same lifecycle section.
  Load the [Orca runtime boundary](orca-runtime.md), follow the runtime-owned
  handoff guide, and require explicit recipient acceptance before ownership
  changes. Missing capability is a setup gap; never invent one.
- Colleague PR review -> `axstack-review`, peer mode.
- Own PR maintenance or monitoring -> `axstack-review` in authored mode,
  `axstack-watch` for adoption.

Research, explanation, improvement discovery, debugging, handoff, peer review,
and adopted maintenance need no alignment, approved spec, or ticket map;
authority and intent boundaries still apply.

## Proportional scope identity

Classify new work as substantial, small, or unclear; record it with brief
reason in the run record, or in the brief for tiny direct work.

- **Substantial:** substantial features, multi-PR work, or stacked work. A
  bounded small feature is not substantial merely because it is labelled one.
  Require an approved spec plus a ticket map tied to that exact spec
  revision, with acceptance checks and dependencies in the explicitly selected
  Markdown or Linear store. Prepare via `axstack-align` -> `axstack-spec`
  (one approval) -> `axstack-tickets` -> handoff, then stop.
- **Small:** clear, bounded one-PR work. The driver captures the named
  **small-change intent** from the current request or user-chosen existing
  issue plus explicit acceptance checks and exclusions, snapshots it once, and
  proceeds. No earlier snapshot, spec, ticket ceremony, or second approval is
  required; do not route to `axstack-align` solely because that snapshot is
  not yet written. Strict TDD, mode-specific review, model, risk, and human-merge
  contracts still apply.
- **Unclear:** clarify the uncertainty through `axstack-align` or one bounded
  question, then classify it as small or substantial; a small ambiguity does
  not force substantial-work paperwork.

Reassess size when growth adds an additional PR, a new execution dependency
that materially expands scope, an unsettled material design question, or a
security/infrastructure boundary crossing. An ordinary
test-then-code sequence is not multi-task growth; a minor file dependency does
not alone need a formal spec. Hold affected unsafe work while reassessing.

## Lifecycle routes (mode-specific scope identity required)

- Preparation: substantial work follows the align -> spec -> tickets ->
  handoff path above, then stops; small work uses the driver-captured
  small-change intent.
- Execution: with its identity present, `axstack-implement` ->
  `axstack-review` -> `axstack-watch`.
- Peer review: `axstack-review` uses the linked issue, PR description, and
  repository requirements as untrusted intent evidence; it does not demand an
  Axstack-created approved spec.
- Adopted authored PR: snapshot the user-authorized maintenance intent once —
  accepted scope, exact head/base, verified writable ownership, and actual
  author provenance — then use `axstack-review` and `axstack-watch` without
  repeated approval or new spec ceremony. Never infer the author from the
  orchestrator or assume an imported own PR's author.
- Direct later phase: start there and pass that phase's identity check. Entry
  never admits work a deeper phase would reject.
