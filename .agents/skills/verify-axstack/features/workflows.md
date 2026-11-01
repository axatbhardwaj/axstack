# Inspect workflow instruction contracts

Multi-project coordination: `multi-driver.test.js` checks the shared runtime
guidance reached from routing, lifecycle, run-record and Implement. Semantic
removal/inversion/rewording probes cover authorized fanout, launch-only authority
holds, independent continuation, cross-project binding, null native parents,
driver handbacks and exclusive PR/record ownership. This proves instructions;
live multi-driver launch and handback remain separate authorized driver checks.

R7c runtime recovery: `recovery-wait-records.test.js`,
`recovery-boundaries.test.js`, `recovery-wake-precedence.test.js` and
`delegate-wake-boundary.test.js` cover the
owner-authored versioned waiting/closing protocol, stable condition dedupe,
immediate diagnosis, non-reply authority, report-only holds, exact owned cleanup
and shared-service preservation. Semantic removal/inversion fails and equivalent
rewording passes; record field names are wire contracts. Existing runtime/watch
keepers retain native completion, own-PR/release 60-minute backstops and
launched-fallback Writer/watch fallback 5-minute responsibilities, with zero
scheduled status checks of running delegates. These checks prove shipped
instructions only. Native queue/idempotency, Stop/restart/provider failure,
external-dependency event support and cross-host sends require an
implementation-authorized bounded synthetic canary with exact receipts; this recipe activates nothing.

Readable shared specifications: `skills/axstack-spec/SKILL.md` loads its relative
`references/format.md`; draft-spec diligence checks comprehension alongside
completeness. `spec-format.test.js` covers brief-first decisions/scope/risks,
binding capability contracts, current criteria versus immutable approved history,
and a usable example with semantic removal/inversion/rewording probes.

Independent delivery: Spec, its format, Tickets and Implement explicitly load
`skills/axstack/references/independent-delivery.md`. The
`independent-delivery{,-maps}.test.js` checks cover loaded outcome/interface
obligations, conditional separate drivers, accepted authority, launch-only holds,
execution admission, semantic conflicts, artifact milestones versus Git ancestry,
current evidence/invalidation and the existing map/receipt templates. Semantic
rules reject removal/inversion and accept equivalent wording. These are instruction
contracts: fresh exact-candidate Spec -> Tickets -> Implement decision evaluation
and actual native multi-driver operation remain separate driver-owned evidence.

`workflow-retirement.test.js` guards active guidance and presets against retired
workflow routes while preserving the documented installer harness interfaces.

