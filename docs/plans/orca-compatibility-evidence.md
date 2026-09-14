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
