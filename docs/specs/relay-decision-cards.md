# Relay decision cards (Stage 1)

Status: Approved rev 8 (2026-10-08, user "perfect let's go"; reviewed content sha256 b0561f7f5e8258ec72b32c4a9868494380d724c82f7cb5f8797703acb5f9db0b).

## Outcome

Telegram relay decisions become readable, one-decision cards in a dedicated
Telegram topic. The user answers with a swipe-reply such as `1`, `2`, or
`explain`. Hermes forwards every reply to the driver thread through its T3 MCP
connection, which replaces the gateway-host SSH inbox. Stage 2, out of scope
here, swaps the swipe-reply for native tap buttons and reuses the same
decision handling.

## Facts this design rests on

- Hermes 0.21.1 on axat-vps has OAuth T3 MCP servers `t3-vps` and `t3-iobox`
  with full access (set up 2026-10-08, T3 nightly 2801 or later; the grant
  lasts 30 days). `hermes mcp test <name>` exists.
- Hermes 0.21.1 forwards the full quoted text of a swipe-reply as
  `[Replying to: "<quote>"]` without truncation
  (`gateway/run_inbound.py:1508-1515`). A Telegram partial-selection quote
  replaces it with only the selected text (`adapter.py:6280-6290`).
- Hermes's agent sees a sender's display name, not a stable user ID
  (`gateway/session.py:419-423`). The gateway's Telegram allowlist, in code,
  decides who reaches Hermes. In a private chat only its user can reply.
- Pending Hermes prompts (such as `clarify`) intercept a session's next reply
  before any skill runs (`run_inbound.py:1201`).
- The gateway runs `busy_input_mode: interrupt`: a message that arrives while
  a turn is running is injected or merged without its own quote
  (`run_inbound.py:527-581`). Queue mode gives each message its own turn and
  quote (`run_busy.py:281-289`), except follow-ups that arrive more than 3s
  into a turn whose agent is still starting, which are appended as new lines
  under the earlier quote (`run_inbound.py:619-622`, `base.py:1698-1702`).
  Profile multiplexing is off on axat-vps, so `~/.hermes/config.yaml` holds
  the effective mode.
- A skill auto-loads only when a topic session is new; a topic's
  `channel_prompts` entry applies every turn (`adapter.py:6336`). A topic
  appears in `hermes send --list telegram` only after a session exists there.
- Hermes supports private-chat topics (Telegram Bot API 9.4): each configured
  topic is an isolated session and can auto-load a skill. The user enables
  Topics mode once in the Telegram client; the bot cannot.
- Hermes Telegram buttons exist only for its own `clarify`, approval and
  model-picker prompts. `hermes send` is plain text. Lasting tap buttons need
  an upstream Hermes change (Stage 2).
- `hermes send` exists only on the gateway host. Drivers elsewhere already use
  the T3 thread fallback; this spec does not change that.
- `t3_thread_send` defaults to `auto`, which can steer a running turn.
- The legacy `axstack-decide` Hermes skill triggers only on
  `approve|reject <token>` and does not overlap.
- `AGENTS.md` forbids an Axstack daemon, scheduler, runtime database, or
  workflow state machine, and live home-configuration edits during development.

## Decisions

