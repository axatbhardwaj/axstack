# Inspect workflow instruction contracts

Entry points: packaged workflow skills and shared references; fixtures:
`tests/workflows/{completion-guards,workspace-hygiene,manager-pass-settlement,manager-holds,relay-removal,merge-audit-discipline,merge-escalation,autopilot-repair,dependabot-driver,analysis-pairs}.test.js`.
Settlement read-back contracts: `tests/workflows/settle-readback.test.js`.
Staged-file writer gate: `tests/workflows/staged-file-tokens.test.js` drives the
packaged `check-staged-file-tokens.js` in temporary Git repos; it checks index
bytes, exclusions, failure guidance, renames and subdirectory invocation.
It also checks shared main-repo ignore globs from a linked worktree and the
resolved ignore-file location in failure guidance.
`staged-token-gate.test.js` checks the Implement instruction with removal,
inversion and equivalent-rewording probes. These tests install no Git hooks.
C1 documentation keepers: `public-docs`, `readme-contract`, `skill-current-contracts`,
`explain-diagram`, `explain-fidelity`, `explain-whiteboard`, `ui-verification` and `presets` in `tests/workflows/`.
Prerequisites: Launch and Doctor; this path needs no live T3, credentials or
network. The tests inspect instructions, not live agent compliance.
The removal check covers shipped transport absence and driver-thread decision holds.
Manager-hold checks cover finite-pass flagging, optional host alerts and host-defined user input.

```bash
doctor > "$EVIDENCE/workflows-doctor.log" 2>&1
STATUS=0
bun run test tests/workflows/completion-guards.test.js \
  tests/workflows/staged-file-tokens.test.js \
  tests/workflows/staged-token-gate.test.js \
  tests/workflows/settle-readback.test.js \
  tests/workflows/workspace-hygiene.test.js \
  tests/workflows/manager-pass-settlement.test.js \
  tests/workflows/pr-managers.test.js \
  tests/workflows/peer-review.test.js \
  tests/workflows/isolated-manager-passes.test.js \
  tests/workflows/relay-removal.test.js \
  tests/workflows/manager-holds.test.js \
  tests/workflows/merge-audit-discipline.test.js \
  tests/workflows/merge-escalation.test.js \
  tests/workflows/autopilot-repair.test.js \
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
  tests/workflows/single-server.test.js \
  tests/workflows/single-server-units.test.js \
  tests/workflows/default-sync-policy.test.js \
  tests/workflows/sync-default.test.js \
  tests/workflows/run-record.test.js \
  tests/workflows/prose-size.test.js > "$EVIDENCE/workflows.log" 2>&1 || STATUS=$?
printf '%s\n' "$STATUS" > "$EVIDENCE/workflows-exit.txt"
test "$STATUS" -eq 0
```

Peer review contracts cover context-only intent, validated behaviour blockers,
binding verdicts, bounded follow-ups, reply finality, the five-request adviser
panel and compact output, while preserving authored review requirements.

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

The default-sync CLI checks use fake homes and loopback usage responses, never
live settings. The pool fixture is
`claudeAgent=claude-opus-5-5,codex=gpt-6-astra:medium`; explicit Claude effort
also has byte-preservation coverage. Checks cover exact weekly reserve bands
at 15% and 10%, cross-driver band preference despite opposing pace, the same-band
ten-point pace margin and ties (including all-low usable quota), unknown holds,
excluded-current escape, hard 95%-used/limit/credential exclusions, no eligible
candidate, and unchanged no-pool behavior. Dry-run preserves all settings bytes;
writes preserve every byte outside the decided root selection. This is offline
policy proof only: best-effort reserve preference does not guarantee a weekly
budget. Host catalog validation, preserving each host's actual Opus effort,
one-time same-account Sol migration at driver host activation, running-thread
non-interference and fleet activation/readback remain separate live checks.

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
