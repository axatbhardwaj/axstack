<!-- Approved spec #215 rev 3; GitHub issue body SHA-256: fa3779fee33c87604a23dead0814e5833f66a3e5764269edfbff8a821cd4193a -->

# Autopilot: runs advance on their own and stop only for human actions

**Status:** Approved rev 3 (2026-09-30). Rev 3 amends scope 1: diligence FINDINGS are a repair at the owning phase, not an autopilot hold (user acceptance, 2026-09-30).
**Repository:** `axatbhardwaj/axstack`.
**Baseline:** `462d636` (v0.20.30).
**Align record:** private run `20260930-autopilot` (Q1–Q4).

## Outcome

In an authorized engineering-delivery run, the driver carries the work from phase to phase in the same chat without being told the next step. It stops only for:

- human actions:
  - spec approval (substantial work only);
  - every merge, including the release PR, bottom-up;
  - npm stage approval (release runs only);
- any hold that a phase records.

Implementation always flows into watch in maintain mode. Where the repo defines a release process, the run also releases, installs, and then closes out last.

## Scope

1. **New reference `skills/axstack/references/autopilot.md`.** Each phase skill gets one pointer to it; `lifecycle.md` has no room left, so it is untouched.
   - **When a run advances:** the run advances only when the finishing phase returned its completed identity (small-change intent, approved spec, ticket map, merge-ready, merged) and the run record has no open hold.
   - **Diligence FINDINGS (rev 3):** a repair at the owning phase, not a hold. Implement FINDINGS follow its §6 repair route; at spec, tickets or release preparation the driver resolves them before advancing. Only a recorded hold (for example a third review round, or a finding that cannot be resolved) pauses the run.
   - **Holds stop the run:** any hold recorded by any phase stops autopilot and records its reason and resume condition. That covers tracker access, adviser or arena-seat availability, CI-wait timeouts, readiness `UNKNOWN`, dismissed approvals, wake or cleanup uncertainty, single-provider routing, an existing tag or version, and a failed publish.
   - **Run-record line:** `Autopilot: on | paused (<hold>; resume: <condition>) | off (cancelled <ts>)`, plus the next step.
2. **Eligibility.**
   - Autopilot applies to authorized engineering-delivery runs.
   - Explicit planning-only, read-only, stop-after-phase, observation-only and peer requests keep their current behaviour.
   - A status question such as "what's left" is observation, not a mode change.
3. **Sequence.** Same chat, same owner. This is not a native ownership handoff.
   - **Small work:** Align read-back → small-change intent → implement → watch/maintain → human merge.
   - **Substantial work:** Align → spec draft (advisers + diligence) → **human spec approval** → tickets (+ diligence) → implement → watch/maintain → merge-ready → **human merge**.
   - **Align refinement opt-in:** for substantial work it folds into gate 1; for small work it folds into the Align read-back.
4. **Implement → watch (non-negotiable).**
   - When implement publishes the run's first PR, it arms exactly one `axstack-watch` chat-run in authorized maintain mode, using the 10-minute harness wake with the Orca fallback. Later run PRs join after readback.
   - Until a PR is merge-ready, wakes feed implement §6 step 4. After that, watch §5 maintenance applies: fix feedback, rebase when the base moves, keep CI green, keep approvals without re-requesting review.
   - The driver stays the single router and single writer.
   - Maintain becomes the default mode for run-created PRs.
   - **End condition:** every watched PR is merged or closed, and the run's release step is settled or not applicable. Expiry is a recorded stop with resumable state; there is no silent renewal.
