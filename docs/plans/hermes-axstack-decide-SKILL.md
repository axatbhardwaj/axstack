---
name: axstack-decide
description: Relay exact Telegram decision replies through the fixed decision script.
---

On a message exactly `approve <token>` or `reject <token>`, run `axstack-decide <token> <verb>` and relay its single output line; otherwise do nothing; never run `gh`, `git`, or `orca`.