| ID | Decision | Source |
| --- | --- | --- |
| Q1 | "Two stages: numbered reply cards first, lasting tap-buttons later." | User |
| Q2 | "Second confirmation only for destructive, production, or fleet-wide actions. Human-only steps stay manual." | User |
| D1 | Hermes is a forwarder only: for relay replies it calls `t3_thread_send` mode `queue` and no other T3 tool. The driver answers `explain` in Telegram. Hermes keeps full-access T3 MCP; any full-access T3 agent could already forge a typed-looking message, accepted under the existing fleet risk, and narrowing with `tools.include` stays available. Alternative: Hermes reads the thread and answers `explain` itself (faster, but feeds untrusted transcript text into the session that forwards choices). | Driver; needs user approval |
| D2 | The forward is the fixed line `Telegram reply via Hermes` followed by Hermes's complete inbound envelope (`[Replying to: "<quote>"]` and the user's reply), never edited. Authority needs the quote to contain a `Card` line and final tag that match a `sent` card receipt of this run, environment, and thread. Card IDs are never reused, so the ID proves card identity, not provenance. Worker messages stay data. | Driver; needs user approval (fixed line) |
| D3 | Labels show values the driver supplies from its approved scope. A host-managed registry on the gateway host maps this host's T3 environment label to its Hermes MCP server and the relay topic, with optional machine aliases. A hostname is never translated to an alias by inference. Systems such as `npm` or GitHub need no registry entry. The registry never grants authority. | Driver |
| D4 | No new store. Each card's `sent` receipt in the existing run record carries its card ID (`<run id>/<n>`, never reused in the driver thread), each option's bound action, scope, and revision, and one advisory outcome field: open until `decided`, `deferred`, `superseded`, `cancelled`, or `run closed`. Only an open card authorizes. The driver applies this in its prose checks; there is no transition engine. Only the run's driver sends reply-dependent cards and records their receipts. The driver resolves `1`, `2`, `3` from the receipt, never from quoted text; a missing receipt grants nothing. | Driver |
| D5 | Decision responses, a new relay message type authorized by the user's own reply, outside the two-milestone cap and needing no Notification policy entry: one acknowledgement per forwarded reply, sent before any side effect; an `explain` answer serves as that reply's acknowledgement; one outcome per decided card. A confirmation card or a fresh superseding card serves as that reply's acknowledgement. An identical repeat reply is acknowledged in T3 only; a different later choice gets "already decided as N" in Telegram. An outcome that is itself a merge-ready or merged milestone counts as that milestone and is sent once. | Driver; needs user approval |
| D6 | A verified confirmation satisfies Q2 once, for its bound action and revision. | Driver |
| D7 | Cards may add `3 Defer`: it records `deferred`, takes no action, keeps the hold, and sends no new card unless context changes or the user asks. | Driver; needs user approval |
| D8 | Relay bodies may be up to 1,000 characters (previously 500): the mandatory label, revision, and card-ID lines do not fit in 500, and Hermes 0.21.1 keeps full quotes. | Driver; needs user approval |
| D9 | Reply-dependent cards go only to a relay-only "Decisions" topic in the verified private home DM, configured with the Hermes reply skill auto-loaded, the same forward-only rule as the topic's `channel_prompts` entry keyed by the topic's thread ID (never the DM chat ID), and no other interactive use. Without that topic, cards are sent with the T3 action route instead of swipe replies. | Driver; needs user approval (one-time Topics setup) |
| D10 | The gateway's `busy_input_mode` becomes `queue` at install. Swipe replies require it; if the user declines, criterion 3 fails and cards use the T3 action route. | Driver; needs user approval (gateway-wide setting) |
| D11 | Multi-line reply text is rejected because Hermes may append a later message under an earlier quote; free text must be one single-line message, and the acknowledgement asks the user to resend each card's reply as one single-line message. | Driver; needs user approval (diligence-r6) |
| D12 | Implementation clarifications carried from opus-r7: the busy mode takes effect after a gateway restart, so the install restarts the gateway and checks that `/busy` in the Decisions topic reports `queue`; the startup merge appends only onto an already-queued follow-up and drops the appended message's quote. | Driver (opus-r7 optional, rev7 text unchanged) |

## Design

Rung 1: the relay contract changes shape at the reply boundary. Data flow
before: Telegram reply → Hermes → `axstack-reply` script → JSONL inbox on the
gateway host → driver reads over SSH at each wake. After: Telegram reply in
the Decisions topic → Hermes reply skill → `t3_thread_send` mode `queue` to the
tagged driver thread. The driver wakes on the queued T3 message and maps the
reply to a normalized choice (`1`, `2`, `3`, `explain`, or free text) before
decision handling, so Stage 2 taps can feed the same handling.

The driver checks a forwarded reply in this order:

1. Proof: the quote's `Card` line and tag match a `sent` receipt of this run
   (any outcome). A failure gets a rejected acknowledgement and changes no
   receipt.
2. Card state: a matched card that is not open gets "already decided" (D5
   rules) or "no longer open" and no action.
3. Context: a matched open card whose task, revision, event, authority, or
   remote state changed is marked `superseded` (a confirmation card:
   `cancelled`) and reissued only if a decision is still needed; otherwise the
   outcome says why.
4. Choice: `explain` gets an answer and the card stays open; reply text with
   more than one line is invalid, and its acknowledgement asks for one reply
   per card; an invalid choice leaves the card open; a valid one proceeds.

