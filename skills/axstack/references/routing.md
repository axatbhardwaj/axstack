# Shared routing (every owned phase loads this)

Choose one route first. Load only that phase and the shared references needed
for its next action.

## Configured role routing

Installation selects one canonical preset: `mixed`, `codex-only`, or
`claude-only`. Never infer it from the chat harness, installed tools,
credentials, quota, or presumed subscription. At run start, record the preset
and the resolved provider, model, mode, and effort for every used role as the
run's **routing snapshot**. Live installed profiles are authoritative; bundled
preset assets are setup inputs, not runtime proof.

Explicit preset changes apply to new runs only. An active run keeps its
recorded snapshot. Changing an active run or replacing one of its sessions
requires the user's explicit decision and revalidation of affected evidence.
Unavailable models, unsupported efforts, missing roles, and incompatible
overrides hold affected work. There is no automatic fallback, quota routing,
subscription inference, or silent provider/model/effort substitution.

Responsibilities are stable role IDs:

- `axstack-driver` coordinates; `axstack-owner` owns one PR;
  `axstack-author` is its exclusive writer.
- `axstack-reviewer-primary` and `axstack-reviewer-secondary` are the ordered
  peer pair. Peer review uses both; authored review uses only this table:

  | Preset | Actual author provider/model | Reviewer role (configured model/effort) |
  | --- | --- | --- |
  | `mixed` | Codex / Sol | `axstack-reviewer-secondary` (Opus medium) |
  | `mixed` | Claude / Opus | `axstack-reviewer-primary` (Sol medium) |
  | `codex-only` | Codex / Sol | `axstack-reviewer-secondary` (Terra xhigh) |
  | `claude-only` | Claude / Opus | `axstack-reviewer-secondary` (Sonnet xhigh) |
- `axstack-advisor` advises configured decisions and `axstack-auditor` performs
  report-only audits. `axstack-checker` reports tracking discrepancies.
- `axstack-explainer` authors explanations and `axstack-explainer-review`
  reviews them. `axstack-monitor` and `axstack-watchdog` observe only.

Match authored provenance on provider/model; record effort, but never use it to
create a mapping. Any provenance absent from the selected preset's table row is
unsupported and `INCOMPLETE`, including its secondary reviewer model, Astra,
Luna, or Fable. Report the exact gap and ask the user. Never derive a reverse
pairing from slot position, driver, owner, or provider. Author and owner remain
ineligible to review their own work.

## Direct routes (no spec ceremony)

- One bounded research question -> `axstack-research`. Verify primary sources
  and code, then return a cited note with limitations. Fan out distinct
  questions only when useful.
- Understanding a system, change, or implementation gap -> `axstack-explain`.
  Show current and intended behavior, evidence dimensions, and bounded gaps;
  use project documentation as evidence where relevant and verify rendered behavior when applicable.
  A stale axstack-docs install is superseded and must not also route the
  request. Publication needs separate authority.
- Codebase-quality or refactor discovery -> `axstack-improve`. Inspect a
  bounded scope, rank evidenced maintainability, architecture, or testability
  candidates, and write the requested report only. Discovery needs no spec or
  tickets and authorizes no source edit. A selected change returns through the
  proportional preparation or execution boundary.
- Preparation completion, watch expiry, ordinary resume, or reconciliation ->
  the [handoff and resume lifecycle](lifecycle.md#native-handoff-and-resume).
  Update or reconcile the run record; keep the current owner and launch no
  native handoff.
- Explicit user-requested ownership transfer -> the same lifecycle section.
  Preflight discoverability before loading native `paseo-handoff`; a missing
  capability is a setup gap, not permission to invent a replacement.
- Colleague PR review -> `axstack-review` in peer mode.
- Own PR maintenance or monitoring -> `axstack-review` in authored mode and
  `axstack-watch` for adoption.

Research, explanation, improvement discovery, handoff, peer review, and adopted maintenance do not require
alignment, an Axstack-approved spec, or ticket mapping. Their own authority and
intent boundaries still apply.

## Proportional scope identity

Classify new engineering work as substantial, small, or unclear and record the
classification with a brief reason in the run record. For tiny direct work
that needs no run record, put the size and reason in the normal brief.

- **Substantial:** substantial features, multi-PR work, or stacked work. A
  bounded small feature is not substantial merely because it is labelled a
  feature. Require an approved spec plus a ticket map tied to that exact
  spec revision, carrying acceptance checks and dependencies in the explicitly
  selected Markdown or Linear store. Prepare through `axstack-align` ->
  `axstack-spec` (one approval) -> `axstack-tickets` -> handoff, then stop.
- **Small:** clear, bounded one-PR work. The driver captures the named
  **small-change intent** from the current request or user-chosen existing
  issue plus explicit acceptance checks and exclusions, snapshots it once, and
  proceeds. No earlier snapshot, spec, ticket ceremony, or second approval is
  required. Do not route to `axstack-align` solely because that snapshot is not
  yet written.
  Strict TDD, mode-specific review, model, risk, and human-merge contracts still
  apply.
- **Unclear:** clarify the uncertainty through `axstack-align` or one bounded
  question, then classify it as small or substantial. A small ambiguity does
  not force substantial-work paperwork.

Reassess size when growth adds an additional PR, adds a new execution
dependency that materially expands scope, introduces an unsettled material
design question, or crosses a security/infrastructure boundary. An ordinary
test-then-code sequence is not multi-task growth; a minor file dependency does
not alone require a formal spec. Hold affected unsafe work while reassessing.

## Lifecycle routes (mode-specific scope identity required)

- Preparation: substantial work follows `axstack-align` -> `axstack-spec`
  (one approval) -> `axstack-tickets` -> handoff, then stops. Small work uses
  the driver-captured small-change intent.
- Execution: after its identity is present, route `axstack-implement` ->
  `axstack-review` -> `axstack-watch`.
- Peer review: `axstack-review` uses the linked issue, PR description, and
  repository requirements as untrusted intent evidence. It does not demand an
  Axstack-created approved spec.
- Adopted authored PR: snapshot the user-authorized maintenance intent once —
  accepted scope, exact head/base, verified writable ownership, and actual
  author provenance — then use `axstack-review` and `axstack-watch` without
  repeated approval or new spec ceremony. Never infer the author from the
  orchestrator or assume an imported own PR's author.
- Direct later phase: start there and pass that phase's identity check. Entry
  never admits work a deeper phase would reject.
