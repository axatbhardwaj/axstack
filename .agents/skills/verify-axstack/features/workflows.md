# Inspect workflow instruction contracts

## Parallel-first acceptance (Outcomes 1–6)

The shared shipped contract is
[`parallel-first.md`](../../../../skills/axstack/references/parallel-first.md),
with Ready work, Ownership, Dependencies and repairs, Evidence and Authority
anchors. Run the semantic checks below with Launch/Doctor isolation. The
`parallel-first-contracts` checks consume shipped instructions; the
`parallel-first-evidence` checks protect this recipe's acceptance requirements.
Both exercise removal/inversion failures and equivalent-rewording acceptance.
They prove instruction contracts only, never deterministic scheduling or native
execution. Preserve the existing workflow checks below. Package-local reds
whose inputs span packages stay pending until integrated green; attribute old
contract assertions to their owning integration repair rather than waiving them.

For O1, inventory every installer-selected `axstack*` and `voa` entrypoint,
affected references, roles/presets, public docs and script surfaces: changed,
already compatible or legitimately serial, each with a source-backed reason.
Reject contradictory blanket one-author-per-deliverable rules while retaining
one writer per actual checkout/artifact. Check phase-specific guards: Debug L0
does not replace L1 evidence or extra fix attempts; Verify keeps product code
off-limits; repo Correct/Cleanup analysis stays read-only with driver-only
cleanup mutation; Perf/UI measured attempts stay sequential, frozen, noise-aware
and budgeted, including candidate-effect probes. Device run-1 shutdown precedes
run-2, one emulator per host and credential-session ownership remain. No worker
gains child delegation, forge or sensitive-action authority.

```bash
doctor > "$EVIDENCE/parallel-first-doctor.log" 2>&1
STATUS=0
bun run test tests/workflows/parallel-first*.test.js \
  > "$EVIDENCE/parallel-first-tests.log" 2>&1 || STATUS=$?
printf '%s\n' "$STATUS" > "$EVIDENCE/parallel-first-exit.txt"
test "$STATUS" -eq 0
```

These commands select all package-owned core/phase/combined checks after
integration as well as evidence checks. Run the dispatch and package recipes,
then the full suite from SKILL.md at the exact integrated head. Retain complete
outputs and dirty-state evidence. Fixture tests and a package-tip green cannot
replace independent integrated review, diligence or the full-suite requirement.

### Native bounded fixture: preparation and feasibility

Only the authorized driver runs this section, after independent review of the
integrated candidate. This recipe activates nothing by itself. Use the existing
Axstack T3 project and current driver on its host; create no project, new driver,
scheduler, production resource or external disposable PR. Use native-created
isolated author worktrees and separately owned evidence directories. Give each
concurrent test its own validated owned 0700 TMPDIR and temporary home outside
real HOME. Load candidate instructions explicitly for this fixture task, with
higher-priority instructions intact; leave installed live-home instructions alone.
Native workers receive explicit bounded fixture scope, output and authority.
Keep configured roles/models/efforts, current capacity rules, serial first-binding
preflight, native completion and cancellation guards. An unavailable required
binding holds that scenario; extra accounts, quota exhaustion and model fallback
are outside the fixture.

The verifier must record candidate head, constituent tips and every loaded
instruction hash, separate from installed-version preflight. Include task/run,
thread, attempt, project/environment, host, worktree, branch, input identities,
effective provider/model/options/runtime and exact candidate override paths in
the receipt. Save native raw reads, loaded bytes, command logs and SHA-256
manifests in private evidence. Each producer and consumer names its input/output
revision or artifact digest. Changed head, input identities or instruction hashes
must invalidate affected evidence. Do not reuse stale reviews or timings.

Before launching, inspect native evidence availability read-only. Determine
whether retained tool/command start/end records or identifiable active model-turn
records can establish substantive windows. Record endpoint feasibility UNKNOWN
until demonstrated; catalog availability and run startedAt/completedAt alone
cannot establish useful work. Unreliable endpoints must yield UNKNOWN and hold
merge and release. Retain the missing-field/raw-read evidence and report the
precise gap to the driver; never infer timestamps from prose, file mtimes or
observer wall-clock samples. Continue independent feasible checks within scope.

### Native execution and timing acceptance

