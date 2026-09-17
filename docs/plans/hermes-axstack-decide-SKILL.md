---
name: axstack-decide
description: Telegram decision replies for Axstack PR automations — `/axstack-decide approve <token>` or `reject <token>` runs the fixed decision script and relays its one line.
---

when invoked as `/axstack-decide approve <token>` or `/axstack-decide reject <token>`, or when a message's own text — ignoring any `[Replying to: ...]` prefix the gateway prepends — is exactly `approve <token>` or `reject <token>`, run `~/.hermes/scripts/axstack-decide <token> <verb>` and relay its one-line result; do nothing else and never run `gh`, `git` or `orca`.
