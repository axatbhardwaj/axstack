<!-- Auto-generated Markdown counterpart of GitHub issue #502 rev 3; body SHA-256 07edd4d7e53518e7a5300ac8da5f28d1bc654df8ffdd7d0e2cbc858ca3fef8b3. -->
# Muse Wonderful in the Axstack stack: driver, third review seat, adviser/judge, quota fallback, and immediate babysit

**Status:** Approved rev 3 (2026-10-21; user in chat: "if the spec looks good to you proceed" — driver approval after Astra plain AGREE, Opus conditional AGREE with N6 folded verbatim, diligence FINDINGS dispositioned in Decisions). **Repository:** `axatbhardwaj/axstack`. **Source baseline:** `5b1aa5ec` (installed axstack 0.47.0). **Align record:** this T3 thread (Q1–Q10; Align adviser round Astra+Opus AGREE-WITH-CHANGES; spec rev 1 reviews: Astra 8 blocking, Opus 12 blocking — all folded into rev 2 per Decisions synthesis). **Markdown counterpart:** `docs/specs/muse-stack.md` (committed by first implementation PR).

## Outcome

Muse becomes a first-class Axstack participant without becoming an author:

- **Driver:** Muse Wonderful is the preferred driver. The user picks the starting provider per thread; after that the driver owns quota checks and switches itself so work does not stop. One honest gap (B4): a Muse driver paused by a Muse usage limit cannot switch itself away — it stalls until T3 auto-continues after reset or the user re-selects a provider.
- **Review:** mixed review gains a Muse seat. First peer review = 3 receipts; Sol-authored = 2; Opus-authored = 1 (Sol); peer follow-up = 1 primary. Verified Muse absence reduces the first two by one.
- **Advice/judging:** Muse is a standing third adviser and joins arena R1; Fable stays fresh for R2/escalation.
- **Scout/research:** Muse Spark 1.3 adds two read-only breadth seats.
- **Quota:** cancelled 5x accounts (`claudeAlt`, `codexAlt`) are picker fallback for every same-provider picker choice until 2026-11-10 (Q7a cross-provider destinations require verified 20x), then removed fleet-wide. Sol stays the only ordinary author.
- **Babysit/merge:** every own PR is babysat from the turn it is raised; once the full watch predicate holds the owning watch merges immediately — never waiting for the user to say "merge".

## Decisions (Align, user-settled)

| ID | Decision |
|---|---|
| Q1c | Review: both Opus and Muse (counts §3); no quota saving claimed |
| Q2a | Muse standing adviser; judge pool Fable + Astra + Muse (surfaces row below) |
| Q3a | Muse driver-only for rotation; picker/sync-default stay Claude/Codex |
| — | Muse effort default **medium** for every Muse seat and driver pick in this spec (no seat overrides) |
| Q4a | Verified Muse absence never blocks; launched seats always count |
| Q5a | Owner stays Sol (`axstack-owner`); scheduled manager passes keep owner binding |
| Q6 | 5x fallback-only until 2026-11-10, then removed (§4 enforces fallback) |
| Q7a | Driver fallback: same-provider sibling → Muse medium → Claude 20x Opus → Codex 20x Astra medium; hold only when all out |
| Q8a | Spark seats: `axstack-explore-codebase-spark` + `axstack-research-code-spark` (mixed, medium) |
| Q9 | Bot term: Axstack review counts everywhere; in `defi-com` repos the repo's defi review bot also counts (account recorded per repo from observed PR reviews, never hardcoded unverified) |
| Q10 | No skipping: full receipts/diligence/CI still required; merge immediately once mergeable under the full predicate |

**Adviser surface row (Q2a scope, driver synthesis of B7):** Muse adviser IN — Align, Spec, advised-hold self-close advice, Implement step-back, debug L1. OUT — peer five-request panel (unchanged). Fable high-stakes trigger stays "Astra and Opus still contradict" (Muse does not trigger or block it). Debug plan merge drops a hypothesis only when *every adviser that ran* refutes it. Audit receipts count advisers that ran; audit seats unchanged (`axstack-auditor` Haiku, `axstack-auditor-sol` Sol).