Use a bounded useful engineering fixture: two independent author packages
produce disjoint parts of one local candidate, for example a parser and a
formatter consumed together by an integration-owned round-trip check. Settle
interfaces and assign combined acceptance before writing. Capture meaningful
red before new combined behavior, then green at the integrated fixture head.
Preserve package commits through ordinary local merges and keep package
checkouts available for repairs. Driver-classified mechanical assembly alone
uses the approved reproducible-tree exception; clean textual merging alone
does not establish it. The integration author alone edits shared glue; the
driver verifies terminal native success and exact outputs before consumption.
Both accepted package outputs must have an integration receipt with ancestry
and final head/base. Include consumed tips, prerequisite identities, merge
order/commits, integration edits/conflict resolutions, red/green logs and joined
acceptance. A queued task, progress message or partial output is insufficient.

Both native run intervals and substantive activity intervals must overlap.
Require native command endpoints or active model-turn evidence to calculate
substantive activity intersection and duration. Normalize trustworthy timestamps
to one time basis and retain their native source IDs. For each worker, form the
union of its observed active intervals, then intersect the two unions; report
each intersection interval and total duration, which must be positive. Keep
native run-envelope overlap as a separate result. Exclude queue, prompt,
rate-limit, idle waits and overlapping parallel tool calls by one driver from
substantive evidence. Manufactured sleeps, duplicate busywork and self-reported
timings are ineligible. Reject incomplete or contradictory endpoint pairs as
UNKNOWN rather than treating them as zero or extrapolating through waits.

Require rejection of serial controls and staggered controls with overlapping
runs but disjoint substantive activity. Run these as separately labelled owned
controls on the same loaded instructions and observation method; collect real
serial/staggered traces without sleeping to create overlap. Explicit dependency
gating can stagger useful work while an earlier run waits. Where native
execution cannot produce a bounded control, use retained labelled deterministic
interval controls for the calculation and report native control coverage UNKNOWN.
Expected overlap verdict for both controls is FAIL; their control PASS means
the misleading overlap was correctly rejected, not that useful overlap occurred.

Require separate native engineering, analysis and verification overlap evidence
and joined correctness. Analysis uses distinct useful bounded source questions
with accepted exact artifacts; verification uses independent ready scenarios
against pinned inputs, each with accepted logs and outputs. Measure each pair
with the same substantive-window method. One pair cannot stand in for the other
two. Preserve independent first passes, required corroboration seats, reviewer
independence and configured floors. Static phase inventory does not prove live
universal compliance. Report each unexercised phase explicitly.

### Failure and boundary matrix (labelled owned fixtures)

Each row specifies an input perturbation and acceptance against the loaded
candidate instructions, not a hardcoded PASS response or a toy scheduler. Retain
the prompt, exact native task/run/artifact where used, observed action/hold,
and instruction source/hash. Use deterministic source-contract mutation or real
bounded T3 fixtures as labelled per row. Do not provoke real external failure.
Require native observation of F1 and F2 alongside deterministic controls.
Deterministic results alone cannot satisfy those native observations.

