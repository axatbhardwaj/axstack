# R5 release trace

For skills releases, the driver runs one capped T3 scenario on the
installed release. Failure, unavailability and exhausted budgets are recorded
and never block publication. Helpers capture facts, never launch T3, enforce
budgets, schedule, retry or grant authority.

Use installed `scripts/check-run.js` twice. Follow `--help` for
captured-head validation, trust limits and independent Git object/environment/
binary and trace-Bun verification. Require equal helper/Bun realpaths and hashes. No live-home edits.

Set REPO=clean tag checkout, RELEASE_HEAD=full tag SHA, ORIGIN=Git origin
URL, CAPTURE=absolute installed helper, OUT=existing owned 0700 evidence outside
source/cwd/writable roots. Verify package version and installed skills; retain
checks and T3 receipts there. Use REPO/tests/workflows/*scenarios.json; catalogs are not installed.

Wrap both modes with check-run using `--repo REPO --repository ORIGIN
--head RELEASE_HEAD --base RELEASE_HEAD --out OUT -- bun CAPTURE MODE ...`.
Retain each capture's receiptPath/logPath and inspect its exitCode/terms.

## Before launch

Write `$OUT/before.json` per `--help`'s Before shape: observed version/host,
absolute checkout catalog, existing scenario ID, exact requested provider/model/
options, current UTC time, fresh crypto.randomUUID() nonce (16+ characters;
no placeholder), positive integer limits, attempt:1. Capture
`r5-plan --input "$OUT/before.json"` before launch. Dirty holds require the exact
printed --snapshot digest; never silently change release identity. Resolve
failed capture/plan terms first; missing prerequisites are unavailable. Only
the helper stamps plannedAt; recordedAt cannot be future; start at/after
plannedAt. PLAN_RECEIPT=receiptPath; PLAN_SHA256=SHA-256 of exact plan logPath bytes.

Launch one authorized T3 attempt under the runtime contract with
plan.scenario.input, installed skill, requested settings/limits, PLAN_SHA256 and
nonce; exclude expected answers, request final `nonce: <nonce>`. Retain actual
task/thread/run IDs. If T3 cannot enforce numeric caps, use existing bounded
controls and report the gap; never claim helper enforcement.

## After observation

Retain T3 observations. Write `$OUT/after.json`: planSha256=PLAN_SHA256,
nonce, version, host, attempt:1, requested/effective {provider,model,options},
outcome, threadId, runId, startedAt, finishedAt, tokensUsed, output, reason citing
raw observations. Read settings from launch/readback; never infer equality.
Unavailable=null; output=actual final response including nonce;
finishedAt=terminal observation time.

Outcomes: completed, failed, unavailable, budget-exhausted, cancelled.
Unavailable with observed thread/run IDs is terminal; absent IDs stay unknown.
Its scenario outcome stays unknown either way. Capture without another attempt:
`r5-trace --plan-receipt PLAN_RECEIPT --result "$OUT/after.json"
--repository ORIGIN --head RELEASE_HEAD --base RELEASE_HEAD`.

In the release record cite after receiptPath, trace logPath, term counts and
observed outcome. Inspect child exitCode separately: failed criteria exit0,
unknown observations exit2; capture may complete with an unknown child.
Missing/truncated/interrupted capture is a gap: record without live retry.
Receipts bind local source/log bytes and caller observations, never authenticate
T3 exports or independently prove live compliance.
