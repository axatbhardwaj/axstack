# R5 release trace

For releases touching affected skills, the driver runs one capped T3 scenario
against the installed release. Failure, unavailability and exhausted budgets
are recorded and never block publication. Helpers capture facts; they never
launch T3, enforce runtime budgets, schedule, retry or grant authority.

Use installed `scripts/check-run.js` in both phases. Set:

- `REPO`: clean release-tag checkout; `RELEASE_HEAD`: full tag commit SHA.
- `CAPTURE`: absolute installed helper; `OUT`: existing owned 0700 evidence
  directory outside source/cwd/writable roots.

Verify package version and installed skills with release/install checks; retain
those checks and T3 receipts in `OUT`. Use `REPO/tests/workflows/*scenarios.json`
(catalogs are not installed). No live-home edits.
Follow check-run `--help`, including captured-head validation, trust limits and
independent verification of Git objects/environment/binary and trace's Bun.
Both captures require identical helper/Bun realpaths and matching helper hashes.

## Before launch

Write `$OUT/before.json` in check-run `--help`'s Before JSON shape with observed
version/host, absolute checkout catalog path and existing scenario ID, exact
requested provider/model/options, current UTC time and fresh `crypto.randomUUID()`
nonce (16+ characters; placeholder rejected). Limits are positive integers;
`attempt` is `1`. Capture before launch. Dirty-source holds require the exact
printed `--snapshot` digest; never silently change release identity.

```bash
ORIGIN=$(git -C "$REPO" remote get-url origin)
bun "$CAPTURE" --repo "$REPO" --repository "$ORIGIN" \
  --head "$RELEASE_HEAD" --base "$RELEASE_HEAD" --out "$OUT" -- \
  bun "$CAPTURE" r5-plan --input "$OUT/before.json" > "$OUT/before-capture.json"
```

Read receipt `exitCode`, capture `terms` and plan terms in `logPath`.
Set `PLAN_RECEIPT=receiptPath`, `PLAN_LOG=logPath`. Resolve failed planning
terms before launch; record missing prerequisites as unavailable. Only the
helper stamps `plannedAt`; `recordedAt` cannot be future, and the run starts
at/after `plannedAt`. Hash exact `PLAN_LOG` bytes into `PLAN_SHA256`:
`bun -e 'console.log(new Bun.CryptoHasher("sha256").update(await Bun.file(process.argv[1]).arrayBuffer()).digest("hex"))' "$PLAN_LOG"`.

Launch exactly one authorized T3 attempt under the runtime contract with
`plan.scenario.input`, installed skill, requested settings/limits. Exclude
expected answers; include `PLAN_SHA256` and nonce; request final `nonce: <nonce>`.
Bind/retain actual task/thread/run IDs. If T3 cannot enforce numeric caps, use
existing bounded controls and report the gap; never claim helper enforcement.

## After observation

Retain raw T3 observations and normalize into `$OUT/after.json`: requested/
effective settings from launch/readback (never infer equality), unavailable
observations `null`, actual final response including nonce in `output`, terminal
observation time in `finishedAt`:

```json
{
  "planSha256": "exact PLAN_SHA256", "nonce": "planned nonce",
  "version": "observed release", "host": "observed host", "attempt": 1,
  "requested": { "provider": "observed", "model": "observed", "options": {} },
  "effective": null, "outcome": "unavailable", "threadId": null, "runId": null,
  "startedAt": null, "finishedAt": "2026-11-16T00:00:02Z", "tokensUsed": null,
  "output": null, "reason": "availability/enforcement gap; raw observation path"
}
```

Outcomes: `completed`, `failed`, `unavailable`, `budget-exhausted`, `cancelled`.
Unavailable with observed thread/run IDs is terminal; absent IDs stay unknown.
Its scenario outcome stays unknown either way. Capture without another attempt:

```bash
bun "$CAPTURE" --repo "$REPO" --repository "$ORIGIN" \
  --head "$RELEASE_HEAD" --base "$RELEASE_HEAD" --out "$OUT" -- \
  bun "$CAPTURE" r5-trace --plan-receipt "$PLAN_RECEIPT" --result "$OUT/after.json" \
    --repository "$ORIGIN" \
    --head "$RELEASE_HEAD" --base "$RELEASE_HEAD" > "$OUT/after-capture.json"
```

Cite after `receiptPath` and trace `logPath`, term counts and observed outcome
in the release record. Inspect child `exitCode` separately: failed criteria exit
0, unknown observations exit 2; capture can complete with an unknown child.
Missing/truncated/interrupted capture is an evidence gap; record without live
scenario retry. Receipts bind local source/log bytes and caller observations;
they neither authenticate T3 exports nor independently prove live compliance.
