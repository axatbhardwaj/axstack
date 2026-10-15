# Ticket map: audit follow-ups and Explain design guidance

Spec: `docs/specs/audit-followups-design.md` Approved rev 4 @ `8c15c7e` (reviewed content SHA-256 `1d419f59c0ce3b134a44914c2f75ac77c58f5961127479e5f04f780f445fc803`). Store: repository Markdown. Run: private `20261014-mode-skill-audit`.

Rule: each task's acceptance is the full acceptance of the named spec section, plus the highlights below; nothing in the spec is waived by omission here.

Owners: the driver thread owns scope, integration, forge mutations and operational items. Each PR has one `axstack-author` writer in its own worktree (base: `main` after B merges for D and E).

## Capability B: prose-size budget

```text
Spec: rev 4 @ 8c15c7e
Capability: docs/plans/audit-followups-design.md#capability-b-prose-size-budget  Prose-size budget
Internal task: B1 -> axstack-author -> worktree axstack/20261014-mode-skill-audit/axstack-author/b1-a1
Theme: tests/workflows/prose-size.test.js ceilings and comment
Size est: small (one test file)
Acceptance: red at PR base for a temporary +1 byte outside and inside the always-loaded set; green at 500,000 / 30,000;
  lowering either ceiling below the measured value fails; one comment states both ceilings and the round-step rule
  (+100,000 / +5,000, reason in PR body and commit, never trim contract text); fixtures in an owned 0700 TMPDIR outside $HOME;
  D1 and E1 later merge without editing prose-size.test.js. Full: spec section B
Depends: none
```

## Capability D: settlement as a checked step

```text
Spec: rev 4 @ 8c15c7e
Capability: docs/plans/audit-followups-design.md#capability-d-settlement-as-a-checked-step  Settlement as a checked step
Internal task: D1 -> axstack-author -> worktree axstack/20261014-mode-skill-audit/axstack-author/d1-a1
Theme: settle read-back contract (run-record, lifecycle, workspace-hygiene, arena pointer) and its contract tests
Size est: small-medium (four Markdown files, one test file)
Acceptance: dispatch column `Settle readback`; mandatory close-out row (thread-bound t3_thread_read settled: true;
  task completion alone does not pass; a plain reason does not satisfy it; user-accepted hold linked to Decisions);
  lifecycle close-out (1) sentence; pinned-child rule (settle clears the pin; keep-pinned request holds);
  arena.md synthesis settle pointer; T3 refusal (for example parent_not_active) -> column held: <error>, close-out pending
  unless user-accepted, never reactivate a parent; contract tests fail on removal or inversion and survive rewording;
  does not edit tests/workflows/prose-size.test.js. Full: spec sections D items 1-5 and D acceptance
Depends: B1 merged
```

## Capability E: Explain and Publish design guidance

```text
Spec: rev 4 @ 8c15c7e
Capability: docs/plans/audit-followups-design.md#capability-e-explain-and-publish-design-guidance  Design guidance
Internal task: E1 -> axstack-author -> worktree axstack/20261014-mode-skill-audit/axstack-author/e1-a1
Theme: design reference for Explain pages and Publish articles
Size est: medium (vendored 9.4 KB file + license, owned guide ~1.5 KB, pointers, three presets, tests); two commits:
  (1) vendored payload, PROVENANCE, source-proof test, path lists; (2) owned guide, pointers, presets, contract tests
Acceptance: FRONTEND-DESIGN.md blob a5333457c414d20d625f307df945842c0952ecc3 from 41bbe19d (hold if upstream differs),
  not registered as a skill; LICENSE.txt; owned PROVENANCE with full commit SHA and "renamed, bytes unchanged";
  source-proof test fails on byte mismatch or missing licence;
  exact vendored entries in vendored-paths.js, bunfig.toml, biome.json; source-proof test; design.md precedence,
  tells, carve-outs, colour, subject-first, motion, fonts, no notes, credit; explainer load scope; reviewer render sources
  (inline self-render; Publish verifier PNGs before review); one design round; cosmetic exception and non-waiver list;
  unknown holds; delivery.md, visual-qa.md, Publish wording, three presets and presets.test.js updated; attribution line
  ending kept; contract tests fail on removal or inversion; verify-axstack package contents include vendored files;
  does not edit tests/workflows/prose-size.test.js. Full: spec section E items 1-6 and E acceptance (contract, source proof)
Depends: B1 merged
Internal task: E2 -> driver (operational, after E1 merges and installs) -> run evidence
Theme: E acceptance evidence on the installed release
Size est: operational
Acceptance: seat probe for html_preview and Publish PNG viewing (pass/fail recorded; fail holds Usage for the user);
  two fixed briefs recorded verbatim; before/after pages; after pages pass existing checks with a design verdict from
  viewed renders (passed, or tells named; unknown does not satisfy); the published-style example uses Publish's render
  source (UI-verifier PNGs); interactive pages keep their real-browser verifier pass; receipts name artifact SHA-256,
  screenshot producer, render paths; each pair shown as one comparison page or separate answers; no page published;
  improvement reported as a review judgment, not a guarantee. Full: spec E acceptance (seat probe, usage examples)
Depends: E1 merged, R1b installed
```

