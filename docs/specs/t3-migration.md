# Spec: migrate Axstack from Orca to T3 Code

Status: Draft rev 4 (2026-10-03), awaiting user approval. Store: this repo Markdown file.
Run: `20261003-t3code-migration`. The private run record holds the spike report, arena verdicts,
adviser and diligence receipts, and the Orca file inventory (83 files).

## Goal

Every Axstack skill runs on T3 Code (pingdotgg/t3code, orchestrator V2, nightly
`0.0.46-nightly.20261003.2610` or later) as its only runtime. Orca is removed from Axstack's
active skills, shared references, installer, generated instructions, tests, docs, and the user's
global instructions.

## Settled decisions

| # | Decision |
|---|---|
| Q1 | Full cutover with no dual-runtime layer. `v0.20.31` stays the tagged Orca release for rollback. |
| Q2 | Desktop first, then the VPS. The VPS review manager becomes a T3 scheduled task. The Orca automation is disabled (not deleted) only after the T3 canary passes. The user drives from the T3 app on desktop and Android. |
| Q3 | Done means `bun test` is green and all 13 `axstack-*` skills have run live on the T3 nightly. Orca-provided skills are dropped. T3 `preview_*` tools replace the Orca browser. |
| Q4 | This migration is built from the current Orca chat. Verification and every later run use a T3 driver thread. |
| Q5 | Notifications stay on Hermes `hermes send`. The relay fallback location moves from the Orca conversation to the T3 driver thread. |
| Q6 | Remote access uses `t3 serve --tailscale-serve` plus `t3 pair` on the existing tailnet, not T3 Connect. |
| Arena | The base design is candidate D. Graft from A: persist `task_status` before `t3_thread_read`, with a launched SHA-pinned reviewer as the fallback. Graft from B: a lane storage limit that pauses the schedule. |

## Verified facts (spike on the T3 nightly, run record `evidence/t3-spike`; T3 source @43bd6677)

- Orchestration is only the `t3-code` MCP inside T3-launched sessions, so the driver is a T3 thread.
  - A Claude T3 session invoked an `axstack-*` skill.
  - Claude and Codex sessions both advertise all 13 skills and have the global instructions and `AGENTS.md` in context.
- `delegate_task` children share the parent worktree.
  - A Codex child `cd`-ed into a driver-made detached checkout and worked there. The driver's `HEAD` and status stayed unchanged.
  - Async child completion is steered into an active driver turn, or starts a new turn when the driver is idle.
- `t3_thread_configuration` read back model and effort for a Codex child. Other providers have not been checked.
- `t3_thread_launch` with a worktree strategy isolates a writer (it runs `git worktree add -b <branch>`).
  - It has no idempotency key.
  - A failed provisioning does not notify the launcher.
  - T3 renames `t3code/*` branches, so `baseRef` must be a commit SHA.
  - A writer's `t3_thread_send` wakes an idle driver.
  - `t3_thread_send(mode=queue)` to the writer runs a repair in the same worktree.
- A child question round trip works. `t3_thread_send` to the `childThreadId` resumes the child as a new run with its context. The resumed result showed only in `task_status.latestTerminal*`. No notification arrived during the observed turn, so a missing notification is assumed.
- `schedule_task` cannot select a model or workspace; it inherits the calling thread's.
  - A bound schedule delivers each tick as a new driver turn.
  - An unbound run creates a fresh thread with a new worktree from `origin/main`.
  - `run_scheduled_task_now` does not return the run's threadId.
  - Delete works.
- `t3_thread_organize` only changes metadata; worktrees remain on disk.
- Effort option ids: codex `reasoningEffort`, claude `effort`, grok `reasoningEffort` (no `max`), opencode `variant`.
- Grok needs CLI ≥1.0.13. T3 advertises Grok even when its CLI is broken.
- Antigravity in T3 is Google's Antigravity ACP agent (`agy_acp_server`), not the `agy` CLI. Its runtime is installed from T3 provider settings, and it has its own browser sign-in (T3 `docs/user/providers-antigravity.md`, `provider/antigravityRelease.ts`). Pointing T3 at `agy` was rejected: T3 reported the executable or its `localharness_external` sibling missing (spike §14).
  - The runtime is a ~682 MB download that unpacks to ~1.9 GB.
  - It does not read `~/.agents/skills`.

## Design

