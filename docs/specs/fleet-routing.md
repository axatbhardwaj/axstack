# Load-aware axnet workers — r6, private draft

Status: not approved; implementation not started.
Proposed authoritative store: axatbhardwaj/axstack, docs/specs/fleet-routing.md. Existing repository convention supports this location; confirm the selected repository planning location before publishing. This private preparation is not the execution baseline.

## Decision brief

T3's native balancer may place the main UI thread on any machine. Axstack will call a Bun CLI before subsequent worker dispatch to select a suitable host using CPU/RAM and task needs. T3 retains task tracking. The CLI removes repeated manual load inspection.

First distribute new work across axat-vps, iobox and iosatellite by observed assignment counts, then measured load, while suitable workers in that pool remain at or below 50%; io and iobook are excluded from this initial balancing pool. Once every eligible measured pool worker exceeds 50% (with unknown/empty-pool handling defined in F1), the fallback preference is axat-vps, iobox, iosatellite, io, iobook. A CPU or RAM measurement above 75% on VPS or 85% elsewhere tries the next eligible host. If all eligible measured hosts exceed the limits, choose the least-loaded host and continue. Personal activity adds no exclusion. These limits are placement preferences, not stop conditions.

Counts-first within the <=50% pool is the proposed technical interpretation of even spreading. It can choose a 50%-loaded worker over a 5%-loaded worker with more assignments; it does not promise equal CPU/RAM percentages.

SSH execution fallback remains conditional on proving equivalent T3 tracking; until then only SSH telemetry/artifact transport is available and supported T3 routes are used.

Includes CLI, Axstack runtime instructions, canonical global AGENTS.md/CLAUDE.md sources and their deployment, all-five-host installation/verification, and completing the authorized link mesh. Retains native main-thread balancing. Excludes job migration, a new scheduler/daemon/database, model substitution, copying authentication sessions, and top-level thread launches as worker substitutes unless separately explicitly requested and reported.

Important limitation: v0.1.5 rejects direct remote worktree-isolated delegation. Remote read-only roles are the first rollout. A T3-tracked remote coordinator delegating an isolated author locally is a candidate for the author phase, not proven support. If its pilot fails, isolated authors remain on the driver's host and the result explicitly reports partial delivery of remote-author routing.

No placement preference questions remain. Approval of a reviewed exact spec revision is still needed before implementation. Missing links or permissions remain execution facts, not load decisions.

## Requirements

### F1 — Deterministic placement

Configuration belongs to Axat's Haoshoku configuration, not the public Axstack package. Canonical source: `axatbhardwaj/haoshoku:configs/fleet-routing.json`, owned by Axat and maintained by the authorized driver. Deploy identical bytes to `~/.config/haoshoku/fleet-routing.json` under each host's T3 account (xzat on io/iobook/iobox/iosatellite; root on axat-vps). The helper accepts --config and defaults to that account-local path.

This file supplies schema version, pool membership, default/task orders, 50/75/85 thresholds, per-host capability facts and per-directed-pair route enablement with host-qualified evidence pointers, versions and timestamps. No keys, tokens, session contents or live load samples belong in it. Dynamic T3 access and live capabilities are still checked; config cannot grant authority. Shipped Axstack code is generic and includes synthetic fixtures only, with no personal fleet defaults. A missing/unreadable config is an explicit configuration error; capability-gated remote routes remain unproven and the driver may use only a supported existing local fallback. It is reviewed configuration, not a runtime database.

Unknown required capability excludes the route (capability-unproven); unknown load does not. Dynamic destination provider/model/options/project facts come from the target environment snapshot, never the origin catalog. Unreadable destination facts mark that route unproven. Missing projects produce project-missing; the driver may provision through supported T3 tools within existing authority, then re-evaluate. The CLI receives the role/task category, required capabilities, requested provider/model/options, repository/project identity, eligible execution routes and the assignment snapshot defined below.

The driver reads T3 task inventory and supplies `assignments` records: `{assignmentId, environmentId, state}` plus `inventoryObservedAt` and `inventoryStatus` (known/unknown). Assignment IDs are origin-qualified T3 task IDs; environmentId identifies the host actually doing the work (remoteChild.environmentId for remote work, origin for local work). Count each placement once: a coordinator and its nested author represent one assignment, not two. Count non-terminal assignments only.

