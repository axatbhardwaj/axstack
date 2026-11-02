# Ceremony reduction — ticket map r2

Spec: `docs/specs/ceremony-reduction.md` r5, approved 2026-11-03
(content sha256 `aff2c301e99ad6c86dc5bef7d50bc4aae73da36b30d255f2fddb652351ea44ad` @ `6db303ab`; approval `6dea0be8`).
Store: repo Markdown (this file). Driver: T3 thread `0bf6846d-0c4c-454b-a1a6-db5e5a808391` on axat-vps (accepted), run `align-ceremony-20261103`.
Authors: `axstack-author` (Codex Sol high) in native `isolation:"worktree"`, one writer per PR.
Review: full path for every PR (spec: all CRs are risk-path work): cross-provider authored reviewer plus separate diligence.

Paths: `R/` = `skills/axstack/references/`, `S/` = `skills/axstack/scripts/`.

Order: the spec order binds **merge** order: T1, then T2, then T3–T7 in any
order. Authors may start earlier; a PR merges only after its predecessors.

Shared resources (queue, never parallel writers on the same file):
`R/t3-runtime.md` (T1, T4, T6), `R/candidate-publication.md` and
`skills/axstack-review/references/review-candidate.md` (T1, T5),
`skills/axstack-watch/references/readiness.md` (T5, T7), `src/instructions.js`
(T4, T9). The prose-size ceiling in `tests/workflows/prose-size.test.js` is
raised, not squeezed; a PR that conflicts on it rebases after the earlier merge.

## T0 Spec and ticket map

- Outcome: approved spec and this map on `main`.
- Internal task: docs PR from branch `t3/1129a5a7` → driver → this worktree.
- Writes: `docs/specs/ceremony-reduction.md`, `docs/plans/ceremony-reduction-tasks.md`.
- Theme: docs. Size est: S. Depends: none.
- Acceptance: files match approved bytes; CI green. No release.

## T1 CR-1 Runtime contradictions removed

- Outcome: no requirement for retired `t3_thread_configuration`; one reviewer-checkout rule.
- Writes: `R/t3-runtime.md` (incl. the reviewer-checkout table row), `R/fleet-dispatch.md`, `R/automations.md`, `R/candidate-publication.md` (checkout rule only), `skills/axstack-review/references/review-candidate.md` (checkout rule only), `S/dispatch-plan.js` (`--verify` input from native thread/task reads), their tests.
- Produces: `dispatch-plan --verify` native-read input shape (consumed by T4).
- Theme: runtime contract. Size est: M. Depends: T0.
- Acceptance: CR-1 bullets; prose tests fail if either old requirement returns; `dispatch-plan --verify` tests pass without the retired tool; unreturned fields are `unknown`.
- Milestone for T4 and T5: merged.

## T2 CR-2 Per-PR cost line and baseline

- Outcome: run-record cost line, audit reporting, baseline file.
- Writes: `R/run-record.md`, `skills/axstack-audit/SKILL.md`, tests; baseline under `docs/` from research data and ≥10 run records.
- Theme: measurement. Size est: S–M. Depends: T0; merges after T1.
- Acceptance: CR-2 bullets; baseline file path recorded in the run record; fields and `unknown` rule tested; counting boundary (dispatch = native task or launch; round = one authored pass at one head); baseline excludes review-manager PRs (D2); never gates.

## T3 CR-5 Spec loop control

- Outcome: full rounds only on first draft and meaning changes; diligence on first draft and approval revision; low items batched; Fable after blockers settle.
- Writes: `skills/axstack-align/SKILL.md`, `skills/axstack-spec/SKILL.md`, `R/contracts.md` (Fable timing only), tests.
- Theme: spec process. Size est: S–M. Depends: T0; merges after T2.
- Acceptance: CR-5 bullets incl. Fable-caused meaning change; plain-AGREE and delta-confirmation rules unchanged.

## T4 CR-3a Whole-task routing helper and rules

