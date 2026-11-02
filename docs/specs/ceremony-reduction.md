# Ceremony reduction — r5, draft

Authoritative location: `docs/specs/ceremony-reduction.md` (repo Markdown, axatbhardwaj/axstack)
Run record: `align-ceremony-20261103` (private run directory under the repository's Git common dir)

## Decision brief

**Problem.** Ordinary Axstack work costs too much: repeated dispatches and driver
oversight, not prose size. In the last 5 days (2026-10-29 to 11-03):

- One spec (DEF-2899) went r1 to r12 in 2h28m with 43 dispatches; two rounds
  were wording-only.
- 62 adviser and Fable threads ran.
- Fleet routing ran in 0 of 4 real run records. Its per-dispatch cost, and the
  rule that worker hosts never hand work to another host, blocked it.
- The user corrected premature watch handback while CHANGES_REQUESTED stood
  (DEF-2826).

**Change.**

- **CR-3 Route whole tasks, not dispatches.** At intake, a new task goes to
  one host whose driver does all the work locally. Routed at most once.
- **CR-5 Control spec loops.** Wording findings are batched; escalation
  receipts are reused while meaning holds.
- **CR-4, CR-6 Lean small-change path** inside `axstack-implement`, with the
  cross-model reviewer also doing the diligence checks.
- **CR-1** fix runtime contradictions; **CR-2** per-PR cost line; **CR-7** fix
  watch handback; **CR-8** shrink the global instruction block.

**Backbone (unchanged).** Every change goes through `axstack-implement` with
cross-model adversarial review (author and reviewer on different providers).
One writer per candidate, strict TDD/proof, exact-SHA publication and the watch
§5 merge predicate stay.

**Before / after.**

- Before: driver on axat-vps → every reviewer/adviser dispatch would need fresh
  facts, a recommendation, binding and multi-read receipts → nobody routes.
- After: task arrives on any host → one routing decision at intake → one driver
  thread on the chosen host (or stay) → authors, reviewers and advisers run
  locally there.

**Included.** CR-1 to CR-8. **Excluded.**

- The review manager (works as intended; unchanged).
- Base-only review carryover (no evidence it costs much; risky merge-rule change).
- Lowering review severities; merging or deleting roles; a new skill.
- Per-dispatch cross-host routing; remote author coordinators (stay disabled).
- A daemon, scheduler, database or workflow state machine.
- Edits to historical `docs/specs/` and `docs/plans/`.

**Risks and trade-offs.**

- CR-1: removing the retired tool could drop a real readback. Bounded by
  `unknown` for unreturned fields.
- CR-2: most baseline values will be `unknown`. Accepted; counts still help.
- CR-3: T3's own rule may refuse standing launches; a launch could be lost or
  duplicated; the new host may lack inputs or staff. Bounded by
  runtime-support check, launch key and hold-on-doubt, and accept-before-hand-off.
- CR-4: one reader instead of two for small code changes. Bounded by the
  combined receipt covering every diligence check and risk paths keeping
  separate diligence.
- CR-5: fewer spec rounds could let a real defect through. Bounded by full
  fresh adviser review for any meaning change and for high/medium findings.
- CR-6, CR-7: a lean path or longer watch could miss an escalation. Bounded by
  explicit escalation triggers and unchanged stop rules.
- CR-8: shrinking the global block could drop a rule. Bounded by installer
  tests on its content.
- Unverified: tokens and time per PR; iobox (unreachable during research);
  live cross-host launch; whether T3 accepts the standing launch grant.

**Dropped from earlier drafts.** Base-only review carryover; severity lowering;
shortened report-only receipts and per-dispatch fact cache (per-dispatch routing
removed);
review-manager changes (Q4). Watch-rule consolidation and a wake-noise filter
are deferred to later work.

**Decisions.** Settled: Q1 (everything through Implement with cross-model
review), Q2 (fleet routing on by default), Q3 (whole task to one host), Q4
(review manager unchanged), Q5 (any host may hand off a whole task once, at
intake; the user's worker rule gains an intake exception and a standing launch
grant for that hand-off). None remain.

| Decision row | Disposition |
|---|---|
| D1 Clone if missing (CR-3 pre-launch) | Follows the user's standing review-lane auto-clone preference (2026-10-23). A failed clone makes that host ineligible: next host, else stay local. |
| D2 Final-review low items (Opus r5 lows 1–7, diligence r5 lows) | Carried into the CR-3, CR-2 and CR-5 ticket acceptance, not new scope: support recorded per launching host and provider from the first unnamed intake (missing = unsupported); `dispatch-plan` fills `delegatedFrom.title`; acceptance-run and `proceed` waits follow the wait tool's `next`, holding when still active or unconfirmed; `proceed` uses a `clientRequestId`; lost-launch search pages fully with `includeSubagents:true`; `intakeRouting` gates only the automatic decision; CR-2 baseline excludes review-manager PRs; wording and history order fixed at snapshot. |

## Definitions

- **Small change**: a small-change intent under `skills/axstack/references/routing.md`
  (one PR, recorded request plus acceptance checks and exclusions).
- **Full path**: the existing `axstack-implement` route for substantial work.
- **Risk path**: the risky paths in `skills/axstack-watch/references/readiness.md`
  (one list). CR-4 and CR-6 additionally treat changes to merge, dispatch or
  authority rules, and anything a reviewer or the driver marks as a security,
  data-loss or major-design concern, as risk paths for review depth only; this
  does not change the merge hold list. This spec's own PRs are therefore
  full-path work.
- **Intake**: the moment a new user-started thread receives a task that will
  dispatch an author, reviewer or adviser, before any such dispatch.
  Scheduled jobs (review manager, sweeps), status asks and follow-ups inside an
  existing driver thread are not intake and stay local.
- **C3a**: the existing per-dispatch remote nonwriter routing in
  `fleet-dispatch.md`. **C3b**: the disabled remote author coordinator.

## Execution requirements

### CR-1 Runtime contradictions removed

- Remove every requirement for the retired `t3_thread_configuration`
  (`t3-runtime.md`, `fleet-dispatch.md`, `automations.md`, `scripts/dispatch-plan.js`,
  and the tests that pin it). Child settings readback uses native task status
  and thread reads; a field they do not return is `unknown`. `t3_thread_configure`
  is used only in its read-only form with an explicit child thread ID.
- One rule for reviewer checkouts: native `isolation:"worktree"`; the reviewer
  checks out and verifies the exact candidate SHA and base inside it.
- Acceptance: prose-contract tests fail if either old requirement returns;
  `dispatch-plan --verify` tests pass without the retired tool.

### CR-2 Per-PR cost line

- The run record gains one line per PR: dispatches, review rounds, spec
  revisions, active time, wait time, tokens (driver and workers separately).
  Missing values are `unknown`, never zero. A dispatch is one native task or
  launch; a review round is one authored-review pass at one head.
- Backfill a baseline from the 2026-10-29 to 11-03 research and at least 10
  recent run records.
- The audit phase reports these counts; it never gates work.
- Acceptance: run-record template and audit text contain the line; a test
  checks the fields and the `unknown` rule; the baseline file path is recorded.

### CR-3 Whole-task fleet routing at intake (default on after rollout)

- **Entry.** Each intake is routed once on the host that receives it, unless
  the user names a host ("on iobox", "here"). A routed task carries a
  `routed` marker and is never routed again. Mid-task hand-off stays forbidden.
- **Runtime support.** The origin launches only where the active T3 runtime
  accepts the user's standing grant as the user's explicit request for that one
  new thread. Support is recorded per host and provider from the pilot result
  (in `fleet-routing.json`), not judged by each driver. Unsupported → stay
  local and record `routing unsupported`.
- **Decision.** One `fleet-route.js plan` call (new; recommend plus binding)
  over a facts directory produced at intake by the existing `fleet-sample`
  telemetry plus saved native reads (environment links, destination project
  list, catalog). A new `driver` request role selects a host for the whole
  task; its authors are local there, so C3b stays disabled. The helper follows
  the `AGENTS.md` helper rules and `AGENTS.md` lists it.
- **Pre-launch check.** Destination reachable, the repo's project present
  (cloned through T3 if missing), worktree isolation available, the driver's
  model and a different-provider reviewer model in its catalog.
- **Launch.** `dispatch-plan --kind launch` builds the call: destination
  `environmentId` and `projectId`, `modelSelection`, `runtimeMode` full-access,
  `delegatedFrom` (origin environment and thread), a task-unique launch key as
  `clientRequestId` and in the title. `dispatch-plan --verify` checks the
  readback (thread, model, mode, run started) from native thread reads; it no
  longer uses `t3_thread_configuration` JSON (CR-1).
- **Inputs.** The brief carries the exact task text, scope identity and its
  content (spec revision or small-change intent inline or at a
  destination-readable ref), authority, the `routed` marker and a citation of
  the user message or standing grant that authorizes the hand-off.
- **Ownership.** The origin owns the task until the destination accepts. The
  destination's first run only checks acceptance (scope and authority, inputs
  readable, local staffing: author plus a different-provider reviewer, and
  advisers if needed) and ends with exactly `AXSTACK-ACCEPT` or
  `AXSTACK-HANDBACK <reason>`. The origin waits on that run with
  `t3_thread_wait`. On accept it records the link, sends one `proceed` message
  and stops; the task then continues in the destination thread.
