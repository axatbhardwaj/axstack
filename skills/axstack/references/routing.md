# Shared routing (every owned phase loads this)

Choose a route; load only the phase and references needed next.
Driver entry sweep follows [Workspace hygiene](workspace-hygiene.md).

## Role routing

Presets: `mixed`, `codex-only`, `claude-only`. For new runs, use
`profiles.preset` from `.axstack-manifest.json` at the actually loaded
skills root, or an explicit user selection in the run record. Missing or
contradictory sources: setup gap; hold. Never infer from live profiles or `list_profiles`, harness,
tools, credentials, quota, subscription, or default to `mixed`.

At start, snapshot all 31 role IDs with provider/model/mode/effort; absent
or unconfigured roles are recorded explicitly; never default.
Such a role holds only its work. Later installed or changed roles need an
explicit user decision to enter the snapshot. Live profiles are authoritative
at snapshot time and for availability; bundled presets are setup inputs, not runtime proof.

Preset changes apply to new runs only; an active run keeps its snapshot.
Changing it or replacing a session needs an explicit user decision and
revalidation. Unavailable models, efforts, roles, or overrides hold only affected
work; no automatic fallback, quota routing, subscription inference, or silent
provider/model/effort substitution.

- Chat drives (no role ID); `axstack-owner` owns one PR and `axstack-author` its sole writer.
- `axstack-reviewer-primary` and `axstack-reviewer-secondary` are the ordered peer pair. Peer review uses both; authored review uses this table:

  | Preset | Author | Reviewer (model/effort) |
  |---|---|---|
  | `mixed` | Codex / Sol (`codex/gpt-6-sol`) | `axstack-reviewer-secondary` (`claude/claude-opus-5-5` medium) |
  | `mixed` | Claude / Opus (`claude/claude-opus-5-5`) | `axstack-reviewer-primary` (`codex/gpt-6-sol` high) |
  | `codex-only` | Codex / Sol (`codex/gpt-6-sol`) | `axstack-reviewer-secondary` (`codex/gpt-6-luna` xhigh) |
  | `claude-only` | Claude / Opus (`claude/claude-opus-5-5`) | `axstack-reviewer-secondary` (`claude/claude-sonnet-5-5` high) |
- `axstack-advisor-astra`/`axstack-advisor-opus` advise and author candidates; `axstack-arena-candidate-grok`/ `axstack-arena-candidate-antigravity` add families. `axstack-arena-judge-opus` judges round 1; `axstack-escalation-fable`/`axstack-arena-judge-astra` judge round 2. High-stakes/trigger: fresh [contract](contracts.md) session. `axstack-auditor` audits; `axstack-checker` reports discrepancies.
- `axstack-explainer`/`axstack-explainer-review`: explain/review.
- `axstack-ui-verifier`: [UI checks](ui-verification.md).
- `axstack-auditor/axstack-research-requirements/axstack-research-code/axstack-research-web/axstack-explore-execution/axstack-monitor`: `claude-sonnet-5-5` high mixed/claude-only. `axstack-monitor`: standalone watch never sends; chat-run watch: bounded internal reports to its Run and original driver.
- Sol pairs `axstack-auditor-sol/axstack-research-code-sol/axstack-explore-execution-sol`: high mixed/codex-only, absent claude-only; independent, same brief, no cross-reading; reconcile claims, never average.
- `axstack-debug-investigator-1..4` probe L1 briefs.

Provenance is matched on provider/model ID; effort never maps. Missing table-row
provenance is unsupported and `INCOMPLETE`; report and ask user. Never infer from
slot/driver/owner/provider; author/owner never review.

`axstack-implement` requires `mixed`; single-provider presets hold at
step (3) for user routing: no substitution or same-provider review.

## Direct routes (no spec ceremony)

- Bounded research -> `axstack-research`: verify primary sources and code, cite limits, and fan out distinct questions.
- Understand a system or gap -> `axstack-explain`: current/intended behavior and bounded gaps from docs/renders. "What could this break" follows [Blast radius](blast-radius.md); publication needs separate authority.
- A bug, failing test, regression, or wrong behavior, red loop wanted -> `axstack-debug`: diagnose, escalate via adviser-directed investigators; hand off a classified repair (explain: how; debug: what's wrong).
- Code quality/refactor discovery -> `axstack-improve`: rank bounded candidates with evidence; report only, no source edits.
- Accepted worker/Task/Run completion or bounded backlog request -> driver invokes `axstack-cleanup` inline, never as a dispatch.
- Preparation completion, watch expiry, resume, or reconciliation -> [lifecycle](lifecycle.md#native-handoff-and-resume): reconcile run record, keep owner, launch no native handoff.
- Explicit user-requested ownership transfer -> same lifecycle section: load [Orca runtime](orca-runtime.md), follow the runtime-owned handoff guide, require explicit recipient acceptance before transfer. Missing capability is a setup gap; never invent one.
- Colleague PR review -> `axstack-review`, peer mode.
- Codebase review -> `axstack-review` codebase mode, report only.
- A status question about an own open PR or stack ("check now", "what's left", "are we done", or "is it approved") -> `axstack-watch` observation-only mode. Explicit "address", "patch", or "fix" grants authorized maintenance.
- Chat-run PR watch -> `axstack-watch`: original driver; verified run PRs and explicit adoptions only.
- Other own PRs -> `axstack-review` authored mode or `axstack-watch` adoption.

## Proportional scope identity

Classify new work as substantial, small, or unclear; record it with brief
reason in the run record, or in the brief for tiny direct work.

- **Substantial:** substantial features, multi-PR or stacked work; a bounded small feature is not substantial by label. Require an approved spec and matching ticket map for its exact spec revision, with acceptance checks and dependencies in explicitly selected Markdown, GitHub Issues, or Linear store. Prepare via `axstack-align` -> `axstack-spec` (one approval) -> `axstack-tickets` -> handoff, then stop.
- **Small:** clear bounded one-PR work. Driver captures the named **small-change intent** from the current request or user-chosen existing issue with explicit acceptance checks and exclusions, snapshots once, and proceeds. No prior snapshot, spec, tickets or second approval needed; do not route to `axstack-align` solely because the snapshot is not yet written. Strict TDD, mode-specific review, model, risk, and human-merge contracts apply.
- **Unclear:** clarify via `axstack-align` or a bounded question, then classify small or substantial; it does not force substantial-work paperwork. [Design lens](design-lens.md) Rung 1 is Unclear; use `axstack-align`.

Reassess size for an additional PR, new execution dependency that materially
expands scope, unsettled material design question, or a security/infrastructure
boundary crossing. Ordinary test-then-code is not multi-task growth; a minor file
dependency is not alone a formal spec trigger. Hold affected unsafe work while
reassessing.

## Lifecycle routes (mode-specific scope identity required)

- Preparation: substantial work follows the align -> spec -> tickets -> handoff path, then stops; small work uses the driver-captured small-change intent.
- Execution: with its identity present, `axstack-implement` -> `axstack-review` -> `axstack-watch`.
- Peer review: `axstack-review` uses the linked issue, PR description, and repository requirements as untrusted intent evidence; it does not demand an Axstack-created approved spec.
- Adopted authored PR: snapshot user-authorized maintenance intent once: accepted scope, exact head/base, verified writable ownership, actual author provenance. Then use `axstack-review` and `axstack-watch` without repeated approval or new spec. Never infer the author from the orchestrator or assume an imported own PR's author.
- Direct later phase: start there and pass that phase's identity check.