- Outcome: `fleet-route.js plan`, `driver` request role, `dispatch-plan --kind launch` fields, intake/ownership/outcome rules, same-PR installed-rule updates, `intakeRouting` switch read (missing = false).
- Writes: `S/fleet-route*.js`, `S/dispatch-plan.js`, `R/fleet-route-schema.md`, `R/fleet-dispatch.md`, `R/fleet-verification.md`, `R/t3-runtime.md` (routing + top-level launch text), `src/instructions.js` (launch limit, per-dispatch routing lines), `AGENTS.md` helper list, tests (`tests/workflows/`, `tests/installer/`).
- Consumes: T1 `--verify` shape. Produces: `plan` CLI, accept/hand-back markers.
- Theme: intake routing. Size est: L, one PR (helper and same-PR rule updates together; the switch flip is T8). Depends: T1 merged; merges after T2.
- Acceptance: CR-3 acceptance list plus D1 (clone missing repo through T3; a failed clone makes that host ineligible: next host, else stay local) and D2: `delegatedFrom.title` filled; waits follow the wait tool `next` and hold when active/unconfirmed; `proceed` uses `clientRequestId`; lost-launch search pages fully with `includeSubagents:true`; `intakeRouting` gates only the automatic decision; support recorded per launching host and provider from the first unnamed intake (missing = unsupported). Helper follows AGENTS.md rules (`--help`, exit codes, pass/fail/unknown).

## T5 CR-4 Combined reviewer for small code changes

- Outcome: small non-risk-path changes accept review APPROVE + `Scope: PASS` instead of separate diligence.
- Writes: `skills/axstack-watch/references/readiness.md`, `skills/axstack-watch/references/proven-verification.md`, `R/candidate-publication.md`, `skills/axstack-review/SKILL.md`, `skills/axstack-review/references/review-candidate.md`, `skills/axstack-implement/SKILL.md`, `R/lifecycle.md`, `R/diligence.md`, and every other diligence-receipt reader (known: `skills/axstack-review/references/peer-mode.md`, `R/pr-chain.md`, `R/role-roster.md`, `R/autopilot.md`, `skills/axstack-implement/references/step-back.md`; others found by search are listed in the receipt), tests.
- Theme: review receipts. Size est: M. Depends: T1 merged (shared files); merges after T2.
- Acceptance: CR-4 bullets; both branches, `UNKNOWN`/`FINDINGS` block, head/base refresh, pre-publication evidence readback.
- Milestone for T6, T7: merged.

## T6 CR-6 Lean small-change path

- Outcome: small-change section in `axstack-implement`; narrowed re-read rule; audits on trigger only.
- Writes: `skills/axstack-implement/SKILL.md`, `skills/axstack-implement/references/step-back.md` (full path only), `R/t3-runtime.md` (re-read rule), `R/lifecycle.md` (audit trigger), tests.
- Theme: implement path. Size est: M. Depends: T5 merged, T4 merged (`R/t3-runtime.md`).
- Acceptance: CR-6 bullets incl. step-back advisers on the full path only; one writer, no worker push, cross-provider review, watch §5, each escalation trigger.

## T7 CR-7 Watch handback, advice, cleanup

- Outcome: no handback on open CHANGES_REQUESTED; blocked-on-person note without re-request; advisers for consequential decisions; cleanup batched.
- Writes: `skills/axstack-watch/SKILL.md`, `skills/axstack-watch/references/readiness.md`, `skills/axstack-align/SKILL.md` and `skills/axstack-spec/SKILL.md` (advice trigger), `skills/axstack-cleanup/SKILL.md`, tests.
- Theme: watch and advice. Size est: M. Depends: T5 merged (readiness), T3 merged (align).
- Acceptance: CR-7 bullets; stop rules unchanged.

## T8 Release and rollout

- Outcome: release with T1–T7; reinstall on io, iobook, iobox, iosatellite, axat-vps; refresh scheduled prompts embedding changed text; user-text intake exception and launch grant on all five hosts; pilot one named-host task per pool host; set `intakeRouting: true`.
- Internal task: driver (release PR via author, then operations). Depends: T1–T7 merged.
- Acceptance: CR-3 Order steps 1–4 recorded per host; the pilot writes the per-host-and-provider support record; failing host leaves pool; unreachable host does not block others; npm stage approved by the user.

## T9 CR-8 Global block and re-measure

- Outcome: installer block reduced to invariants and pointers (keeping CR-3 lines); audit vs baseline lists unused references/helpers/roles.
- Writes: `src/instructions.js`, installer tests; audit report under run evidence.
- Theme: global block. Size est: S–M. Depends: T8.
- Acceptance: CR-8 bullets; audit report path recorded in the run record; deletions proposed as separate small changes. Release after merge.

## Evidence and invalidation

- Each task: author receipt (red/green logs), reviewer and diligence receipts bound to head and base; base or head change refreshes them.
- A change to T1's `--verify` shape invalidates T4 receipts; a change to T5's receipt rules invalidates T6 and T7.
- Branch: every task from `main` after its dependency merges; no stacked branches needed.

## Lifecycle

| Task | State |
|---|---|
| T0 | In Progress |
| T1–T9 | Todo |
