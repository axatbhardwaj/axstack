# Parallel-first delivery map

Spec: [approved r4](../specs/parallel-first.md), issue-body SHA-256
`775236748b84c4ff0c60c58d69b5805dbfcb079b37ea4db9fbf8e943b62b329f`.
Capability: https://github.com/axatbhardwaj/axstack/issues/639 — useful parallel
work by default across phases, including packages feeding one PR.
Outcome/scope: all PF-1–PF-6 and Outcomes 1–6, with original exclusions intact.
Driver: accepted current io T3 driver `a1788374-ae3c-4859-b34d-d3ee5f19ff15`;
sole PR owner, forge actor and run-record writer. No new driver is needed.

## Packages and ownership

One implementation PR: these instruction changes form one coherent contract.
Each writing package uses a separate native T3 worktree and the saved mixed
author binding. Driver planning files are complete before authors launch.
Actual worktree paths, attempt identities and tips are recorded at dispatch.

| ID | Theme and exclusive writes | Produces / consumes | Size and dependency |
| --- | --- | --- | --- |
| P1 | Shared contract: `skills/axstack/references/`, `profiles/presets/`, `AGENTS.md`, README, `docs/*.md` | Shared scheduling/ownership/provenance contract; consumes approved PFs | Medium; approved map |
| P2 | Phase wiring: `skills/axstack-*/` and `skills/voa/` | Complete entrypoint inventory and compatible phase rules; consumes approved PFs and P1 interface | Medium; approved map and immutable interface below |
| P3 | Verification: `tests/workflows/parallel-first*`, `.agents/skills/verify-axstack/features/{workflows,dispatch,package}.md` | Semantic regression checks, labelled fixture matrix and live recipe; consumes approved Outcomes | Medium; approved map |
| I | Integration author owns combined branch, combined tests from the base immediately; existing workflow-test adaptations and shared wiring after P1–P3 settle | Preserved package ancestry, full integrated checks; consumes verified terminal package tips | Medium; red-check preparation needs only map; merges need verified P1–P3 receipts |
| V | Driver-coordinated native evidence on owned fixtures, separate configured workers | Outcomes 3–5 exact-candidate receipts; consumes independently reviewed combined head and loaded instruction hashes | Medium; reviewed I |
| R | Release author then driver publication/install | Release PR, signed-tag workflow, five-host receipts; consumes all required PASS and merge predicates | Small; V PASS and reviewed implementation merge |

P1–P3 may prepare concurrently. Their instruction interface is PF-1–PF-6 in
the pinned spec: shared contract path `skills/axstack/references/parallel-first.md`;
phase entrypoints link it without redefining authority. P1 owns that path;
P2 may use this accepted path/interface before P1 code exists. P3 tests the
approved contract, not a private helper implementation. No new runtime helper,
scheduler, database, dependency or model seat is planned.

P1 and P2 own package-specific new test files named `parallel-first-core*` and
`parallel-first-phases*` respectively; P3 owns remaining `parallel-first*` tests.
P3 must not edit those reserved files. Existing tests belong to I to prevent
overlap. Each instruction author records meaningful red before instruction changes;
integration author owns combined acceptance and runs its real red on base or
partial assembly before the behavior-producing merge. Driver classifies any
mechanical-only exception using the approved reproducible-tree criteria.

Base: current verified repository commit pinned at dispatch, not an unfinished
unreviewed PR parent. No package publishes its own PR. One package author may
become I only after completion and explicit exclusive write-scope transition.
No writer transfer from idle state alone. Authors never push or publish.

## Acceptance coverage and required evidence

All scenarios below are required except explicitly labelled natural incidents
and an actual native nonrepo artifact run. No scenario is silently waived.

| Spec | Owner | Acceptance and evidence |
| --- | --- | --- |
| O1 / PF-1,4,5 | P1/P2/I | Inventory every installer-selected `axstack*` and `voa` entrypoint and affected references, AGENTS, README, shipped docs and autopilot: changed, compatible or legitimately serial with source reason. No blanket one-writer-per-deliverable conflict; retain one writer per checkout/artifact. Semantic removal/inversion red and rewording green. |
| O2 / PF-2,3,6 | P1/P3/I | Real red/green ownership, input staleness and combined behavior; isolated package tips remain ancestors; named provenance and repair owner; integrated acceptance and unaffected workflow tests green. Run affected verify-axstack workflows/dispatch/package recipes and full suite with retained logs. |
| O3 | V | Owned engineering fixture with two useful independent author packages, joined correctness, native run overlap AND timed substantive-activity intersection. Record exact task/run IDs and duration; exclude waits and self-report. Serial and staggered negative controls must fail overlap. Missing reliable endpoints = UNKNOWN. |
| O4-F1–F4 | P3/V | Dependent consumer waits while unrelated work proceeds; shared resource serializes; tiny work stays direct with reason; producer drift invalidates only affected consumers. |
| O4-F5–F7 | P3/V | Failed/unavailable work does not duplicate writers or substitute models; first-binding rejection holds siblings only; ambiguous launch reconciles without replacement. No real quota exhaustion or destructive failures. |
| O4-F8–F11 | P3/V | Package versus integration repair routing; same-binding contributor review; divergent/unknown provenance holds; resume/cleanup preserves attempts/evidence. |
| O4-F12–F15 | P3/V | Labelled seeded same-author repair after settlement and overlapping independent repairs; one per-PR budget; small two-package combined review eligibility; risk-path separate diligence. Natural repairs only reported observed when real, otherwise not observed. |
| O5-A/V | V | Useful native overlap and accepted exact outputs for bounded analysis and verification scenarios, using the O3 definition; static inventory never claims universal live compliance. |
| O5-N | P3/V | Supported nonrepo fixture retains configured artifact roles and owned dirs, no synthetic Git/engineering role; independent checks overlap and changed bytes invalidate hashes. Distinguish deterministic mode proof from optional native artifact run. |
| O6 | R/driver | Reviewed release PR, signed-tag publish workflow; reinstall/verify io, iobook, iobox, iosatellite, axat-vps. Check actual default-sync timer and pool drop-in per host; separately report iosatellite provisioning/closed-lid proof. No local npm publication. |

