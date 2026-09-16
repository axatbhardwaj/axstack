# Shared routing (every owned phase loads this)

Choose one route; load only the phase and references needed next.

## Configured role routing

Canonical presets are `mixed`, `codex-only`, and `claude-only`. For a new run,
read `profiles.preset` from `.axstack-manifest.json` at the actually loaded
skills root, or an explicit user selection recorded in the run record. Proceed
only if those sources give exactly one unambiguous preset. Missing or
contradictory sources are a setup gap: hold. Never infer from live profiles or `list_profiles`, harness, tools, credentials,
quota, subscription, or default to `mixed`.

At run start, capture one **routing snapshot**: the complete map of all 17 role
IDs and their provider/model/mode/effort, with absent or unconfigured roles
recorded explicitly and no invented provider default. An absent or unconfigured
role holds only that role's work, not the run. A role installed or changed later
must not silently enter the snapshot; ask for an explicit user decision to add
it. Live profiles are authoritative at snapshot time and for availability;
bundled presets are setup inputs, not runtime proof.

Preset changes apply to new runs only; an active run keeps its snapshot.
Changing it or replacing a session requires an explicit user decision and
revalidation. Unavailable models, unsupported efforts, missing roles, and
incompatible overrides hold only affected work. No automatic fallback, quota
routing, subscription inference, or silent provider/model/effort substitution.

Stable role IDs:

- The current chat drives (no role ID); `axstack-owner` owns one PR;
  `axstack-author` is its exclusive writer.
- `axstack-reviewer-primary` and `axstack-reviewer-secondary` are the ordered
  peer pair. Peer review uses both; authored review uses only this table:

  | Preset | Actual author provider/model | Reviewer role (configured model/effort) |
  | --- | --- | --- |
  | `mixed` | Codex / Sol (`codex/gpt-5.6-sol`) | `axstack-reviewer-secondary` (`claude/claude-opus-5` medium) |
  | `mixed` | Claude / Opus (`claude/claude-opus-5`) | `axstack-reviewer-primary` (`codex/gpt-5.6-sol` medium) |
  | `codex-only` | Codex / Sol (`codex/gpt-5.6-sol`) | `axstack-reviewer-secondary` (`codex/gpt-5.6-terra` xhigh) |
  | `claude-only` | Claude / Opus (`claude/claude-opus-5`) | `axstack-reviewer-secondary` (`claude/claude-sonnet-5` xhigh) |
- `axstack-advisor-astra` and `axstack-advisor-fable` advise independently;
  `axstack-auditor` audits and `axstack-checker` reports discrepancies.
- `axstack-explainer` authors explanations and `axstack-explainer-review`
  reviews them. `axstack-monitor` observes only; `axstack-watchdog` sends
  only gate-authorized health escalations.

Provenance is matched on provider/model ID; record effort, but never use it to
create a mapping. Any provenance absent from the selected preset's table row is
unsupported and `INCOMPLETE`, including its secondary reviewer model, Astra,
Luna, or Fable. Report the exact gap and ask the user. Never derive a reverse
pairing from slot position, driver, owner, or provider. Author and owner remain
ineligible to review their own work.

## Direct routes (no spec ceremony)

- One bounded research question -> `axstack-research`: verify primary sources
  and code; return a cited note with limitations. Fan out only distinct
  questions.
- Understanding a system, change, or implementation gap -> `axstack-explain`.
  Show current/intended behavior, evidence dimensions, and bounded gaps; use
  project docs and verify rendered behavior when applicable. Stale axstack-docs
  is superseded. Publication needs separate authority.
- Codebase-quality or refactor discovery -> `axstack-improve`: inspect bounded
  scope, rank evidenced candidates, and report only. No spec, tickets, or source
  edits; selected changes return through preparation or execution.
- Preparation completion, watch expiry, resume, or reconciliation -> the
  [handoff/resume lifecycle](lifecycle.md#native-handoff-and-resume): reconcile
  the run record, keep its owner, and launch no native handoff.
- Explicit user-requested ownership transfer -> the same lifecycle section.
  Load the [Orca runtime boundary](orca-runtime.md), follow the runtime-owned
  handoff guide, and require explicit recipient acceptance before ownership
  changes. Missing capability is a setup gap, never license to invent one.
- Colleague PR review -> `axstack-review` in peer mode.
- Own PR maintenance or monitoring -> `axstack-review` in authored mode and
  `axstack-watch` for adoption.

Research, explanation, improvement discovery, handoff, peer review, and adopted
maintenance need no alignment, approved spec, or ticket map; authority and
intent boundaries still apply.

## Proportional scope identity

Classify new work as substantial, small, or unclear; record the classification
with brief reason in the run record. Tiny direct work without one puts
size/reason in its brief.

- **Substantial:** substantial features, multi-PR work, or stacked work. A
  bounded small feature is not substantial merely because it is labelled one. Require an approved spec plus a ticket map tied to that exact
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
