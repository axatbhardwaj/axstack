# Inspect workflow instruction contracts

Entry points: packaged workflow skills and shared references; fixtures:
`tests/workflows/{completion-guards,workspace-hygiene,manager-pass-settlement,relay-discovery,merge-audit-discipline,merge-escalation,autopilot-repair,dependabot-driver,analysis-pairs}.test.js`.
C1 documentation keepers: `public-docs`, `readme-contract`, `skill-current-contracts`,
`explain-diagram`, `explain-fidelity`, `explain-whiteboard`, `ui-verification` and `presets` in `tests/workflows/`.
Prerequisites: Launch and Doctor; this path needs no live T3, credentials or
network. The tests inspect instructions, not live agent compliance.

```bash
doctor > "$EVIDENCE/workflows-doctor.log" 2>&1
STATUS=0
bun run test tests/workflows/completion-guards.test.js \
  tests/workflows/workspace-hygiene.test.js \
  tests/workflows/manager-pass-settlement.test.js \
  tests/workflows/relay-discovery.test.js \
  tests/workflows/merge-audit-discipline.test.js \
  tests/workflows/merge-escalation.test.js \
  tests/workflows/autopilot-repair.test.js \
  tests/workflows/dependabot-driver.test.js \
  tests/workflows/analysis-pairs.test.js \
  tests/workflows/public-docs.test.js \
  tests/workflows/readme-contract.test.js \
  tests/workflows/skill-current-contracts.test.js \
  tests/workflows/explain-diagram.test.js \
  tests/workflows/explain-fidelity.test.js \
  tests/workflows/explain-whiteboard.test.js \
  tests/workflows/ui-verification.test.js \
  tests/workflows/presets.test.js \
  tests/workflows/prose-size.test.js > "$EVIDENCE/workflows.log" 2>&1 || STATUS=$?
printf '%s\n' "$STATUS" > "$EVIDENCE/workflows-exit.txt"
test "$STATUS" -eq 0
```

Proof: source contracts pass, targeted removal and inversion fail, and accepted
equivalent wording passes. Auditor routes derive from the selected preset
policy; prose budgets use measured bytes. No test result proves native queue
coverage, atomic settlement, relay authentication or universal English parsing.
Live acceptance requires the driver's exact task/thread/run identities,
terminal state, receipt acceptance, settlement and readback, plus a fresh
run-owned inventory before absence or cadence claims. Retain unobserved cases
as UNKNOWN and cancellation as a separate disposition.

## Explain delivery

Entry points: `skills/axstack-explain/SKILL.md` and its `inline-pages`,
`delivery`, `fidelity`, `visual-qa` and `whiteboard-defense` references.
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
700-word counting without card exemptions, exact-byte network scans, preview
and interaction gates, bounded delivery holds, and ambiguous-render readback.
For page behavior, delegate this feature path to `axstack-ui-verifier` with the
reviewed artifact's SHA-256 and private evidence folder. It serves the exact
bytes on its own isolated host-loopback instance and checks 728px dark/360px
light, layout, theme, console/network, all interactive states and accessibility.
Use [Anatomy](anatomy.md#browser-acceptance-handoff) for figure theme/compositing.
Honor user browser-tool policy. The author performs no review browser drive;
only the driver publishes. Reviewer/verifier logs are final-head proof, whereas
author logs and preview URLs alone are not. Mark uncovered behavior explicitly
`changed-behavior: unproven`.
