# Chat-owned PR watch task map

Spec: [GitHub issue #151](https://github.com/axatbhardwaj/axstack/issues/151), body SHA-256 `82c6fbb84954ae53ea13d42f7f6a112cdbca29512d67580e480e583e7512392a` (approved 2026-09-23).

Capability: [GitHub issue #153](https://github.com/axatbhardwaj/axstack/issues/153), chat-owned PR watch. Keep the issue open through source review; close only when the source PR merges and the live acceptance checks pass.

| Task | Owner and worktree | Theme | Size estimate | Depends |
| --- | --- | --- | --- | --- |
| T0 Native capability preflight | Driver, initiating chat; no candidate checkout | Verify same-host schedule, observer role/model, Run delivery, driver wake, overlap, own-automation stop | Small, read-only plus isolated canary if required | None |
| T1 Workflow source and tests | One `axstack-author`; `chat-owned-pr-watch` Orca child worktree; driver owns its PR | Add chat-run watch mode, observer contract, event/stop/repair routing, docs and scenarios | Target band, likely one cohesive PR under 2,000 changed lines | Approved spec; T0 gaps may hold activation but do not silently change design |
| T2 Live canary and activation | Driver on same Orca host; no new source writer | Verify installed source, scheduled delivery and wake, overlap, recovery, stop, and bounded resource use | Small operational task | T0; T1 reviewed, merged, released and installed under applicable authority |

## Acceptance by task

**T0:** Record actual Orca CLI/version and supported flags; prove or hold the configured monitor provider/model/effort, same-Run message delivery, request-bound safe driver wake, fresh sessions, and exact own-automation disable/readback. Help text or `input_accepted` alone does not prove behavior. Preserve any disposable automation identity and stop receipt. A missing capability is a named hold, not permission for a custom scheduler or second driver.

**T1:** Use strict behavior red/green checks for run-scoped membership, same-head events, quiet unchanged passes, incomplete coverage, driver-only repair dispatch, one writer per PR, stack invalidation, cancellation and stop. Keep unchanged standalone/peer and watch-manager retirement holdouts green. Run focused and full `bun:test`, inspect the final diff, and get exact-head authored review. Publish only through the driver with `gh stack`; the author does not push.

**T2:** On the actual same host, observe scheduled-at, started-at, and completed-at receipts across several ten-minute slots; exercise a quiet tick, a new same-head event, idle/busy/unavailable driver, overlap, recovery, and own-automation stop/readback. Separate source, merge, installation, and live outcomes as PASS/FAIL/UNKNOWN. Activate only after applicable release and host authority; never infer live behavior from source tests.

## Boundaries

The main chat is the sole driver and run-record writer. The observer may report internally and disable only its own automation at verified completion/cancellation. It never edits, dispatches, reviews, replies, pushes, or merges. Independent PRs may run in parallel within measured capacity; same-PR fixes serialize under one author. No account-wide watch manager, custom daemon, fallback model, or automatic merge.