Entry points: packaged workflow skills and shared references; fixtures:
`tests/workflows/{completion-guards,workspace-hygiene,manager-pass-settlement,manager-holds,relay-removal,merge-audit-discipline,merge-escalation,autopilot-repair,dependabot-driver,analysis-pairs}.test.js`.
Settlement read-back contracts: `tests/workflows/settle-readback.test.js` and
`tests/workflows/native-pr-watch.test.js` cover read-first native/manual author settlement.
The native-watch contracts also cover driver-only arming, stop conditions,
non-user-stop recovery with unsettle and diagnostic rate-limit checks, and
conflict-free base movement through the existing base-update rule.
`chat-run-watch.test.js` and `automatic-own-pr-watch.test.js` cover the hourly
backstop, five-minute recovery, user Stop exclusion and schedule-only digest.
`parked-holds.test.js`, `parked-hold-order.test.js`, `hold-waiting.test.js` and
`parked-watch.test.js` cover the shared user-reply
hold procedure and its runtime, Autopilot, watch and public-guide references.
Their removal, inversion and rewording probes verify instruction contracts;
the live parking and restart canary remains a separate driver check.
Native-watch checks also cover next-wake quota recovery and re-arming remaining
PRs after a merge auto-settles the driver, including the host-guide copies.
`watch-quota-recovery.test.js` covers saved reset deadlines and digest deferral
and restart; cadence checks define native wake sources. These remain instruction contracts.
`hidden-author-dispatch.test.js` checks worktree delegation, fresh branch bootstrap,
idempotent recovery, same-child repair, delegated candidate checks and manual
settlement/retirement in each shipped copy; the live canary stays a driver check.
Runtime preflight contracts cover merge-deleted author worktrees and private evidence.
Review entry point: `skills/axstack-review/SKILL.md`; loaded references:
`references/codebase-mode.md`, `references/codebase-brief.md`,
`references/codebase-report.md`, `references/peer-mode.md`,
`references/review-candidate.md`, `references/candidate-brief.md` and
`references/review-receipt.md` under `skills/axstack-review/`.
Watch readiness entry point: `skills/axstack-watch/SKILL.md`; loaded references:
`references/readiness.md`, `references/proven-verification.md`,
`references/escalation.md` and `references/blocked-on-person.md` under
`skills/axstack-watch/`.
`adoption-disposition.test.js` checks pre-push MODERNIZE/REWORK/CLOSE decisions,
base/replacement inspection, single-author repair and independent review before
publication, read-only modes, and the scoped rebase lease with semantic mutations.
`merge-boundary.test.js` checks risky-path merge holds, exact-revision user
clearance, uncertain classification, parking decision holds and renewed holds
after head or base changes; `advised-holds.test.js` pins their advice exclusion.
`approval-carryover.test.js` checks forge-counted feedback-repair approval
carryover and repository-rule guards with removal, inversion and rewording probes.
Split test files: `tests/workflows/{presets-research,presets-roles,presets-runtime,pr-managers-lifecycle,structural-workflows}.test.js`;
runtime tables: `tests/workflows/t3-runtime/*.js`.
`provider-bindings.test.js` checks fixed Claude/Codex instance bindings and
usage-limit holds without failover, with removal, inversion and rewording probes.
`runtime-safety.test.js` preserves the single-server keeper, sole stateless timer
and model-discipline contracts with removal, inversion and rewording probes.
Staged-file size advisory: `tests/workflows/staged-file-tokens.test.js` drives
packaged `check-staged-file-tokens.js` in temporary Git repos. Successful
measurements exit 0 and report exact bytes above 20,000, including new source,
legacy edits, unchanged incoming merge blobs and docs/changelogs. The boundary
is byte-based; any token estimate must be explicitly rough. Git, read,
malformed-size and unmerged-index errors exit nonzero, including conflicts on
excluded paths. Empty indexes and initial repos remain valid.
The fixtures preserve index-only reads, exclusions (including generated banners,
binaries and gitlinks), renames, subdirectory invocation and shared main-repo
ignore globs from linked worktrees. Advisories offer no ignore/banner escape.
`staged-token-gate.test.js` checks pre-commit execution, advisory success,
no size-only splits or approval requests, structural review, helper error exits,
author error resolution before committing, enforceable repository checks, no
hiding authored files behind exclusions, and receipt recording with removal,
inversion and equivalent-rewording probes. Helper nonzero exits and the author
stop-on-error duty are separate contracts.
Also run these two staged-file test files with `TMPDIR` unset, as in CI; their
shared temp root falls back to `/tmp`. Keep that `/tmp` private to the dispatch
(e.g. a mount namespace bound to owned 0700 scratch outside HOME).
These tests install no Git hooks and prove instructions and fixture CLI behavior,
not live author compliance. Run the workflow command below after Launch/Doctor;
record isolation or harness-discovery gaps and complete feasible checks without
claiming offline acceptance when those prerequisites are unavailable.
C1 documentation keepers: `public-docs`, `readme-contract`, `skill-current-contracts`,
`explain-diagram`, `explain-fidelity`, `explain-whiteboard`, `ui-verification` and `presets` in `tests/workflows/`.
`presets.test.js` guards retired `axstack-monitor` absence in bundled presets
and shipped watch/roster prose while retaining codebase explorer bindings.
UI discovery/iteration keeper: `ui-improvement.test.js` checks report-only named
scope, verifier Playwright evidence, ranked defects/acceptance criteria, frozen
capture procedure with fresh renders, blind independent comparison, hard gates,
keep/revert, disagreement and finite stopping. It mutates each semantic rule
for removal/inversion and equivalent rewording. Run it with the workflow checks
below; this proves instructions only, not live visual improvement or reviewer blindness.
Prerequisites: Launch and Doctor; this path needs no live T3, credentials or
network. The tests inspect instructions, not live agent compliance.
The removal check covers shipped transport absence and driver-thread decision holds.
Manager-hold checks cover finite-pass flagging, optional host alerts and host-defined user input.
Advised-hold checks cover eligibility and exclusions, adviser seats and splits,
bounded waits and gaps, advice reuse, reply authority and serious-risk ordering.
Step-back checks cover both adviser seats, conditional round-4 repair, independent
review and diligence, unchanged ratings and independent-hold cards. Durable
per-PR budgets cover ticketless/adopted entries, legacy Runtime versions,
unknown history, separate budgets for shared issues, write-before-dispatch,
replacement/split inheritance and no renewal after interruption or later failure.
Repair checks cover unused budgets at three or more failing rounds, user-picked
step-back repairs consuming the budget before dispatch, zero-round legacy
initialization, the later-failure advised card and both required load directives.
The existing Fable and autopilot checks retain the general escalation and
availability rules while loading the advised-hold exceptions.

