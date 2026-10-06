# Ticket map: default auto-merge, revert line, PR previews, nightly PR triage

Spec: `docs/specs/auto-merge-preview-triage.md` approved rev 7 @ 697223bf10f539c4f3d9884dc4cd7bfee97cb6b0
Store: this repo Markdown file. Run: `20261006-video-takeaways`.
Delivery: one linear `gh stack` T1 → T6 (shared files: `autopilot.md`, watch, implement,
docs). Every PR of this run is merged by the user (spec D4); the run's watch carries
`Auto-merge: off`. State: all tasks **Planned**.

Each task: PR owner = driver (`axstack-owner` binding); author = `axstack-author`;
worktree = `axstack/20261006-video-takeaways/axstack-author/<task>-a<n>`; strict TDD with
prose-contract tests under `tests/workflows/` that fail when the instruction is removed
or inverted.

Acceptance rule: each task's acceptance is **every sentence** of the named spec sections
at rev 7; the spec text governs. The bullets below are pointers, not a substitute, and add
no requirement the spec lacks.

## T1 — Review severity and comment holds

Capability: spec section C.
Internal task: T1 -> driver -> `t1-a1`
Theme: one shared finding-severity rubric for review and diligence.
Size est: small (≤400 lines).
Acceptance (spec C1–C4):
- `axstack-review` and `diligence.md` define high/medium/low with the C1 meanings,
  including evidence-integrity mismatches as at least medium.
- Reviewer rates; uncertain rounds up; only diligence raises; nobody lowers (C2).
- medium/high block `APPROVE`; diligence returns `FINDINGS` for medium/high, `PASS`
  listing lows when only lows remain, `UNKNOWN` unchanged; lows go to one follow-up
  issue in the repo's tracker and do not gate merge (C3).
- Only receipt-recorded comment IDs are agent-authored; every other thread, review
  body, or top-level comment holds auto-merge and posts a merge card until a human
  clears it; GitHub-unresolvable items are cleared by the user's card reply naming
  them; agents never rate, resolve, or dismiss them; an always-commenting review bot
  therefore blocks auto-merge until the user clears it; agent-authored low-only threads
  may stay open; forge conversation-resolution rules still apply (C4).
- C3 follow-up issue: the owner records lows in one issue (GitHub Issues, or Linear for
  `defi-com`) linked from the PR.
Files: `skills/axstack-review/SKILL.md`, `skills/axstack/references/diligence.md`,
`skills/axstack-watch/SKILL.md` (thread term), `tests/workflows/`.
Depends: none.

## T2 — Revert line

Capability: spec section B.
Internal task: T2 -> driver -> `t2-a1`
Theme: revert-readiness line on own PRs.
Size est: small (≤300 lines).
Acceptance (spec B1–B3):
- Own PR descriptions carry exactly one `Revert: clean | steps: … | irreversible: …`
  line (`candidate-publication.md`, `axstack-implement`).
- `clean` definition and release PRs as `irreversible` are stated.
- The authored reviewer checks the line against the diff, records it in the review
  receipt, and rates a wrong or missing line at least medium.
Files: `candidate-publication.md`, `pr-shape.md` (PR body policy), `axstack-implement`,
`axstack-review`, `tests/workflows/`.
Depends: T1.

## T3 — Default automatic merge

Capability: spec section A, D4, D5, D7.
Internal task: T3 -> driver -> `t3-a1`
Theme: merge authority and predicate for own PRs.
Size est: medium (≤1500 lines; many files, small edits each).
Acceptance: every sentence of spec A1–A7, D4, D5, D7, Exclusions, and Risks accepted.
Pointers:
- A1 includes small and adopted work; `lifecycle.md` reconcile and explicit-transfer
  rules apply before any owner change.
- A2 keeps: head/base binding of review and diligence; receipt-recorded provenance; the
  single patch-id definition (`merge-base..head`, recorded for both heads, forge still
  counts the approval, unchanged patch-id adds no provenance); fresh authored review,
  diligence, and CI on every new head; watch §5 persistence rule unchanged.
- A3 keeps the full stack rule: bottom base eligible; each other member's base is the
  next-lower member's branch at its reviewed head; every member meets every other term
  and exclusion; reviewed members are never retargeted; the stack holds until every
  planned member is published.
- A5 enumerated in full, including "test sources stay eligible", workflow-invoked-by-path
  files, non-`clean` revert, and C4 holds.
- A7 exactly as the spec: a reply clears A3, A6, and C4 causes; in `team` mode it never
  replaces collaborator approval; A5's CI, manifest, merge-authority, and non-`clean`
  revert categories and this run's PRs are user-merged; promotion, release, `deploying`,
  and peer PRs are user-merged.
- Exclusions (D1 CLI proxy, D2 CI contention, quota-driven routing, no auto-merge of
  promotion/release/peer PRs) and Risks accepted are stated in `docs/workflows.md` and
  `README.md`.