Failure modes at Hermes: a missing tag, unknown environment label, or
unreachable T3 server makes Hermes answer in Telegram, repeat the user's text
so it can be resent, and forward nothing. A partial quote that keeps the
`Card` line and tag is forwarded and handled normally; one that drops either
fails proof. An uncertain `t3_thread_send` result is reported as uncertain and
never retried automatically.

Usage: the driver composes a card, checks reply-route readiness, sends it to
the Decisions topic with `hermes send`, records the `sent` receipt, and ends
its turn. The user swipe-replies `1`. Hermes forwards the message and, after a
confirmed send, answers "Queued for the driver; not done yet." The driver runs
the checks, records `decided`, sends the acknowledgement, acts, and then sends
the outcome.

### Card layout

Plain ASCII text, one Telegram message, under 1,000 characters including the
tag:

```text
<project> - <decision title>
Card <run id>/<n>[, confirms card <run id>/<m>]
Context: <what we were doing, one line>
Decision: <the question>
Driver environment: <value | not supplied>
Execution machine: <value | not supplied>
Affected targets: <values | not supplied>
Revision: <repo#PR @ full SHA | spec rev N sha256 | none>
1 <action> - <scope>
2 <action> - <scope>
3 Defer (optional)
Reply 1, 2, 3 or explain. Open T3: <link | not available>
T3 reply: <env label> thread <driver threadId>
```

`Revision: none` is allowed only for decisions that concern no PR head or spec.
An option that is a human-only step reads `You do: <instruction>`; choosing it
records the choice and grants no agent action. An option that needs a second
confirmation ends with `(confirm)`. When reply-route readiness fails, the
`Reply ...` line becomes `Act in the T3 thread: <link | thread id>`.

## Acceptance criteria

1. One card carries exactly one decision, a card ID `<run id>/<n>` never
   reused in the driver thread, a one-line `Context:` summary of the work in
   progress, two numbered options plus an optional `3 Defer`, and the tag line
   last. Only the run's driver sends reply-dependent cards.
2. Every card has the `Driver environment`, `Execution machine`, and
   `Affected targets` lines with the driver-supplied value, a registry alias
   where one exists, or `not supplied` when absent. No hostname is translated
   by inference. A fleet release card names each install target and `npm` as
   an external system.
3. Before sending a card that expects a reply, the driver checks reply-route
   readiness: Hermes 0.21 or newer, a registry entry for its environment with
   the Decisions topic, that topic listed by `hermes send --list telegram`
   with the verified home DM's chat ID, the gateway's effective
   `busy_input_mode` set to `queue`, and `hermes mcp test <server>` passing. On failure
   the card keeps its options and tag and swaps the `Reply ...` line for the
   T3 action route.
4. The Hermes reply skill, auto-loaded in the Decisions topic, handles only
   swipe-replies whose quote ends with a valid tag whose environment label
   resolves through the registry. Any other case gets "Reply to the whole
   card" or "Act in the T3 thread" with the user's text repeated, and nothing
   is forwarded. A message without its own quote, including a mid-turn
   correction, is never forwarded and never changes an envelope already being
   forwarded. The skill never calls `clarify`.
5. Every reply that passes criterion 4, including `1`, `2`, `3`, `explain`
   and free text, is forwarded with `t3_thread_send` mode `queue` as D2
   describes; the skill calls no other T3 tool. Hermes says "Queued for the
   driver; not done yet" only after a confirmed send, and reports a failed or
   uncertain send without retrying.
6. On `explain`, the driver answers in Telegram with the context, options,
   risks, and the Open T3 link when available. It grants no authority and the
   card stays open.
7. The driver applies the four checks in the Design order. Proof failures
   change no receipt; closed cards get no action; changed context supersedes
   and reissues only when a decision is still needed; an unresolved machine
   or target for a consequential action counts as changed context.
8. Any forwarded reply, including free text and `(confirm)` options, that
   would authorize a destructive, production, or fleet-wide action first gets
   a confirmation card with its own ID naming the card it confirms, the exact
   action, execution machine, affected targets, and revision, with
   `1 Confirm` and `2 Cancel`. Sending it records the confirmed card
   `decided` (pending confirmation, no authority). Only a verified `1` reply
   to that open confirmation card authorizes, once, and the confirmation card
   carries the outcome. `2 Cancel` or a failed revalidation records
   `cancelled`; any further decision needs a fresh card.
