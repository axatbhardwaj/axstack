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
| I | Integration author owns combined branch, existing workflow-test adaptations and shared wiring after P1–P3 settle | Preserved package ancestry, full integrated checks; consumes verified terminal package tips | Medium; verified P1–P3 receipts |
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
overlap. Every author records meaningful red before instruction changes;
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
constituent tips and every loaded hash. Never edit live-home instructions.
No manufactured sleeps or duplicate busywork qualify as overlap.

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
Standalone Watch without verified package boundaries retains its single-author
repair path. Internal package milestone is new; cross-PR reviewed-parent stays.

Separate diligence is required (dispatch/ownership policy risk). Actual author
provenance selects independent review; no contributor reviews the joined candidate.
Capability issue stays open until required PRs merge and acceptance passes.
Release/host authority: approved delivery plus repository standing authority;
all sensitive-action holds remain. Close-out includes applicable independent audit,
owned-resource preservation/cleanup and explicit unverified live phase coverage.
