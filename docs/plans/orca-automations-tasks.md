# Orca PR automations — capability and task map

Spec: `docs/specs/orca-automations.md` rev 32304f4 (approved 2026-09-16).
Store: repository Markdown (this file). Run record:
`20260915-orca-pr-automation-align`. All PRs target `main`; the human merges.

## C1 — Skills execute the automation contract

Capability: installed Axstack skills load a consistent automation contract
(watch hold lifted, automations reference, review COMMENT branch and
escalation field, gated fast-forward repair, review-skill exception sections).

- Internal task T1: PR #38 (rev 656890e content) -> Opus author (released),
  worktree `orca-automations-skills`. Theme: skill alignment. Size est: target
  band (docs + JSON notes). Acceptance: spec §Purpose same-change list for the
  five hold locations and presets; `references/automations.md` has four
  criteria and both tokens; review skill has COMMENT branch and escalation
  field; scenario corpus passes. Depends: none. State: **In Review** (Sol
  authored review in progress).
- Internal task T2: rev-2 deltas on top of #38 -> Opus author, same worktree
  (stacked on #38 or folded after review). Theme: rev-2 contract deltas.
  Size est: target band. Acceptance: review skill Standalone-owner and
  Authorized-submission exception text; repair-publication fast-forward
  wording; workflows.md `gh stack` exception; automations reference gains
  record-only outside allowlist, due-control-work wake, watchdog-owned health
  send + `watchdog.json`, observed-fingerprint promotion, per-PR event state,
  effective-identity inspection, mention-as-request rule, limit rule.
  Depends: T1 verdict.

## C2 — Installer removes pristine stale owned files

Capability: reinstalling never leaves a retired owned file behind when it is
pristine; edited or missing stale files are preserved and reported.

- Internal task T3: PR #37 -> opencode author, worktree
  `installer-stale-cleanup`. Theme: installer stale handling. Size est: target
  band. Acceptance: pre-mutation stale plan (unsafe stale path => zero target
  mutations); rollback restores bytes and mode; `docs/specs/v1.md` amended;
  refreshed Sol + Opus peer receipts at the new head. Depends: none. State:
  **In Review** (repair in progress after REQUEST_CHANGES x2).

## C3 — Release and install

Capability: v0.6.5 carries C1 and C2 and is installed on local and VPS.

- Internal task T4: release PR + tag + assets -> Opus worker, new worktree.
  Theme: release. Size est: small. Acceptance: `gh release view v0.6.5` shows
  tarball + SHA256SUMS; `axstack --version` prints 0.6.5. Depends: T2, T3
  merged.
- Internal task T5: install both local and both VPS skills dirs from the
  checksum-verified tarball; verify `references/automations.md` present and 17
  roles. Depends: T4.

## C4 — VPS automations verified and enabled

Capability: driver (5 min) and watchdog (hourly) run on the VPS per spec.

- Internal task T6: precheck rev 2 -> current chat, VPS run directory. Theme:
  precheck. Acceptance: spec acceptance 2 (all seven exit conditions). Depends:
  none (shell only). State: partially done (rev 1 passed the original three
  conditions).
- Internal task T7: driver and watchdog prompts updated to rev 2 (record-only,
  due work, watchdog send, effective identity) -> current chat via
  `orca automations edit`. Depends: T5 (prompts reference installed
  reference).
- Internal task T8: acceptance 3–8 manual runs -> current chat with role
  dispatches. Acceptance: spec acceptance 3, 4, 5, 6, 7, 8 each with evidence
  in the run record. Depends: T6, T7.
- Internal task T9: enable both automations -> current chat; user confirms.
  Depends: T8.

## C5 — Run audit

- Internal task T10: `axstack-auditor` (Luna max) end-of-run audit of the
  evidence above. Depends: T9.

## Dependency order

T1 -> T2 -> (T3 parallel) -> T4 -> T5 -> T7 -> T8 -> T9 -> T10; T6 parallel
from now.