The driver also supplies `pendingAssignments`: `{clientRequestId, environmentId, taskId?}` for selections already committed in its current dispatch batch that have not yet appeared in the inventory. Once T3 returns taskId, map it to the origin-qualified assignmentId and de-duplicate; remove failed/not-submitted selections. If submission is ambiguous, retain it as pending and reconcile before replacing it. The helper groups the distinct records by environmentId; it does not query T3 itself or persist counts. Missing inventory is explicitly unknown and uses only known pending records, as specified below. A host's eligibility is established before load ranking. Offline, unauthorized or incapable routes are excluded with evidence. Missing load telemetry alone never excludes a reachable otherwise eligible route.

For general/backend jobs, use the default order. For Playwright, task preference order is iosatellite followed by the default order without duplication, among hosts proven to support the requested browser mode. In balance this preference breaks ties after assignment count and load; in fallback it determines host order. Interactive authentication uses the host with the actual required session (io when required); never transfer credentials to satisfy preference.

Output stages are named `balance`, `pool-unknown`, `fallback` and `no-route`; numbered procedure steps are not stage names. Evaluate this ordered decision procedure afresh before each dispatch; there is no persistent mode switch. The approved config sets pool membership to VPS/iobox/iosatellite; names and thresholds come from that config rather than hard-coded package constants. Define load=max(cpu,RAM used). Use integer basis points (0..10000); convert valid raw fractions by rounding upward to a basis point, with exact integer threshold comparisons (5000/7500/8500). Inject evaluation time; samples older than 15000ms or from the future are unknown. Display rounding never changes a decision.

1. Establish route/capability eligibility; if empty, return no-route with reasons.
2. If any eligible pool host has measured load <=5000, enter `balance`. Among those hosts, rank by this driver's observed non-terminal assignments plus not-yet-reflected assignments in the current batch, then measured load, then task preference. De-duplicate assignment IDs so batch items already visible in T3 are not counted twice. This evenly spreads assignments within the under-50 pool without predicting task resource costs. io/iobook are excluded. Counts are not CPU/RAM estimates; other drivers and late-starting jobs remain snapshot races. If task inventory is unavailable, use caller-known batch counts, flag counts-unknown and break remaining ties by load/task order; do not stop work.
3. Otherwise, if there is at least one eligible pool host and all eligible pool loads are unknown, select by task order within that pool, with stage `pool-unknown` and reason pool-all-unknown, even if io/iobook has measured load.
4. Otherwise enter `fallback` over all eligible hosts. Select the first measured host in task order at or below its 75/85 threshold. If none qualifies, select the measured least-loaded host, ties by task order. If nothing is measured, select by eligible task order with unknown telemetry flagged. Report pool-partly-unknown when relevant; do not claim unknown hosts exceeded 50%. An empty eligible pool is distinct from an all-unknown pool and permits a personal host with the actual capability/route exclusion reasons.

Required task capabilities override soft preferences. The author-local-only route may leave only the driver eligible, even if that is io/iobook. Stage and reason must expose that limitation.

No CPU/RAM-based hold, automatic migration, personal-use/GPU gate or invented emergency ceiling. If no executable route exists, return an explicit no-route result and its reasons; do not claim dispatch succeeded.

### F2 — Small Bun interface

Illustrative usage: `bun <installed-axstack>/scripts/fleet-route.js recommend --task playwright --input snapshot.json --now <epoch-ms> --json`; `bun <installed-axstack>/scripts/fleet-route.js sample --fleet fleet.json --json`. Package this helper with the skill beside dispatch-plan.js; keep the installation-only bin/axstack.js boundary unchanged.

Use Bun >=1.3.14 with no runtime dependencies. Separate read-only sampling from a pure recommendation function. A convenience invocation may collect and recommend so the caller performs one pre-dispatch command. Support --help, bounded network timeouts and machine-readable JSON.

Output includes schema version, selected host/environment/project/route, stage, reason, sample age and CPU/RAM, assignment counts/provenance, eligible/excluded hosts with reasons, and overload/unknown flags. Support an explicit excluded-host/route map with reasons; after an unambiguous failed launch the driver re-runs with the failed route excluded, retaining permission boundaries. Pure recommend has no ambient clock, network or filesystem writes: the same canonical input and injected time yield byte-identical JSON. Unknown schema versions fail explicitly. A recommendation grants no execution permission. It does not launch agents, mutate links, fetch repositories, reserve capacity or keep state between calls.

