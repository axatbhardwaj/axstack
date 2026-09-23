# Chat-owned PR watch

Approved 2026-09-23. The authoritative specification is [GitHub issue #151](https://github.com/axatbhardwaj/axstack/issues/151) with body SHA-256 `82c6fbb84954ae53ea13d42f7f6a112cdbca29512d67580e480e583e7512392a`. This file is its repository counterpart; the issue body governs material scope questions.

## Outcome

One chat watches all PRs it raises through a native Orca observer on the same host, about every ten minutes. The observer reports new current-state events. The initiating chat alone owns repairs, review, publication, and cross-PR decisions. Independent PR repairs may run in parallel, with one writer per candidate. Watching ends when every member PR merges or closes, or the user cancels.

## Delivery boundary

- Add a first-class chat-run watch mode while preserving standalone and peer watch contracts and the retired global watch-manager boundary.
- Use one read-only native observer automation per run, fresh finite sessions, exact membership and event identities, driver-owned disposition, and verified own-automation stop.
- Preserve existing mode-specific publication and authored review order for run-created and explicitly adopted PRs.
- Treat source tests, exact-head review, installed bytes, and live same-host canary as separate evidence. Do not call the watch active until the native capability and canary checks in the issue pass.

The capability and task map is [GitHub issue #153](https://github.com/axatbhardwaj/axstack/issues/153) plus `docs/plans/chat-owned-pr-watch.md`. The human merges the source PR.