```text
Usage: in a T3 thread, "/axstack-implement <task>" -> the driver reads t3-runtime.md, saves the
       orchestrator_capabilities JSON, then calls delegate_task(target{providerInstanceId,model,
       options}) for non-writer roles or t3_thread_launch(workspaceStrategy worktree@SHA) for writers.
Shape: driver T3 thread ──delegate_task──> advisers, research, judges, diligence (driver worktree,
         read-only) and reviewers, debug and execution investigators, UI verifier (driver-made
         disposable detached checkout under the run dir)
       driver ──t3_thread_launch──> writer thread (own worktree, branch axstack/<run>/<role>/<task>-a<n>)
       writer ──t3_thread_send "AXSTACK-DONE key=… head=… report=…"──> driver
       VPS: schedule_task (unbound, 15 min) ──> lane pass thread ──delegate_task──> reviewers
Binding: skills/axstack/references/t3-runtime.md replaces orca-runtime.md; the role->mechanism
       split by permitted writes; receipt lines AXSTACK-DONE/FAILED/QUESTION; dispatch key
       <run>:<role>:<task>:a<n> as T3 title, matched exactly on the whole title; branch =
       axstack/<run>/<role>/<task>-a<n>, each segment lowercased with [^a-z0-9-] -> '-'; presets keep role ids, mapping table in t3-runtime.md;
       baseRef always a SHA; worktreeCleanup off and checked; no Axstack daemon, DB, lock, scheduler.
Flow + failure: driver launches writer -> provisioning fails silently -> post-launch
       t3_thread_wait(timeoutMs 120000) -> failed: launch failure; timed out but t3_thread_read shows
       activeRunId+worktreePath: started; still preparing: hold, re-read at next wake.
We accept: driver-made disposable checkouts and a per-run bound watch schedule, for native
       completion wake-ups and no Axstack runtime.
Rejected: all roles via launch (loses native wake, multiplies worktrees); writers via delegate_task
       (shared worktree); per-project manager schedules (narrows today's cross-repo coverage); bare
       mirrors (host clones exist); T3 worktreeCleanup as retirement (no salvage); dual runtime.
Open: none. The launched SHA-pinned reviewer fallback stays an unused contingency; the delegated
       detached-checkout smoke passed (spike §10, §13).
```

### Role dispatch (classified by permitted writes)

| Roles | Mechanism | Workspace | Completion |
|---|---|---|---|
| Advisers, research, explorers that only read, explainers, diligence, checker, auditor, monitor, arena candidates and judges, escalation | `delegate_task` async, title = key | Driver worktree, tracked and untracked files untouched; writes only `<run>/evidence/<key>/` | Native notification, then `task_status`: `completed`, `result_available`, `hasPendingChildRuns:false`, final `AXSTACK-DONE` line |
| Reviewers (peer, authored), release checks, debug investigators, `axstack-explore-execution`, `axstack-ui-verifier` | `delegate_task` async | Driver-made `git worktree add --detach <run>/checkouts/<key> <sha>` (plus the pinned patch for debug). Writable only as a disposable probe. Outputs go to evidence. | Same as above |
| Author and its repairs, code-arena candidates | `t3_thread_launch` `{type:worktree, baseRef:<SHA>, branch:<per Binding>, startFromOrigin:false}` | Own T3 worktree, kept until the PR merges or closes | `AXSTACK-DONE` via `t3_thread_send`, terminal `t3_thread_wait` on that run, and driver checks (non-empty diff, clean tree, red/green logs) |
| Owner | The driver thread | Driver worktree; never writes tracked files | n/a |

**Provider binding**
- Providers map codex→`codex`, claude→`claudeAgent`, grok→`grok`, antigravity→`antigravity`. `modeId` maps to `runtimeMode: full-access`, and effort maps to `options:[{id,value}]`.
- Model rule: a preset `model` is used as given. Otherwise `modelClass` resolves to the newest matching catalog id for that provider: codex `gpt-<N>-<class>`, claude `claude-<class>-<N>-<N>`. A `model:null` role with no class uses the provider's model as listed first in the saved capabilities JSON, and the exact id is recorded. `resolve-models.js` gains `--provider` and reads the saved capabilities JSON.
- A value the provider lacks holds that role, with no substitution.

**Verification**
- The dispatch call echoes the provider and model. `t3_thread_configuration` reads back the options.
- A missing effort read-back holds roles that require it; it is never recorded as satisfied.
- The first dispatch per (provider, model, effort) must reach a running or completed run before its siblings launch.

