<!-- Markdown counterpart of GitHub issue #160 rev 2; body SHA-256 aba5748ed68b54f831fabe832ac71ff077ffafc71e57ce89a1e4e87b36f91158. -->
# Driver-only workspace hygiene for Orca runs

**Status:** Approved rev 2 (2026-09-23, user approval in chat). **Repository:** `axatbhardwaj/axstack`. **Source baseline:** `39bd85be6f6150db8addb2a1c7fce8424348fd9d` (v0.20.16). **Align record:** private run `20260923-workspace-hygiene-align` (Q1–Q5, two adviser rounds, one spec review round).

## Outcome

After Axstack work settles, the Orca sidebar on desktop and Android shows only driver sessions, the workspaces they own, automation dedicated workspaces, and the user's own chats. Every worker, reviewer, and scheduled-pass session is closed and its worktree removed when its work completes. The author worktree is the one exception and stays until its PR merges. Completion leaves nothing of value in a disposable worktree, so leftovers are deletable. Anything that cannot be removed is reported to the user as a hold with its reason. Leftovers from a crashed or abandoned driver are removed or listed on the next driver start. Remaining rows carry readable role-first names and a current status.

## Delivery

A bottom-up `gh stack` of three PRs:

- **A. Scheduled-pass hygiene.** Continuity template and own-terminal close for watch passes (scope 5).
- **B. Settlement and sweep.** New `references/workspace-hygiene.md` plus settlement invariant, evidence outside the worktree, salvage, sweep, and bookkeeping rules (scope 1–4).
- **C. Readable sidebar.** Names, status, and lineage (scope 6).

The report-only Stop hook moves to a separate follow-up spec after a feasibility spike (see Exclusions).

## Scope

New rules live in one new reference, `skills/axstack/references/workspace-hygiene.md`. `lifecycle.md`, `routing.md`, `orca-runtime.md`, and `axstack-cleanup` get one-line pointers, keeping the 7800-character budgets.

1. **Settlement invariant.**
   - **Intermediate completion:** when a worker or reviewer Dispatch is accepted, the driver releases the worker natively, confirms the terminal closed from a fresh native list, and removes the worktree, descendants first. The author worktree and session are excluded until merge so repairs return to the same session.
   - **Final settlement (run close-out):** no eligible non-driver session or worktree remains, including the run's worktrees in other repositories. Each remaining resource is reported as a hold with its reason.
   - **Ownership:** recorded native ownership (Run, Task, Dispatch) decides, not the parent/child tree. The creator closes what it created. A finite scheduled pass closes only its own exact terminal as its final action.
   - **Never removed:** the user's manual chats, automation dedicated workspaces, and genuine `user_takeover` sessions.
   - **Deleting a session** means closing its terminal; agent chat history is not deleted.
2. **Nothing of value left at completion.**
   - **Workers:** write evidence, reports, probes, and scratch to a private per-dispatch folder under the run directory (`<run dir>/evidence/<dispatch>/`), named in the brief and the completion receipt. Peer reviewers stay isolated from each other's folders.
   - **Authors:** commit the candidate before reporting done; the driver publishes it under the existing candidate-publication rules. Workers still never push.
   - **Salvage before delete:** if a completed non-author worktree still holds uncommitted or unpublished content, the driver:
     1. commits everything (`git add -A`) on a salvage ref in that worktree;
     2. writes a git bundle of that ref to the private run folder;
     3. runs `git bundle verify`, recording the path and SHA in the receipt;
     4. then removes the worktree.

     A failed verify holds the worktree. Salvage never applies to an author worktree before merge. Ignored files other than known build and dependency caches, submodule changes, and anything outside the worktree hold rather than being salvaged.
3. **Orphan sweep at driver start.**
   - **When:** only drivers sweep, on phase-skill entry; dispatched workers never sweep.
   - **Scope:** the current repository plus the worktrees listed in the driver's run records, via a new run-record field for per-run worktrees in other repositories.
   - **Skips:** if Orca is unreachable, the sweep reports one line and the phase continues; an unreachable host holds only its items.
   - **Removal:** standing authority, after salvage where needed, for items where every owning Dispatch and descendant is settled, ownership and liveness are rechecked from a fresh native list, and the evidence is already durable.
   - **Never:** branches with a remote counterpart are not deleted.
   - **Listed, not removed:** live or unsettled work, genuine `user_takeover`, and items without provable Axstack provenance, in one table.
4. **Bookkeeping rules.**
   - **Repair into an existing author terminal:** Orca records the worker as retained with reason `user_takeover` or `external_terminal`. The driver may treat that label as its own only when its run record holds the exact repair Dispatch ID for that terminal. Otherwise the item holds. The mislabel is reported to Orca upstream.
   - **`release_unknown`:** reconcile it with the native worker inspection. When a fresh native terminal list confirms the terminal is gone, record that and proceed. Otherwise hold.
5. **Scheduled automations (PR A).**
   - **Review-manager continuity:** each pass overwrites fixed current-state sections (Lane state, Open holds, Watermarks, Last pass) and reads them back before the terminal close. Superseded history goes once into a separate history file; a pass with no change appends at most one line there. About 60 lines is the normal budget, not a truncation rule; open holds and watermarks are never dropped.
   - **Task-owned watch automations** (`axstack-watch` runtime): each pass closes only its own exact terminal as its final action.
6. **Readable sidebar (PR C).**
   - **Names:** run first, then role, space-separated: `<run> driver`, `<run> author #<pr>`, `<run> review #<pr> r<n>`. Peer reviewers add `primary` or `secondary`; authors carry no round number.
   - **Status:** the comment is set at dispatch, at settlement (verdict and short SHA), and on a hold; `--workspace-status` carries the rest and is never set to `completed` for a hold.
   - **Lineage:** ownership presentation only and only where supported (reviewer under its author; author under its driver in the same repository). Dependency order lives in names and `gh stack`. Cross-repository parents and remote `new-child` are not relied on.

## Acceptance criteria (merge-ready)

- Contract tests for every scope item fail on the baseline text and pass after the change.
- A cleanup scenario fixture (like `pr-manager-scenarios.json`) covers:
  - author retained until merge;
  - reviewer removed at acceptance;
  - dirty non-author worktree salvaged then removed;
  - failed bundle verify holds;
  - ignored non-cache file holds;
  - genuine `user_takeover` held;
  - repair-labelled takeover with a recorded Dispatch ID removed;
  - unreachable host skipped;
  - terminal missing from the native list;
  - cross-repo worktree removed via the run-record field;
  - branch with a remote counterpart kept.
- Full `bun test` passes; `routing.md` and `lifecycle.md` stay under 7800 characters.

## Verification (after release; separate host-mutation authority)

- Install on desktop and VPS.
- Update the live review-manager and DEF-1180 automation prompts; the packaged prompt changes do not redeploy them.
- One supervised implement run and three review-manager passes leave no non-driver terminals or worktrees, confirmed on desktop and Android after reconnect.
- The continuity file keeps its holds and watermarks and stays near its budget over those passes.

## Exclusions

- **Stop hook:** deferred to a follow-up spec after a feasibility spike. The spike covers Claude user-visible non-blocking output, Codex `hooks.json` ownership, coexistence with Orca's hooks, and uninstall.
- **No new runtime pieces:** no blocking hook, scheduler, daemon, cleanup automation, runtime database, or state machine, and no AGENTS.md amendment.
- **Not handled automatically:** the user's manual chats and tabs Orca restored after a restart.
- **No Orca source changes:** the takeover mislabel is only reported upstream.
- **No migration:** existing leftovers are handled only by the first driver-start sweep.