- **Outcomes.**
  - No launch call made (unsupported, no eligible host, failed pre-launch
    check) → stay local.
  - `AXSTACK-HANDBACK` → origin continues locally; no rerouting.
  - Error or lost launch reply → retry once with the same `clientRequestId`
    (the launch tool documents this as safe; the pilot proves it across
    hosts), then reconcile by launch key in the destination's thread list.
    One verified match → wait for its first run. Still unclear, multiple
    matches, incomplete listing, readback mismatch, a run that never starts,
    or a first run that ends without exactly one marker → hold in the origin
    thread. Never start a second driver while the first may exist.
  - Local runs (stay or continue) check staffing too; failure holds.
- **Inside the task.** All dispatches are local on that host. C3a is no
  longer required; its text and helpers stay until the CR-8 audit, whose
  driver proposes retirement as a separate small change.
- **Same-PR rule updates.** The PR updates every installed line that would
  block this: `src/instructions.js` (launch limit, per-dispatch routing
  lines), `fleet-dispatch.md`, `fleet-verification.md`, `fleet-route-schema.md`
  and `t3-runtime.md` routing and top-level launch text (including its
  explicit-request rule for drivers).
- **Order.** (1) helper and rules PR merged and released; (2) user text added
  on all five hosts (user section, not the installer block; authorized by Q5):
  the worker-rule intake exception and the standing grant worded as the
  user's explicit request for each intake hand-off thread; (3) pilot: with the
  switch off, the driver routes one real small task to each pool host by
  naming the host explicitly, and records the result; a host that fails leaves
  the pool, and an unreachable host does not block the others; (4) default-on
  via `intakeRouting: true` in `fleet-routing.json`, read by `plan`; missing
  means `false`. Rollback: set it to `false`.
