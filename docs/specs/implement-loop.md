# No entry skill; implementation is the loop

Status: Approved revision 5 (2026-09-19); both advisers AGREE (Astra, Fable);
user approved in chat 2026-09-19. Adviser-agreed body digest (pre-status
edit): sha256 fb756ef8e92e746b. Revisions 1-3 received adviser corrections, folded in below; rev 3 had
Fable AGREE and Astra DISAGREE on two bounded gaps (CI-wait exhaustion, and
behavioral evidence for the repair loop), both addressed in rev 4, which both advisers AGREED to. Rev 5 adds one
release step the driver found in the live VPS automation. One point is presented to the user as an
explicit decision (see D3 "Boundary and resume"). Authoritative store: repository Markdown, following this
project's existing specification convention. Supplements docs/specs/v1.md and
docs/specs/subscription-routing.md; it does not rewrite their approvals.
Evidence: arena run `20260918-driver-trace-improvements` and PR #106 (driver
operating rules), on which this spec stacks.

## Outcome

The `axstack` entry skill is removed. Users invoke the phase skill they want.
`axstack-implement` becomes the only looping phase: from an accepted scope
identity it drives every required PR through author -> publish ->
cross-harness review -> repair -> re-review until the whole set is merge-ready,
without re-invocation between that boundary and the start. The human approves
the spec and merges; after the merge the same run reconciles and closes out.
Every other phase stays a separately invoked phase.

## Design

### D1 Shared root without a router

`skills/axstack/` remains the shared root: `references/*.md` and the
installer-generated `roles.json` keep their paths; every
`../axstack/references/...` link resolves. Only `skills/axstack/SKILL.md` is
deleted; twelve phase skills remain.

Installer (`src/installer.js`): the `SKILL.md` requirement applies to every
`axstack-*` directory; the exact name `axstack` may omit it (allowed, not
banned; `orca-migration` fixtures stay valid). Nothing else in bundle
validation, `roles.json` generation, manifest hashing, or `src/roles.js`
changes. A previously installed pristine `skills/axstack/SKILL.md` is removed by
the existing owned-file cleanup; an edited one is reported; an unowned copy is
out of scope.

Instruction block (`src/instructions.js`, marker `v1`; the ownership hash
drives the update). PR1: "Use Axstack for engineering work: invoke the matching
`axstack-*` skill directly." PR3 appends: "`axstack-implement` loops author ->
review -> repair until every PR is merge-ready." The two Orca lines are
unchanged.

### D2 Scope identity without the router

The gate lives in `routing.md` (proportional scope identity) and
`contracts.md` (Scope identity) and binds every engineering phase.
`contracts.md` "Required lifecycle load" names `axstack-relay` beside
`axstack-audit` as the phases that do not load the lifecycle. `axstack-implement`
§1 gains the one router sentence worth keeping: substantial work without an
approved spec and matching ticket map reports the exact gap, names
`axstack-align`, and stops. Pointers that said "the user invokes `axstack` to
execute" (`axstack-align/SKILL.md:164`, routing.md "Direct later phase",
README.md:71, docs/workflows.md, docs/specs/v1.md:198) say `axstack-implement`.
`orca-runtime.md:25` and docs/workflows.md:54-57 locate `roles.json` in the
installed shared root `skills/axstack/`.

### D3 The implement loop (`axstack-implement`)

Replace the opening (SKILL.md:8-12, "Review and merge are later phases") and
§5's stop rule with a run-level contract:

Inputs: one snapshotted small-change intent, or an approved spec plus its
ticket map. Unit: the accepted task/PR map (a capability may span several
PRs); dependent PRs form a `gh stack`, bottom-up, each child starting from its
reviewed parent; independent PRs run in parallel within the contracts' fanout
rule. The current chat is the driver and the owner of every loop PR it
creates: sole run-record writer, dispatcher, publisher, wait-holder. On
resume an existing live owner is preserved unless an accepted transfer exists. `axstack-owner` is materialized only by standalone
`axstack-watch` or `axstack-review` when no live driver exists.

