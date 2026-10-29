# Fleet routing execution map

Approved spec: r6, `docs/specs/fleet-routing.md` at `8912084d`, SHA-256 `afaca25c5bac070aeb38e0e81c2be1a7166521cb62acd86bae477e068c0563f7`.
Approval: Axat answered “let's go” to the r6 implementation/store checkpoint. Exact approved bytes retain historical draft/pending labels; this record establishes approval without rewriting the snapshot.
Store: repository Markdown, axatbhardwaj/axstack. Haoshoku changes form a dependent capability in axatbhardwaj/haoshoku.
Owner: originating T3 driver `1ac64f7f-58aa-42f4-a68c-f8c8916203f1`; any transfer requires explicit acceptance. Authors receive T3-owned isolated worktrees; never shell-created author worktrees.
State: mapped; map diligence pending. Source base: Axstack `7879335ca4ca2d66ea2f10a5d97885188a5e100d`. No source implementation yet.

## C1 — Predictable worker recommendations

Tasks: C1a pure selector/config and assignment schema; C1b packaged Bun command interface and destination binding in dispatch-plan. One writer per candidate; dependent slices start from reviewed predecessor.
Theme: turn supplied facts into deterministic placement; approximate size medium, coherent commits around 200 lines.
Acceptance: F1 complete ordered procedure including capability-before-load, balance/pool-unknown/fallback/no-route, config-driven pool/task orders and thresholds; all-overloaded continues; CPU/RAM only; no migration.
Acceptance: assignment identity, remote host mapping, coordinator de-duplication, pending batch mapping, unknown-inventory behavior, excluded-route retry, fixed precision, injected clock and stable JSON from F1/F2.
Acceptance: F2 --help, strict schema errors, explicit result/provenance/reasons and no dispatch/config/credential side effects; generic public package with synthetic fixtures only; recommendation binds config digest and destination facts.
Acceptance: every F6 deterministic fixture, including 20/35/40 one-per-host oracle, unknown/empty/mixed pool, exact boundaries, project/capability unproven, Playwright precedence, local-only author on personal hosts, target mismatch, null child ID and unknown schema.
Verification: extend verify-axstack existing offline recipes in the same PR, red/green behavioral checks; no duplicate verification skill. Preserve installation-only bin contract.
Depends: approved spec + accepted map.

## C2 — Bounded live telemetry collection

Task: sampler and one-command sample/recommend convenience integration with C1.
Theme: read local/SSH Linux CPU/RAM with bounded calls; approximate size medium.
Acceptance: F2 two-sample CPU including steal and excluding guest double-counting; MemAvailable-based RAM; validation, errors, stale/future results, timeout and duration, collecting-host timestamps; no secret logging or persistent sampler state.
Acceptance: F2 uses actual SSH argument vectors/MagicDNS and existing identities; no copied secrets; pure recommend remains offline and takes saved JSON. Invocation immediately before dispatch, no invented role costs/reservations.
Verification: fixture/parser/timeout/remote-clock-skew behavior and meaningful no-side-effect checks through verify-axstack; live directed sampling remains C6.
Depends: C1.

## C3 — T3-aware dispatch and lifecycle

Tasks: C3a remote nonwriter target/receipt contract; C3b conditional isolated-author coordinator pilot/integration.
Theme: preserve execution identity and ownership across hosts; approximate size large, split by nonwriter versus conditional author capability.
Acceptance: F3 destination environment/project/model/options verification, per-target snapshots, tracked T3-first dispatch, no untracked SSH agent, supported local fallback, explicit unsupported SSH execution; submission ambiguity and no duplicate writer.
Acceptance: F3/F4 remoteChild/null childThreadId, host-qualified paths, recommendation/config evidence, terminal verification, exact candidate/base retrieval, driver-only publication/watch, remote reviewer disposable checkout ownership and retirement.
Acceptance: F4 author route off by default and pair/version-bound; local author fallback; pilot proves target local isolation, initial/nested completion, same-author repair/new run wake, questions/answer/resume, approval boundary, cancellation/failure/orphan behavior, root immutability, exact SHA retrieval and owned cleanup. A failed gate records disabled, not success.
Verification: offline receipt/config fixtures plus shipped reproducible `skills/axstack/references/fleet-verification.md`; version/route matrix; conditional route never enabled solely from source inspection. Update relevant runtime/role/cleanup instructions.
Depends: C1, C2; pilot additionally needs C5 connectivity/preflight. Nonwriter integration may precede pilot.