- **Acceptance.** Tests pin: intake scope (scheduled and follow-up work stay
  local); one decision per task; no second routing; the named-host opt-out;
  each outcome branch above (including a silent first run); launch built and
  verified by `dispatch-plan`; accept marker before hand-off; no per-dispatch routing inside a task; the switch.

### CR-4 Combined reviewer for small code changes

- For a small change that is not a risk path, the cross-provider reviewer also
  performs every applicable diligence check: scope against the intent
  (dropped, added, softened), author evidence and red/green logs, and claims,
  counts, SHAs and paths in the PR body and commits against the diff.
- The reviewer returns `Scope: PASS|FINDINGS|UNKNOWN` bound to head and base.
  `UNKNOWN` blocks merge-readiness.
- Before publication, the driver verifies the author's evidence folder: named
  logs exist and counts, SHAs and paths match. The combined review runs after
  publication on the exact head.
- Every diligence producer and consumer changes together for this case only:
  watch readiness, candidate publication, `axstack-review/SKILL.md`,
  `axstack-implement` and lifecycle. Merge-readiness needs review APPROVE plus
  `Scope: PASS`; `FINDINGS` or `UNKNOWN` blocks. The receipt refreshes on any
  head or base change.
- Separate diligence stays for substantial work, spec checkpoints, risk paths
  and release reconciliation.
- Acceptance: tests pin both branches, the `UNKNOWN` block and readiness.

### CR-5 Spec revision loop control

- A full adviser round runs on the first draft and on any revision that
  changes meaning (criteria, scope, decisions, authority).