**Driver synthesis notes:** accepted Astra 1–8 and Opus B1–B12 except: wonder/spark model classes dropped (pins only, Opus optional 1 — `muse-wonder-1.0` and `muse-wonder-full-1.0` must not share a class); provenance-guard paragraph dropped as duplicate of existing unsupported-provenance rule (reworded §1). B4 stall gap and B11 exhausted-Muse absence rule are stated in-spec and flagged at approval; both follow the user's settled "don't block" direction (Q4a/Q7a) without inventing telemetry.

**Approval items named (diligence rev 3):** (a) mixed `debug-investigator-4` Sol→Muse move — adviser-recommended in Align synthesis, approved with this spec, the only Sol seat move; (b) Spark dispatch wiring (Scout cap 8, Research third code branch) approved with Q8a seats; (c) §6 merge-card causes (provenance, hand-written) restate existing rules and still apply under Q10. Diligence verdict FINDINGS (1 medium = item (a), 4 low) — all resolved by this row or wording fixes in the approved text.

**Verification decision:** `.agents/skills/verify-axstack` exists; covering features: Install/check/version, Resolve-a-model/plan-a-dispatch, Package payload, Workflow instruction contracts. Prose contracts rely on `bun:test` prose-contract tests alone. No verify-create first PR.

## Scope

### 1. Installer Muse support (PR A)

- `src/roles.js`: add `muse` to `PROVIDER_BOUNDS.mixed` only. No new model class; Muse roles use exact pins (grok/antigravity pattern). `deriveModelClass` unchanged (returns null for muse pins, which is valid for pinned roles).
- New role IDs in **all three presets** (identical ID sets): `axstack-advisor-muse`, `axstack-reviewer-muse`, `axstack-arena-judge-muse`, `axstack-explore-codebase-spark`, `axstack-research-code-spark`.
  - Mixed: provider `muse`, `modeId: full-access`, `thinkingOptionId: medium`; pins `muse-wonder-full-1.0` (adviser/reviewer/judge) and `muse-spark-1.3` (scout/research pair). Notes: read-only, fresh session, never author/owner, no cross-reading, optional-seat absence per §2. Spark research seat is never sole source for a verified claim; Spark scout is an optional whole-question breadth seat reconciled by the driver.
  - Codex-only/claude-only: in-bounds provider, `model: null`, no `modelClass`; listed in `isIntentionalAbsence`; intentional absence, never dispatched.
- Mixed only: `axstack-debug-investigator-4` Sol → Muse (`muse-wonder-full-1.0`, medium). Investigators 1–3 unchanged (≥1 Codex + ≥1 Claude remain). Debug seats may instrument disposable checkouts (existing rule, not strictly read-only).
- **Spark dispatch contracts (PR B2):** mixed Scout dispatches one optional `axstack-explore-codebase-spark` per Scout call beside Flash, searching the whole bounded question (not a facet; cap becomes at most eight seats across three facets; Flash absence/hold rules apply); mixed Research dispatches `axstack-research-code-spark` as an optional third code branch beside `axstack-research-code`/`-sol` whenever the code source class is needed; a Spark-only claim stays unverified. PR B2 edits `axstack-scout/SKILL.md` §2, `axstack-research/SKILL.md` step 2, `optional-seats.test.js`. Existing corroboration/diligence requirements unchanged. Single-provider behaviour unchanged.
- `resolve-models.js`: `effortIds.muse = 'reasoningEffort'`; exact pin + advertised `medium` required; missing medium at pre-dispatch resolution counts as launch failure for optional Muse seats per §2; a post-launch configuration read-back mismatch is NOT absence — it fails acceptance, leaves the seat unresolved, and never reduces the required receipt count (reconcile under existing recovery rules); never fall back to provider default effort (catalog defaults differ per model; both pins advertise medium).
- `dispatch-plan.js` + `t3-runtime.md` binding prose: `muse→muse` beside grok/antigravity using a synthetic `{"chosenInstanceId":"muse"}` picker file; record exact model ID from plan. Picker CLI stays `--provider claude|codex` (Q3a). A Muse driver invoking `--provider muse` gets exit 1 and keeps its binding — state this; Muse drivers skip the picker.
- `AUTHORED_ROUTES` author side unchanged; no Muse authored route. Drivers never author candidate source/tests (existing rule). An independently encountered Muse-authored candidate follows the existing unsupported-provenance → INCOMPLETE rule and makes `axstack-reviewer-muse` ineligible; nothing here grants Muse authoring authority.