Files: every file that states the human-merge default or merge predicate:
`contracts.md`, `autopilot.md`, `lifecycle.md`, `routing.md`, `role-roster.md`,
`t3-runtime.md`, `automations.md`, `test-audit-weekly.md`, `axstack-watch/SKILL.md` (§5),
`axstack-watch/references/watch-runtime.md`, `axstack-implement/SKILL.md` (§6),
`axstack-review/SKILL.md`, `axstack-audit/SKILL.md`, `AGENTS.md`, `docs/workflows.md`,
`README.md`, `tests/workflows/`. Release authority text (D5) unchanged.
Depends: T1, T2.

## T4 — Automatic watch for every own PR

Capability: spec section F (Q10, Q11).
Internal task: T4 -> driver -> `t4-a1`
Theme: watch arming and lifetime.
Size est: small (≤600 lines).
Acceptance (spec F1–F5):
- Any phase publishing an own PR arms or joins the driver's chat-run watch after
  verified readback; explicit stop-after-publication or observation-only requests win.
- Driver stays single owner and sole record writer; no per-PR session or hand-off.
- Rebases and feedback route to the PR's author; adopted-PR repairs follow adoption
  rules; one-writer rule unchanged.
- Stop conditions: all PRs merged/closed, launched work settled, release settled or
  not applicable, or user cancel; closed-required-PR decision hold keeps the wake armed;
  no expiry or re-authorization while PRs are open; quiet cadence 60 min after 7 quiet
  days only with no unsettled launched work, back to 10 min on the next event;
  `update_scheduled_task` on the recorded ID, never a second wake; re-arm at a wake if
  the native schedule has a lifetime; no stale notifications; Close-out after the watch
  ends.
- Card replies and `hold` in the driver thread; two-milestone notification limit kept.
Files: `autopilot.md`, `run-record.md`, `axstack-watch/SKILL.md` and references,
`axstack-implement/SKILL.md`, `axstack-relay/SKILL.md` (two-milestone limit), `tests/workflows/`.
Depends: T3.

## T5 — PR previews

Capability: spec section D.
Internal task: T5 -> driver -> `t5-a1`
Theme: tailnet-only preview lifecycle on the VPS.
Size est: small (≤500 lines; new reference plus hooks).
Acceptance (spec D1–D9):
- New preview reference; previews only when the run host is the VPS; otherwise record
  "no preview".
- Owner decides per PR: base-branch-documented dev command + user-visible change; the
  command is read from the base.
- systemd user unit from an isolated head checkout with `RuntimeMaxSec=4h`,
  `MemoryMax=2G`, `CPUQuota=200%`; loopback-only check and `127.0.0.1:<port>` serve
  target verified, else teardown; never Funnel; missing lingering/operator rights =
  "no preview", never changed.
- At most two previews per host; third waits.
- `Preview: <url> @ <served-sha>` in run record and driver thread; PR description only
  for private repos; updated after restart or teardown.
- Teardown removes unit and serve route with readback, on merge/close, watch end, or
  time limit (`ExecStopPost`); head change restarts; failed teardown holds.
- No production secrets anywhere; only repository-documented dev or test environment
  sources; preview authority covers only the unit and its serve route (D5); UI verifier
  may use the URL (D9).
Files: new preview reference, `ui-verification.md`, `axstack-watch` references,
`axstack-implement/SKILL.md`, `tests/workflows/`.
Depends: T4.

## T6 — Nightly PR triage

Capability: spec section E.
Internal task: T6 -> driver -> `t6-a1`
Theme: read-only nightly report.
Size est: small (≤300 lines; prompt reference plus setup docs).
Acceptance (spec E1–E3):
- New triage prompt reference; one unbound `schedule_task` at 02:00 host time; host
  timezone, schedule ID, prompt, and repository set recorded durably outside run
  records; setup reads existing schedules and never duplicates.
- Report per own open PR: forge state or `UNKNOWN`, stale (7 days), top three; never
  declares merge-ready.
- Read-only: no merges, comments, labels, pushes, relay, dispatches, or thread launches.
- Follows the weekly test-audit pattern (`bindToCurrentThread:false`); reports in its
  own T3 thread with CI, reviews, mergeable, and unresolved-thread state.
Files: new triage prompt reference, `automations.md`, `docs/workflows.md`, `tests/workflows/`.
Depends: T5 (stack order only; no functional dependency).

## Spec coverage

| Spec item | Task |
|---|---|
| A1–A7, D4, D5, D7 | T3 |
| B1–B3 | T2 |
| C1–C4 | T1 |
| D1–D9 | T5 |
| E1–E3 | T6 |
| F1–F5 | T4 |
| Exclusions, Risks accepted | T3 (docs acceptance) |
| Change surface | union of each task's Files list |
