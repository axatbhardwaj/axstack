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
  them; agents never rate, resolve, or dismiss them; forge conversation-resolution
  rules still apply (C4). Document the "LGTM approval body" friction.
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
Depends: T1.

## T3 — Default automatic merge

Capability: spec section A, D4, D5, D7.
Internal task: T3 -> driver -> `t3-a1`
Theme: merge authority and predicate for own PRs.
Size est: medium (≤1500 lines; many files, small edits each).
Acceptance (spec A1–A7):
- A1 merge actor: chat-run or standalone authorized-maintenance watch, owning thread
  (`axstack-owner` for standalone); no transfer on missing/idle owner; workers,
  reviewers, monitors, managers, triage never merge; observation-only and peer
  watches never merge.
- A2 approval by mode: `solo` cross-provider review (provider differs from every
  authoring/repairing provider in `merge-base..head`) + diligence `PASS`; `team`
  counted collaborator approval at current head + agent review + diligence;
  automation-marker reviews never count; one patch-id carry-over rule for both modes;
  unknown/mixed provenance and hand-written PRs post a card.
- A3 eligible base: `team` → documented non-production `dev` only; `solo` → `main` or
  other `integration` base; docs/workflows classification, unknown = `deploying`;
  stack rule (bottom base eligible, members chained, all planned members published);
  approval mode and base class re-read before each merge and at resume.
- A4 all existing watch §5 terms kept; never `--admin` or bypass.
- A5 never-auto-merge list, with the authority-file list as examples.
- A6 `Auto-merge: off`.
- A7 merge-card scope: reply-merge only own PRs on `integration` bases; in `team` mode
  a reply never replaces collaborator approval; every A5 category PR and this run's PRs
  are user-merged; promotion, release, `deploying`, peer PRs user-merged.
  Carry deferred notes: A7 cites the whole A5 list; state that a reply does not release
  a partly published stack.
- Remove or rewrite every "human merges by default" statement listed in the spec change
  surface (`contracts.md`, `autopilot.md`, `lifecycle.md`, `routing.md`,
  `role-roster.md`, `t3-runtime.md`, `test-audit-weekly.md`, `axstack-audit`,
  `AGENTS.md`, `docs/workflows.md`, `README.md`) consistently; release authority text
  (D5) unchanged.
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
  days only with no unsettled launched work, back to 10 min on the next event or in the
  same turn as a new launch (deferred note); `update_scheduled_task` on the recorded
  ID, never a second wake; no stale notifications.
- Card replies and `hold` in the driver thread; two-milestone notification limit kept.
- `autopilot.md`, `run-record.md`, and watch references updated.
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
- No production secrets anywhere; UI verifier may use the URL.
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
- `automations.md` and `docs/workflows.md` reference it.
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
| Exclusions, Risks accepted | T3 (docs), each task's acceptance |
| Change surface | union of T1–T6 |
