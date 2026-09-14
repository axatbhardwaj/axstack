# Orca migration compatibility evidence

Scope: implementation preparation and bounded runtime exercises, 2026-09-14. No full migration/cutover claim.

## Verified runtime exercises

- Codex and Claude/Fable workers completed tasks through native Orca dispatch and `worker_done` delivery.
- Native new-worktree placement created separate author worktrees; exact handles and task/dispatch IDs were returned. This is placement evidence, not yet an isolation regression test.
- Same-terminal follow-up dispatch reused the workflow author's actual process incarnation. Structured questions were answered using the original message IDs.
- Successful workers were released through Orca. A user-taken-over terminal was preserved by Orca's cleanup protection.
- A fresh execution Run bound to this continued chat after previous-Run consumer fencing; no old coordinator identity was borrowed.

## Failures and recovery

- A workspace trust prompt caused Claude to return to its shell while the launch receipt reported input accepted. Read-only advice was retried from the already trusted workspace against absolute source paths, without editing trust configuration.
- An early Luna attempt failed at `codex-hooks-review-prompt` before executing its audit. A later native dispatch ran `gpt-5.6-luna` at max effort and returned a completed recovery/admission checkpoint audit; this is not a final candidate audit. Requested launch settings, observed provider/model, task execution and audit coverage are separate receipts.
- The old checkout contained a pre-existing zero-byte Git object. Authors paused before production edits and returned failed receipts. The driver cloned remotely, imported only healthy planning patches and verified connectivity plus the approved specification digest. The old checkout remains preserved.
- The fresh clone exposed newer upstream presets and Claude-settings ownership. Migration preparation was rebased onto `51b4765`; the preserved current-base tests passed 285, skipped 1, failed 0 before production edits.

## Native watch hold

Orca runtime reported version 1.4.199. Research inspected tag source at `28957d6004dd191b6f0baff493a9fd3d37405d9d`:

- [Automation CLI](https://github.com/stablyai/orca/blob/28957d6004dd191b6f0baff493a9fd3d37405d9d/src/cli/specs/automations.ts) exposes provider and schedule options, but no model, effort or permission selection.
- [Automation types](https://github.com/stablyai/orca/blob/28957d6004dd191b6f0baff493a9fd3d37405d9d/src/shared/automations-types.ts) and [dispatch handler](https://github.com/stablyai/orca/blob/28957d6004dd191b6f0baff493a9fd3d37405d9d/src/renderer/src/hooks/automation-dispatch-handler.ts) do not preserve the required role settings through fresh scheduled launches.
- [RRULE parser](https://github.com/stablyai/orca/blob/28957d6004dd191b6f0baff493a9fd3d37405d9d/src/shared/automation-schedule-parsing.ts) returns frequency/day/hour/minute fields and discards `UNTIL`/`COUNT`. The driver independently re-read the exact parser through GitHub's API. General RRULE support is therefore not proof of bounded firing.

No schedules were created for this investigation. A8 remains blocked on exact role pinning and bounded native scheduling. No custom Axstack scheduler or Paseo fallback is introduced. Missing-tick, restart, cancellation and active-expiry execution remain unverified. Mobile delivery also remains unverified.

## Integrated core candidate

The installer and workflow port now use the selected preset as an owned
`axstack/roles.json` snapshot. Package smoke consumes the unmodified packed
presets from a neutral directory; no fixture substitution is used for the real
package. Edited-role readiness is checked against the selected bundle's role
IDs while preserving user bytes. Review follow-ups added deterministic failure
labels and hermetic capability fixtures.

The first capability slice passed 286 tests (one skipped); the integrated
installer slice passed 256, and the full workflow candidate passed 261 with no
failures. These suites are source/package evidence, not a complete live-runtime
acceptance claim. An independent Opus evaluation of the six frozen workflow
scenarios changed from 2 PASS / 3 FAIL / 1 UNKNOWN before edits to 6 PASS after
edits. Responses were recorded before scoring; this remains a single-evaluator
qualitative simulation, not six live tasks or deterministic behavioral proof.

The native-guided unmanaged-Linux executable path was also exercised. On this
host, `orca-ide` resolves to the application launcher: its version command
returned an unknown-command error and the runtime/guide probes returned
single-instance errors. The checker reports the selected executable and keeps
this a visible setup gap. The passing managed-terminal probes do not establish
plain-shell compatibility. No fallback executable or home configuration change
was applied.

Independent final review and a final Luna audit remain delivery gates. A8 stays
held and A9 remains unverified; no release, live installation, old timer removal,
or host cutover has occurred.
