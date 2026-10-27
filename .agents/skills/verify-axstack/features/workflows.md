# Inspect workflow instruction contracts

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
Staged-file writer gate: `tests/workflows/staged-file-tokens.test.js` drives the
packaged `check-staged-file-tokens.js` in temporary Git repos; it checks index
bytes, exclusions, failure guidance, renames and subdirectory invocation.
It also checks shared main-repo ignore globs from a linked worktree and the
resolved ignore-file location in failure guidance.
`staged-token-gate.test.js` checks the Implement instruction with removal,
inversion and equivalent-rewording probes. These tests install no Git hooks.
C1 documentation keepers: `public-docs`, `readme-contract`, `skill-current-contracts`,
`explain-diagram`, `explain-fidelity`, `explain-whiteboard`, `ui-verification` and `presets` in `tests/workflows/`.
`presets.test.js` guards retired `axstack-monitor` absence in bundled presets
and shipped watch/roster prose while retaining codebase explorer bindings.
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

## Explain delivery

Publish audience keeper: `publish-audience.test.js` checks private-only discovery
and questions, enabled/complete and unshared status, one-slug/one-audience consent,
earlier-version warnings, inference and revocation prohibitions, republish disclosure,
public exclusion and promotion warnings, old-help fallback and failure holds.
The operational checks require remote non-TTY `notes --help` after list failure
and both null private audience/share fields for an existing unshared document.
Grant consent covers both a yes for one audience and a selection among several.
It checks verified-publish-before-grant ordering, grant JSON identity, incomplete
share reporting, placeholders and absence of service IDs. Each semantic test drives
real-source removal and inversion red plus equivalent-rewording green in memory.
These checks prove instructions only. In a separately authorized live run, drive
zero/one/several audiences, new/unshared/shared slugs, disabled/pending entries,
old help, list/status failures, yes/no, grant failure and public promotion.
Record the question, status audience, command order, grant JSON readback and hold;
confirm private publication remains valid when sharing fails. Never use reader
passwords. Unrun CLI and reader-access cases remain unverified.

Publish's `publish.test.js` checks per-request authority, public redaction and
self-contained assets, fresh final-byte review, password/TTY prohibitions and
anonymous live-URL/SHA verification through removal, inversion and rewording.
It also checks host-managed routing and missing/invalid-config holds, driver-only
publication, final-byte previews, external-edit warnings and URL/version/SHA receipts.
Private proof checks published=true, version comparison and null/pending holds;
earlier publication grants no authority, and theme adaptation requires final-byte
rechecks. Input limits, output SHA/origin comparisons and missing-check holds are covered.
Publish and `explain-design.test.js` also check frontend-design's sole design authority,
inline font choices and published system stacks, inline colours derived from T3 theme variables,
theme legibility and the accessibility floor, plus screenshot
review at 360, 390, 728 and 1440px in both themes with exact-byte identity.
Inline pages never switch palettes on `prefers-color-scheme` or redefine T3 variables.
The Publish reuse contract retains the complete Explain page rules alongside
Visual QA, including word counting, static/interactive definitions and storage rules.
Preset reviewer-note contracts mirror Publish's four-width, both-theme inputs and
desktop/mobile inspection duties across mixed, codex-only and claude-only snapshots,
while preserving the inline-only two-preview self-check.
This offline recipe proves instructions only. The driver separately runs the
candidate skill against the deployed stack with one public and one private
test article; reader-side access requires the authorized AC23 end-to-end run.

Entry points: `skills/axstack-explain/SKILL.md` and its `inline-pages`,
`delivery`, `design`, `fidelity`, `visual-qa` and `whiteboard-defense` references.
After base-revision Launch and Doctor, the authored reviewer runs the declared
workflow checks above plus the full Explain boundary below at the final head.

```bash
doctor > "$EVIDENCE/explain-doctor.log" 2>&1
STATUS=0
bun run test tests/workflows/explain-*.test.js \
  tests/workflows/ui-verification.test.js tests/workflows/verify-wiring.test.js \
  > "$EVIDENCE/explain.log" 2>&1 || STATUS=$?
printf '%s\n' "$STATUS" > "$EVIDENCE/explain-exit.txt"
test "$STATUS" -eq 0
```