**Repairs, questions, replacements**
- A repair to a live writer is `t3_thread_send(writerThreadId, mode=queue)`, within the same attempt.
- A replacement attempt after a terminal failure gets `a<n+1>`: a new branch and title. The failed attempt's branch is kept until it is salvaged.
- A question ends with `AXSTACK-QUESTION key= q=`. Natively it looks `completed`, so only the marker line distinguishes it.
  - The driver answers once via `t3_thread_send` to that thread.
  - It then runs `t3_thread_wait(childThreadId, runId, timeoutMs 600000)` (re-armed by the run watch) and accepts only `latestTerminal*` whose `latestTerminalRunId` is newer than the question's run.
- Permission requests and safety refusals are holds.

### Receipts and safety

**Run record (driver is the sole writer)**
- Run-level fields:
  - driver threadId and projectId
  - host
  - T3 version and installed Axstack SHA
  - capabilities JSON path
  - scheduledTaskIds of every watch and manager schedule
- Per dispatch:
  - key and mechanism
  - requested target and read-back
  - taskId/childThreadId/childRunId, or threadId/runId/worktree/branch/base SHA
  - checkout path, with candidate and base SHAs
  - evidence folder

**Failure**
- Any of:
  - `task_status` failed
  - a run failed or interrupted
  - a thread error while preparing
  - `AXSTACK-FAILED key=`
- A message without terminal state counts only as progress.

**Completion**
- `task_status` is persisted before any `t3_thread_read`.
- A completion is accepted only for the current attempt key and candidate SHA. An older attempt never completes a newer one.

**Isolation**
- One writer per candidate.
- After each delegated completion, the driver checks that its own `HEAD` and `git status --porcelain` are unchanged. Any change is a hold.

**No duplicate launch**
- The key is recorded before the call.
- Recovery uses `t3_thread_list titleContains=<key>`, fully paginated and filtered to exact whole-title equality, plus `git worktree list`:
  - one exact match: adopt it
  - proven absence: relaunch once
  - several matches or an incomplete inventory: hold

**Lost completion**
- A driver turn may end with an unsettled launched thread only while the run watch is armed (`schedule_task` bound, `everyMs:600000`).
- The driver deletes the watch, verified via `list_scheduled_tasks`, once nothing is unsettled.

**Cleanup**
- Order:
  1. Confirm descendants are settled.
  2. Read back the evidence.
  3. Salvage if the worktree is dirty or holds ignored non-cache content.
  4. `t3_thread_organize archive`.
  5. Exact `git worktree remove` without force.
  6. `git branch -d` for local-only branches.
- Author worktrees stay until the PR merges or closes. The current pass and any unsettled descendant are never removed.
- The sweep inventory is project-scoped T3 threads plus `git worktree list --porcelain` plus run records. User-created threads and other projects' items are reported, never touched.

**T3 cleanup policy**
- `worktreeCleanup` must be `off` for every Axstack project.
- The driver preflight reads it back via `t3_project_read` where it is exposed. Otherwise it records a limitation pointing to the documented setup step.

### VPS review manager

**Lane**
- A T3 project `axstack-review-lane` sits on the VPS's existing `axatbhardwaj/axstack` clone, which has an `origin` and `main`.
- Unbound pass worktrees branch from `origin/main`. Each pass fetches first.
- Continuity stays at `~/.local/share/axstack/runs/review-manager/progress.md`, outside every worktree.
- Per-PR review checkouts are `git -C <host clone> worktree add --detach` from existing host clones. A repo without a clone becomes a held job.

**Binding**
- The lane thread is set to the `axstack-owner` binding via `t3_thread_configure` and read back.
- Then `schedule_task` runs with the packaged prompt, `everyMs:900000`, `bindToCurrentThread:false`, and a stable `clientRequestId`.
- Each pass compares its own `t3_thread_configuration` with the recorded binding. A mismatch holds admission.

**Admission** (the existing `automations.md` rules, restated)
- Discovery reads every page of PRs and native threads. A truncated or failed inventory holds admission and cleanup.
- A pass never admits a PR owned by a live or uncertain earlier pass.
- The earlier pass wins only when ordering evidence exists. Missing ordering or ownership evidence holds admission and never guesses a winner.
- A duplicate pass does read-only discovery into its own note, and notifies once about a stalled owner.
- Cross-repo coverage, event deduplication and held-job coverage are preserved.

