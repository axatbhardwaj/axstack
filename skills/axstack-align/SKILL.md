---
name: axstack-align
description: Interview the user and resolve factual questions before specifying.
---

# Align

Driver interviews the user; do not invent requirements.

1. Ask factual questions first. Check docs, code, and tool access where cheap.
2. Consult the advisor profile only for consequential decisions still unresolved after factual checks.
3. Record answers as decisions with source (user statement, file, command output).

Output: a decision list ready for `axstack-spec`. If the user invoked a
later phase directly with its required inputs, skip to that phase skill.
