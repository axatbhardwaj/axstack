# Orca-only Axstack migration — revision 1

Status: draft execution baseline, awaiting specification approval.
Authoritative store: repository Markdown, continuing this repository's spec/plan convention and the migration plan selected in this conversation.
Source: `3491905f8beb51eaa1b4ee12169b0da919f5d45d`.
Supersedes: the Paseo runtime and installation portions of `v1.md` when approved; all unrelated workflow requirements remain in force.

## Outcome

Install and run Axstack using Orca as its only supported runtime. Axstack supplies workflow policy and role data. The installed, version-matched Orca `orchestration` and `orca-cli` skills supply runtime instructions. Do not vendor their guides or add an Axstack dispatcher, scheduler, daemon, runtime database or escalation engine.

The current user chat remains the driver. Preserve one owner per PR, one writer per candidate, strict TDD, exact-head independent review, `gh stack`, default human merge, explicit ownership acceptance, prompt-only serious-risk escalation and no model substitution. Preserve the 24-hour watch deadline.

## Role contract

Use the existing fields `id`, `provider`, `model`, `modeId`, `thinkingOptionId`, `notes` and optional display name. Package defaults in `profiles/roles.json` with a versioned role list. This is Axstack data, not an invented Orca-native configuration format. The final JSON container and installation path are frozen in T1 before parallel authors consume them.

The verified installed preset is `mixed`. Reviewer IDs become `axstack-reviewer-primary` and `axstack-reviewer-secondary`, matching installed policy. This changes names, not the Sol/Opus review pairing. The checker remains explicitly unconfigured. No new preset implementation is included in this migration.

| Role (axstack- prefix omitted) | Provider/model | Effort |
| --- | --- | --- |
| driver | codex/gpt-6-astra | low |
| advisor | claude/claude-fable-5-1 | medium |
| owner | claude/claude-opus-5 | medium |
| author | codex/gpt-5.6-sol | medium |
| reviewer-primary | codex/gpt-5.6-sol | medium |
| reviewer-secondary | claude/claude-opus-5 | medium |
| checker | codex / unset | low |
| research-requirements | claude/claude-opus-5 | medium |
| research-code | codex/gpt-5.6-sol | medium |
| research-web | claude/claude-opus-5 | low |
| explainer | claude/claude-sonnet-5 | xhigh |
| explainer-review | codex/gpt-5.6-luna | max |
| explore-codebase | claude/claude-sonnet-5 | xhigh |
| explore-execution | codex/gpt-5.6-terra | low |
| monitor | claude/claude-opus-5 | medium |
| watchdog | claude/claude-opus-5 | medium |
| auditor | codex/gpt-5.6-luna | max |

The driver row is a preference, never authority to replace the current chat. Authored review remains Sol author → Opus reviewer and Opus author → Sol reviewer. Unsupported author provenance holds final review; it never invents a mapping.

Package defaults retain conservative permission intent. Existing user overrides remain private and must not become permissive public defaults. Orca currently documents model/effort arguments but no per-dispatch permission-mode flag: verify actual supported launcher settings and effective permissions before claiming parity. Never treat a read-only prompt as a sandbox, or silently replace a configured permission mode with the runtime default.

## Installation and upgrade

The CLI continues to perform installation bookkeeping only, using Bun >=1.3.14 with the existing narrow built-in exceptions and no new runtime dependencies.

Install owned Axstack skills and role data into an explicit supported destination. Load Orca guides through capability discovery at runtime; do not install, overwrite or take ownership of Orca's skills. Preserve manifest hashes, idempotence, path/symlink checks, edited-file protection and partial-failure recovery.

`axstack check` checks the resolved Orca executable, runtime connection and required guide capabilities alongside Bun, Git and `gh stack`; report binary availability, runtime readiness and actual harness compatibility separately. Respect Orca's CLI resolution rules, including the Linux screen-reader name collision. Never auto-switch binaries after a failed resolution.

Remove active Paseo CLI and daemon-profile requirements. Reject obsolete Paseo configuration flags before writes, with migration instructions. Upgrading an old ownership manifest must preserve its provenance without treating former profile ownership as permission to write unrelated role data. Preserve unrelated configuration and all user-edited assets. Do not mutate live Paseo config during installation or tests. Historical asset cleanup is explicit and separate from the new install path.

## Runtime integration

Use native Run, Task and Dispatch identity for supervised work. Preserve actual agent/workspace handles, requested/effective launch evidence and exact revisions in the driver-owned private record. It is derived progress, not runtime authority.

An input-accepted receipt is not proof of agent readiness, task execution, intended model or completion. Detect trust prompts, hook-review prompts, model errors and exited agents without creating duplicate attempts. Recover through runtime-provided commands and preserve failed-attempt history.