V uses the existing Axstack project, native-created isolated worktrees and
owned disposable fixture boundaries. It is a fixture task, not the implementation
PR itself. Do not publish a disposable forge PR. Load candidate instructions
explicitly per task; record installed preflight separately from candidate head,
constituent tips and every loaded hash. Preserve higher-priority instructions and scope overrides to that verification
task. Native canary workers receive explicit bounded authorization and fixture
boundaries. Never change live home configuration during development.
Both engineering outputs must be accepted, with an integration receipt. Native
started/completed intervals must overlap. Construct substantive windows only
from retained native tool/command start/end or identifiable active model-turn
evidence; exclude queue, prompt, rate-limit and idle waits. No manufactured
sleeps or duplicate busywork qualify as overlap.

Every required fixture/control and engineering/analysis/verification overlap
plus correctness must PASS before implementation merge/release. FAIL or UNKNOWN
holds until evidence or user-approved material spec revision; static tests and
driver disposition cannot waive the gate. Changed head/input identities invalidate
affected proof; retain the conservative exact-head rule, no carryover assumption.

## Preserved boundaries and review

P2 explicitly retains Debug isolation/packet rules for L0 probes, existing L1
seat/attempt bounds, Verify Maintain limits outside the approved change, ordered
device runs, nonrepo Correct/Cleanup/VOA inline-only mode and report-only analysis.
Perf/UI frozen measurements, noise controls, cheapest-first/early-stop, keep/revert
and attempt budgets stay intact; probes testing candidate effects consume budget.
Watch routes package-owner repairs where independent, retaining one integration
writer, per-PR budgets, observation-only modes and sole forge ownership. Internal package milestone is new; cross-PR reviewed-parent stays.

Separate diligence is required (dispatch/ownership policy risk). Actual author
provenance selects independent review; no contributor reviews the joined candidate.
Capability issue stays open until required PRs merge and acceptance passes.
Release/host authority: approved delivery plus repository standing authority;
all sensitive-action holds remain. Close-out includes applicable independent audit,
owned-resource preservation/cleanup and explicit unverified live phase coverage.


## Explicit phase checks (O1/PF-4)

P1 owns shared references; P2 owns entrypoints and phase-local references.
For each row its owner records semantic removal/inversion red and equivalent
rewording green for changed instructions, plus retained-boundary checks.

| Restriction | Owner paths | Required change and preserved acceptance |
| --- | --- | --- |
| Debug | P2 `skills/axstack-debug/`; P1 preset eligibility notes | Permit bounded L0 probe packages with existing isolation/packet rules; no extra fix attempts; L0 receipts never satisfy L1; retain L1 bounds and L2 holds. |
| Verify | P2 `skills/axstack-verify/` | Replace Maintain source-wave ban and blanket one-writer-per-PR; disjoint verification packages allowed; product source remains off-limits, shared glue exclusive. |
| Scout | P2 `skills/axstack-scout/` | Remove 1–3 facet ceiling; useful independent concerns within observed capacity, no forced worker per concern. |
| Correct/Cleanup | P2 `skills/axstack-correct/`, `skills/axstack-cleanup/`; P1 `local-artifacts.md`, `routing.md` | Repo-mode bounded read-only analysis allowed; invocation/report/selected-record constraints and driver-only mutation retained; nonrepo Correct/Cleanup/VOA remains inline. |
| Watch | P2 `skills/axstack-watch/` | Replace two-issues/one-author blanket rule with independent package-owner repairs; retain sole integrator, budgets, observation modes and forge owner. |
| Perf/UI | P1 `perf-loop.md`, `ui-improvement-loop.md`; P2 Perf/Improve entrypoints | Non-measuring prep or isolated non-contending probes only; frozen/noise-aware sequential measurement, cheapest-first early-stop, keep/revert and finite budgets. Candidate-effect probes count; contended measurements never support baseline/delta/keep. |
| Devices/browser | P1 `ui-verification.md`; P2 affected phase links | Retain ordered run-1 shutdown before run-2 and one emulator per host; overlap only independent resources, preserve credential-session ownership and configured model/tool preferences. |

