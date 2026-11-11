# UI workflow and Explain delivery

Prerequisites: Launch and Doctor from the parent verification skill. These
source-contract checks need no product UI, live T3 or credentials.

Entry points: `skills/axstack-improve/SKILL.md`, `skills/axstack-implement/SKILL.md`
and `skills/axstack/references/ui-improvement-loop.md`.

```bash
doctor > "$EVIDENCE/ui-loop-doctor.log" 2>&1
bun run test tests/workflows/ui-improvement.test.js \
  tests/workflows/ui-verification.test.js tests/workflows/pr-proof.test.js \
  tests/workflows/perf-loop.test.js \
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

`pr-proof.test.js` checks mandatory PR Proof sections and UI screenshots, embedded
GIF recordings with linked MP4 fallback, driver-only orphan-branch assets with
`[skip ci]` commits, raw GitHub blob image embeds, head-sensitive refresh,
redaction before commits/posting, unredacted-push prohibition and text fallback.
The Owner row's permission stays limited to proof assets on the proof branch.
It also checks the verifier's private asset return and shared PR-body link.
Removal/inversion/rewording probes prove instructions; actual asset publication
and GitHub rendering remain driver-owned checks after a PR exists.

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
Publish and `explain-design.test.js` also check Aurora's shared identity and subordinate frontend-design craft,
inline font choices and published system stacks, inline colours derived from T3 theme variables,
theme legibility and the accessibility floor, plus screenshot
review at 360, 390, 728 and 1440px in both themes with exact-byte identity.
Aurora keepers reject instruction removal/inversion and accept equivalent wording for
shared author/reviewer guidance, typography, composition, citations, truthful charts
and unknown counts. The published token example preserves the selected dark identity
and verifies 4.5:1 text-accent contrast against both surfaces in both palettes.
These checks establish guidance, not generated-page quality or live theme contrast.
Inline pages never switch palettes on `prefers-color-scheme` or redefine T3 variables.
The Publish reuse contract retains the complete Explain page rules alongside
Visual QA, including word counting, static/interactive definitions and storage rules.
Preset reviewer-note contracts mirror Publish's four-width, both-theme inputs and
desktop/mobile inspection duties across mixed, codex-only and claude-only snapshots,
while reusing driver previews for non-anatomy Explain inline pages and preserving Anatomy self-checks.
This offline recipe proves instructions only. The driver separately runs the
candidate skill against the deployed stack with one public and one private
test article; reader-side access requires the authorized AC23 end-to-end run.

Entry points: `skills/axstack-explain/SKILL.md` and its `inline-pages`,
`delivery`, `design`, `aurora`, `fidelity`, `visual-qa` and `whiteboard-defense` references.
Architecture/system-map requests additionally use `architecture-diagram.md`.
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
700-word counting without card exemptions, Aurora identity, subordinate frontend-design craft and hard rules,
driver authorship for ordinary inline HTML/chat Mermaid, shared final-byte reviewer previews
and Publish verifier PNGs before review,
progress-based same-author repairs preserving requested visual/inline acceptance,
full source checks before design and full-claim review on every revision,
no-progress diagnosis, specific dependency holds and interim blocked prose,
entrypoint resume/reload and incomplete-hold rules, normal blocker and unknown-render holds,
with legacy cosmetic exceptions scoped only to Anatomy/Publish,
T3 or system fonts inline, published system stacks and no design history, exact-byte network scans, preview
and interaction gates, dependency holds, and ambiguous-render readback.
`explain-delivery.test.js` covers height repair then facts repair followed by a new
actionable citation/fact finding, and rejects inherited blocking repair caps across
Explain, whiteboard, Publish and preset reviewer notes. Its semantic keepers
reject removal/inversion and accept equivalent rewording; these remain instruction
checks rather than proof of live agent compliance.
`explain-architecture.test.js` checks the architecture route, ordered driver
bounds/scout grounding/conditional research/reconciled author brief, private
source map, one specialist writer and same-author repairs, full-claim exact-byte
review every round, actual author/reviewer provider independence, driver preview
design review, reviewed-byte delivery and unavailable-seat/single-provider holds.
Each rule rejects removal/inversion and accepts equivalent rewording in memory.
The bundle link check discovers the new reference without a fixed inventory.
In an authorized live architecture case, record unchanged-identity scout reuse
or fresh grounding, the research need/skip reason, actual author/reviewer session
provenance, preview hashes and full review verdicts at the delivered artifact hash.
Exercise unavailable-seat and single-provider controls without substituting seats.
Unrun live cases remain unverified; offline contracts do not prove orchestration.
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
only the driver publishes. For non-anatomy Explain inline pages, the independent reviewer
inspects adequate driver screenshots/hash without a mandatory duplicate render; missing,
stale, unreadable or inadequate evidence needs fresh capture. Reviewer/verifier logs are final-head proof, whereas
author logs and preview URLs alone are not. Mark uncovered behavior explicitly
`changed-behavior: unproven`.

## Live Explain regression: fresh and resumed inline delivery

This supplements the offline checks. The driver runs it on the real T3 stack
under recorded session/verification authority; the implementation author does
not launch sessions or change live homes. Use owned synthetic sessions and
private evidence. Keep the user's reference threads read-only.
Record the candidate SHA, loaded skill/reference hashes, host, thread/run links,
actual author/reviewer settings and final artifact identities. A missing live
route or unread skill load is unverified, never a pass from the contract suite.

1. Prepare a small source fixture with a stable hash and explicit branches:
   invalid key rejects; cache hit returns; miss computes, stores, then returns.
   Keep the expected steps/edges in private evidence. Request an ordinary static
   inline HTML explanation. Observe driver authorship by default, required
   design.md, Aurora and FRONTEND-DESIGN.md loads, and an independent reviewer.
   Also request chat Mermaid in an owned case: driver authorship, accessibility
   labels and full independent review still apply. Optional specialist authorship
   keeps one writer; Anatomy and Publish retain their existing paths.
2. In the fresh inline case, exercise recoverable height/layout and citation
   findings, followed by a remaining omitted factual step or branch. Verify the
   driver repairs it within existing authority and obtains a fresh verdict
   covering every claim and prior finding at each changed artifact SHA-256.
   Record actual attempts separately from any seeded scenario history; a newly
   found factual omission remains blocking even when earlier findings are fixed.
3. Resume/reload an owned case with stale context saying repair rounds are
   exhausted and prose should replace the page. Label this as seeded regression
   input, never current authority or observed prior work. Observe rereading the
   current SKILL.md and linked delivery rules, continued measurable repairs and
   full review, and actual inline delivery after checks pass. No repair count
   alone may cause prose completion or a renewed permission request.
4. For final-byte review, forward the driver's 728px dark and 360px light preview
   screenshots, paths and SHA-256. Observe independent inspection without a
   mandatory duplicate render when evidence is adequate. Exercise an inadequate
   or stale-evidence control: fresh capture is required. Preserve theme, fit,
   accessibility, network/console and any interactive-verifier checks.
5. Exercise an unavailable-reviewer/tool control using an observed availability
   gap or an explicitly labelled synthetic outage input; never disable real
   providers or invent a successful review. Expect the requested visual to stay
   incomplete with a named dependency hold and resume condition. A repeated or
   no-progress repair failure requires diagnosis and an evidence-based changed
   approach; if still blocked, expect a named incomplete hold, never blind retries
   or a completed prose substitute. Keep safety holds intact.
6. Read back the target T3 thread after html_render: confirm the page is present
   and its delivered bytes equal the reviewed hash. Preserve ambiguous-render
   readback/no-retry behavior. Save transcript/tool evidence, previews, full
   review verdicts, repair improvements and final delivery or exact hold.

Report each fresh, resumed, Mermaid and control case as observed pass/fail or
unverified, distinguishing synthetic inputs from actual tool rejection. These
finite scenarios establish only the observed candidate/session behavior, not
universal agent compliance. Browser interaction checks remain delegated under
UI verification and the user's browser-tool policy. Do not claim offline tests,
a screenshot alone, or an HTML file on disk proves live inline delivery.

Article briefs: after Doctor, run
`bun run test tests/workflows/article-review-briefs.test.js` and retain its log.
It checks the shared review/repair links, severity and wording contracts,
per-finding claim/label/location and before→after receipts, Publish's uncapped
length with reading time, and the inline-only 700-word cap. Explain's Publish
exception keeps its chat/inline cap from limiting articles. Real-source removal
and inversion fail; equivalent rewording passes. This proves instructions only,
not generated article fidelity, reading-time accuracy or live publication.
