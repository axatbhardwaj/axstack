# Local verification and live boundary

In an Axstack source checkout, use the repository `verify-axstack` Launch and
Doctor with an owned 0700 TMPDIR outside HOME, an isolated fixture HOME and
offline network namespace. Run these actual interfaces:

```bash
bun run test tests/workflows/voa-install.test.js \
  tests/workflows/voa-recovery.test.js tests/workflows/voa-cleanup.test.js \
  tests/workflows/voa-boundaries.test.js tests/workflows/voa-coverage.test.js \
  tests/workflows/voa-cli.test.js
bun run test tests/installer/package.test.js tests/installer/regressions.test.js \
  tests/installer/preset-bundle-validation.test.js tests/workflows/prose-size.test.js
bun pm pack --dry-run
```

The fixed cases exercise pre/post snooze, specific missing diagnosis, open and
cleared dependencies, head/restart/native-event dedupe, completion, human/auth
and question holds, active/unknown Workers, untrusted/incomplete records,
partial five-host inventory and budgets, exact owned cleanup and shared
services, status isolation, wake precedence and directed C4/C5 proof.
CLI checks use saved synthetic JSON, no provider CLI on PATH, and an empty
fixture HOME with Bun's transpiler cache disabled. They compare input bytes
and output determinism; no execution adapter exists. Package tests extract
the actual artifact and byte-check all installed assets through uninstall.
Skill Creator's `quick_validate.py skills/voa` validates authoring metadata;
Python is a development validator, not a shipped VOA runtime.

Fixture success cannot prove native authentication, inventory/API pagination,
cross-host write links, events/idempotency, Stop/restart/provider-failure queues,
schedule binding, actual deletion or live delivery. The Coordinator owns the
separately authorized bounded R7d canary after source review and R7c integration.
Record exact versions, host/thread, scope, budgets, expiry, delivery IDs and
cleanup readbacks. Preserve unknowns and perform no live canary from author
fixtures. Installation alone neither activates recovery nor changes schedules.
