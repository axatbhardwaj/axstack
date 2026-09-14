# Axstack migration to Orca

Status: proposed plan; implementation and host cutover are not authorized by this document.
User decision: Orca is the sole target runtime. Preserve the previous Paseo release for rollback, not as a second supported backend.
Source baseline: `3491905f8beb51eaa1b4ee12169b0da919f5d45d`.

## Architecture and scope

Axstack owns workflow policy, role choices, brief templates, evidence and installation bookkeeping. Orca owns workspaces, sessions, dispatch, messaging, settlement and scheduling. Use the installed version-matched `orchestration` and `orca-cli` skills; do not copy their command guides or build an Axstack runtime adapter, daemon or scheduler.

Keep strict TDD, one writer per candidate, independent review, exact revision receipts, `gh stack`, human merges, prompt-only escalation, model outage holds and the 24-hour watch limit. Preserve current role choices and explicit user overrides; unsupported mappings remain gaps rather than defaults.

No active Paseo session import, automatic ownership takeover, global home cleanup, credential migration, publishing, release or deployment is part of implementation. Historical specifications remain historical; add a superseding migration specification.

## Evidence and open compatibility work

- Verified in this conversation: Orca launched a Codex worker and a Claude/Fable 5.1 worker, received their `worker_done` reports, and applied settlement cleanup. Fable agreed with using Orca while retaining Axstack policy.
- Observed failure: a Claude workspace-trust prompt returned to the shell while the launch receipt still said input accepted. Acceptance is not proof of a working agent.
- A later Luna max audit launch failed at agent readiness with `codex-hooks-review-prompt`. The task never ran; startup trust and hook-review prompts need explicit failure-path coverage. This plan has advisor review but no completed independent Luna audit.
- Observed cleanup: Orca retained a settled Fable terminal with reason `user_takeover`; Axstack must respect this protection.
- Documented by the local CLI: worker-start supports explicit model/effort; automations support existing workspaces, RRULE, disabled creation, run history, prechecks and session reuse. Reuse may create a fresh session when the old terminal is gone.
- Unverified: permission-mode parity, all configured model/effort combinations, hard schedule expiry, automation model pinning, restart reconciliation, worktree isolation and Android delivery. Automation create help exposes provider but no model/effort flags. Do not claim these work from command availability alone.
- Installed Axstack guidance and this checkout differ in role schema. Inventory both and explicitly reconcile the selected current routing before freezing a spec; do not silently adopt either set of defaults.

## Proposed delivery sequence

### 1. Freeze runtime and role contracts

Inventory shipped roles, installed overrides, ownership manifests and current Axstack schedules without changing them. Define a small Axstack-owned role configuration containing provider, model, effort and supported permission intent; propose `profiles/roles.json` for packaged defaults. Install it as owned data rather than merging Paseo daemon configuration or inventing Orca native profile keys.

Pin the tested Orca capabilities/version and resolve model and permission mappings. Prototype only the unresolved boundaries in isolated fixtures or explicitly authorized temporary runtime tests. Establish whether native automations can enforce the existing expiry and exact-role constraints. A missing capability blocks that feature and full cutover; do not introduce a custom scheduler or quietly drop watch behavior.

Keep the role-data change minimal: derive it from the existing profile fields and preserve notes rather than inventing a larger configuration system. Reconcile installed overrides before proposing the final role table for spec approval.

The first timer experiment should test native RRULE `UNTIL`/`COUNT`, plus handling of a tick still running at expiry and cleanup after a missed final tick. RRULE support alone does not prove these semantics. Inspect documented automation configuration for model/effort support; do not guess fields in `source-context`. A worker reporting a model mismatch is useful detection, but does not prove prevention of an unintended-model launch. No silent default or self-attested identity counts as exact-role parity.

Acceptance: every role has a documented mapping or named hold; timer acceptance criteria and a supported implementation path are settled before dependent production work.

### 2. Port workflow instructions

Replace the Paseo launch reference with a concise Orca integration reference that points to runtime-owned guides. Update entry, phase references, lifecycle, run records, watches and notifications.

Map run/task/dispatch IDs and actual agent handles into existing evidence records. Use structured completion, FIFO delivery acknowledgment and explicit release/retention. Distinguish supervised work from full handoff; input acceptance alone never grants Axstack ownership transfer. Reconcile old and new owner acceptance explicitly. Run records remain derived progress, not a duplicate runtime database.

Acceptance: behavioral scenarios cover same-author repair, independent reviewers, unavailable models, uncertain launch, duplicate completion, user takeover, interrupted coordinator, explicit handoff and changed-parent evidence invalidation.

### 3. Port installer and package

Update `bin/`, `src/`, profile assets and installer tests to install Axstack skills plus role data, check Orca CLI/runtime/required guides and stop requiring Paseo. Retain Bun, dependency constraints, ownership hashes, edited-file protection, idempotence and temporary-home tests.

Define old-manifest upgrade behavior explicitly: preserve unrelated data and live Paseo configuration; never reinterpret old profile hashes as new role ownership. Reject obsolete flags with actionable guidance. Legacy removal is a separate documented cutover step using ownership-aware tooling.

Acceptance: clean install, repeat install, old-manifest upgrade, edited assets, interrupted install and uninstall all preserve unrelated fixtures. Packed CLI works from a neutral directory and has no active Paseo dependency.

### 4. Port watches and prove the lifecycle

Use native Orca automations only after step 1 establishes the mapping. Keep monitor and watchdog responsibilities distinct, bind schedules to run/host identity, record expiry and actual run receipts, and distinguish schedule firing from delivery and work advancement. Fresh-session fallback must reconcile ownership rather than become a replacement owner.

Acceptance: bounded live tests cover a pinned role, scheduled firing, deadline expiry, restart, missed runs, duplicate ticks, user takeover, cancellation and no remaining task-owned active timers. Android notifications and reply delivery require separate observed evidence.

### 5. Review, document and cut over

Update README, installation/workflow guides and compatibility claims from evidence. Preserve historical docs with clear supersession. Run strict behavioral red/green for changed behavior, installer tests, package smoke and independent exact-revision review. Do not describe parser checks as agent behavior proof.

Deliver coherent PRs via `gh stack`, around 200-line commits where practical. Suggested stack: role/installer contract; core workflow port; watch/recovery integration and final compatibility docs. Final PR grouping follows measured diff size. Steps 2 and 3 may proceed in parallel after their shared asset contract is frozen; step 4 depends on both.

After human merge and separate release/cutover authorization: back up owned configuration, finish or explicitly hand off active Paseo work, stop only identified Axstack-owned Paseo timers, install the reviewed Orca release, verify effective roles and run one small end-to-end task. Never run both runtimes as owners of the same work. Rollback restores the prior release and selected saved configuration only after Orca-owned work and timers are reconciled.

## Preparation boundary

This is substantial work spanning installer and workflow contracts. Next: settle compatibility findings, obtain approval of a superseding specification, and map implementation tasks to that exact revision. Planning creates no implementation workers, production schedules, PRs or host configuration changes.

## Advisor assessment

Fable 5.1 reviewed the concrete plan and returned AGREE with corrections. The driver accepted the minimal role-data conversion and concrete RRULE expiry experiment. The driver retained the model-pinning hold: after-launch self-verification cannot replace reliable launch configuration, and ownership prechecks must not turn into an unapproved Axstack runtime engine. These are proposed verification paths, not measured compatibility results.
