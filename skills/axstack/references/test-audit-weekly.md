# Weekly test-audit prompt

You are a fresh finite weekly test-audit session in this repository's dedicated
existing Orca workspace. Before admission, read the activation record: repository,
test-path allowlist, finite budget, and standing edit and PR-open authority.
Missing authority, or no passing native canary from [Automations](automations.md),
holds admission; source checks alone prove no weekly runtime behavior.
When the finite budget runs out, stop the pass, publish nothing further, and report.
Use native Orca scheduling and orchestration,
not a new skill, daemon, scheduler, state engine, or campaign ledger.

Reconcile GitHub test-audit PR history and live Orca Run/worktree ownership before
selecting work. Derive the next single owner boundary within the allowlist from
the last test-audit PR; with no prior PR, choose the first allowed owner boundary
and record the choice. Use PR history, never a cursor file or persistent traversal
state. Never re-propose candidates from any closed unmerged test-audit PR.
If an open test-audit PR exists, skip the week, publish nothing and report only.
If paths overlap with live Orca Run or worktree ownership, publish nothing and
report only.

Invoke [Improve](../../axstack-improve/SKILL.md)'s Test-audit lens through Orca;
load [Test value](test-value.md), pin the base, and run the baseline suite.
If a red baseline exists, publish nothing and report only the possible bug.
If a flaky baseline exists, publish nothing and report only the instability.
Mark every test declaration in this boundary R/F/C/D and report reviewed and
eligible counts. Retain uncertain candidates and independent contracts; hidden
release-only tests are outside scope. There is no deletion quota, score, or target;
zero deletions is normal.
If zero proven candidates remain, publish nothing and report only.

Route accepted proven C/D to [Implement](../../axstack-implement/SKILL.md) as
structure-preserving work with the same suite green on pinned base and candidate.
For every removed assertion, record its location, detectable failure, validation
command, and named keeper or vacuity/obsolescence proof under Test value.
For each C and keeper-backed D, prove the keeper red under a targeted disposable
owner mutation per distinct contract, then restore source byte for byte.
Improve reports F; the standing authority also permits Implement to repair those
weak assertions while retaining their contracts.
For F repairs, apply [F proof](test-value.md#f-proof): base-green,
removal/inversion-red, byte-for-byte restore, and equivalent-rewording-green.
Never weaken or loosen an assertion.
If a weekly PR mixes C/D and F repairs, record both evidence paths in its receipt:
structure-preserving for C/D and F proof for repairs.

The candidate diff touches test files only: deletions, consolidations, F repairs.
Never edit skip/only/xfail, rewrite snapshots, change coverage-thresholds or CI,
or edit line-caps. Report test-only production seams without changing them.
After restoring mutations, verify every non-test path byte-identical to the base;
coverage, where reported, is a per-file guard and never deletion proof alone.
Keep one writer and private revision-bound receipts; workers never push.
Obtain independent review using Implement's configured authored-review roles and
verify the exact candidate's checks before publication. The driver uses
`gh stack` and opens at most one test-audit PR per week after independent review.
Only the chat-run driver may auto-merge that PR into an integration base after
the full predicate; the user merges it into a deploying base.

Notify only under the run's Notification policy: a decision park, merge-ready
(within the run's milestone cap), or serious-risk hold; never progress or
heartbeats. Keep routine reports in Orca, including skipped or empty passes.
Settle owned workers and preserve evidence under the shared lifecycle.
