# T3-native watch, visible holds and a drivers-only sidebar

Approved baseline: [#543 rev 4](https://github.com/axatbhardwaj/axstack/issues/543),
2026-10-26; capability #527 starts the chain at base `80596e1e`.
Approved snapshot SHA-256:
`9c867631cb0fe0aee55937581c84a183651c971f38970648e692e3ed8ad5c078`.
This concise counterpart records the whole approved scope; later layers remain
planned until their own acceptance evidence exists.

## Outcome and decisions

- The PR-owning driver alone links and watches each PR. Native PR events are
  the fast path; one bound schedule is the backstop. Hidden authors are unlinked.
- Target cadence is 60 minutes while watches are armed and nothing is unsettled;
  5 minutes covers recovery. Remove the 30-minute tier. Run `pr-digest.js` on
  schedule wakes only; native wakes reconcile the event plus current state.
- Park only holds waiting solely on a chat reply: no unsettled workers, adviser
  seats, receipts or forge-resolved holds. Forge waits (merge, npm stage approval,
  human review) keep watches and the 60-minute backstop.
- Parking order: unwatch -> text card -> disable schedule and read back -> cancel
  queued prompt copies -> harness question. A verified-enabled failed disable
  rolls back using PR A recovery; unknown schedule state holds UNKNOWN and marks
  automatic recovery unproven. Never infer an enabled backstop from a failed read.
- Answers reconcile state and bind to hold key/head/base before resuming. Parked
  runs have no backstop: the card persists. On the next user message, re-ask once
  under the same key if the request is missing. Scoped/forge holds stay text-only;
  unavailable question tools are recorded. No new alerts.
- Use native pending requests for delegated-child questions; providers without
  question tools and launched writers retain markers. Reviews remain fresh tasks.
- Delegate authors with worktree isolation, stable request identity and hidden
  dispatch-key titles. Repairs continue the same child. Top-level drivers use
  plain outcome titles of at most 30 characters. Launched authors are a recorded
  fallback when isolation is unavailable. E1 and E2 activate in one release.
- Unbound scheduled passes self-settle only with no owned watch, unsettled
  descendants or pending receipts and when not held, wedged or stalled. Deferred
  self-settle is the terminal-before-settle exception; the next pass verifies it.
- Collectors are retired. Readiness, mixed review, one writer and default automatic
  merge remain unchanged. The user lifted the freeze on 2026-10-26.

## Serial delivery and acceptance

| Layer | Contract and acceptance |
|---|---|
| A (#527) | Watch ends after 8 failed reads, settle, archive, user Stop or merge/close. Handle existing checks/comments before arming. Re-arm only after non-user stops: record T3's reason, diagnose read failures with `gh api rate_limit --jq .resources.graphql`, wait for reset near zero, unsettle first, never loop. Conflict-free base movement follows the schedule digest and existing base-update rule; no new readiness term. |
| D (#528) | One watcher per PR; 60/5-minute cadence above, with parked unwatch exempt from recovery. After merge auto-settles a multi-PR driver, recover remaining watches. Keep queue cancellation and account selection. |
| B (#526) | Visible parked holds follow the ordering, rollback, UNKNOWN and answer-reconciliation rules above; forge-resolved holds stay armed. |
| C (#529) | Detect child questions with `t3_pending_request_list`, read and confirm still pending, respond once within authority; second asks hold. Keep permission/trust holds and fresh review tasks. |
| E1 | Record task/child/worktree/branch identity. Fresh authors verify branch absence then `git switch -c` at pinned base; repairs verify existing head and use the same child. Retry lost dispatch responses idempotently; never duplicate uncertain writers. Verify terminal state, clean nonempty candidate and TDD logs; preserve evidence and worktrees until merge/close. Supersedes #514. |
| E2 | Update installed author routing and docs with E1, including delegated-writer authority; prove install/check and package payload with `verify-axstack`. |
| F | Guarded pass self-settle, driver titles above, and `settle: native` only when no driver settle was issued. |

Each layer uses prose contracts that reject removal/inversion and accept equivalent
rewording. Run `bun run test:all`; run native parking, same-child repair and deferred
self-settle canaries on axat-vps before E1 merges. Release once after F, including
#541, #542 and split small PRs #534/#535, then reinstall and verify on io, iobook,
iobox and axat-vps. Human approval owns the npm stage.

## Boundaries

No new daemons, timers, helpers, model roster or readiness predicate. Host collector
scripts and T3 sidebar/storage settings are excluded. #537 prose trimming is a
separate structure-preserving run and release after F.
Question survival across server restart, question-driven working-list exit and
long-run hidden-worktree cleanup remain unverified. Conflict-free base movement
and label/edit changes can wait until the next 60-minute digest (accepted delay).
