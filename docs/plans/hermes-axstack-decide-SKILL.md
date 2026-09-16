---
name: axstack-decide
description: Relay exact Telegram decision replies through the fixed decision script.
---

when a message is exactly `approve <token>` or `reject <token>`, run `~/.hermes/scripts/axstack-decide <token> <verb>` and relay its one-line result; do nothing else and never run `gh`, `git` or `orca`.