## Release

```text
Spec: rev 4 @ 8c15c7e
Capability: docs/plans/audit-followups-design.md#release  Release
Internal task: R1a -> axstack-author -> worktree axstack/20261014-mode-skill-audit/axstack-author/r1a-a1
Theme: chore(release) PR
Size est: small
Acceptance: one chore(release) PR merged under the watch predicate
Depends: B1, D1, E1 merged
Internal task: R1b -> driver -> run evidence
Theme: tag, publish workflow, four-host reinstall
Size est: operational
Acceptance: publish.yml run on the tag; the user approves the npm stage; reinstall and verify on io, iobook, iobox and
  axat-vps; an unreachable host is held with a resume command. Full: spec Delivery
Depends: R1a merged
```

## Capability C: quiet-gate decision (operational)

```text
Spec: rev 4 @ 8c15c7e
Capability: docs/plans/audit-followups-design.md#capability-c-quiet-gate-decision-operational  Quiet-gate decision
Internal task: C1 -> driver -> run evidence
Theme: dated measured keep/retire verdict
Size est: operational
Acceptance: review-manager-prompt.md and automations.md stay unchanged until the verdict (no code or prompt change);
  one interval schedule bound to the driver thread, first firing at or after 2026-10-27T15:04Z, deleted when it
  fires; Pending holds date, scheduledTaskId and resume prompt; receipt with both windows (2026-10-09T13:00Z to
  2026-10-13T15:04Z; 2026-10-13T15:04Z to run time), measured on axat-vps with output to a private evidence path: idle pass count,
  idle $/day, mean idle-pass cost, quiet share, admitting cost, admission reconciliation, missed-event attribution;
  coverage gaps (missing transcripts, missing rates, Codex passes without transcripts, unknown attribution, unattributed
  job-thread cost); verdict: keep (idle $/day down >= 25%, quiet share >= 40%, no quiet-only miss), retire (saving < 15%
  or any quiet-only miss), else inconclusive to the user. Full: spec section C
Depends: none (schedule created now; verdict after 2026-10-27T15:04Z)
```

## Capability D3: one-time settlement backlog (operational)

```text
Spec: rev 4 @ 8c15c7e
Capability: docs/plans/audit-followups-design.md#capability-d3-one-time-settlement-backlog-operational  Settlement backlog
Internal task: D3a -> driver (axat-vps, own project only) -> run evidence
Internal task: D3b -> local driver per remaining host/project scope (or held) -> that host's run evidence
Theme: metadata-only settle of eligible completed delegated children
Size est: operational
Acceptance: rules per spec D item 6 (selector created before 2026-10-15T04:55Z, latest run completed, neither settled nor
  archived; parent thread settled or run record Archived; exclusions; inherited-vs-user pin from read-only state; no parent
  state change). Per scope: before/after counts from a fresh fully paginated native inventory; settled IDs; pin evidence
  and classification per pinned child; excluded IDs with reasons, including T3 refusals; zero changes to excluded
  threads and parents; census counts (~456) are discovery denominators and drift is reconciled in each receipt; each
  local driver confirms on its first settle that settle clears the pin; scopes without a local driver are held with
  selector and resume prompt, user-accepted for close-out by spec approval (Decisions); any other hold needs its own
  user acceptance linked to Decisions. Full: spec D item 6 and D acceptance
Depends: none (independent of PRs; runs under existing hygiene rules)
```

## Dependencies

B1 → {D1, E1} → R1a → R1b → E2. C1 and D3 run independently. Close-out follows C1's receipt.

Driver-only, optional and deferred (no task): rev 4 wording notes (Opus spec-r4 #1, #2; diligence L-g, L-h, L-i) stay deferred to the post-approval snapshot note; they change no rule.