**Growth**
- Each pass retires settled predecessor passes and reports the retained worktree count.
- Past the authorized limit (default 20 retained lane worktrees), the pass disables the schedule (`update_scheduled_task enabled:false`) and holds.

**Canary** (before the Orca automation is disabled)
1. Two `run_scheduled_task_now` passes, the second while the first is live: exactly one admission owner per PR.
2. One pass that reviews or correctly no-ops a real PR event.
3. A pass that reconciles a killed predecessor.
4. With a temporary limit equal to the current count, the next pass disables the schedule, and no new pass worktree appears at the following interval.

## Acceptance criteria

1. **Live matrix.** From a T3 driver thread on desktop with the `mixed` preset, each of the 13 skills completes one live run. The recorded T3 nightly version and installed Axstack `main` SHA are noted. Each skill with configured roles dispatches them through T3, and the matrix as a whole shows codex, claudeAgent and grok dispatches. Relay and cleanup run inline. Antigravity's 3 roles count only after its T3 runtime is installed, the user has signed in, and a canary succeeds. Otherwise they are a recorded hold the user accepts.
2. **Recovery paths.** Each of these has a workflow scenario test (fails when its rule is removed or inverted) and is exercised once during the live gate:
   - lost launch response
   - silent provisioning failure
   - writer death after the driver idles
   - bound-watch wake and verified deletion
   - stale completion
   - child question and resume
   - delegated reviewer isolation
   - cleanup with unmerged or ignored content
3. **No active Orca.** `bun test` passes. The existing `tests/workflows/structural.test.js` gains a check, landing in the final code PR, that fails on active Orca routing or dependency (content or file name). It covers `skills/`, `src/`, `bin/`, `profiles/`, `tests/`, `README.md`, `docs/workflows.md`, `docs/installation.md`, `AGENTS.md` and `package.json`. Exempt: the named legacy-line pattern constant in `src/instructions.js` and its installer fixtures, the structural check's own pattern list, the rollback section of `docs/installation.md`, and the historical `docs/specs/` and `docs/plans/`.
4. **Runtime reference.** `orca-runtime.md`, `orca-runtime.test.js`, `trust-path.js` and `trust-path.test.js` are deleted. Every reference to them is repointed or removed. Each binding rule in `t3-runtime.md` has a prose-contract test that fails when the rule is removed or inverted, and survives rewording.
5. **Installer.**
   - `src/capabilities.js` validates `t3` presence and the nightly floor by version and date, tested with an older same-version nightly. It reports in-session MCP readiness as "verified by driver preflight". It has no Orca probes.
   - `src/instructions.js` generates the T3 routing block with the standing writer-launch authorization, and reports hand-written Orca lines in global instructions without editing them.
   - Tests use temporary homes.
6. **Presets.** `mixed`, `codex-only` and `claude-only` keep their 32 role ids. Notes that mention Orca, the TUI or `agy` are updated to T3.
7. **Release.** `v0.21.0` is published and installed on desktop and VPS. The installed version, roles, and both skill directories (`~/.claude/skills`, `~/.agents/skills`) are verified on both hosts. Grok CLI is ≥1.0.13 on both.
8. **Global instructions.** `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` are backed up, then rewritten on both hosts to route through T3. Their rules are preserved: `defi-com`-only Linear via the executor MCP, GitHub specs elsewhere, and Notion via executor. Loading is read back from a T3 Claude thread and a T3 Codex thread.
9. **VPS.** The VPS runs `t3 serve --tailscale-serve` as a user service, paired with the Android app. The review-manager canary passes. The Orca automation is disabled and read back. Hermes delivery is verified, including the decide gateway's `AXSTACK_RUN_DIR` for a T3 run.
10. **Rollback.** Rollback is documented and listed in the release PR:
    - reinstall `v0.20.31`
    - restore the backed-up global instructions on both hosts
    - set the T3 manager schedule to `enabled:false`
    - delete armed run watches
    - stop and disable the `t3 serve` user service
    - re-enable the Orca automation

    Orca stays installed for one week after the VPS canary.

## Exclusions