Process a whole delivery before acknowledgment. Validate `worker_done` against the expected active Task and Dispatch. Reuse, retain or release settled terminals through Orca; respect `user_takeover` and runtime fencing. No borrowed terminal identity, forged sender or bypass of consumer fencing is permitted.

Distinguish supervised workers from full ownership handoffs. Orca input acceptance alone does not satisfy Axstack's ownership transfer rule: record explicit recipient acceptance before relinquishing the current owner. Ordinary resume reconciles rather than launches a handoff. Contact loss, idle state and missing status do not transfer ownership or prove exit.

## Watches and capability hold

Use native Orca automations for the existing read-only monitor (5 minutes) and watchdog (hourly), with one shared default 24-hour deadline. Persist schedule IDs, role sessions, handshake, snapshot, expiry and wake owner. Healthy ticks remain quiet; actionable events are deduplicated.

T1 must prove or explicitly rule out native model/effort pinning, permission intent and bounded firing. Start with documented automation configuration and RRULE expiry; do not guess `source-context` fields. Post-launch model self-report is not a substitute for exact-role launch control.

Test expiry while a tick is active, missed final ticks, restart, duplicate ticks and session-reuse fallback. A fallback session must reconcile ownership and cannot silently become owner. Stop registrations on expiry, cancellation, completion or relevant PR closure and verify cleanup. A firing timestamp is not delivery or advancement evidence.

If native capabilities cannot meet these requirements, hold watch activation and the complete migration claim. Core installation and supervised workflow work may continue independently. Removing watch coverage, loosening model discipline or introducing a custom runtime requires a material spec revision; it is not an implementation workaround.

## Observable acceptance

| ID | Required result and evidence |
| --- | --- |
| A1 | Temporary-home clean/repeat installation, upgrade, partial failure and uninstall preserve unrelated and user-edited assets; old flags fail before writes. |
| A2 | Packed CLI runs from a neutral directory; active package checks/guidance require Orca and no Paseo runtime. Historical references are explicitly labeled. |
| A3 | Every listed role has a preserved mapping or an explicit capability hold; unset checker never launches a provider default. |
| A4 | Live Codex and Claude tasks execute and return accepted completion receipts using pinned configured roles; unsupported model/effort and startup prompts fail visibly without fallback. |
| A5 | Separate worktrees isolate authors; fixes return to the same author; reviewer provenance and exact SHA/base are verified; changed parent invalidates affected evidence. |
| A6 | Duplicate delivery, uncertain creation, coordinator restart, user takeover and fenced authority do not duplicate writers or seize ownership; cleanup is evidenced. |
| A7 | Explicit handoff records acceptance; ordinary resume preserves the existing owner and reconciles pending work. |
| A8 | Native watches preserve role settings, cadence and expiry; restart, missed ticks, cancellation and final cleanup leave no active task-owned registrations. |
| A9 | Android completion notification and a reply are observed on the intended host/session before advertising mobile compatibility; otherwise report unverified. |
| A10 | Independent exact-revision review and Luna audit report evidence/limitations; no runtime compatibility is inferred from structural tests or requested launch arguments. |

Define meaningful behavioral checks and observe intended red before changing behavior, then green and refactor. Missing-module failures are not behavioral red. For prompt behavior, use predeclared scenarios and retain actual evaluator responses separately from parser checks. Never claim deterministic proof from agent evaluations.

## Authority and delivery

Approval authorizes bounded implementation, fixture tests, and isolated reversible Orca compatibility tests within this scope. Name and record every temporary runtime artifact and clean it up. Production schedules, host-wide settings, credentials, live session import, global cleanup and mobile pairing remain outside those tests.

Driver owns integration and forge mutations; authors stay within assigned paths and do not push, merge or publish. Use granular semantic commits and `gh stack` for dependent PRs. The old Muse quota exception is historical; implementation uses the preserved Sol author and independent Opus reviewer mapping, with Fable for consequential decisions and Luna max for audits. An unavailable role holds affected work without substitution.

Human merge remains the default. Release, host installation/cutover and removal of old Axstack-owned Paseo timers occur only under separate applicable authorization, after backup and reconciliation. Keep the prior release available for rollback. Never leave both runtimes owning the same active work.

## Approval and evidence boundary

The user selected Orca-only and asked to proceed with the proposed plan. This revision makes its acceptance criteria and remaining capability holds concrete; it awaits the specification checkpoint. The task breakdown is a draft until bound to the approved digest.

Reuse Fable's earlier AGREE only for unchanged architecture. Role-table and specification-draft review remain pending because this session's Orca coordinator binding is fenced. The earlier Luna audit failed before task execution at a hook-review prompt. No completed spec review or audit is claimed.
