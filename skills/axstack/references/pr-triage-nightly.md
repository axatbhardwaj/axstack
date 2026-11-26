# Nightly PR-triage prompt

## Native schedule fallback

Follow [Provider bindings](t3-runtime.md#preflight-and-binding) and [setup](automations.md#nightly-pr-triage-setup).
At pass start, read the prior pass thread with `t3_thread_read` for guarded verification or hold/report before replacing its identity. Record own pass threadId in the activation record and read back the save.

Read the durable activation record for the repository set.
Resolve the user with `gh api user --jq .login` through the collector.
Read all open PRs authored by the user in every repository in the recorded set, including all pages.
Set `AXSTACK_SKILL_DIR` to the installed skill directory and shell arguments to the recorded repositories.

```bash
bun --no-env-file "${AXSTACK_SKILL_DIR}/references/pr-triage-collect.js" "$@"
```

Use the compact JSON with the report instructions below. Keep partial rows on exit 2.

At pass end, an unbound pass calls `t3_thread_organize` with `action: settle` on its own thread only, only when it owns no PR watch, has zero unsettled descendants, has no pending receipt and is not held, wedged or a stalled owner.
Follow [Finite-session teardown](automations.md#finite-session-teardown) for deferred self-settle and next-pass verification. This applies to quiet, skipped and empty passes too.

## Report instructions

Run a fresh read-only nightly PR-triage pass. Read-only applies to the forge.
Report each PR's CI, reviews, mergeable state, and unresolved threads in your own T3 thread.
For an incomplete forge field, report `UNKNOWN`.
Mark coverage gaps or an unavailable collector `UNKNOWN`, naming each affected repository.
Flag stale PRs after 7 days of inactivity.
Report the top three PRs to act on, or fewer if available, with observed reasons and evidence links.
Never declare a PR merge-ready.
Never merge, post comments, change labels, push, send user messages, dispatch
work, or launch threads.
