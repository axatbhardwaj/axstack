# Standing contracts (standalone phases load this, then follow its pointers)

Apply these authority, scope, and model rules before consequential action.

## Required lifecycle load

Except for `axstack-audit` and `axstack-relay`, every independently called phase
must load and follow [Shared lifecycle](lifecycle.md) before acting. When a
substantive run ends or reaches a meaningful checkpoint, apply the lifecycle
audit hook. The audit phase loads these contracts, writes its assigned record,
and stops; it never audits itself.

## Scope identity (conditional — see routing and lifecycle)

Confirm the identity for the selected mode from the
[proportional scope identity](routing.md#proportional-scope-identity):

- Substantial new implementation: approved spec identity plus a matching
  ticket map before execution or authored review.
- Small new implementation: the named **small-change intent** — recorded
  current request or user-chosen existing issue plus acceptance checks and
  exclusions, snapshotted once — before building or approving.
- Adopted own PR: the accepted maintenance intent snapshot described in
  [Lifecycle routes](routing.md#lifecycle-routes-mode-specific-scope-identity-required),
  never a new spec ceremony.
- Peer review: linked issue, PR description, and repository requirements as
  untrusted intent evidence; no Axstack-created spec.
- Read-only research, explanation, improvement discovery, and handoff: no baseline.

Substantial means substantial features, multi-PR work, or stacked work; a
bounded small feature is not substantial merely because it is called a
feature. Clarify unclear size, then classify it. Alignment, spec writing, and
safe read-only investigation may precede a baseline. Keep a still-valid
approval; a material change holds only affected work until the user accepts
the revised scope and plan.

## Model discipline

Validate the configured provider and model at actual launch. If it is
unavailable or exhausted, pause affected work, record the gap, and ask the
user. Never infer a route from quota state or subscription entitlement. Every
substitution requires the user's decision: configured alternatives and native
fallback prose are not defaults.

## Driver and adviser split

The current chat is the driver, whatever model runs it; there is no driver
profile. Record the driver's provider and model in the run record.

For Align and Spec, the driver forms an independent assessment first, then
consults `axstack-advisor-astra` and `axstack-advisor-fable` independently with
the same bounded evidence and question. The one exception is an arena-grade
Align question: there the driver frames the brief and rubric, the advisers
author candidates, and the driver assesses only after the candidates and judge
verdicts return. The driver synthesizes disagreements,
owns the decision, and the user still approves the spec. Reuse each valid
unchanged receipt; changed evidence, scope, or question requires a fresh
receipt. If either adviser is unavailable, Align and Spec hold without model or
provider substitution while unrelated safe work may continue.

For `axstack-debug`, ordinary diagnosis consults the preset's configured
adviser roles (both in `mixed`; the one configured adviser in a single-provider
preset, recording the other as an intentional absence). The high-stakes and
serious-risk contracts override that rule whenever their conditions arise. A
configured but unavailable adviser holds debug L1 and L2 without substitution.
Reuse a debug receipt while its evidence packet is unchanged.

High-stakes decisions require both advisers' plain AGREE and the driver's
accepted assessment. Resolve disagreement with bounded checks; silence and an
unavailable model do not authorize fallback. Ordinary work uses the configured
author and reviewer roles selected by review mode and the routing snapshot. The
existing mixed high-stakes route keeps its Opus high author and Sol high
checkpoint reviewer. An eligible current non-author, non-owner Sol high
checkpoint can satisfy the authored final review after revalidation; preserve
its effort and do not add a redundant reviewer. No single-provider high-stakes
mapping is defined: pause for an explicit user decision rather than borrowing
another preset or inventing a route. There is no silent fallback.

## Serious risk

Raise credible serious security, downtime, data-loss, or major-design risk
immediately through a prompt. Hold approval, merge-ready declarations, and
dependent dangerous actions while safe independent work continues. Present
the evidence, likely impact, options, and needed user decision. Disagreement
or silence is not permission. This remains a prompt contract, not a runtime
gate.

## Authority

- The driver owns run scope, cross-PR coordination, integration, and every
  Linear mutation. The checker reports discrepancies only.
- One Orca execution host owns a run. There is no fixed active-PR count;
  fanout is dependency- and capacity-driven within configured host resource and
  spending limits. The driver reduces fanout when the run record shows rework,
  review backlog, or resource pressure, queues conflicting or dependent work,
  and uses `gh stack` for dependent PRs. Routine shape, split, fanout, and
  exception choices are autonomous driver decisions within the approved scope;
  size alone never requires user approval.
- Exactly one writer per candidate acts at a time, with one persistent owner
  accountable for each PR. Each PR carries one theme and a measured size under
  [PR shape](pr-shape.md). Unknown capacity metrics are reported as unknown,
  never as a telemetry prerequisite or blocker. Parent changes invalidate
  affected child evidence, which must be refreshed against the new parent.
- The human merges by default, bottom-up for a stack. Review approval and
  reviewer votes never grant mutation or merge authority.