| ID | Owned input / seed | Required acceptance and preserved guards |
| --- | --- | --- |
| F1 | Delay a producer's accepted terminal input; leave unrelated useful work ready. | A consumer must wait for its input while unrelated work proceeds; verify native launch/consumption order and exact milestone, without a global phase barrier. |
| F2 | Assign two useful operations the same owned file or fixture resource. | Shared resource conflicts must serialize competing work; observe native ordering and exclusive writer/resource ownership, while disjoint work stays eligible. |
| F3 | Give a tiny indivisible fixture action. | Tiny indivisible work must stay direct with its reason; extra agents are never a quota. |
| F4 | Change one producer tip/interface after consumer evidence exists. | Producer revision drift must invalidate affected consumers; preserve unrelated current evidence, and revalidate affected acceptance/reviews. |
| F5 | Supply labelled failed/unavailable completion or binding evidence. | Failed or unavailable work must preserve its writer and model binding; hold the affected work, prohibit duplicate writers and silent provider/model substitution. |
| F6 | Supply a labelled first-binding rejection with eligible unrelated configuration. | First-binding rejection must hold siblings while unrelated configurations progress; verify current same-configuration start prerequisites, with unknown telemetry recorded honestly. |
| F7 | Supply an ambiguous launch identity or lost receipt. | Ambiguous launch identity must be reconciled before replacement; retain current owner/attempt and prohibit a second writer or guessed success. |
| F8 | Seed package-local, integration-only and initially unattributable combined findings. | Package and integration repair findings must return to their respective owner; integration diagnoses combined/base defects, then routes proven local causes, ordering cross-package repairs without competing writers or implicit transfer. |
| F9 | Join same-binding package and integration contributors. | Same-binding contributors must retain independent review; exclude every contributing writer and the owner, preserve applicable review pairing and required corroboration floors. |
| F10 | Supply divergent or unknown contributor session/provider/model evidence. | Divergent or unknown provenance must hold the candidate; never select an unmapped reviewer or infer provenance from attribution trailers. |
| F11 | Resume an existing attempt and assess cleanup eligibility with retained evidence. | Resume and cleanup must preserve attempt identities and evidence; retain same-author repair, current native completion/settlement checks, package checkouts until merge/close and driver-only mutation/preservation order. |
| F12 | Seed a package-local defect after its author settles. | The seeded same-author repair must follow settlement; resume the same checkout/branch/author with a new attempt identity and append repair commits, preserving prior evidence. |
| F13 | Seed independent defects in two packages on one candidate. | Seeded independent repairs must overlap and retain one per-PR budget; exclusive package writers repair their own paths, one integration writer joins accepted tips, without resetting review rounds or attempt limits. |
| F14 | Use a small-change two-package fixture with eligible bindings and scope. | Small two-package work must retain eligible combined review; splitting alone does not escalate, while all contributors satisfy its review pairing and risk criteria remain. |
| F15 | Mark an otherwise similar fixture as a dispatch/authority risk path. | Risk-path work must require separate diligence; combined review cannot waive risk classification or existing exact-head/base review and merge holds. |

Require seeded repairs to be labelled fixtures and natural repairs to be
reported not observed unless they occur. F12/F13 may use real delegates but
remain seeded, not naturally occurring production repairs. Keep one per-PR
round budget across all contributors, cancellation and resume. Deterministic
F5–F7 supplied failures do not demonstrate actual quota rejection, crash or
ambiguous native launch; disclose that boundary explicitly.

For O5-N, drive the existing dispatch recipe's supported local non-repository
artifact fixtures and real dispatch-plan/receipt CLI tests. The nonrepo artifact
fixture must retain configured roles and owned directories without Git or
engineering author prerequisites. Include independent evidence/check packages,
changed-byte digest invalidation and ownership conflicts; keep unsupported
Correct/Cleanup/VOA modes inline. Record deterministic mode-selection proof
separately from optional actual native artifact execution. Neither proves the
required native analysis/verification overlap by itself.

### Acceptance handback and delivery boundary

Every required fixture and control must PASS while FAIL or UNKNOWN holds
acceptance. O3 engineering and O5 analysis/verification each need native useful
overlap plus joined correctness PASS; F1/F2 additionally need native observation.
Static tests, deterministic fixture results and driver disposition cannot waive
merge/release gates. Missing natural incidents and optional native nonrepo
artifact execution stay explicitly not observed. Any material change to the
approved gate needs user approval; unavailable endpoints do not relax it.

Return one exact-head receipt covering O1 phase inventory; O2 strict TDD,
ownership, staleness, full-suite and integrated review/diligence; O3 timing and
integration outputs; O4 F1–F15 labelled results; O5 the separate analysis,
verification and nonrepo results; and O6 delivery pending. Include exact evidence
paths, trustworthy raw endpoint sources/calculation, fixture versus native
classification, packages identified/launched/completed/serialized with reasons,
unknown costs/durations and no speedup claim without a comparable baseline.
Release follows required PASS, independent review/diligence and existing merge
predicates through the signed-tag workflow; never publish locally. Five-host
install verification covers io, iobook, iobox, iosatellite and axat-vps, actual
default-sync timers/pool drop-ins and separate iosatellite provisioning/closed-lid
evidence under recorded authority. This recipe grants no rollout authority.