Per PR: (1) dispatch `axstack-author` (strict TDD, §3-5) and consume its
receipt; (2) publish through candidate-publication and read back the exact SHA;
(3) dispatch the authored-mode reviewer selected from actual author provenance
(`axstack-review`) and consume the verdict; (4) route it: `APPROVE` at the
exact head and the full readiness predicate of `axstack-watch` §5 (required
checks, all feedback, approvals, mergeability, exact-revision receipts) ->
record `merge-ready`; `APPROVE` while required checks are still pending ->
wait once per revision with the forge's own blocking check wait (bounded,
never a loop), then re-evaluate; if that wait times out, errors, or the
capability is missing, the PR becomes `held` bound to that revision with the
reason and the resume condition (checks observed green or red), never an
author repair; `REQUEST_CHANGES`, a failed required check,
or post-readiness feedback -> return findings to the same author (new
revision), back to (1), increment `repairs`; `INCOMPLETE`, provenance gap, unavailable
model, serious risk, or a third `REQUEST_CHANGES` on one PR (a plain driver
recommendation, a fixed number) -> `held`. A changed parent re-runs the child
from (1).

Waiting: one run-level completion wait (lifecycle Execution tracking) covers
every unsettled Dispatch; the forge check wait above is the only other wait. A
turn ends only when every required PR is `merge-ready` or `held`, after
notification (b) or (a). Serious risk (c) is raised immediately when found,
per contracts, never deferred to the boundary. No sleep loops, no Axstack
timer, no forge polling, no automation registration.

Boundary and resume (user decision): merge-ready is the human boundary. The
user merges (`gh stack merge` for a stack). No Orca capability exists today
that wakes a chat driver on a forge merge without creating a second PR owner
(the PR automation is repo-allowlisted and owns what it handles), so the
driver resumes on the user's next message or `/axstack-watch` on the run. On
resume it re-reads forge state: merged PRs are recorded `merged`; a changed
head or new feedback re-enters (1); nothing is released yet. When every
required PR is forge-merged and acceptance passes, lifecycle Close-out runs
once: settle workers, counts, auditor decision and settlement, then worktree
release, ticket closure (a capability's tickets close only when all its PRs
are merged and its acceptance passed), and `Archived`. If Orca later offers a
merge wake that keeps one owner, a revision may adopt it; this spec adds none.

G1: the loop requires a preset whose authored-review row pairs two providers
(`mixed`). Under `codex-only` or `claude-only` the loop holds at step (3) for an
explicit user routing choice; no substitution, no same-provider review.

Records: one task row per PR in `progress.md` with derived state
`authoring | published | in-review | repairing(n) | merge-ready | merged |
held`, receipts per revision, holds as `Decisions` rows. Notifications go
through `axstack-relay` under the run's recorded Notification policy: (a) hold
on a user decision, (b) the set is merge-ready, and all-merged (two per run),
(c) serious risk; never progress.

## Delivery: three stacked PRs on #106, human merges bottom-up

PR1 `feat(installer): shared root may omit SKILL.md` — installer rule, PR1
instruction line, this spec file at docs/specs/implement-loop.md; tests:
`tests/installer/instructions.test.js`, `instruction-cli.test.js`
expectations; new behavior test: a bundle whose `axstack/` lacks `SKILL.md`
installs and whose `axstack-x/` lacks it fails. ~150 lines.

PR2 `refactor(skills): remove the axstack router` — delete
`skills/axstack/SKILL.md`; D2 edits; tests: `scope-identity.test.js`,
`owned-core.test.js:59,276,429` and its entry-routes test, `structural.test.js:51,72`,
`bundle-discovery.test.js` (13 -> 12), `automations.test.js:466`,
`relay-discovery.test.js:48,56`, `pending-repairs.test.js:55`. ~200 lines.

