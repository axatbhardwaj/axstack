# UI workflow and Explain delivery

Prerequisites: Launch and Doctor from the parent verification skill. These
source-contract checks need no product UI, live T3 or credentials.

Entry points: `skills/axstack-improve/SKILL.md`, `skills/axstack-implement/SKILL.md`
and `skills/axstack/references/ui-improvement-loop.md`.

```bash
doctor > "$EVIDENCE/ui-loop-doctor.log" 2>&1
bun run test tests/workflows/ui-improvement.test.js \
  tests/workflows/ui-verification.test.js tests/workflows/perf-loop.test.js \
  > "$EVIDENCE/ui-loop.log" 2>&1
```

Proof: report-only discovery for a named screen/flow, Playwright evidence,
ranked defects and criteria; fixed capture procedure, fresh comparable renders,
blind independent A/B, hard gates, keep/revert, disagreement and finite stopping.
Each semantic keeper rejects removal/inversion and accepts equivalent rewording.
Visual-only TDD keepers require verifier-executed acceptance failure on best-known
before editing, then the same check passing on a fresh candidate with hard gates.
They preserve applicable repository behavior tests and browser delegation,
reject screenshot-only, subjective-score and retrospective red, and retain the
hold when a meaningful test-first check is unavailable.
This does not prove a live visual improvement, capture comparability or reviewer
blindness. For an actual product UI run, the driver delegates Playwright through
the existing UI verifier with exact revision, protocol and private evidence;
no browser drive belongs to the author. Preserve all existing delivery gates.

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
