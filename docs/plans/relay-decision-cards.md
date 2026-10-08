# Relay decision cards: ticket map

Spec: docs/specs/relay-decision-cards.md rev 8 (reviewed content sha256
b0561f7f5e8258ec72b32c4a9868494380d724c82f7cb5f8797703acb5f9db0b).
Store: repository Markdown.

## C1 Decision cards replace the relay inbox

Capability: docs/plans/relay-decision-cards.md#c1 "Decision cards replace the relay inbox"
Internal task: T1 -> launched writer (axstack-author) -> branch axstack/20261008-relay-cards/t1-cards, stacked on the spec PR
Theme: the relay reply path (driver card contract, packaged Hermes reply skill, and their tests)
Size est: medium (prose contract and test rewrite across about 8 files)
Acceptance: spec criteria 1-13 (the criterion 13 case list verbatim) and Decisions D1-D12 at rev 8.
- AC1-AC3, AC6-AC11 and D2-D8, D10, D11: `skills/axstack-relay/SKILL.md`
  (card layout, readiness, four ordered checks, confirmation flow, receipts,
  decision responses, single-line rule, label rules with no inference,
  Decisions-topic routing `telegram:<chat_id>:<thread_id>` as routing, not authority).
- AC4, AC5, D1, D9, D12 (startup-merge behaviour): packaged Hermes skill
  `skills/axstack-relay/hermes/hermes-skill.md` rewritten in place as forward-only;
  `axstack-reply.sh` removed.
- AC12: inbox text removed from the relay skill, `skills/axstack/references/automations.md`,
  `docs/host-operations.md`, `docs/workflows.md`, `tests/workflows/relay-inbox.test.js`,
  `tests/workflows/autonomy-runtime.test.js`; the decision-response message type added
  to the relay skill and `docs/workflows.md`; the card reply set replaces "Do not invent
  reply commands"; 500 -> 1,000 pins; decision-interpreter wording in `automations.md`.
- D3 and Open item 1: registry shape and rules (environment label -> Hermes MCP server,
  Decisions topic, optional aliases; never authority) documented in `docs/host-operations.md`.
- Open item 2: deferred; the fixed first line stays authoritative. Recorded as an open
  item in `docs/host-operations.md`.
- AC13: tests in `tests/workflows/` cover the criterion 13 case list, fail on removal or
  inversion, and survive rewording.
Depends: spec PR

## C2 Release and host switch (driver)

Capability: docs/plans/relay-decision-cards.md#c2 "Release and host switch"
Internal task: R1 -> driver -> release branch after C1 merges; host install under standing authority
Theme: driver-owned release mechanics (standing AGENTS.md authority, not a spec item) and the spec's host switch on axat-vps
Size est: small (version bump) plus host steps
Acceptance: criterion 14 case list verbatim (live canary with the user's own swipe-replies)
and the Exclusions host-change order: Topics enabled and one user post in the Decisions
topic; topic skill and `channel_prompts` (keyed by thread ID) bound; `busy_input_mode:
queue`; gateway restart; `/busy` reports `queue` (D12); `/reset`; the new skill replaces
`axstack-reply` in place (never both installed); legacy open cards settled or superseded
and reissued and remaining inbox entries reconciled; registry entry written on axat-vps
last as the switch; canary; then remove `~/.hermes/scripts/axstack-reply`. A failed
canary removes the registry entry. Fleet reinstall on io, iobook, iobox, vps after the
user approves the npm stage.
Depends: C1

## Exclusions (from the spec, untouched by this map)

- Native tap buttons, card editing in place, Mini Apps, a separate bot, a dashboard, any database or daemon.
- Hosts without `hermes` (iobox, io) keep the T3 thread fallback.
- The legacy `axstack-decide` Hermes skill and its gateway drop-in.
- Merge and npm-stage authority are unchanged.
