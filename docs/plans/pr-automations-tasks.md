# PR automations — capability and task map

Spec: `docs/specs/pr-automations.md` rev 4 (tag `spec/pr-automations-rev4`;
rev 3 `9dc01bf` approved 2026-09-16, rev 4 = review corrections, no decision
changed). Store: repository Markdown
(this file). Run record: `20260917-automations-simplify`. All PRs target
`main`; T1 is the root and the human merges it first; T2–T5 fan out from T1's
branch and retarget to `main` on its merge. Every PR: one theme, target band,
commits of roughly 200 lines, semantic messages, `gh stack` for the chain.
Tests follow the repository's `bun test` conventions
(`tests/workflows/automation-precheck.test.js` shim pattern for shell scripts,
`automations.test.js` / `automation-contracts.test.js` for reference wording).

## C1 — The approved contract is in the tree

Capability: the spec and the installed Axstack references and skills describe
the driver/watchdog contract, so an agent that loads them follows rev 4 and not
the superseded pair C/D rules.

- Internal task T1: spec PR -> driver (this chat) -> worktree
  `automations-simplify` (already contains `9dc01bf` and this map).
  Theme: specification baseline. Size est: target band (docs only).
  Acceptance: `docs/specs/pr-automations.md` at the approved content;
  `docs/specs/orca-automations.md` gains a one-line "superseded for the
  defi-com pair by pr-automations.md" status note and nothing else; this
  task map present. Depends: none.
- Internal task T2: references and skills -> `axstack-author` (Sol) via
  `axstack-implement` -> child worktree `pr-automations-refs` off T1. Also
  retires superseded clauses in `skills/axstack/references/lifecycle.md`,
  `skills/axstack-watch/references/watch-runtime.md`,
  `skills/axstack-watch/SKILL.md` and `README.md` (five-minute driver, 24-hour
  watch deadline, health gate, `watchdog.json`) so no agent loads them.
  Theme: contract text. Size est: target band (~600–900 lines of Markdown +
  test updates). Acceptance: `skills/axstack/references/automations.md`
  rewritten to rev 4 (driver/watchdog roles, review-state wake, abandon un-processing via the marker `trigger`, base check identity by name + app, four searches + debounce, due
  work list, dispatch markers + TTL, budgets, token lifecycle table, marker
  line, watchdog table, run directory, cutover); `skills/axstack-relay/SKILL.md`
  gains a "Decision tokens" section (agent opens token + sends; Hermes script
  decides; driver consumes; still no polling of Telegram by any session);
  `skills/axstack-review/SKILL.md` automation exception: verdict body ends with
  `<!-- axstack-automation verdict head=<sha> -->`, agent re-reads self reviews
  immediately before `gh pr review`, `escalate` opens a token and exits;
  `skills/axstack-watch/references/repair-publication.md`: `escalate` pins
  `refs/axstack/decisions/<token>` and opens a token instead of pushing;
  `tests/workflows/automations.test.js` and `automation-contracts.test.js`
  pin the new wording (three PR criteria, no obligations, no COMMENT, marker
  line, lifecycle table) and pass; `docs/workflows.md` automation paragraph
  updated. Depends: T1.

## C2 — Driver precheck wakes on real work only

Capability: a shell precheck with no model discovers allowlisted PRs across
four searches, debounces peer heads, hashes a fingerprint, detects due control
work, guards the driver against itself, and exits 0 only when there is work.

- Internal task T3: `docs/plans/pr-automations-precheck.sh` + tests ->
  `axstack-author` (Sol) via `axstack-implement` -> child worktree
  `pr-automations-precheck` off T1. Theme: driver precheck. Size est: target
  band (script ~150 lines + shim tests ~300). Acceptance (spec §Discovery,
  acceptance 1–2, 11): overlap guard logs `running` exit 3; four searches with
  `--json url,number,repository,updatedAt`; truncation logs `error` exit 2
  and writes no fingerprint; allowlist union filter; `gh pr view` per PR;
  `seen[]` debounce (peer/fourth-search heads hashed on second observation,
  own heads immediately, own hash includes reduced checks and `latestReviews`
  at head so a new review wakes the driver); due list exactly as §Discovery step 5 (`approved`/
  `rejected` without `consumed_at`, `spent` without receipt, `deferred[]`
  with matching head, expired cap, marker > 3 h, `pending_settlement[]`);
  `pending.json` shape; log vocabulary `changed|due|unchanged|running|error`;
  exit codes 0/1/2/3. Tests use the fake-`gh` shim pattern; no live GitHub.
  Depends: T1.

## C3 — Two-way Telegram decisions

