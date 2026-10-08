# Relay decision cards: ticket map

Spec: docs/specs/relay-decision-cards.md rev 8 (reviewed content sha256
b0561f7f5e8258ec72b32c4a9868494380d724c82f7cb5f8797703acb5f9db0b).
Store: repository Markdown.

## C1 Decision cards replace the relay inbox

Capability: docs/plans/relay-decision-cards.md#c1 "Decision cards replace the relay inbox"
Internal task: T1 -> launched writer (Opus high) -> worktree branch axstack/20261008-relay-cards/t1-cards, stacked on the spec PR
Theme: the relay reply path (driver card contract, packaged Hermes reply skill, and their tests)
Size est: medium (prose contract and test rewrite across about 8 files)
Acceptance: spec criteria 1-13 and Decisions D1-D11 at rev 8.
- AC1-AC3, AC6-AC11 and D2, D4-D8, D10, D11: `skills/axstack-relay/SKILL.md`
  (card layout, readiness, four ordered checks, confirmation flow, receipts,
  decision responses, single-line rule, Decisions-topic routing).
- AC4, AC5, D1, D9: packaged Hermes skill `skills/axstack-relay/hermes/hermes-skill.md`
  rewritten in place as forward-only; `axstack-reply.sh` removed.
- AC12: inbox text removed from the relay skill, `skills/axstack/references/automations.md`,
  `docs/host-operations.md`, `docs/workflows.md`, `tests/workflows/relay-inbox.test.js`,
  `tests/workflows/autonomy-runtime.test.js`; 500 -> 1,000 pins; decision-interpreter wording;
  registry shape documented in `docs/host-operations.md` (open item resolved there).
- AC13: prose-contract and scenario tests in `tests/workflows/` with removal and inversion checks.
Depends: spec PR

## C2 Release and host switch (driver)

Capability: docs/plans/relay-decision-cards.md#c2 "Release and host switch"
Internal task: R1 -> driver -> release branch after C1 merges; host install under standing authority
Theme: release v0.32.0 and Hermes host switch on axat-vps
Size est: small (version bump) plus host steps
Acceptance: AC14 live canary (needs the user's swipe-replies and one-time Topics setup);
Exclusions host-change order: Topics enabled, user posts once, topic skill and
`channel_prompts` bound, `busy_input_mode: queue`, gateway restart, `/busy` reports
`queue`, `/reset`, legacy cards settled, registry entry written last, canary, then
remove `~/.hermes/scripts/axstack-reply`; failed canary removes the registry entry.
Fleet reinstall on io, iobook, iobox, vps after the user approves the npm stage.
Depends: C1
