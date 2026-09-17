---
name: axstack-decide
description: Telegram replies `approve <token>` or `reject <token>` for Axstack PR automation decisions — run the fixed decision script and relay its one line.
---

when a message's own text — ignoring any `[Replying to: ...]` prefix or quoted text the gateway prepends — is exactly `approve <token>` or `reject <token>`, run `~/.hermes/scripts/axstack-decide <token> <verb>` and relay its one-line result; do nothing else and never run `gh`, `git` or `orca`.