- Rewriting historical `docs/specs/` and `docs/plans/`.
- Uninstalling Orca, or deleting its automation, workspaces or Notion prompt backup.
- T3 Connect, T3 mobile push, and Hermes transport changes.
- Upstream T3 fixes (gaps are reported only).
- T3 nightly upgrades after verification.
- Cursor, Pi and OpenCode roles.
- Rebuilding computer-use or Orca Linear.
- Single-provider presets beyond keeping their role ids. Their live runs hold as today.
- Editing the user's auto-memory notes is not a deliverable.
- Installing Axstack skills for Antigravity's own skill paths. Antigravity roles (checker, research-web-google, arena candidate) get self-contained briefs and need no skills.

## PR stack (`gh stack`, bottom-up, commits of about 200 lines)

Behavior changes are red then green; structure-preserving slices are green before and after. The
ticket map gives every file in the run's 83-file Orca inventory one primary owner PR, lists any named
secondary edits by other PRs, and diligence checks that the assignment is complete. Tests that read
README or `docs/` ride with PR 7, which edits those docs. A PR stays green on its own: a file is deleted only in the
PR that also updates every test and link that reads it.

1. `feat(workflows): add t3 runtime reference`. Adds `t3-runtime.md` and its prose-contract tests. Additive only.
2. `feat(workflows): resolve models from T3 catalog`. Adds `resolve-models.js --provider` with the model rule. Deletes `trust-path.js`, `trust-path.test.js` and every reference to them (including `automations.md` and `run-record.test.js`). Drops the transcript read-back.
3. `refactor(workflows): T3 lifecycle and hygiene`. Covers `lifecycle.md`, `workspace-hygiene.md`, `evidence-archive.md`, `candidate-publication.md`, the cleanup skill, and their tests and scenarios.
4. `feat(workflows): T3 scheduled review manager and watch`. Covers `automations.md`, `review-manager-prompt.md`, `test-audit-weekly.md`, `axstack-watch` with `watch-runtime.md`, chat-run watch scenarios, admission, overlap and growth rules, and the recovery-path scenarios from AC2.
5. `refactor(workflows): migrate phase skills and routing`. Covers the 13 SKILL.md bodies, `routing.md`, `run-record.md`, `contracts.md`, `autopilot.md`, `diligence.md`, `ui-verification.md` (preview tools), relay fallback, preset notes, the repo `AGENTS.md`, and the remaining workflow tests and scenarios. Deletes `orca-runtime.md`, `orca-runtime.test.js`, `orca-native-contracts.test.js`, `orca-scenarios.json` and `orca-native-scenarios.json`, with T3 equivalents.
6. `feat(installer): validate T3 and reroute instructions`. Covers `capabilities.js`, `instructions.js`, legacy-line detection, `bin/axstack.js` (help text and the line-113 `--profile` message), `package.json` metadata, and the installer tests. `orca-migration.test.js` is renamed `legacy-runtime-migration.test.js`, with `writeOrcaBundle` renamed accordingly.
7. `docs: T3 runtime and structural guard`. Covers README, `docs/installation.md` (T3 setup, `worktreeCleanup` off, Antigravity runtime and sign-in, Grok minimum, Tailscale pairing, rollback) and `docs/workflows.md`. Adds the AC3 structural check.
8. Live gate: after merge, install `main` on desktop and run the AC1/AC2 matrix from a T3 driver. Fix PRs stack on top.
9. Release: `chore(release): v0.21.0`, then publish, then desktop reinstall and global-instruction cutover, then VPS install, service, pairing and canary, then the Orca automation is disabled.

## Authority requested at approval

- **Release:** the `AGENTS.md:40` release rule plus the tag-triggered `.github/workflows/publish.yml`. Install hosts: desktop (`io`) and VPS (`axat-vps`). npm stage approval stays with the human.
- **Host mutation on both hosts:**
  - Install the T3 nightly and Grok ≥1.0.13 in user space.
  - Run `t3 serve --tailscale-serve` as a user service, plus `t3 pair`.
  - Install T3's Antigravity runtime from T3 provider settings after a disk check (≥3 GB free). The Google sign-in stays a user action.
  - Set `worktreeCleanup` to off for Axstack projects.
  - Create the T3 projects and schedules, with a lane limit of 20 retained worktrees.
  - Back up, then rewrite, the Axstack-related lines of the global `CLAUDE.md` and `AGENTS.md`.
  - Disable, but do not delete, the Orca review-manager automation, and update its Notion prompt backup.
- **Standing authorization:** Axstack drivers in T3 run full-access and may launch top-level writer threads and worktrees within approved scope.