9. The driver records `decided` and sends the acknowledgement before any side
   effect. After an interruption, it reconciles remote state before repeating
   any action. `3 Defer` follows D7.
10. Queued, acknowledged, and done are distinct, and decision responses follow
    D5.
11. Human-only steps (for example `npm stage approve`, user merges) stay
    manual; no card option performs them.
12. The SSH inbox, `axstack-reply.sh`, consumed-line counts, body digests,
    and the "inbox unreadable" hold are removed from the relay skill,
    `automations.md`, `docs/host-operations.md`, `docs/workflows.md`,
    `tests/workflows/relay-inbox.test.js`, and
    `tests/workflows/autonomy-runtime.test.js`. The relay skill and
    `docs/workflows.md` add the decision-response message type, and the card
    reply set replaces "Do not invent reply commands". The relay skill allows
    the registry's `telegram:<chat_id>:<thread_id>` Decisions topic inside the
    verified home DM as routing, not authority, and its inbox readiness text
    becomes criterion 3. In `automations.md`, "decision interpreter" becomes
    "no programmatic decision interpreter; the driver maps card replies in its
    prose checks". The 500-character pins
    in `relay-discovery.test.js` and `relay-scenarios.json` move to 1,000. The
    packaged Hermes skill is rewritten in place for criteria 4 and 5.
13. Tests in `tests/workflows/` fail when an instruction is removed or
    inverted and cover criteria 1 to 11, including: each of the four check
    outcomes; a delayed reply to a decided card after an identical reissue; a
    delayed reply across two runs in the same driver thread; a partial quote
    with and without the `Card` line; altered option text under a valid card
    ID (resolved from the receipt); a multi-line reply under a valid card
    (invalid); the confirmation flow; `3 Defer`; and
    decision handling on a normalized choice.
14. During the authorized host install, before the old route is retired, a
    live canary in the Decisions topic with the user's own swipe-replies
    passes, in a fresh topic session after the skill is bound: `explain`, `1`,
    a partial quote without the tag, a near-limit card with a non-ASCII reply,
    two quick replies to two open cards (each decides its own card), a quoted
    reply followed quickly by an unquoted correction (the correction is not
    forwarded), and a card reply while a `clarify` is pending in another
    topic.

## Exclusions

- Native tap buttons, card editing in place, Mini Apps, a separate bot, a new
  dashboard, and any new database or daemon (Stage 2 or never).
- Sending cards from hosts without `hermes` (iobox, io); the T3 thread
  fallback stays. The registry covers only the gateway host's environment.
- The legacy Orca `axstack-decide` Hermes skill and its gateway drop-in.
- Host changes happen in the post-release host install under its recorded
  authority, not in the code change. There, after the user enables Topics
  mode and posts once in the Decisions topic, the topic is configured with
  the new Hermes skill and `channel_prompts` entry, `busy_input_mode` is set
  per D10, and the user sends `/reset` in the Decisions topic so a fresh
  session loads the skill. The new skill replaces `axstack-reply` in place
  (never both installed). The registry
  entry is written last as the switch, and a failed canary removes it so
  criterion 3 falls back to the T3 action route. Switch only after legacy open
  cards are settled or superseded and reissued, and remaining inbox entries
  are reconciled; then remove `~/.hermes/scripts/axstack-reply`.
- Changing who may merge or approve npm stages.

## Needs user approval

- D1: Hermes only forwards and the driver answers `explain` (alternative:
  Hermes reads the thread and answers `explain` itself).
- D2: the fixed `Telegram reply via Hermes` first line counts as forwarding
  the reply unchanged.
- D5: decision responses as a new relay message type outside the
  two-milestone cap.
- D7: the optional `3 Defer`.
- D8: the 1,000-character relay body limit.
- D9: a relay-only Decisions topic in the bot DM; the user enables Topics mode
  and posts once in it.
- D10: gateway-wide `busy_input_mode: queue`; without it, no swipe replies.
- D11: free-text replies must be a single line.

## Open items

- Registry path and shape (proposed `~/.config/axstack/machines.json`), set
  during implementation.
- Whether T3 records the sending MCP client on a `t3_thread_send` message.
  If it does, the driver may require it in addition to the fixed first line.