Stamp samples on the collecting driver host when received, using its clock for freshness; remote wall clocks do not determine freshness. Record collection duration and reject timed-out collections. Sample Linux CPU from two /proc/stat reads and RAM from MemAvailable/total. CPU represents busy utilization including steal time and excludes guest double-counting. Validate samples and mark stale (>15 seconds), failed, missing or inconsistent samples unknown. Use local reads on the current host and bounded read-only SSH on other hosts; native T3 telemetry may replace this only if a supported authenticated callable API is proven.

Read-only SSH telemetry is a data collection path, not a fallback agent runtime. Exact sample interval and timeout are implementation choices recorded in --help and tested.

Call immediately before each dispatch. Report sample ages and acknowledge concurrent dispatch races; do not invent per-role CPU/RAM costs or claim reserved capacity. Batch projected CPU/RAM costs are deferred; caller-supplied observed assignment counts distribute `balance` work across all suitable workers at or below 50%. Refresh load and task observations between dispatches; snapshots do not reserve capacity. This does not promise perfect load distribution.

### F3 — T3-first execution

Extend dispatch-plan and its configuration verification to bind environmentId/projectId and the destination capabilities snapshot to the recommendation. Axstack consumes the recommendation and explicitly targets the selected environment/project. Keep the configured model/provider/options and one writer per candidate. Each host may originate work on another; replace contradictory io-control-center-only, worker-only/no-cross-host and iobook-no-work restrictions. Native UI balancing does not override an explicit worker environmentId.

Use T3 linked environments for agent execution. SSH is allowed for authorized telemetry and evidence/commit transport. Any last-resort SSH execution route must still use supported T3 orchestration with equivalent tracking and effective settings; until proven, report it unsupported and choose another supported route. Never run raw provider CLIs as hidden workers or use SSH to bypass a denial.

A timeout after possible submission requires reconciling the exact attempt before retry. Unknown liveness is not permission to launch a duplicate. No new task-owned repeating timer is introduced.

All remote roles use a receipt containing origin task identity plus remoteChild.environmentId/threadId/runId; local childThreadId may be null. Preserve recommendation JSON in that receipt and verify terminal state on the correct host. Host-qualified evidence and exact candidate/base retrieval apply from the first read-only rollout, not only authors.

### F4 — Isolated authors and remote receipts

Direct remote `delegate_task` with worktree isolation is ineligible on v0.1.5. Local isolated delegation remains a supported fallback even if the local host exceeds its threshold.

Investigate a narrow remote coordinator: origin delegates to the target project; the coordinator receives explicit scope to delegate one local isolated author using the pinned base and exact model/options. It never writes source in the project root, publishes a PR, changes global settings or recursively routes across hosts. All descendants remain tracked by T3. The route is off by default and enabled per directed origin/target pair only with version-bound evidence. A T3 or Axstack version change at either end invalidates enablement until reverified. A bounded owned pilot is included; do not enable this route for production work until its design and lifecycle checks pass.

Pilot gates and limits:

- Before the coordinator pilot, prove harmless remote delegation and target-host local isolation
- Pilot must prove isolated checkout and pinned base, parent completion after nested completion, cancellation propagation, questions/approvals visibility, same-author repair completion wake, effective access/model/options, and candidate/evidence retrieval without duplicate writers
- Initial completion must reach the origin after the nested author settles and identify the candidate/evidence
- A post-completion repair must reach the same author/checkout/branch, return a newer bound run/candidate receipt and wake the origin; the original receipt cannot satisfy it
- A blocking question must reach its decision owner, receive an authorized answer on the exact pending request and resume the author
- Approval visibility alone is not approval authority
- Cancellation must stop coordinator, nested writer and pending follow-ups; an unconfirmed remote stop retains unknown liveness and prevents replacement
- Record nested task/thread/run IDs, and test disconnected cancellation only in owned test contexts
- Also prove nested failures propagate as failures, coordinator loss does not conceal an orphaned author, target project root HEAD/status/refs are unchanged by the coordinator, retrieved candidate/base match the receipt, and host-qualified retirement cleans only owned remote resources
- A target base unavailable without root mutation makes that pilot attempt ineligible until separately provisioned within scope
- Pilot outcome is enabled or disabled with failing gates recorded
- No remote top-level fallback unless the user separately explicitly requests the new thread and the driver reports it
- If an unresolved pilot constraint requires different authority or ownership, report it rather than silently changing the contract.

