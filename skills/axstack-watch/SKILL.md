---
name: axstack-watch
description: Bounded 24h monitoring with resumable handoff; no silent renewal.
---

# Watch

PR owners remain responsible during the configured monitoring window
(default 24 hours). Wake on CI or review state changes or bounded
scheduled checks via existing Paseo mechanisms; do not keep models
reasoning continuously while waiting.

## End conditions

- End early when all required PRs merge.
- Otherwise end at the configured deadline. Work remaining at expiry gets a resumable handoff, never silently renewed monitoring.

## Template: resumable handoff (all fields required)

```text
PR: <URL> rev <sha>
Owner: <profile> Worktree: <path>
Spec: <approved rev> Capability: <issue + state>
CI/review: <states + links>
Remaining: <next actions + who>
Resume: <commands/refs to restart from this rev>
```