```bash
doctor > "$EVIDENCE/workflows-doctor.log" 2>&1
STATUS=0
bun run test tests/workflows/completion-guards.test.js \
  tests/workflows/independent-delivery.test.js \
  tests/workflows/independent-delivery-maps.test.js \
  tests/workflows/multi-driver.test.js \
  tests/workflows/recovery-wait-records.test.js \
  tests/workflows/recovery-boundaries.test.js \
  tests/workflows/recovery-wake-precedence.test.js \
  tests/workflows/delegate-wake-boundary.test.js \
  tests/workflows/spec-format.test.js \
  tests/workflows/adoption-disposition.test.js \
  tests/workflows/staged-file-tokens.test.js \
  tests/workflows/staged-token-gate.test.js \
  tests/workflows/settle-readback.test.js \
  tests/workflows/native-pr-watch.test.js \
  tests/workflows/chat-run-watch.test.js \
  tests/workflows/automatic-own-pr-watch.test.js \
  tests/workflows/parked-holds.test.js \
  tests/workflows/parked-hold-order.test.js \
  tests/workflows/hold-waiting.test.js \
  tests/workflows/parked-watch.test.js \
  tests/workflows/watch-quota-recovery.test.js \
  tests/workflows/workspace-hygiene.test.js \
  tests/workflows/manager-pass-settlement.test.js \
  tests/workflows/pr-managers.test.js \
  tests/workflows/pr-managers-lifecycle.test.js \
  tests/workflows/peer-review.test.js \
  tests/workflows/peer-corroboration.test.js \
  tests/workflows/peer-round-lifecycle.test.js \
  tests/workflows/pre-existing.test.js \
  tests/workflows/review-severity.test.js \
  tests/workflows/merge-boundary.test.js \
  tests/workflows/approval-carryover.test.js \
  tests/workflows/isolated-manager-passes.test.js \
  tests/workflows/relay-removal.test.js \
  tests/workflows/manager-holds.test.js \
  tests/workflows/merge-audit-discipline.test.js \
  tests/workflows/merge-escalation.test.js \
  tests/workflows/autopilot-repair.test.js \
  tests/workflows/advised-holds.test.js \
  tests/workflows/step-back.test.js \
  tests/workflows/step-back-repair.test.js \
  tests/workflows/review-convergence.test.js \
  tests/workflows/implement-loop.test.js \
  tests/workflows/diligence-repair.test.js \
  tests/workflows/fable-escalation.test.js \
  tests/workflows/dependabot-driver.test.js \
  tests/workflows/analysis-pairs.test.js \
  tests/workflows/public-docs.test.js \
  tests/workflows/readme-contract.test.js \
  tests/workflows/skill-current-contracts.test.js \
  tests/workflows/publish.test.js \
  tests/workflows/publish-audience.test.js \
  tests/workflows/explain-diagram.test.js \
  tests/workflows/explain-fidelity.test.js \
  tests/workflows/explain-whiteboard.test.js \
  tests/workflows/ui-verification.test.js \
  tests/workflows/ui-improvement.test.js \
  tests/workflows/presets.test.js \
  tests/workflows/presets-research.test.js \
  tests/workflows/presets-roles.test.js \
  tests/workflows/presets-runtime.test.js \
  tests/workflows/single-server.test.js \
  tests/workflows/single-server-units.test.js \
  tests/workflows/provider-bindings.test.js \
  tests/workflows/runtime-safety.test.js \
  tests/workflows/run-record.test.js \
  tests/workflows/prose-size.test.js > "$EVIDENCE/workflows.log" 2>&1 || STATUS=$?
printf '%s\n' "$STATUS" > "$EVIDENCE/workflows-exit.txt"
test "$STATUS" -eq 0
```