Capability: an escalation carries a token; the user's `approve <token>` /
`reject <token>` reply on Telegram is turned into a decision file by a fixed
script under the Hermes gateway; nothing else can transition a token.

- Internal task T4: `docs/plans/axstack-decide.sh` (installed by the user to
  `~/.hermes/scripts/axstack-decide`), `docs/plans/hermes-axstack-decide-SKILL.md`
  (installed to `~/.hermes/skills/axstack-decide/SKILL.md`), and tests ->
  `axstack-author` (Sol) via `axstack-implement` -> child worktree
  `pr-automations-decide` off T1. Theme: decision script. Size est: target
  band (script ~120 lines + tests ~250 + skill ~40). Acceptance (spec
  §Two-way decisions, acceptance 8): token regex `^[0-9a-f]{24,}$` else exit
  2 with no I/O; unknown/decided/malformed file exit 3; gateway config check
  every call (`TELEGRAM_ALLOWED_USERS` == user id, home chat private) else
  exit 4; optional sender/chat env vars, when present, must equal the user id;
  per-token lock with re-read inside; temp file + rename; writes `state`,
  `decided_at`, `decided_message_id`; one-line stdout; the skill text is
  exactly the two-command instruction and forbids `gh`, `git`, `orca`. Tests
  run the script against a temp run dir and a fake config. Depends: T1.

## C4 — Model-free watchdog

Capability: an hourly shell precheck reads the run directory and Orca run
history, evaluates four checks, records one JSON line per tick, sends one
Telegram message per new occurrence, and never launches a session.

- Internal task T5: `docs/plans/pr-automations-watchdog.sh` + tests ->
  `axstack-author` (Sol) via `axstack-implement` -> child worktree
  `pr-automations-watchdog` off T1. Theme: watchdog precheck. Size est:
  target band (script ~130 lines + shim tests ~250). Acceptance (spec
  §Watchdog, acceptance 10): four checks with the spec's thresholds (driver
  stuck incl. never-started after a `changed`/`due` line; three `error`
  lines; marker > 3 h 30; `open` decision > 24 h); occurrence `(check,
  first_observed)` dedup, re-send only after observed clear; `unknown` when
  evidence unreadable; `watchdog.log` line `{ts, checks, trips, sent}`; send
  receipt `sent|failed|uncertain` persisted, `failed` retried next tick;
  always exits non-zero; fake `hermes` and `orca` shims. Depends: T1.

## C5 — Driver and agent briefs

Capability: the driver automation prompt and the per-PR agent briefs make a
fresh Opus session execute the tick exactly as §Driver tick and §Agents
specify, using only Orca orchestration for dispatch.

- Internal task T6: `docs/plans/pr-automations-prompts.md` (driver prompt,
  review brief, repair brief, escalation message template, watchdog
  automation definition) -> driver (this chat) -> worktree
  `automations-simplify` stacked on T2. Theme: operational prompts. Size est:
  target band (docs only). Acceptance: prompt states both allowlists verbatim,
  the 15-minute cadence, identity validation, `run-use`, settlement, decision
  consumption with revalidation and spend-before-call, both repair triggers
  with id + digest dedup, marker rule with `legacy_automation_reviews[]`,
  budgets, `deferred[]`, TTL handling, verbatim fingerprint promotion,
  `tick_done_at`; briefs end with the required escalate field and the marker
  line; the escalation template names PR, criterion, reasons and the two exact
  replies. Depends: T2, T3, T4, T5 (paths and exit codes referenced).

## C6 — Enabled on the VPS

Capability: the new pair runs on the VPS in place of C/D with every acceptance
check passed.

- Internal task T7: host setup and acceptance -> driver (this chat), in the
  Orca conversation, no PR. Theme: cutover. Acceptance: spec acceptance 1–13
  executed in order and recorded in the run record with outputs; dedicated
  launch worktree created; run directory initialised (`cursor.json` with
  deploy-on-push sets for monorepo and mobile, `legacy_automation_reviews[]`
  = 5227822153, 5227925429, 5228233241); Hermes script and skill installed
  and the gateway allowlist verified; automations created disabled at distinct
  minutes; C/D disabled after confirmed settlement; old worktree removed; old
  run directory read-only; first real tick recorded. Depends: T1–T6 merged and
  installed (`axstack install` refreshes the skills). User-visible steps
  (installing to `~/.hermes`, typing the test `approve`) are requested in the
  Orca conversation.

## Dependency summary

T1 -> {T2, T3, T4, T5} -> T6 -> T7. T3, T4, T5 are independent of each other
and run as parallel bounded workers. Nothing here runs an automation, mutates
GitHub outside PR creation for T1–T6, or touches `~/.hermes` before T7.
