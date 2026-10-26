---
name: axstack-watch
description: When babysitting an existing PR, use axstack-watch to maintain own PRs by default within bounded authority.
---

# Watch

For authorized delivery runs, follow [Autopilot](../axstack/references/autopilot.md)
for phase continuation and holds.

On driver entry, sweep under [Workspace hygiene](../axstack/references/workspace-hygiene.md); dispatched workers do not sweep.
For every dispatch brief, name its private `<run dir>/evidence/<dispatch>/` folder.

Manual watch keeps the user’s chat and workspace open.

Leave each adopted PR with one accountable owner, current readiness evidence,
and user-facing updates that name its current milestone and next wake or
condition.

Before acting, load [Standing contracts](../axstack/references/contracts.md).
Its required edge loads [Shared lifecycle](../axstack/references/lifecycle.md),
including the end-of-run audit hook. Reach other references only at the steps
that name them.

Select the operating mode before discovery. Preserve any explicitly named PR,
repository, or peer scope. For standalone broad discovery of the user's own PRs (such as “my” or “our” PRs), run
`gh api user --jq .login` on the execution host, then select open PRs authored
by that login in the named or current repository. Never hardcode or guess the
username; a missing or failed authenticated-login lookup is a concrete blocker.
The authenticated human login selects PRs. Runtime session IDs coordinate work
only and establish neither human identity nor write, reply, or merge authority.
## 1. Adopt and reconcile

Start from actual state. Reconcile the PR's remote head and base, ownership,
existing T3 tasks, threads and runs, private run record, and watch registrations. Reuse the
live owner and watch; uncertain state holds new registrations until resolved.

