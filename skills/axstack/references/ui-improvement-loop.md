# Bounded UI improvement

Use this loop only for authorized UI changes to the named screen or flow.
Improve owns report-only discovery; Implement owns changes. Reuse the existing
PR author, `axstack-ui-verifier` and independent authored reviewer from the
run's role snapshot; create no new roles. Follow [UI verification](ui-verification.md)
for read-only Playwright capture in the verifier's isolated checkout and private
evidence folder. The author never reviews its own change.

## Establish the comparison

Before the first edit, anchor task and visual goals to acceptance criteria.
Use the discovery's ranked defects: for example, the primary action is visible
at the agreed mobile width, labels remain legible in both themes, and the named
keyboard task completes. Describe intended users and the visual direction in
concrete terms so preference has an inspectable basis.
Before the first edit, record a finite attempt and time budget plus a plateau
threshold (consecutive attempts without a supported improvement).
Freeze the capture protocol with routes, fixtures, viewports, themes and states.
Include browser/build settings, data and authentication fixtures, font loading,
animation settling, scroll position, and the interactions used to reach each
state. Freeze the procedure, not a candidate image. Keep comparable evidence
for loading, empty, error and populated states where relevant.
Capture the baseline through the verifier before editing.
Preserve the baseline as the best-known revision with its evidence.
When the protocol changes, recapture both sides before comparison and record why.

## Attempt, compare, decide

Use one writer and one hypothesis for each attempt.
Tie the small change to one ranked defect and its acceptance checks; keep
unrelated cleanup outside the attempt. Apply Implement's normal TDD path.
Each attempt requires fresh renders of best-known and candidate exact revisions
under the same protocol. Bind screenshots and interaction logs to revision,
route, fixture, viewport, theme and state in the private evidence manifest.
A missing or failed capture or uncertain comparison cannot justify a win.

Give an independent reviewer a blind A/B with random labels and the anchored
criteria. The driver retains the label-to-revision mapping separately from the
review packet. Hide author identity, change narrative, hypothesis and expected
winner; supply matching task context and state coverage for both sides. Review
all captures and relevant interaction evidence, with findings tied to specific
regions or actions. Record preference, reasons, regressions and uncertainty
before revealing the mapping; never treat the author's preference as review.

Functional, accessibility and interaction hard gates must pass before any keep
decision. Verify the named task, keyboard/focus behavior, accessible names,
contrast, responsive layout, reduced motion and affected tests as applicable;
an unrun applicable gate remains unknown and prevents keeping the attempt.
Keep only an evidence-backed improvement against the criteria, otherwise revert
to best-known. Record the decision, rejected hypothesis and exact resulting
revision; preserve each accepted best-known candidate and its evidence.
Resolve disagreement with specific evidence and recapture within budget, then
retain best-known if unresolved. Recheck the disputed state with a fresh blind
independent comparison; ties and unresolved tradeoffs are inconclusive, never
a forced win or averaged vote. Failed attempts consume the budget too.
Never use a numeric aesthetic score as the sole success criterion.

Stop at the goal, budget exhaustion or plateau and report unverified boundaries.
Return the best-known revision, attempt/keep/revert ledger, evidence paths,
criteria met, remaining defects and stop reason. Budget exhaustion may leave
the UI goal unmet; say so. The driver can finish an authorized bounded run
without a new human taste approval. Explain's two-round visual limit does not
apply to this loop. Existing exact-revision review, verification and merge gates
remain required; this comparison grants no publication or merge authority.
