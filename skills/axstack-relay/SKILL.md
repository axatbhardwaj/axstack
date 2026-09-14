---
name: axstack-relay
description: When the user requests a relay message or test, or an authorized notification needs their attention, use axstack-relay to verify routing and deliver without expanding action authority.
---

# Relay

Send normal messages, transport tests, and authorized notifications through the
configured relay. This is an inline caller procedure: it creates no driver,
team, owner, auditor, monitor, child session, or recursive invocation.

## Establish message authority and routing

Choose the applicable message type:

- **Explicit messages and transport tests:** the user's request authorizes
  sending the requested content, including a simple “hi”. No Axstack decision,
  PR, or pre-existing `Notification policy` is required. Clearly label transport
  tests as tests with no action authority; preserve ordinary message content.
- **Urgent issues and blockers:** an explicit standing instruction to contact
  the user via Telegram authorizes proactive outreach when a time-sensitive
  issue or blocker requires their attention, without approval for each send.
  Record that instruction in the caller's private notification policy for
  subsequent runs. State the issue, impact, and the answer or action needed.
- **Other automated notifications:** follow the caller's recorded
  `Notification policy`, including eligible-message rules. Without applicable
  authorization, keep the message in the current Orca conversation.

Verify the transport, execution host, and intended recipient from the user's
request, trusted caller context, or an existing private notification policy.
Use the configured destination only when its binding to the intended user is
verified. Never guess a destination or send a probe to establish its identity.
If a required binding is missing or conflicts, ask only for that missing
routing information in the current conversation. Do not reconstruct authority
from host configuration. Do not switch execution hosts as part of this skill.

Use `conversation` mode for normal messages and tests; use `pr` only for an
actual PR decision. For automated notifications, honor the authorized mode and
execution-host binding. A policy naming a different transport does not authorize
`hermes-relay`. Keep credentials and private destination values host-managed;
public artifacts contain neither these values nor personal notification policy.

## Discover availability in order

Complete the first two steps before opening relay data, reading its manual, or
running any relay command.

1. Locate the CLI with `command -v hermes-relay` and capture the returned path
   as `relay_cli`. If it is missing, report "relay unavailable" in the current
   Orca conversation and use the recorded fallback. Never use a remote shell,
   search user directories, or hardcode a location.
2. Run `hermes-relay-host-enabled`. A non-zero result means "relay disabled on
   this host"; use the current-conversation fallback. The guard is availability policy, not a
   serious-risk gate, and changes no authority.
3. Resolve the discovered CLI symlink to its real file. Use `readlink -f` when
   available; otherwise use
   `python3 -c 'import os,sys;print(os.path.realpath(sys.argv[1]))' "$relay_cli"`.
   Read the sibling installed `README.md` as the authoritative manual. Do not
   copy or link an external manual into the bundle.
4. If that README is unavailable, `hermes-relay --help` and
   `hermes-relay doctor` prove capabilities only. A missing request schema
   holds every send; never infer the schema from help or doctor output.
5. Run `hermes-relay doctor` and inspect its JSON payload. Exit 0 alone is not
   readiness. The installed manual and payload must prove an Orca-capable
   conversation route; a legacy-runtime-only route is unavailable for active
   Axstack. `hermes` must resolve, `gh` must also resolve in `pr` mode, and the
   `database` value must equal `"ok"`. Any unmet requirement holds relay use and
   routes the message to the current conversation. Record only which readiness
   requirements passed or failed; never paste raw doctor output into public
   surfaces such as PR comments or reviews.

Discovery is complete only when authorization, routing, lookup, guard, installed manual,
request schema, mode-specific commands, and database payload all pass.

## Preserve identity and authority

For explicit user requests, use the requesting session as owner after verifying
its identity and persistence; no separate PR owner or user nomination is needed.
If it cannot accept replies persistently, use only a documented one-way/demo
route that needs no persistent owner, or report that specific capability gap.
For policy-driven messages, preserve the recorded owner.

For conversations that accept replies, verify a persistent owner and bind the
request to that owner and execution host. This includes reply-routing tests.
For one-way messages, require only the identity fields the installed schema
actually needs; do not invent a PR, revision, or decision to satisfy a workflow.
If the transport requires a persistent owner even for a one-way message,
verify it before sending. Never invent an owner or transfer ownership.
Bind actual PR decisions to the recorded repository, exact head and base.

Send authority comes from the explicit request or applicable standing policy.
It grants no merge, publication, ownership-transfer, or model-substitution
authority. Delivery and test replies are transport evidence only. Revalidate
any substantive user reply against the current task and existing action
boundaries before acting; silence never grants permission.

## Reconcile, deliver, and record

Before any new alert or retry, inspect `hermes-relay pending` and reconcile
uncertain delivery against the caller, message purpose, and any applicable revision.
Deduplicate by message purpose and applicable identity; a deliberate new user
request is distinct from an uncertain retry. Never retry an uncertain attempt; use
`hermes-relay retry` only for a definite failed send when the installed manual
and existing authority permit it.

Build request files only from the installed manual's schema. Keep them in a
private location, pass paths and identifiers as separate safely quoted
parameters, and never print file contents or parameter values. Use the
manual's `open --request-file`, `answer`, `supersede`, `pending`, `close`, and
`retry` procedures only as needed for the selected mode. Record the result as
a receipt bound to the message, applicable revision and owner, and delivery
state. Close one-way test requests when the manual requires it; keep reply
tests open only for their agreed lifetime.

Healthy unchanged watch ticks stay quiet. Avoid repeating unchanged blocker alerts; notify again when the situation
materially changes or the user requests a reminder. An absent CLI, disabled guard, readiness
failure, or failed delivery uses the current Orca conversation fallback. It
never clears an existing serious-risk or decision hold.
