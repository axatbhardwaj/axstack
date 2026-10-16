# Stable T3 and Omarchy palette task map

Approved spec: `docs/specs/t3-stable-omarchy-theme.md`, r2, SHA-256
`a4ebe6cbdd59e99e603458db31620dc3a550efe26b5f6fac7c2b09e38a7845ee`.
User approved in T3 driver `576a5ed9-ba4e-4294-ab55-43bfa03655f2` on 2026-10-16.
Store: repository Markdown; driver owns both PRs and rollout.

## A — Axstack stable prerequisite

Theme: stable T3 prerequisite and current installation guidance.
Task: source check, installer behavioral tests, docs and verify-axstack feature mapping.
Acceptance: stable >=0.1.0 passes; older/malformed/prerelease versions give actionable failures; checks do not mutate hosts; current guidance names stable; historical docs retained.
Owner: driver; one T3 author in isolated Axstack worktree.
Size estimate: small, approximately 100–200 changed lines excluding planning baseline.
Depends: none. Status: Pending.

## H — Haoshoku stable setup and palette

Theme: supported T3 stable desktop/server setup.
Task: package lists, launchers/managed primary app, CLI links, server install/update channel, fixture tests, one-time palette setup and current docs.
Acceptance: fresh setup chooses stable; proven managed nightly defaults migrate; unrelated apps/executables/preferences/provider settings survive; wrong/newer/unmanaged runtime holds rather than silent downgrade; reruns stay stable and idempotent; tailnet and single-server constraints persist.
Theme acceptance: use current Omarchy palette once, Local environment remains off; no auto-sync or Android/browser appearance change. Safe import gets its own temporary-home fixture proving preference preservation/rerun behavior; otherwise an importable palette and exact manual step remain an explicit pending checkpoint.
Owner: driver; one T3 author in isolated Haoshoku worktree based on `stable`.
Size estimate: medium, split coherent commits near 200 lines where practical.
Depends: none; owns its own stable floor. Status: Pending.

## V — Runtime verification and fleet channel migration

Task: inspect actual service/client/CLI paths, origins and channel on all four hosts; verify stable package availability and native single-owner lock; select one idle host, back up userdata, migrate and smoke-test before continuing.
Acceptance: separate CLI/running-server evidence; thread resume, Codex/Claude delegation, schedule and PR wake, desktop palette rendered and Android connectivity. Keep unknown checks pending. No second server, broad system upgrade or unrelated config mutation. Current driver host goes last with safe continuation or an explicit held step; don't interrupt active runs.
Owner: driver. Size estimate: bounded operational runbook/evidence.
Depends: A and H reviewed; code proof before host changes. Status: Pending.

## R — Releases, installation and close-out

Task: reviewed release PRs, tags, publication, narrow reinstall on io, iobook, iobox and axat-vps; exact version/readback checks.
Acceptance: both feature PRs merged; publish verified; Axstack installed only after T3 floor met; Haoshoku narrow changes applied and verified; human npm stage approval remains a checkpoint; no unverified host is Done. Preserve backup and verification evidence, settle workers and close owned watches.
Authority: r2 approval grants T3 migration, Haoshoku release/install and one-time theme application; Axstack standing release/install also applies.
Owner: driver. Size estimate: release metadata plus operational evidence.
Depends: A, H and V; npm approval where required. Status: Pending.

## Shared acceptance constraints (apply to A/H/V/R)

- A and H each require meaningful Bun behavioral red/green evidence using temporary homes; H extends workspaces/primary-app, install_user_scripts, configure_axstack, t3_tailscale/configure_tailscale_t3, configure_t3_code_server and t3_desktop_preflight fixtures, explicitly including wrong channel and failed setup. Its scope includes Super+T and Debian installation. Both advisers agreed no separate verify-haoshoku skill is needed.
- Both PRs require cross-provider authored review and diligence, no human review requests, and merge only under the standing watch predicate. Keep automatic worktree cleanup disabled.
- Preserve the current Omarchy theme and unrelated preferences. Add no runtime, scheduler, daemon, palette converter or state store; never create a second server for theme setup. A missing supported client theme path blocks the theme slice; the manual import checkpoint applies only when a supported import exists but safe automation is unavailable.
- V uses existing supported install paths and channel controls, installed-package/CLI smoke checks, and Playwright for a real stable desktop where available. Retain explicit evidence if desktop-specific appearance cannot be proved. Report source and live verification separately.
- Inspect the phone version; human Android verification may remain a named checkpoint. A newer-than-stable running build or failed smoke check holds its host. The current driver is on axat-vps, so doing it last implements the listed fleet order and active-run preservation, not a changed order.