- Diligence runs on the first draft and on the revision presented for
  approval.
- Low and wording-only findings are batched into one final pass; they never
  trigger a new full round and never waive high/medium findings.
- `axstack-escalation-fable`, when its existing triggers apply, runs after the
  ordinary high/medium findings are settled. Its receipt stays valid while the
  reviewed meaning holds; if its own findings change meaning, a fresh Fable
  session reviews the result. The existing plain-AGREE rule is unchanged.
- Delta confirmation stays as today.
- Acceptance: Align/Spec text and tests pin each rule, including a
  Fable-caused meaning change.

### CR-6 Lean small-change path in `axstack-implement`

- A small-change section in `axstack-implement`: one isolated author, one
  cross-provider reviewer (CR-4), proof, publish, native watch, merge under
  watch §5.
- Escalates to the full path on a second PR, a risk path, review round 3 or a
  design conflict.
- The re-read rule in `t3-runtime.md` narrows to the files the current path
  uses.
- Step-back advisers belong to the full path. Audits run on request, on a
  material deviation or after repeated repairs, not on every small run.
- Acceptance: tests assert one writer, no worker push, cross-provider review,
  watch §5 and each escalation trigger.

### CR-7 Watch handback, advice and cleanup

- While a watch is active, it never unwatches or hands back because a forge
  CHANGES_REQUESTED or required review stands unresolved; it keeps repairing
  and watching. A stale CHANGES_REQUESTED whose findings are addressed gets one
  blocked-on-person hold note, with no review re-request. User cancellation,
  expiry and existing stop rules are unchanged.
- Align and Spec consult advisers for consequential decisions and
  disagreements, not for every question.
- Eligible cleanup batches at the run checkpoint, preserving evidence first.
- Acceptance: tests pin each rule.

### CR-8 Global block and re-measure

- The installer-owned block in global instructions shrinks to authority
  invariants and pointers, keeping the CR-3 routing lines.
- After CR-1 to CR-7 ship, an audit compares CR-2 cost lines with the
  baseline and lists references, helpers or roles no run loaded. Each deletion
  is a separate small change.
- Acceptance: installer test checks the block; audit report path recorded.

### Delivery constraints

- About one PR per CR. Order: CR-1, CR-2, then CR-3 to CR-7 (CR-4 at or
  before CR-6), CR-8 last. CR-3 may split into helper and switch PRs.
- All CRs are risk-path work for review purposes (they change dispatch, merge
  or authority rules).
- The prose-size ceiling may be raised rather than squeezing contract text.
- Changes ship skills and `src/`: release and reinstall on io, iobook, iobox,
  iosatellite and axat-vps under standing release authority. The user approves
  the npm stage. Refresh scheduled prompts that embed changed text after release.

## Evidence and history

- Align adviser reports, r1–r3 reviews (Astra, Opus, diligence) and the 5-day
  thread research are in the run directory `align-ceremony-20261103/evidence/`
  (axat-vps, repo HEAD 57df9216, axstack 0.59.1).
- r1 → r2: dropped base-only carryover and severity lowering; replaced
  per-dispatch routing with whole-task routing (Q3); added spec loop control
  and watch handback (research); widened CR-1; added baseline backfill;
  combined reviewer covers all diligence checks; defined small change, full
  path and risk path; excluded the review manager (Q4).
- r2 → r3: Q5 intake hand-off; CR-3 adds `driver` role and `plan` helper,
  launch hand-off, ambiguous-launch reconcile, model readback, destination
  hand-back, same-PR installed-rule updates and user-text change; CR-4 lists
  all receipt consumers; CR-5 Fable and diligence timing; CR-7 no re-request;
  one risk-path list; CR-2 counting boundaries.
- r4 → r5: CR-3 acceptance marker on the destination's first run, origin
  wait and hold on a silent run, documented same-key retry, pre-launch check
  parts, `delegatedFrom`, grant citation, per-host support record, pilot with
  switch off, switch default, C3a retirement owner, `--verify` input.
- r3 → r4: CR-3 intake scope, runtime-support check, `dispatch-plan` launch
  build and verify, accept-before-hand-off, launch key and hold-on-doubt,
  outcome branches, named facts producer, order and switch; CR IDs on Change;
  risks per CR; dropped items listed; C3a/C3b defined.