### 2. Optional seats, advice, arena (PR B2)

- **Optional seats:** add all five Muse roles + mixed `debug-investigator-4` to the role-roster Optional seats list. Existing rule applies: launch failure / trust-login prompt / prompt block / `dispatch-plan` exit-2 resolution hold → recorded `absent (<reason>)`; uncertain dispatch is reconciled, never marked absent; launched seat remains outstanding and its findings count. **Verified Muse absence** = a recorded `absent (<reason>)` from launch failure, trust/login prompt, prompt block, pre-dispatch `dispatch-plan` exit-2 hold, or `muse usage limit` (seats not yet launched after a limit recorded this run, until the recorded reset; with no recorded reset, until a later Muse turn completes or the run ends). A verified Muse absence is excluded from every count and never counts as no-agreement or a phase hold; the 'unavailable adviser holds' lines in Align/Spec/Debug/contracts/step-back are amended to bind Astra/Opus only. A Muse seat launched before a limit stays outstanding; its phase waits for T3 auto-continue after reset (residual stall, flagged with the §5 gap). Sol/Opus/Astra seat unavailability keeps existing holds (incl. Align/Spec hold when Astra or Opus adviser is unavailable).
- **Advised-hold agreement (narrow scope):** the unanimity rule binds ONLY (a) advised-hold one-shot self-close, (b) Align verify-skip AGREE, (c) Implement step-back path. Align/Spec synthesis (driver accepts/rejects points) is NOT bound by it. Vocabulary: "every adviser that ran recommends the same option" (verify-skip keeps plain AGREE wording). Unanimous plain agreement permits at most one advice-driven attempt per PR and cause kind, within existing authority; advice grants no approval or hold clearance. Any non-unanimous completed result (2-1, 1-1, 1-1-1, any AGREE-WITH-CHANGES) is a split → existing card path, driver pick first, dissent named. A pending Muse adviser blocks self-close. Late Muse advice is an addendum only (existing rule); it never retroactively unlocks a self-close. Card status strings (template already parenthesizes; grammar updated to combine statuses): `advisers agree 3/3`, `advisers split 2-1`, `advisers agree 2/2; advice unavailable: axstack-advisor-muse`, `advisers agree 2/2; advice pending: axstack-advisor-muse` (pending blocks self-close). Driver pick never counts. Serious-risk/never-advised/mandatory-approval rules unchanged. High-stakes gate (Astra + fresh Fable plain AGREE) unchanged.
- **Arena (mixed only):** R1 judges = Astra + Muse. R2 = fresh Fable + Astra (current R2 composition preserved); R2 Astra is a fresh session never given its R1 receipt, and R1/R2 Astra agreement counts as one family, not corroboration. R2 trigger: driver and completed R1 judges do not agree on the base, or user rejects the R1 recommendation. `axstack-arena-judge-opus` remains a defined role: R1 judge in claude-only; in mixed it is not an R1 seat (notes + `align-arena`/`presets` tests updated; never dispatched in mixed R1). Judge independence is by **session**: a judge session never authored a candidate *in that arena session set*; same-model different-session is the existing Astra pattern. Roster "one Codex + one Claude" floor reworded to bind arena **candidates**, not R1 judges. Claude-only/codex-only arena unchanged.

### 3. Review counts + readiness wording (PR B1)

Mixed only. Update consistently: review `SKILL.md` completeness/publication lines, `review-candidate.md`, `peer-mode.md`, `lifecycle.md`, `role-roster.md`, `automations.md`, `docs/workflows.md`.

