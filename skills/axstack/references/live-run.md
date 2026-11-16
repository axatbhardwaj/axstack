# R5 release trace

For a release touching affected skills, the driver runs one capped T3 scenario
against the installed released version. Failure, unavailability and exhausted
budgets are recorded and never block publication. Helpers capture facts; they
never launch T3, enforce runtime budgets, schedule, retry or grant authority.

Use the installed `scripts/check-run.js` in both phases. Keep a clean release
checkout at its tag (`REPO`); verify its package version and installed skills
against the released package using the release/install checks. Set `CAPTURE` to
the absolute installed check-run path, `OUT` to an existing owned 0700 evidence
directory outside source/cwd/writable roots, and `RELEASE_HEAD` to the full
release commit SHA. Keep the raw installed-version check and T3 receipts there.
The catalog comes from that checkout's existing `tests/workflows/*scenarios.json`;
tests are not installed with the package. No live-home edits are needed.
Trace requires the current and planned catalog hashes to match its committed
blob at the captured head; an unreadable blob remains unknown. A `--snapshot`
cannot substitute different catalog bytes or a path absent from that commit.
It also checks the package version at that head and the planning helper's
realpath/hash against the trace helper. Use the same installed helper and Bun
realpath in both captures. The trace trusts its own interpreter: a fake bun earlier
on PATH than the trace's own bun stays undetectable; verify that interpreter independently.

## Before launch

Write `$OUT/before.json` with this shape, substituting observed version/host,
an existing catalog ID, explicit destination settings, current UTC time and a
fresh nonce from `crypto.randomUUID()` (at least 16 characters; the literal
placeholder below is rejected). Limits must be positive numeric integers;
`attempt` must be `1`. Save the exact requested settings, including options.

```json
{
  "catalog": "/absolute/released-checkout/tests/workflows/run-record-scenarios.json",
  "scenario": "stale-evidence-hold",
  "version": "0.68.0",
  "host": "axat-vps",
  "tokenLimit": 4000,
  "timeLimitMs": 600000,
  "attempt": 1,
  "nonce": "replace-with-fresh-uuid",
  "recordedAt": "2026-11-16T00:00:00Z",
  "requested": { "provider": "codex", "model": "catalog-model-id", "options": { "reasoningEffort": "low" } }
}
```

Capture the plan before launching. A dirty-source hold needs the exact printed
`--snapshot` digest; it does not permit silently changing the release identity.

```bash
bun "$CAPTURE" --repo "$REPO" --repository "$(git -C "$REPO" remote get-url origin)" \
  --head "$RELEASE_HEAD" --base "$RELEASE_HEAD" --out "$OUT" -- \
  bun "$CAPTURE" r5-plan --input "$OUT/before.json" > "$OUT/before-capture.json"
```

Read the receipt's `exitCode`, capture `terms`, and its `logPath` plan terms.
Use `receiptPath` as `PLAN_RECEIPT`, `logPath` as `PLAN_LOG`. Resolve any failed
planning terms before launch; missing prerequisites are recorded as unavailable.
The helper stamps `plannedAt` from its own clock; callers cannot supply it.
`recordedAt` must not be in the future, and the run must start at or after `plannedAt`.
Compute `PLAN_SHA256` from the exact `PLAN_LOG` bytes with
`bun -e 'console.log(new Bun.CryptoHasher("sha256").update(await Bun.file(process.argv[1]).arrayBuffer()).digest("hex"))' "$PLAN_LOG"`.

The driver launches exactly one authorized T3 attempt under the runtime contract,
using `plan.scenario.input`, the installed skill, requested settings and limits.
Keep expected answers out of the worker prompt. Include `PLAN_SHA256` and the
nonce; ask for a final line `nonce: <nonce>`. Bind and retain actual task/thread/run
identities. If T3 cannot enforce a numeric cap, use the existing bounded run
controls and report the enforcement gap. Do not claim a helper enforced it.

## After observation

Save raw T3 observations and normalize them into `$OUT/after.json` below; take
requested/effective settings from actual launch/readback, never infer equality.
Use `null` for unavailable observations. `output` is the actual final response,
including its nonce line. `finishedAt` is the terminal observation time.

```json
{
  "planSha256": "exact PLAN_SHA256",
  "nonce": "the planned nonce",
  "version": "observed installed release",
  "host": "observed execution host",
  "attempt": 1,
  "requested": { "provider": "observed", "model": "observed", "options": {} },
  "effective": null,
  "outcome": "unavailable",
  "threadId": null,
  "runId": null,
  "startedAt": null,
  "finishedAt": "2026-11-16T00:00:02Z",
  "tokensUsed": null,
  "output": null,
  "reason": "availability or enforcement gap; raw observation path"
}
```

Outcomes: `completed`, `failed`, `unavailable`, `budget-exhausted`, `cancelled`.
An `unavailable` terminal with observed thread/run IDs is a terminal observation;
absent IDs remain unknown. Its scenario outcome remains unknown in either case.
Capture the trace without another scenario attempt:

```bash
bun "$CAPTURE" --repo "$REPO" --repository "$(git -C "$REPO" remote get-url origin)" \
  --head "$RELEASE_HEAD" --base "$RELEASE_HEAD" --out "$OUT" -- \
  bun "$CAPTURE" r5-trace --plan-receipt "$PLAN_RECEIPT" --result "$OUT/after.json" \
    --repository "$(git -C "$REPO" remote get-url origin)" \
    --head "$RELEASE_HEAD" --base "$RELEASE_HEAD" > "$OUT/after-capture.json"
```

The after receipt's `logPath` is the R5 trace file. Cite that receipt's
`receiptPath` and trace `logPath` in the release record, alongside its term
counts and observed outcome. Inspect child `exitCode` separately from capture
completeness: failed criteria exit 0, unknown observations exit 2. Capture may
complete even when its child reports unknown. Missing/truncated/interrupted
capture is an evidence gap; record it without retrying the live scenario.
These receipts bind local source/log bytes and caller-supplied observations;
they do not authenticate T3 exports or independently prove live compliance.