Receipts carry origin task ID, remote environment/thread/run IDs, host-qualified checkout/evidence paths and candidate SHA. Driver reads terminal state, retrieves exact candidate/evidence and owns publication, PR links and watches. Remote paths are not assumed locally readable. Remote reviewers require disposable checkouts on their execution host with pinned candidate/base. The driver creates and retires those owned detached checkouts over SSH within the assigned evidence/worktree scope; this is bounded workspace preparation, not an SSH agent runtime. The reviewer reads that checkout and never creates a second writer.

### F5 — Integration and fleet rollout

Put the global routing reference inside the installer-managed Axstack instruction block, preserving install/uninstall ownership. Update shared Axstack dispatch/runtime guidance and reference it from canonical global AGENTS.md/CLAUDE.md sources, including Haoshoku where applicable. Preserve unrelated live customization; inspect differences before syncing. State T3 UI placement and worker placement separately. Apply the CLI hook to delegated workers/reviewers and any explicitly authorized agent-launched driver; it grants no new top-level launch authority.

Update standing release/install/verify host lists to all five hosts, including iosatellite, and verify its existing timer wiring without assuming timers exist. Deploy the approved Haoshoku fleet-routing.json source revision to all five accounts, verify schema and identical content SHA-256, and bind that digest to every recommendation. Reject a mismatch with the run-pinned config digest explicitly and use only an existing supported local fallback until reconciled. Install and verify on all five hosts, including iosatellite. Reconcile existing directed links before completing the authorized mesh; verify each directed edge with harmless T3 reads, do not assume reverse links. Report expiring links and live client native-balancer state without disabling native balancing. Do not recreate the deleted continuation schedule.

Keep backups of changed instructions/configuration; rollback restores only this change. CLI or integration failure must be explicit and fall back to existing supported local dispatch where feasible, not silently skip work. Missing capability remains a real limitation.

### F6 — Verification

Extend the existing .agents/skills/verify-axstack through axstack-verify for offline selector, sampler-parser, CLI/packaging and instruction integration checks. Do not mix fleet credentials or live networking into its isolated recipe. Add skills/axstack/references/fleet-verification.md as a separate reproducible live fleet procedure for link reachability, telemetry and harmless remote delegation; add author lifecycle gates from F4 before enabling remote authors. Link it from verify-axstack uncovered surfaces. Maintain it with shipped runtime documentation and rerun affected coverage on routing releases, T3 version changes and link changes. Include owned fixtures, exact actions, observable success/failure, evidence collection and cleanup. Record version-bound evidence.

Deterministic fixtures cover CPU-only and RAM-only pressure, 50% stage transition and return, pool exclusions, unequal loads, three-dispatch spread at unequal loads 20/35/40 with equal starting counts, task-count de-duplication, missing inventory, offline/unknown pool behavior, 75/85 boundaries, host/task order, all-overloaded/ties, stale/unknown/malformed telemetry, missing capability, unsupported isolation and no route. Explicit backend fixture oracles: all three eligible workers unknown and io at 20% selects VPS with uncertainty; VPS at 60%, iobox unknown, iosatellite offline and io at 20% selects VPS under `fallback`; no eligible worker and eligible io at 20% selects io with the worker-exclusion reasons. Additional binding fixtures: unknown capability; project-missing; malformed/unknown schema; excluded-route retry after unambiguous failure; target capability snapshot mismatch; null local childThreadId with remoteChild; Playwright preference versus balance ranking; local-only authors on io/iobook; injected-clock and precision determinism; missing/config-digest mismatch; and remote-clock skew with collector timestamps. For three eligible workers at 20/35/40% with equal initial counts, three sequential assignments with unchanged load and updated batch counts must select one assignment per pool host. Simulate overload rather than stressing user machines. Integration checks verify no CLI dispatch side effect and no credentials in logs.

Real target acceptance: directed telemetry checks from every origin to every target; supported directed links; a version-bound coverage matrix and harmless dispatch for every materially distinct enabled execution configuration, with exact settings/project/capability evidence; exclude unverified routes, justify equivalence reuse, demonstrate requested browser mode; local author isolation; every F4 gate before remote-author enablement; exact installed CLI/skill revisions and canonical global instructions across all five; identical fleet-routing.json digest/schema on all five and recommendation binding to that digest; iosatellite real closed-lid job/SSH/T3 proof before advertising closed-lid/unattended capability; absent that proof, reachable attended execution remains separately eligible and the host is not categorically removed from the pool; a driver-level recommendation-to-target-to-receipt trace; a harmless multi-dispatch spread check; helper-failure local fallback and rollback rehearsal on one owned target; native-balancer client state and link expiry reporting. Expired links are ineligible; do not claim renewal automation exists. Mark unmet acceptance explicitly, never infer live behavior from source/tests alone.