PR3 `feat(implement): loop until merge-ready` — D3 text, G1 sentence in
routing.md, lifecycle roster sentence (driver = owner of loop PRs), PR3
instruction clause, one loaded-text regression test (A4), and a scenario
contract following this repo's evaluator-inputs convention
(`tests/workflows/r2-evaluator-inputs.json` shape): a new
`tests/workflows/implement-loop-evaluator-inputs.json` with at least two
predeclared cases, (i) CI check wait exhausted -> `held` with revision, reason,
resume condition; (ii) `REQUEST_CHANGES` -> same author repairs -> republish
-> re-review -> `APPROVE` -> `merge-ready`, plus one unchanged holdout case
from the existing inputs. Before the prose edit the driver evaluates the cases
in a fresh agent session against the old implement text (expected: the agent
stops at the implementation receipt), and after the edit against the new text
(expected: the agent names the correct transition); both receipts are recorded
in the PR as agent evidence, labelled separately from the deterministic
structural tests and from A6. ~200 lines.

Release after PR3 merges per AGENTS.md; reinstall on desktop and VPS. In the
same release step, before the VPS reinstall, update the live VPS "Axstack PR
driver" automation prompt (Orca automation `8c1e0fdf`) and its template at
docs/plans/pr-automations-prompts.md:37 to load
`~/.claude/skills/axstack/references/contracts.md` and
`.../references/automations.md` directly instead of `skills/axstack/SKILL.md`;
the watchdog automation references no skill file and is unchanged. Verify the
next scheduled driver run starts without a missing-file report.

## Acceptance criteria

A1 `bun test` green after each PR. PR1 carries real red -> green for the
installer fixture pair; PR2 for the entry-file absence assertions; PR3 carries
structural coverage (A4) plus the evaluator-inputs before/after receipts with
the holdout unchanged, labelled as agent evidence.
A2 After PR2, `grep -rn "skills/axstack/SKILL.md\|invokes \`axstack\`" skills src
tests README.md docs/workflows.md` is empty (docs/specs history excluded).
A7 The VPS PR-driver automation completes one scheduled run after the
reinstall with no missing-file report, recorded in the run record.
A3 The installer test asserts the installed directory set after install into a
temporary home: exactly twelve `axstack-*` directories with `SKILL.md`,
`skills/axstack/references/` and `skills/axstack/roles.json` present, no
`skills/axstack/SKILL.md`, and the instruction block's first line. Harness
catalog discovery is a manual post-install check on desktop `io` in Claude
Code and Codex (their skill pickers list twelve `axstack-*` entries and no
`axstack`), recorded with harness versions in the run record, not a test.
A4 The implement skill's loaded text states: one run-level wait plus the
bounded forge check wait; the state list; same-author repairs; the repair cap;
G1 hold; immediate serious-risk escalation; merge-ready boundary and resume;
done = forge-merged + Close-out. Structural coverage only.
A5 Named-file-set measure: implement SKILL.md + routing, contracts, lifecycle,
orca-runtime, run-record, pr-shape, candidate-publication <= 6,800 words after
PR3 (baseline 6,490 at #106), recorded in the PR.
A6 Post-merge runtime checkpoint: PR3's own delivery (driven per D3 as
drafted, candidate SHA pinned in the run record) and the first
`axstack-implement` run after release each show, with receipts, at least:
authoring -> published -> in-review -> merge-ready -> merged, one run-level
wait per turn, and Close-out once; a repair cycle is recorded when one occurs
(its behavioral coverage is the PR3 evaluator case, not this checkpoint); the
Close-out auditor or the user confirms.

## Exclusions

No new skill; no Axstack scheduler, daemon, timer, database, or automation
registration; no change to presets, `roles.json` shape, or the review-routing
table beyond G1; no automatic merge; no installer ban on `axstack/SKILL.md`; no
change to `automations.md`; no Orca CLI text in skill prose; no Linear/Notion
changes; heartbeat cadence (Orca-owned) is filed as an Orca issue.

## Preparation evidence

Arena candidates, judge verdicts, driver scores and synthesis, and both
adviser receipts per revision live under the run's scratchpad; run record
`.git/axstack/runs/20260918-driver-trace-improvements/progress.md`.