Peer review contracts cover context-only intent, validated behaviour blockers,
binding verdicts, bounded follow-ups, reply finality, the five-request adviser
panel and compact output, while preserving authored review requirements.
Corroboration checks cover owner refutation, fresh opposite-role verifier
batches, evidence-only briefs, receipt independence, confirmed/refuted/unsettled
outcomes, failed-verifier holds and follow-up finality, including both shared
disagreement carve-outs. These remain prompt contracts, not live agent proof.
Peer round checks cover user-recorded sync pairs, same-repository source proof,
no-submission skips and dedupe, and stale-round readbacks, cancellation,
settlement, cleanup and unknown-state holds without a watcher.
Pre-existing checks cover Source-base and merge-base proof, exclusions,
reviewer-only tagging, authored/diligence/watch exceptions and unchanged human
holds. Peer drafts cover eligibility, budgets, tracker search and non-gating
filing requests. Every semantic rule rejects removal/inversion and accepts
equivalent wording; live disposition validation, peer posting and tracker
search remain unproven. Clarification checks cover highest-rating draft choice,
diff-order ties, blocker-only serious findings, trailing summary fields and
search limits, zero-draft block shape, unchanged-file tie ordering, and the
reference-to-head diff for own-run chains.

Proof: source contracts pass, targeted removal and inversion fail, and accepted
equivalent wording passes. Auditor routes derive from the selected preset
policy; prose budgets use measured bytes. No test result proves native queue
coverage, atomic settlement, or universal English parsing.
Live acceptance requires the driver's exact task/thread/run identities,
terminal state, receipt acceptance, settlement and readback, plus a fresh
run-owned inventory before absence or cadence claims. Retain unobserved cases
as UNKNOWN and cancellation as a separate disposition.

The single-server checks use fake `/proc` trees and injected kill/spawn seams:
keeper selection (unique owner-file fd in the main process or descendants,
multiple-holder holds, unreadable-fd safety and legacy runtime fallback),
descendant snapshots and SIGKILL order, user/base-dir filters,
hold/dry-run safety and notification stdin/failure. They also verify process-local
base-dir environments and normalization (`~`, trailing slashes, relative paths
against each process cwd), default/custom replacement grace and its expiry,
unknown uptime/start-time holds, and self/ancestor protection. Hold alerts cover
the youngest-server age window [600, 780), multiple hold reasons, missing age,
dry-run suppression, notification stdin and failure. Kill notifications include
failed survivor pids even when all kill attempts fail. Run the test file with
TMPDIR both set (owned 0700 scratch outside HOME) and unset in a scratch HOME
to cover CI's default.
Unit checks prove the installed
Bun path and one-minute cadence. They do not kill a live process or activate a timer.
Confirm `bun "$SCRIPTS/single-server.js" --help` lists all five flags (including
`--grace-seconds N`, default 120 seconds) and
`bun "$SCRIPTS/single-server.js" --dry-run` emits one JSON decision with exit 0.
Only use dry-run for host inspection; live kills and notification delivery require
separate host-mutation authority. Installation must leave timers disabled.