PF-5 tests also preserve research pair/branch floors, arena judges, peer first
passes and audit pairs. Same-binding writers and distinct-brief decomposition
are the scoped exceptions; required corroboration is not weakened.

## Milestones, invalidation and combined checks

Accepted interface M0 is this map's fixed shared-reference contract: path
`skills/axstack/references/parallel-first.md`, headings/anchors `Ready work`
(`#ready-work`), `Ownership` (`#ownership`), `Dependencies and repairs`
(`#dependencies-and-repairs`), `Evidence` (`#evidence`), `Authority` (`#authority`).
They respectively cover PF-1, PF-2, PF-3, PF-6 and PF-5; PF-4 links the relevant
sections. P1 receives this immutable interface in its initial brief. No wait
for a progress message is needed: M0 is a completed driver-owned artifact
accepted with this map, with its commit/hash pinned in every consumer brief.
P1 returns a terminal interface-conformance receipt with its package tip.

Milestones: P2 and P3 consume M0, not unfinished P1 code; I starts combined-red
preparation from the same pinned base concurrently. I merges only verified
terminal P1/P2/P3 tips with scoped acceptance evidence. V preparation (P3 and
read-only timing investigation) starts immediately; V execution consumes the
reviewed integrated head and candidate instruction hashes. R consumes V PASS,
review/diligence and merge predicates. All consumers name exact producer/input
identities in receipts. Any change to M0 path, anchors or meanings invalidates
P2/P3 links/tests and I's related checks; revalidate affected consumers before
acceptance. Tip changes invalidate affected integration/review/live evidence;
unrelated packages continue. Progress alone is never an accepted milestone.

I owns these combined behavioral checks and records meaningful red on the base
before any behavior-producing merge: C1 cross-file contradiction absence;
C2 author/decomposition exemptions with phase links and retained review floors;
C3 installer/package discovery of the shared reference and entrypoint inventory;
C4 ownership and stale-input handling across package/consumer/integration edges.
Existing helpers (`prose-contract.js`) remain read-only unless a concrete need
is assigned exclusively to I. No production test-only helper is introduced.

P1/P2 capture package-local red/green where independent. P2 cross-reference
checks and P3 checks whose required production inputs span packages record red
before those edits and final green at I's integrated head; these are explicitly
pending combined checks in package receipts, never claimed package-tip passes.
I maps every pending check to its final green. A scoped terminal receipt can
unblock integration while combined acceptance remains pending; it cannot unblock
publication or final acceptance. Known obsolete assertions (Scout facet count,
Improve ordering and affected ceremony/Verify/tracking/watch tests) may fail at
package tips: record each exact failure, old-contract reason and owning I repair.
I captures those failures before aligning obsolete tests and retains meaningful
red-first behavioral checks for the newly required contract. Do not label an
unattributed failure pre-existing or convert an old assertion failure alone into
proof of new behavior. Run the full suite after integration and retain output.

Branch: packages and I start from the full driver planning head that includes
`e2955f8efdcf068cc0a0a34d7a22468e51983374` plus this map correction, resolved and
pinned before dispatch. Integration thereby includes the baseline docs commit.
The implementation PR targets `main` at its freshly fetched SHA; normal freshness
rules apply. Use native-created worktrees and encoded `axstack/` branch names;
the existing driver branch name is not a desired product behavior.

## Reporting and evidence classification

P1 wires `run-record.md` and P2 wires `skills/axstack-audit/references/record.md`:
semantic checks cover packages identified/launched/completed/serialized with
reasons, native execution overlap separately from queued work or parallel tool
calls, unknown cost/duration without trustworthy receipts and no speedup claim
without a comparable measured baseline. Driver close-out emits those PF-6 fields,
exact evidence links and unexercised phase coverage. V supplies the native data.

O3, O5 analysis and O5 verification each require separate live overlap and joined
correctness PASS. O4 F1–F15 may use explicitly labelled deterministic fixtures;
seeded repair cases may use actual delegates but never count as natural repairs.
O5-N mode-selection is a deterministic fixture; actual native artifact execution
is optional and separately labelled. All controls/fixtures remain required;
report fixture versus genuinely observed T3 behavior separately. Local-only
canary publication is a map-selected conservative boundary within PR/candidate.

Every concurrent writer/test run uses a distinct validated owned 0700 TMPDIR
and temporary homes outside real HOME; no symlink/shared temporary resource.
P1 inventory includes `skills/axstack/scripts/*` as unchanged or names a needed
change before assigning it to I. Release preparation requires separate diligence;
driver records release and host-mutation authority before tag push and installs.
P2 remains one coherent phase-wiring owner for now; split only if concrete useful
independent boundaries and staffing justify it, never to meet a worker quota.