Proof covers visual author/reviewer bindings, whiteboard evidence/gaps,
700-word counting without card exemptions, frontend-design authority and hard rules,
inline reviewer self-previews and Publish verifier PNGs before review, blocking
design findings repaired within two rounds and delivered by name after round two
when only design findings remain, normal holds for other failures, unknown-render holds,
T3 or system fonts inline, published system stacks and no design history, exact-byte network scans, preview
and interaction gates, bounded delivery holds, and ambiguous-render readback.
For page behavior, delegate this feature path to `axstack-ui-verifier` with the
reviewed artifact's SHA-256 and private evidence folder. It serves the exact
bytes on its own isolated host-loopback instance and checks 728px dark/360px
light, layout, theme, console/network, all interactive states and accessibility.
For standalone Publish articles, also capture 390px mobile and real 1440px desktop
screenshots and cover all four widths in both themes before independent review.
Inspect desktop balance, horizontal margins, prose measure, typography, section rhythm
and chart legibility; inspect mobile gutters and readable text/labels, with clipping
and horizontal-scroll checks throughout. A 728px render alone leaves desktop unproven.
Use [Anatomy](anatomy.md#browser-acceptance-handoff) for figure theme/compositing.
Honor user browser-tool policy. The author performs no review browser drive;
only the driver publishes. Reviewer/verifier logs are final-head proof, whereas
author logs and preview URLs alone are not. Mark uncovered behavior explicitly
`changed-behavior: unproven`.

## Saved New-chat defaults

Entry points: `skills/axstack/scripts/sync-default.js`, `default-policy.js`,
`default-settings.js`, `hub-usage.js`, `hub-secret.js`, `driver-history.js`; policy and opt-in instructions:
`skills/axstack/references/default-routing.md`. After Launch and Doctor:

```bash
doctor > "$EVIDENCE/default-routing-doctor.log" 2>&1
bun run test tests/workflows/default-routing.test.js \
  tests/workflows/default-reset-timing.test.js \
  tests/workflows/default-cli.test.js tests/workflows/default-settings.test.js \
  tests/workflows/hub-usage.test.js tests/workflows/hub-secret.test.js \
  tests/workflows/driver-history.test.js tests/workflows/default-live-input.test.js \
  tests/workflows/default-routing-assets.test.js \
  tests/workflows/pass-self-settle.test.js tests/workflows/hidden-author-dispatch.test.js \
  tests/workflows/runtime-safety.test.js > "$EVIDENCE/default-routing.log" 2>&1
```

Proof: fixture CLI dry-run changes no bytes; apply changes only the default and
preserves overrides/text-generation settings, modes and locks. A fake loopback
hub exercises the real management envelope without secrets. Policy tests cover
same-account eligibility, equal-account aggregation, the 25% reserve, authoritative
single-window n/a versus incomplete telemetry, stale/missing inputs, reset timing
and stable fairness. Valid null/absent resets retain reported usage and use zero
elapsed credit; malformed non-null dates and stale telemetry hold. The CLI fixture
includes an idle Claude account with a null reset. Fixture masked source keys resolve without logging/leaking or
persisting hydration. Read-only native metadata covers web/mobile and completeness,
with unavailable diagnostics and bounded UTC tie rotation. The real CLI combines
these boundaries against a fake hub and an existing fixture history DB. Title contracts preserve role-labelled
keys. No live request, live settings write, timer activation, existing thread
mutation or title-model execution is covered. Manually verify New chat and client
refresh only under driver authorization; unsupported T3 title settings remain held.

The five routing fixture files follow the existing `TMPDIR ?? '/tmp'` pattern so
CI's bare `bun test` entrypoint works without an exported TMPDIR. Each mkdtemp root
is owned/private (0700); normal verification still supplies an owned 0700 TMPDIR
outside HOME. For CI-equivalent reproduction, unset TMPDIR only in the isolated
child test process and run those five files, retaining its setup-failure/pass logs.
Run that check and the full recipe on both matrix Bun versions when available.
