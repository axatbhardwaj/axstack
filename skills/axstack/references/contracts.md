# Standing contracts (standalone phases load this, then follow its pointers)

Apply these authority, scope, and model rules before consequential action.

For user-facing output, follow [STE-inspired writing](ste-writing.md).

## Required lifecycle load

Except for `axstack-audit` and `axstack-correct`, every
independently called phase must load and follow [Shared lifecycle](lifecycle.md) before acting. When a
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
- Peer review: linked issue, PR description, and author comments as context for code and design defects; accept author-stated
  scope/design decisions under [Peer mode](../../axstack-review/SKILL.md#peer-mode-colleague-pr),
  without an Axstack-created spec.
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
user. Only same-provider, same-model account selection among instances of one
driver may use headroom under [Provider bindings](t3-runtime.md#preflight-and-binding).
An exhausted account with no eligible sibling still holds; dispatched roles never fail over mid-thread.
Follow [Provider bindings](t3-runtime.md#preflight-and-binding) for driver account re-selection at turn boundaries.
Never infer any other route from quota state or subscription entitlement. Every
substitution requires the user's decision: configured alternatives are not
defaults. Rejection, timeout, quota and auth failures hold affected work.
Substitution here means changing provider or model, excluding that account selection.
Exception: opt-in default sync can change only the New-chat default within the user-configured pool.
Running threads, dispatched roles, schedules and roles.json keep existing rules.
Read the [T3 runtime boundary](t3-runtime.md) before dispatch, receipt consumption
or recovery; resolve models from the saved capabilities snapshot and verify
requested and effective settings separately.
Optional seats follow [Role roster](role-roster.md), while required seats,
including resolved `model: null` bindings, hold without substitution except that a base auditor
preflight rejection follows [Close-out](lifecycle.md#close-out).

## Driver and adviser split

The current T3 thread is the driver, whatever model runs it; there is no driver
profile. Record the driver's provider and model in the run record.

For Align and Spec, the driver forms an independent assessment first, then
consults `axstack-advisor-astra` and `axstack-advisor-opus` independently with
the same bounded evidence and question. The exception covers every brainstorm: the driver frames
its brief and rubric and assesses only after the candidates and required judge
rounds return. The driver synthesizes disagreements,
owns the decision, and the user still approves the spec. Reuse each valid
unchanged receipt; changed evidence, scope, or question requires a fresh
receipt. If either adviser is unavailable, Align and Spec hold without model or
provider substitution while unrelated safe work may continue.

For `axstack-debug`, ordinary diagnosis consults the preset's configured
adviser roles (both in `mixed`; the one configured adviser in a single-provider
preset, recording the other as an intentional absence). The high-stakes and
serious-risk contracts override that rule whenever their conditions arise. A
configured but unavailable adviser holds debug L1; an unavailable escalation seat holds L2 without substitution.
Reuse a debug receipt while its evidence packet is unchanged.

High-stakes decisions require `axstack-advisor-astra` and
`axstack-escalation-fable` plain AGREE plus the driver's accepted assessment. Resolve disagreement with bounded checks; silence and an
unavailable model do not authorize fallback. Ordinary work uses the configured
author and reviewer roles selected by review mode and the routing snapshot. The
existing mixed high-stakes route keeps its Opus high author and Sol high
checkpoint reviewer. An eligible current non-author, non-owner Sol high
checkpoint can satisfy the authored final review after revalidation; preserve
its effort and do not add a redundant reviewer. No single-provider high-stakes
mapping is defined: pause for an explicit user decision rather than borrowing
another preset or inventing a route. There is no silent fallback.

Use `axstack-escalation-fable` only for arena round 2, high-stakes decisions,
or when two attempts at the same named goal fail a stated acceptance check
(including debug L2 or a spec decision rejected twice). It also applies when
Astra and Opus still contradict after one reconciliation with no safe
discriminating check. A bare "stuck" claim needs pointers to two failed attempts;
setup slips and new user requirements do not count. Each use starts a fresh
session that never reuses an adviser or candidate context. Escalation never
resets existing holds or attempt budgets.
At an advised hold or step-back that is not high-stakes, an adviser split goes
to the user with no reconciliation and no Fable.

## Advised holds

Advise when a hold reaches the user and the reply picks between two or more
paths an agent can then carry out.
The criterion governs and the examples are illustrative.
The never-advised list is exhaustive and judged by the cause, rather than reply
option wording.
Examples include `verification not proven`, provenance or unclosable-verification
merge cards, a blocked operation after bounded recovery, a scoped no-test-first
decision, the round-4 step-back hold, major-design urgent escalation in authored
or codebase review, and authored `Escalate to user` concerns about security,
permanent on-chain state changes or an architectural change in approach.
Diligence `UNKNOWN` and a `Learning` contradiction remain driver dispositions,
advised only if raised to the user as a hold.

Never advise spec approval, npm stage approval or collaborator approval.
Never advise access or credentials.
Never advise forge merges by the user.
Never advise `Auto-merge: off`.
Never advise risky-path holds.
Never advise work-promotion, deploying-base or unknown-base report cards.
Never advise the report-only comment-rating card.
Never advise model unavailability or substitution.
Never advise denied actions or explicit user stops.
Never advise peer-review holds; peer mode keeps its cap panel and sends no other human ping.
Never advise review-manager pass holds; the manager keeps its flagged-thread path.

Before advice the driver closes the gap where possible under existing rules,
then forms its own assessment.
This pre-advice gap-closing never spends the one advice-driven action.
In `mixed`, consult `axstack-advisor-astra` and `axstack-advisor-opus`
independently with the same bounded evidence packet and question.
The evidence packet and question omit the driver's own pick.
Advisers never cross-read one another.
Single-provider presets use the one configured adviser and record the other
as an intentional absence.

For high-stakes holds, use `axstack-advisor-astra` and `axstack-escalation-fable`
plain AGREE after bounded checks under the existing high-stakes contract
instead of the ordinary seats.
For a single-provider high-stakes hold, pause for an explicit user decision
under the existing contract.
In a single-provider preset, consult the configured one of those two seats once.
Show `advice unavailable: <seat>` for the absent high-stakes seat.
In a single-provider preset, no AGREE can form.
Mark the single-provider high-stakes card `high-stakes: no AGREE`
in the parenthetical `Recommended` status.
Only seats and disagreement handling follow that contract.
For high-stakes holds the card, wait and authority rules here still apply.
If Astra and Fable still disagree, show both options with the driver's pick
first and `high-stakes: no AGREE` in the parenthetical `Recommended` status.
The user's pick is the explicit user decision.
The driver's pick never counts as AGREE.

Add `Recommended`, `Trade-off`, `Checks would miss` and numbered `Reply` lines
to the existing card:

```text
Recommended: <option n> (<advisers agree | advisers split | one adviser | advice pending: <seat> | advice unavailable: <seat>>)
Trade-off: <one line>
Checks would miss: <what tests and review would miss on this path | n/a for a non-code hold>
Reply: 1. <option> 2. <option> ...
```

On a non-high-stakes split show both options with one-line reasons and the
driver's pick first; apply the Fable carve-out above.
On a single-provider adviser disagreement with the driver, show both options
with one-line reasons and the driver's pick first, as on a split.
With multiple open cards each reply names its PR, or the hold key for a hold
without a PR.
An ambiguous reply clears nothing and the driver asks once.
Advice never clears a hold or grants approval, merge or `user-accepted unproven`.
Silence never applies the recommendation.
A user reply clears only its bound cause.

Make one attempt per seat with no automatic retry or substitution.
With a run watch armed wait at most until the next bound watch wake, then
post the card.
With no watch armed post the card at once.
A running seat shows `advice pending: <seat>` on the card.
A failed or unavailable seat shows `advice unavailable: <seat>` on the card.
Late advice is an addendum in the driver thread, never a new hold or second alert.
Keep pending dispatches in the run record and settle them when they terminate.
Record an unavailable seat as a model gap for later work needing that seat.
An advice gap never blocks the card or the user's reply.

Reuse an advice receipt while its cause and evidence packet, including patch-id,
are unchanged.
Changed evidence, authority or question requires fresh advice.
The round-4 card reuses the step-back advisers with a delta-only brief.
On a head or base change, supersede the card under the existing supersede rules.
Reissue the card only if the decision is still needed, bound to the current head and base.
Reuse unchanged advice when reissuing the card.
A reissued card for the same cause is the same hold and sends no new alert.
A reply bound to a superseded head or base clears nothing at the new head or base.

After advice, per PR and cause kind the driver can act once on advice to close the cause
within existing authority only when advisers agree.
In single-provider presets, for self-close the adviser must agree with the driver.
Post the card on a split or a single-adviser disagreement with the driver.
Post the card when the cause recurs after that one action, or when the action raises a new hold.

Outside peer mode raise every serious-risk hold immediately in watch, implement,
review, autopilot or debug before dispatching advisers.
Serious-risk holds include security, downtime, data loss and major design.
Serious-risk advice follows as an addendum with no second alert.
Peer serious-risk holds stay never advised under the peer-review exclusion above.

### Parked user-reply holds

When late advice completes and the hold becomes user-only, re-evaluate parking
eligibility and update the existing text card under the same hold key.

A parked hold waits only on a user reply in chat.
A parked hold has no unsettled worker, pending adviser seat or pending receipt.
A parked run has no forge-resolved hold and no other member PR needing watch events (CI, review, approval or repair).
Never park holds resolved on the forge, including user merge, npm stage approval
and human review.
Scoped and forge-resolved holds use a text card only, and watches and the
60-minute backstop stay.

For parking:

1. Call `unwatch_pull_request` for each watched member.
2. Post or update the text card saying "answer the prompt".
3. Call `update_scheduled_task` `enabled:false` and read it back.
4. Cancel queued copies of the run-watch prompt.
5. Use the harness question tool.

Include the PR URL, cause, head and base in the question, with the recommended
option first and numbered replies.
If disable or its read-back fails, reconcile the exact schedule ID.
For either failed-disable branch, update the existing text card by posting a
corrected version under the same hold key without a new alert.
When verified enabled, roll back to the unparked user-decision state, re-arm
watches using the [native-watch recovery procedure](t3-runtime.md#native-pr-links-and-watches)
and update the existing text card to remove "answer the prompt" and omit the question.
After successful native re-arm, set cadence to 60 min.
If native re-arm fails or is rate-limited, use the 5-minute recovery cadence
under the [native-watch recovery procedure](t3-runtime.md#native-pr-links-and-watches).
When the state remains unknown, update the existing text card to remove
"answer the prompt", mark it `automatic recovery unproven`, hold UNKNOWN and
omit the question.
Never infer an enabled backstop from a failed read.

On an answer from the question tool or chat:

1. Reconcile current PR and run state.
2. Bind the answer to the hold key, head and base.
3. Re-enable the schedule.
4. Re-arm watches using the [native-watch recovery procedure](t3-runtime.md#native-pr-links-and-watches).
5. Continue.

Stale answers clear nothing.
While parked there is no wake source and the text card is the lasting signal.
On the user's next message, if the hold is still open and
`t3_pending_request_list` shows no pending request, re-ask once under the same
hold key.
Re-ask without a new alert.
If the question tool is unavailable, follow the same parking order, omit the
question step and record `question tool unavailable`.

## Serious risk

Raise credible serious security, downtime, data-loss, or major-design risk
immediately through a prompt. Hold approval, merge-ready declarations, and
dependent dangerous actions while safe independent work continues. Present
the evidence, likely impact, options, and needed user decision. Disagreement
or silence is not permission. This remains a prompt contract, not a runtime
gate.

For local repository-state recovery, this exception applies.
Only when the repair is fully reversible from a checksummed backup verified
before repair, the driver can repair local state of its own run repository.
Record the backup path, checksum, verification, and restore command.
Post a post-repair note in the T3 driver thread.
The driver must never edit candidate source during this repair.
Keep exactly one writer per candidate.
Effects outside the run repository or repairs without a verified backup
remain a serious-risk hold.

## Authority

- The driver owns scope, cross-PR coordination, integration, and every selected
  external-tracker mutation. Checker reports discrepancies only.
- One T3 host/server owns a run. No fixed active-PR count; fanout is dependency-
  and capacity-driven within host resource and spending limits. Reduce fanout for
  recorded rework, review backlog, or resource pressure. Queue conflicts and
  dependencies; follow [PR chains](pr-chain.md). Routine shape, split, fanout, and
  exception choices within approved scope are autonomous driver decisions; size alone never
  requires user approval.
- Exactly one writer per candidate; one persistent accountable PR owner. Each PR has one theme and measured size under [PR shape](pr-shape.md). Report unknown capacity
  metrics; never a telemetry prerequisite or blocker. PR chains owns child evidence invalidation and refresh.
- Own PRs default to automatic merge under [watch §5](../../axstack-watch/SKILL.md).
  Review approval and reviewer votes alone never grant mutation or merge authority.
  User merges are bottom-up for a stack.