5. **Release and install (where applicable).**
   - **Applicability:** detected once, at Align or spec time, and recorded as `Release: <AGENTS.md file:line + tag-triggered workflow path + named install hosts> | not applicable (<reason>)`. The predicate is an AGENTS.md release rule that names an existing tag-triggered workflow; a partial match counts as not applicable and is noted. Install hosts come only from explicit targets; an absent host list is a decision hold.
   - **Authority:** the `Release:` line is shown in the spec the user approves at gate 1 (or in the small-work Align read-back). It is written to the run's `Authority:`. It is per run and never carries over to other runs or repos.
   - **Order once all feature PRs merge:**
     1. Open the release PR (version bump: patch by default, minor if a `feat` commit landed since the last tag). It is a normal run PR: authored review + diligence (release body vs merged PRs) → merge-ready → **human merge**.
     2. Tag after the forge shows the release PR merged, then wait for the staged publish.
     3. **Human npm stage approval.** This is a decision hold; agents never run `npm stage approve`.
     4. A wake observes the registry reporting the expected package and version.
     5. Install on the named hosts and verify the version and roles.
     6. **Close-out last**, with release and install receipts and the installed version.
   - A failed publish, pending approval, registry uncertainty, missing host access or failed verification each records a resumable hold, never success.
   - A required PR that closes without merging is incomplete scope, not release eligibility.
6. **Resume and cancel.**
   - Every entry (user message, wake, compaction, new chat) first reconciles the owner, Dispatch, approved revision, PR membership, uncertain tags, wakes and publications, and completed receipts, following `lifecycle.md` and `run-record.md`. Only the original driver advances the run.
   - Wakes do not reset attempt budgets and do not grant approvals.
   - The user's answer to a hold resumes the run.
   - Cancel sets `off`, stops new actions, and ends the watch under watch §6 with guarded settlement.
7. **Notifications.** Autopilot gates and holds are user-decision holds, relayed under the run's recorded Notification policy.
   - The "routine events stay in Orca" lines in the relay, implement and watch skills and `docs/workflows.md` gain "unless the recorded Notification policy names it".
   - **Budget:** decision holds (including npm approval) are always eligible; merge-ready and merged together are capped at two per run, counted across implementation and release. Deduplicate through relay.
   - Healthy ticks stay quiet, and a failed or uncertain delivery keeps the hold.
8. **Text and test surfaces.**
   - **Stop text:** `routing.md` (the "then stop" lines), `align` (the "user invokes implement" line), `spec`, `tickets`, `implement` ("only other wait", "no merge wake"), `watch` and `watch-runtime.md` (end condition, membership), and `run-record.md` (the `Autopilot:` and `Release:` template lines).
   - **Other files:** relay, `docs/workflows.md` and `AGENTS.md` (the release line references per-run authority).
   - **Tests:** the no-daemon/state-machine test also covers `autopilot.md`.

## Delivery

One PR if it stays coherent. Split per `pr-shape.md` if needed; the driver decides.

## Acceptance criteria

- **Changed continuation decisions:** each has red→green contract evidence.
- **Preserved rules:** each has an unchanged-green holdout. These are human merge, spec approval, npm approval by a human, no re-request, and the holds.
- **Scenario fixtures** (fed to an independent evaluator as input-only briefs, with outputs recorded):
  - the small path;
  - the substantial path with gate 1;
  - tickets starting on their own;
  - the watch armed at the first PR and a later PR joining;
  - hold then resume;
  - cancel;
  - the release path (human release merge → npm wait → install → close-out last);
  - the not-applicable path;
  - a release without install hosts (hold);
  - wake expiry;
  - a closed-unmerged PR;
  - notification dedup.

  Bun proves the contract text only; model behaviour and live wake or host behaviour are separate claims.
- **Suite and review:** `env -u TMPDIR bun test` passes; `routing.md` stays within budget and `lifecycle.md` is unchanged; reviewer APPROVE plus diligence PASS.

## Exclusions

- No auto-merge of any PR, including the release PR.
- No auto spec approval, and no npm approval by agents.
- No daemon, scheduler or state machine beyond the existing harness wake and Orca fallback.
- No change to peer reviews of other people's PRs or to the VPS review manager.