Lean small-change delivery: `small-change-path.test.js` and `pending-repairs.test.js` cover one
writer per isolated candidate, driver-only publication, mandatory cross-provider review with T5's
combined/separate diligence branches, native watch and watch §5's full merge
predicate. Removal/inversion/rewording probes cover all four full-path
escalation triggers, full-path-only step-back advice, current-path rereads and
small-path trigger-only audits and default audits for every other substantive run in both Lifecycle
and Audit. The same checks pin triggered-audit settlement, retained strict TDD,
§6 gates, mandatory Scope receipts and no merge clearance from risk classification.
They also pin §6's round-3 escalation and full-path step-back qualifier,
unavailable-reviewer holds, and escalation reconciliation with budget preservation.
Keep the T1 reviewer-checkout, T4 intake, T5 combined-review
and T7 checkpoint cleanup/watch guards green. This proves shipped instructions,
not live delivery, adviser behavior or audit dispatch.

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
`review-checkout.test.js` guards native authored/candidate reviewer isolation,
main’s peer checkout rule, workspace templates and the authored-only driver-path
brief field. It scans shipped skills, top-level docs and README for driver-made
authored checkouts or new local peer/all-reviewer native isolation. It retains
main’s remote/fleet native rules and pins peer checkout creation and removal.
Watch readiness entry point: `skills/axstack-watch/SKILL.md`; loaded references:
`references/readiness.md`, `references/proven-verification.md`,
`references/escalation.md` and `references/blocked-on-person.md` under
`skills/axstack-watch/`.
`watch-handback.test.js` covers active-watch continuity with unresolved
`CHANGES_REQUESTED` or required reviews, one blocked-on-person note without
re-requesting review, consequential-only Align/Spec question advice, and
checkpoint cleanup batching with evidence and per-resource guards. `cleanup.test.js`
also rejects per-review timing in Implement, Lifecycle and the workflow guide,
including contradictory timing added alongside the checkpoint rule.
The handback checks pin checkpoint events, batch ownership and pending cleanup
in the private run record. Removal and
inversion fail; equivalent rewording passes. Existing watch stop, T1 checkout,
T3 spec-round and T5 combined-review guards remain separate keepers. These are
instruction checks, not proof of live watch behavior or resource retirement.
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
  tests/workflows/small-change-path.test.js \
  tests/workflows/pending-repairs.test.js \
  tests/workflows/review-checkout.test.js \
  tests/workflows/combined-review.test.js \
  tests/workflows/watch-handback.test.js \
  tests/workflows/cleanup.test.js \
  tests/workflows/autonomy-planning.test.js \
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
policy: Sonnet high without a model pin in mixed and Sonnet medium in claude-only.
The preset matrix protects Fable high, Haiku exploration medium, and all 14
claude-only Sonnet medium seats. Installed role/readiness tests exercise the
claude-only reviewer medium contract; resolver tests retain missing-effort holds.
Prose budgets use measured bytes. No test result proves native queue
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

## Direct release publication

The release contract keepers inspect the entire pinned publish job, including
version-tag triggers, read-only permissions, timeout, action SHA pins, tag/manifest
match, full suite, registry existence check, npm prefetch before auth, and the
cache-only `npm@12.0.2 publish . --access public` command. Registry-auth remains
whoami-only. The synthetic credential-preflight fixture verifies successful auth
writes a private `.npmrc`, missing/invalid auth writes none, and output omits the
fixture token. It never invokes npm or contacts a registry. The separate
`publish-token.test.js` probe uses the pinned offline npm cache from Launch to
prove npm reads sandbox HOME `.npmrc` and sends a synthetic Bearer token in a
PUT to a 127.0.0.1 Bun.serve registry (port 0), without staging. It skips only
on local runs when the pinned npm is not cached offline, with an explicit reason;
record that boundary as unverified. In CI, a missing cache fails. Both automated
workflows prefetch npm before tests; Bunx resolves the cache without assuming a
TMPDIR path. `publish-token-ci.test.js` checks the CI failure and local skip. No real registry or credential is used.

After Launch and Doctor, run:

```bash
doctor > "$EVIDENCE/direct-publish-doctor.log" 2>&1
bun run test tests/installer/publish-workflow.test.js \
  tests/installer/publish-credential.test.js \
  tests/installer/publish-token.test.js \
  tests/installer/publish-token-ci.test.js \
  tests/installer/registry-auth-workflow.test.js \
  tests/workflows/default-auto-merge.test.js \
  tests/workflows/merge-contract-sweep.test.js \
  tests/workflows/autopilot.test.js > "$EVIDENCE/direct-publish.log" 2>&1
```

The semantic prose checks cover tag workflow publication, recorded authority for
signed release tags, prohibition of local npm publication, and a shipped-surface
sweep rejecting mandatory human stage approval. Removal/inversion and equivalent
rewording probes prove instruction contracts only. Live token publish permission,
2FA bypass and npm registry publication remain unverified by this offline recipe.

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