For an existing own PR, read the
[proportional scope identities](../axstack/references/routing.md#proportional-scope-identity),
apply its default maintenance rule and verify writable ownership, then snapshot the
accepted maintenance intent once: authorized scope, actual head and base,
current owner, actual author provenance, and watch state. Check authoring
session evidence; the orchestrator identity is not author evidence, and never
assume an author for an imported own PR. It needs no new spec, ticket, or repeated
approval. Explicit observation-only adoption grants no repair or reply authority.

Adoption is settled when the record names one persistent owner, one watch, the
exact PR revision and base, and the applicable authority snapshot. If writable
access is unverified, record the hold and continue read-only; pushing stays held.

### Stale or external PRs

Here, stale or external means the base moved since opening, or the PR was not
authored in this run.
For a stale or external PR, the driver records MODERNIZE, REWORK or CLOSE before
any push. Fetch the actual remote base and PR head, recording the head SHA and
merge base. Inspect base commits since divergence and merged and open PRs for
the same fix before choosing a disposition.

Route MODERNIZE and authorized REWORK through
[Repair and publication](references/repair-publication.md): the single repair
author writes in its owned worktree, then independent authored review covers
the exact rebased or reworked head and base before driver publication.
The driver never writes tracked files.

- **MODERNIZE:** for a useful goal whose implementation remains the right shape,
  the repair author rebases onto the freshly fetched actual base.
  Run focused checks and record pre-rebase and post-rebase `git range-diff`
  and focused-check evidence, inspecting the final diff for lost intent or
  reintroduced landed behavior.
  After independent review, the driver confirms the expected-old remote SHA
  matches the head SHA observed before the rebase, then pushes this narrowly
  justified history rewrite with
  `--force-with-lease=refs/heads/<branch>:<observed-head-sha>` under
  [Candidate publication](../axstack/references/candidate-publication.md).
  A lease mismatch holds publication: fetch and reassess.
- **REWORK:** for a useful goal in the wrong shape, describe the smallest
  credible rewrite and stop unless the user authorized rework.
- **CLOSE:** when superseded or obsolete, cite concrete evidence and ask the
  user before closing.

These dispositions preserve the recorded mode and authority snapshot: peer and
observation-only adoption remains read-only. Routine force push for ordinary
PRs stays forbidden under Candidate publication.

## 2. Fix the operating mode

Choose one mode under [Shared routing](../axstack/references/routing.md#direct-routes-no-spec-ceremony)
and record it before dispatch:

- **Chat-run watch:** authorized maintain mode is the default for run-created
  PRs. The initiating chat remains the only driver and record
  writer for every PR raised in its Run, including later verified publications
  and explicitly adopted members. Follow [Chat-run watch runtime](references/watch-runtime.md#chat-run-watch)
  for its bound T3 scheduled driver wake. This mode has no replacement `axstack-owner` or
  standalone 24 h expiry.
- **Observation-only:** reconcile and report CI, reviews, and PR state. It
  dispatches no author and sends no reply. This restriction dominates every
  repair path, including obvious fixes after changed heads or feedback.
- **Peer:** observe and report a colleague's PR. Peer mode never repairs.
- **Authorized maintenance:** repair an adopted own PR only within the accepted
  maintenance snapshot and publication authority; own-PR watch requests use this
  mode by default under Shared routing.

Every later wake must be classifiable from this recorded mode without inferring
new authority.

## 3. Start the bounded watch

Read-only checks and updates to the already-owned local record need no runtime
load. When the watch needs a new owner or automated observation, first read
[Watch runtime](references/watch-runtime.md) and then
[T3 runtime](../axstack/references/t3-runtime.md). Reconcile before creating
anything. Task-owned observations use their recorded wakes and expiry.
`axstack-monitor` stays an optional read-only observer for standalone watch
that never sends. For own open PRs in chat-run mode, use the normal 30-minute cadence under
[Chat-run watch runtime](references/watch-runtime.md#chat-run-watch);
the bound T3 schedule resumes the original driver thread. One read-only PR observation needs
neither. Start no automation for a read-only check.

For standalone adoption, materialize `axstack-owner` only when no live owner
exists. Once it exists, the current chat is not a competing coordinator. Only
the owner launches the writer, reviewers, and optional monitor. Leaf workers
create no recursive teams, and the adoption watcher is never the writer.

A standalone live watch has verified role and timer receipts, handshakes, watched scope,
wake ownership, and a common expiry. A missing runtime capability is a setup gap,
subject to the [native PR watch fallback](../axstack/references/t3-runtime.md#native-pr-links-and-watches).
Never invent a call or create a duplicate registration. Native
wake-ups drive observation; never poll or keep a model active between events.

## 4. Route each wake

Re-read the remote head and base, then reconcile the event against acknowledged
IDs and the recorded mode. A changed head, CI result, or review comment is an
event, not repair authority. Stale or ambiguous observations authorize nothing.
Every user-facing update is actionable: name the current milestone, the next
wake or condition, and an ETA when the forge exposes one, such as CI median.
A healthy unchanged observation produces no user-facing message.

Bound T3 chat-run wakes resume the original driver. The original driver alone reconciles and
acts under the recorded authority. Observation-only and
peer wakes produce a read-only report and stop. For an
authorized maintenance wake that may require a repair or public reply, read and
follow [Repair and publication](references/repair-publication.md).

### Feedback routing

New work routes only under its confirmed scope identity: an approved spec and
matching ticket map for substantial work, or a snapshotted **small-change
intent** for small work. An adopted own PR instead uses its accepted maintenance
snapshot. Missing, stale, or materially changed identity holds repair routing
while monitoring continues. Accepted fixes return to the same original author
session only when the run itself launched that session and evidence allows,
then receive refreshed review under the authored mode rule before publication.
If this run did not launch the original author, or historical provenance is
unknown or mixed, launch a new configured `axstack-author` attempt under
[Shared routing](../axstack/references/routing.md).
For an adopted own PR, pair the authored reviewer from the recorded actual
provenance of its repair author.
Hold only when the repair author's own provenance cannot be established or
an eligible configured reviewer is unavailable; report that exact gap.
Historical provenance still follows §5's merge-card rule.

A handled wake has an acknowledged event ID, an observation or action bound to
the current revision, and a recorded hold or next owner where work remains.

Follow [Advised holds](../axstack/references/contracts.md#advised-holds) before parking a user-decision hold.
Raise user-decision holds and serious-risk holds in the T3 driver thread,
and the driver ends its turn parked on the decision.
These include `verification not proven`, merge cards needing user input,
spec approval and npm stage approval.
Raise serious risks immediately; attempt bounded safe recovery for blocked operations.
After bounded safe recovery, raise a genuine blocked operation that still needs
the user in the T3 driver thread, and the driver ends its turn parked on it.
Routine questions stay in the T3 driver thread. Progress, CI pending, and completion always stay
in the T3 driver thread.
Post the report-only unresolved-rating notice there, deduplicated per comment and
head. It grants no reply authority and never clears the hold.
The standalone monitor never sends; the chat-run schedule resumes the driver.
Healthy watch observations remain quiet.

## 5. State readiness precisely

Load and follow [5. State readiness precisely](references/readiness.md).

### Proven verification

Load and follow [Proven verification](references/proven-verification.md).

### Escalation

Load and follow [Escalation](references/escalation.md).

### Blocked on a person

Load and follow [Blocked on a person](references/blocked-on-person.md).

## 6. End and preserve continuity

Reconcile PR links and stop native PR watches under
[T3 runtime](../axstack/references/t3-runtime.md#native-pr-links-and-watches).

End a chat-run watch only after all members merged or closed, launched work is settled,
and the run's release step is settled or not applicable, or user cancellation.
Without an Autopilot or Release record, the release step is not
applicable to this watch. A required PR closed without merging records a
decision hold and the wake remains active until the user resolves scope or cancels.
Stop the chosen wake and verify
its stop receipt; a failed or uncertain schedule deletion is a hold.
Delete only the recorded schedule and verify absence with `list_scheduled_tasks` under
[Watch runtime](references/watch-runtime.md#chat-run-watch).

Run Close-out after the watch ends, subject to its existing acceptance conditions.
Keep merge-card replies and `hold` in the driver thread.

End a standalone watch early when all required PRs merge, at cancellation, or
at its shared default 24 h deadline. In every case, stop all owned
registrations and verify their receipts.

At every end condition, leave the compact state below in the private run record
and report it in the current chat, even when work remains. Standalone expiry grants neither
silent renewal nor ownership-transfer authority.

Transfer ownership through the runtime-owned T3 transfer route only when the
user explicitly requests it. Before transfer, follow the lifecycle-owned
preflight for native capability availability, the configured role, and explicit
recipient acceptance. A failed or incomplete preflight preserves the current
owner and reports the gap; never invent a native command or infer acceptance.

```text
Record: <progress.md path>
PR: <URL> rev <sha> base <sha>
Owner: <profile + session> Worktree: <path>
Scope: <approved rev, small-change intent, or maintenance snapshot>
Capability: <issue + lifecycle state>
CI/review: <current states + evidence refs>
Watch: <chosen wake mechanism, native id or command, native schedule lifetime + re-arm receipts + stop receipt>
Standalone watch: <shared expiry>
Remaining: <next actions + owner>
Resume: <known commands or verified refs needed to reconcile from this revision>
```

The watch ends only when registrations are stopped, receipts are recorded, and
the PR is either merged or represented by this resumable state.
When every required PR is merged and the run's Release step is settled or not
applicable, follow the lifecycle [Close-out](../axstack/references/lifecycle.md#close-out)
before reporting the run as done.