## Design

Usage: one pre-dispatch CLI call returns a host, route and explanation.
Shape: fleet facts -> bounded sampler -> pure selector -> JSON -> Axstack driver -> explicit T3 dispatch -> host-qualified receipt.
Binding: F1-F6 are intended requirements; sample command spelling is illustrative.
Flow + failure: SSH sample timeout -> unknown telemetry -> other measured host or preferred eligible unknown host; remote isolation unsupported -> eligible local author route with explicit reason.
We accept: snapshot races and conservative author fallback for a stateless small tool and preserved T3 ownership.
Rejected: native weights as worker policy; untracked SSH agents; top-level threads as routine delegated-worker fallback; guessed role costs; custom monitor/reservation scheduler.
Open: remote coordinator pilot/lifecycle feasibility, canonical instruction source reconciliation, spec store confirmation. These do not reopen placement choices.

## Evidence and decisions

User decisions: evidence/fleet-align/settled-20261030.md, Q1/Q2 answered. Native source analysis: native-load-balancer.md (historical disable recommendation superseded).
Astra/Opus delta reports accepted preferences. Driver accepts eligibility/receipt/SSH boundaries and investigating the relay; rejects claiming it already works. Rejects speculative per-role projected load without measurements. Existing verify-axstack was found after Astra's first recommendation; reuse it plus separate live coverage rather than duplicate its offline recipe.
Live 2026-10-30 check: this VPS currently lists only iosatellite, reachable full-access, expires 2026-11-28. Other origin links must be reconciled. No new runtime tests or configuration mutations in this drafting step.
Revision history: r2 adds user-requested worker-pool balancing up to 50%, and tightens lifecycle/route-coverage acceptance from Astra r1. Opus r1 cancellation requested because policy changed. r3 fixes Astra r2 M1 with explicit all-unknown-worker precedence and three fixture oracles. Astra accepted the other r2 requirements. Opus r2 completed; its findings are incorporated in r4 as recorded below. r3 is a driver repair of a bounded finding, not a newly approved baseline; no extra review launched for this small correction. Diligence r4 returned FINDINGS; driver repairs recorded below. Approval: pending.

## r4 driver dispositions
Opus r2 capability provenance, explicit exclusions/clock/precision, packaging, remote receipt, lifecycle and coverage findings accepted and applied. Astra r2 unknown precedence fix retained. For fairness, reject a 10-point tie band as insufficient for the concrete 20/35/40 counterexample: all suitable <=50% workers compete by observed assignment count first, then measured load/task preference. This follows the user's even-spread requirement and changes only the earlier driver-invented least-load heuristic, not a user-settled preference. No fictional resource costs or global scheduler. Add fixtures for unknown capability/project missing, schema errors, exclusion retry, target snapshot mismatch, null local child ID, Playwright preference versus balancing, local-only authors on personal hosts and clock/precision determinism. r4 is unapproved; prior reviews are evidence, not approval of these revised bytes.

## r5 bounded diligence repairs
M1: stage names are explicit and consistent. M2: driver owns inventory collection; helper receives host-qualified assignment records, pending submission mapping, de-duplication and provenance. Low findings: counts-first tradeoff moved to brief, task-preference precedence clarified, old host-role cleanup named, explicit new-thread authority retained, SSH fallback limitation surfaced, unattended proof separated from attended eligibility, and pilot gates split for readability. No placement preference changed. No extra review dispatched for these bounded repairs. Opus r4 reconciliation is still pending; its receipt will be assessed against this delta.

## r6 bounded reconciliation repairs
Opus r4 B1: canonical Haoshoku configs/fleet-routing.json, per-account deployed path, Axat ownership, data-driven policy, five-host deployment and digest checks now binding in F1/F5/F6. B2: all specified fixtures and the explicit three-assignment oracle are now in F6. Collector-clock timestamps and driver-owned remote reviewer checkout preparation clarified. Stage/count repairs from r5 retained. Driver fixed these bounded findings directly without an extra review dispatch. Adviser receipts cover r4 and remain recorded as such; r5/r6 repairs are driver dispositions, not fabricated fresh adviser acceptance. No implementation, live config deployment or user approval occurred.