- **First peer review:** 3 receipts (Sol primary + Opus peer + Muse), or 2 with verified Muse absence. Isolated first pass, exact SHA/base. Peer terms only — no authored "acceptance"/diligence import; diligence is never dispatched in peer mode.
- **Sol-authored:** 2 receipts (Opus secondary + Muse), or 1 with verified Muse absence. A validated medium/high finding from either seat blocks; one `repairs` increment per round regardless of seat count.
- **Opus-authored (high-stakes route):** unchanged, 1 Sol receipt; no Muse seat this run.
- **Peer follow-up:** unchanged, exactly 1 `axstack-reviewer-primary` receipt.
- **Readiness approval term:** "every mode-required authored reviewer receipt `APPROVE` at current head/base (verified Muse absence allowed)"; watch predicate otherwise unchanged except §6.
- Single-provider presets: counts unchanged; Muse seats never dispatched.

### 4. Picker: fallback enforcement + correctness (PR C, strict TDD)

- **Fallback-only (Q6 enforced, weights alone don't):** partition eligible instances by tier weight descending (4 = 20x/pro before 1 = 5x/prolite); choose highest score within the top non-empty partition. Fixture: 20x at 80% vs 5x at 0% → 20x chosen. Picker `--json` adds per-instance `weight` (4 = 20x/pro; 1 = 5x/prolite or unknown tier) — the only output-shape change; tier-up and the §5 20x check read it (score alone cannot reveal tier). An instance with unknown tier (no cache/failed fetch) has weight 1 and lands in the lower partition. **Tier-up:** when the picker's `chosenInstanceId` is in a higher partition than the consumer's own eligible instance, a driver or scheduled pass performs the existing same-provider sibling switch to it (same provider/model/effort; review-manager owner binding follows the existing owner-of-record rule). `sync-default` applies the same partition before band/pace. Red fixtures: driver on eligible 5x with eligible 20x → switch; `sync-default` current `claudeAlt` with eligible `claudeAgent` → `updated`. Weights/scores/exit codes otherwise unchanged.
- **Unauthorized:** 401/403 excludes ONLY when the on-disk token is unexpired (Claude `claudeAiOauth.expiresAt > now`; Codex: token expiry field if present, else unknown). Expired-token 401/403 → `unknown` (picker never refreshes OAuth; an idle account must not starve forever). Note honestly: this differs from `sync-default`, which excludes unauthorized only for the current default instance.
- **Stale:** stale cached usage → state `unknown`, score = tier weight (existing unknown scoring). Stale values ≥95% or `limitReached` still exclude. Intentionally flipped existing tests named in PR: `pick-instance.test.js` stale-score cases (240 / 80).
- **Red first (fixtures):** (a) unexpired-token 401 account at 0% currently outranks/beats eligible 20x → after fix excluded; expired-token 401 → unknown not excluded; (b) stale low-usage cache outranks fresh eligible sibling → after fix unknown-scored; (c) fallback fixture above. Green evidence recorded.
- Cancelled-plan endpoint payload remains an open unknown; fixtures cover 401/403/stale shapes, live mismatch = follow-up, never silent pass.

### 5. Driver quota switching (PR B3)

Standing user-authorized exception, stated verbatim in contracts + t3-runtime: "Exception (Q7a): the run driver thread only may change its own provider/model by this rule. Dispatched roles, scheduled automation passes, schedules other than its own run watch, and `roles.json` keep the existing no-substitution rules. Scheduled automation passes keep the existing same-provider rule and exit-2 hold." Review-manager/owner-bound passes never cross-switch; recorded `axstack-owner` binding is never overwritten by a driver switch (Q5a).

At run start, resume, and run-watch wake, the driver checks its own provider (Muse drivers skip picker, §1):

- exit 0, own instance eligible → stay, unless §4 tier-up applies (then same-provider switch to the higher-tier chosen instance). A Muse driver applies the Muse target eligibility rule to itself; ineligible counts as exit 2 (switch away early when a Muse seat recorded a limit first).
- own instance excluded, eligible same-provider sibling → switch instance (existing rule; 5x qualifies until 2026-11-10 removal).
- exit 2 → traverse Q7a order skipping current provider: Muse `muse-wonder-full-1.0` medium → Claude `claude-opus-5-5` `medium` → Codex `gpt-6-astra` medium. Claude/Codex cross-provider target eligible iff its picker exits 0 AND the chosen instance is verified 20x-tier (tier weight 4 in picker evidence); a returned 5x instance does not satisfy a Q7a 20x destination — continue to the next destination. Same-provider sibling selection retains the authorized 5x fallback until removal. Muse target eligible iff advertised in fresh `orchestrator_capabilities` and no Muse usage limit recorded this run since reset. Switch via `t3_thread_configure`; verify with `t3_thread_configuration` read-back (provider/model/effort) before continuing; a requested switch is not proof — next turn must execute on the new binding.
- exit 1 → keep current binding, record error, never switch provider.
- Every switch: record exit status/stdout/stderr (JSON pointer only when JSON exists — exit 2 emits none today), from/to provider+instance+model+effort, UTC, in `progress.md` AND update driver provider/model in the run record. Recreate bound run watch with the **new** provider/model/effort (amends same-model re-arm rule for this case only), preserving prompt/cadence/binding, duplicate check + old-absence/new-presence read-back.
- All providers unavailable/excluded → hold + in-thread user notice. Mid-turn pause cannot self-recover. **Q7a gap (B4):** Muse driver paused by Muse limit stalls until auto-continue/reset or user re-selects.
- `sync-default` pool unchanged (default stays Claude/Codex; `muse` default would read unmanaged).

### 6. Immediate babysit + merge-when-mergeable (PR E)

- **Immediate babysit:** every own PR a **driver publishes** is linked (`link_pull_request`) and watched in the publishing turn under the existing Autopilot publication rule (chat-run watch; join existing watch; no duplicates). An unowned own PR a driver finds outside its run is reported once in the driver thread with its full URL; adoption stays explicit under watch §1. Workers, reviewers, managers, monitors and nightly triage never link, watch or adopt PRs, and never push/submit/merge; only the recorded owning watch thread merges.
- **Merge-when-mergeable (Q10):** when the full §5 predicate holds at current head/base, the owning watch merges in that wake without awaiting a user "merge" instruction and without a merge card, unless an existing merge-card cause applies (provenance, hand-written PR). Existing user-merge categories, holds, vetoes, and cards for *unmet* terms unchanged; this section creates no new user-merge category and removes none.
- **Team bot term (Q9, AND):** outside `defi-com`, the bot term is the current-head Axstack authored `APPROVE` already required (no new check). In a `defi-com` repo it additionally requires the repo's defi review bot: the `Bot`-type account whose review on a PR in that repo the driver observed and recorded with its URL in the run record (re-derived per run; never hardcoded). It holds when that bot reviewed the current head and none of its items there is rated `above low`, `uncertain` or unrated under the existing rule (no separate high/critical threshold). No current-head bot review or no identifiable bot = `unknown`, holds automatic merge with a report-only notice; agents never request bot re-review unless repo docs define a trigger. The bot term never clears feedback holds: every non-agent item keeps existing reviewer-rating rules; replies or a `Pre-existing` disposition alone do not clear non-agent holds (agent-authored validated `Pre-existing` exception unchanged). Solo mode unchanged (no human/bot term beyond existing authored+diligence). Peer and observation-only watches never merge.

### 7. Fleet operations (driver-run, recorded; no PR)

- **Now:** close the io (`xzat@io`) / iobox (`xzat@iobox`) settings-home unknown with read-back evidence; inventory per host: scheduled tasks, live threads, recorded owner bindings, in-flight dispatch records bound to `claudeAlt`/`codexAlt`. No settings mutation before Nov 10 (Q6 fallback is live behaviour).
- **At release:** reinstall + verify io, iobook, iobox, axat-vps (standing authority; human approves npm stage). Per host record: installed version, `muse` instance/model/medium advertised in capabilities, picker JSON.
- **2026-11-10 runbook** (owner: the fleet-step driver creates a one-shot T3 scheduled task for 2026-11-10 naming this section; if that task is missing, the first driver run on/after that date owns it): recreate 5x-bound schedules on 20x; one settings edit per host: default → 20x selection + both 5x `enabled:false`; `t3-provider-fix`; read back picker lists no 5x. Owner bindings bound to 5x follow existing owner-update rules, never hand-edited.

## Delivery chain

Ordinary PR chain, semantic commits ~200 lines, one writer per PR. Order: **C ∥ A** → **B1** (counts/readiness) → **B2** (advice/arena) → **B3** (driver runtime) → **E** (watch) → release (minor bump) → fleet reinstall/verify. PR A commits `docs/specs/muse-stack.md`. Prose-size test ceilings are raised additively where new contract text lands, never by squeezing existing text. Docs updates ride their PRs (`docs/workflows.md`, `docs/installation.md` provider tables). Tests: `tests/installer/`, `tests/workflows/`, picker tests beside existing script tests.

## Acceptance criteria

1. `bun run test:all` green at chain head; new prose-contract tests fail on removal/inversion of §§2/3/5/6 rules.
2. Temp-home installs: mixed `roles.json` has 5 new Muse roles plus migrated debug-4 (6 Muse-bound roles), exact pins, medium, no muse modelClass; single-provider installs show explicit nulls, readiness ready, `muse` outside bounds.
3. `dispatch-plan` per Muse role: provider/instance `muse` via synthetic picker file, exact model, `reasoningEffort=medium`; missing-medium pre-dispatch fixture records absence; post-launch read-back-mismatch fixture fails acceptance without reducing receipt counts. Claude/Codex plans byte-unchanged behaviour.
4. Picker: §4 red→green (fallback partition, unexpired-401 excluded, expired-401 unknown, stale unknown-scored, stale-≥95 excluded). Live axat-vps: JSON exposes per-instance `weight`; chooses highest-scored eligible in top partition; 5x listed eligible-or-excluded by real usage, never assumed.
5. Contract prose matches §§2/3 verbatim semantics incl. card strings, counts 3/2/1/1, primary-only follow-up, readiness plural approval term.
6. Driver-switch matrix exercised in tests/fixtures: eligible-stay, sibling switch, exit 1 keep, exit 2 → each Q7a destination, Claude-20x-excluded/Claude-5x-eligible/Codex-20x-eligible → Codex 20x chosen, all-out hold. **Live proof:** throwaway thread on axat-vps switches Codex → Muse medium → Claude Opus; each step `t3_thread_configuration` read-back + next-turn reply prove binding and context survival; the recreated run watch is proven firing on the new provider via `run_scheduled_task_now` read-back. Failure holds only the driver switch (rest of chain unaffected).
7. Seat smokes against PR-head roles snapshot (pre-release): adviser, reviewer, judge, debug-4, scout-spark, research-spark via `delegate_task`; config read-back correct; receipt returned. Launch-unavailable smoke = capability **unverified** + degraded-mode (absence) behaviour proven; wrong settings or broken absence handling fails.
8. Watch: prose-contract covers immediate-babysit, team bot term incl. defi-only external bot, solo unchanged, merge-in-wake without user instruction, peer never merges. First own PR of the release run itself is babysat from raise turn (evidence: link + watch receipts in run record).
9. Fleet read-back (acceptance 7 of rev 1, expanded): all 4 hosts on release version; `muse` advertised with model+medium on io/iobox/axat-vps (+iobook recorded); io/iobox settings-home unknown closed. Nov-10 runbook present; its execution is a separate dated task.

## Exclusions

No Muse author/owner/explainer/auditor/monitor/checker seat, and Muse is never an arena, brainstorm, or authored candidate. No Muse picker/pool/telemetry membership. No burn-down inversion; no 5x disable before 2026-11-10. No change to high-stakes Opus-author route, Fable gate/trigger, peer panel, diligence dispatch rules, or merge authority holders. No Sol seat moves beyond debug-investigator-4. No new daemon/scheduler/state.

## Unknowns carried openly

- Muse-driver stall gap (B4) — no telemetry, no self-switch while paused.
- `t3_thread_configure` cross-provider context/queue behaviour — proven or held by acceptance 6.
- Cancelled-plan usage payload; Muse usage-limit/pause semantics; Muse availability on io/iobox/iobook — closed live, never assumed.
- Spark quality on verified research claims — pair-seat-only until evidence says more.
- Defi bot account names per repo — recorded from observed reviews at first use.