## UI and Explain delivery

Follow [UI workflows and Explain delivery](ui.md) for the UI loop source checks
and final-head reviewer/verifier delivery drives.

## Saved New-chat defaults

Entry points: `skills/axstack/scripts/sync-default.js`, `default-policy.js`,
`default-settings.js`, `hub-usage.js`, `hub-secret.js`, `driver-history.js`; policy and opt-in instructions:
`skills/axstack/references/default-routing.md`. After Launch and Doctor:

```bash
doctor > "$EVIDENCE/default-routing-doctor.log" 2>&1
bun run test tests/workflows/default-routing.test.js \
  tests/workflows/default-sol-reserve.test.js \
  tests/workflows/default-reset-timing.test.js \
  tests/workflows/default-cli.test.js tests/workflows/default-settings.test.js \
  tests/workflows/hub-usage.test.js tests/workflows/hub-secret.test.js \
  tests/workflows/hub-weekly-only.test.js \
  tests/workflows/driver-history.test.js tests/workflows/default-live-input.test.js \
  tests/workflows/default-routing-assets.test.js \
  tests/workflows/pass-self-settle.test.js tests/workflows/hidden-author-dispatch.test.js \
  tests/workflows/runtime-safety.test.js > "$EVIDENCE/default-routing.log" 2>&1
```

Proof: fixture CLI dry-run changes no bytes; apply changes only the default and
preserves overrides/text-generation settings, modes and locks. A loopback hub
drives the management envelope. Policy tests cover same-account eligibility,
equal-account pooled minima, both-low <30% Sol admission, either-30% exclusion,
non-low primary preference, scoped/exhausted/unknown holds, weekly-only n/a and
primary fairness. Adapter-to-policy fixtures cover mixed/all-weekly-only Claude
pools, corroborated explicit-null sessions, inactive-but-present 4% sessions,
weekly/scoped exhaustion and no account discard. Missing or inconsistent weekly
metadata, unknown/session limits (even inactive), malformed scopes/resets,
provider errors and stale telemetry hold. Repeat this selection on cached minimum
Bun 1.3.14 and authoring Bun; it proves no live account's plan or null semantics.
Forbidden Sol is evicted before hysteresis. Null/absent resets
retain usage with zero elapsed credit; malformed dates and stale telemetry hold.
The CLI includes an idle Claude account with a null reset. Fixture masked keys
resolve without leaking or persisting hydration. Read-only metadata covers
web/mobile, completeness, unavailable diagnostics and bounded UTC tie rotation.
The CLI drives a fake hub and fixture history DB. Title contracts retain role keys.
No live request, settings write, timer activation, existing-thread mutation or
title-model execution is covered. Verify New chat/client refresh only under driver
authorization; unsupported T3 title settings remain held.

The five routing fixture files follow the existing `TMPDIR ?? '/tmp'` pattern so
CI's bare `bun test` entrypoint works without an exported TMPDIR. Each mkdtemp root
is owned/private (0700); normal verification still supplies an owned 0700 TMPDIR
outside HOME. For CI-equivalent reproduction, unset TMPDIR only in the isolated
child test process and run those five files, retaining its setup-failure/pass logs.
Run that check and the full recipe on both matrix Bun versions when available.