## C4 — Canonical personal policy and global instructions

Task: Haoshoku `configs/fleet-routing.json`, deployment wiring and managed global AGENTS.md/CLAUDE.md references, coordinated with Axstack generic runtime instructions.
Theme: one owned policy revision on every driver; approximate size medium. Use a separate Haoshoku isolated author and pinned base; preserve unrelated live differences.
Acceptance: F1/F5 Axat-owned config source; account-local deployed paths, explicit config/schema/digest failures, identical bytes all hosts, evidence-bound capabilities/pair gates, no secrets/live load in config.
Acceptance: replace conflicting io-control-center-only, no-cross-host worker and iobook-no-work rules; preserve native main-thread balancing; hook every subsequent dispatch and only explicitly authorized top-level launch. Install/uninstall ownership inside managed block.
Acceptance: all-five-host standing install/release lists including iosatellite; do not assume/create unrelated timers. Backups and scoped rollback.
Depends: C1 interface; C3 runtime contract before final integration. Config preparation can run alongside C2 after C1.

## C5 — Fleet preflight and complete directed links

Task: reconcile authorized existing fleet setup; complete missing links using supported pairing flows; preserve credentials in memory.
Theme: actual route eligibility, not policy changes; approximate size operational.
Acceptance: F5 every directed link read tested, access/expiry recorded, no reverse-link inference, destination project/base/provider/options/capabilities proven; missing project provision only within existing authority. Keep VPS T3 :8443 distinct from Executor :443.
Acceptance: verify live native-balancer client setting without disabling it; verify actual versions and all five Axstack installations; iosatellite closed-lid job + SSH/T3 proof before claiming unattended capability, with attended eligibility separate.
Acceptance: no repeated timer recreation; link renewal not invented. Access denials are reported, never bypassed.
Depends: approved spec + accepted map; can proceed independently of code. Pairing cards may require user action, not policy approval.

## C6 — Release, deploy, verify and rollback

Task: own PR review/diligence/CI/merge, release and five-host installation; execute shipped live procedure against approved routes.
Theme: prove shipped behavior end to end; approximate size operational plus release metadata.
Acceptance: F6 directed telemetry origin×target matrix, every materially distinct enabled route configuration, browser mode, local isolation and conditional author gates; exact target/model/options, host-qualified receipt and recommendation-to-dispatch trace; harmless multi-dispatch spreading.
Acceptance: identical config digest/schema and installed CLI/skill revisions/global sources all five hosts; helper failure/local fallback proof, one owned-target rollback rehearsal, link expiry/client setting receipts; no real overload stress.
Acceptance: existing verify-axstack offline coverage plus discoverable live procedure with owned fixtures/actions/results/evidence/cleanup and rerun triggers for routing/T3/link changes. Preserve unverified boundaries and exclude unsupported routes.
Acceptance: complete required tests/reviews and release workflow; never approve npm staging as agent. Keep automatic own-PR merging within standing exclusions; no completion claim before required live checks pass or explicit user disposition.
Depends: C1-C5; conditional author enabled only with C3b gates. Do not label partial remote-author delivery as complete author support.

## Tracking

All C1-C6 pending. No PRs, authors or worktrees yet. Driver records per-task source base, candidate, PR URL, review rounds and acceptance receipts in private run record. Keep capability status open until merges and checks complete. Mapping changes cannot rewrite approved requirements.
