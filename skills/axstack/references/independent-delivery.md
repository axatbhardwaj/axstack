# Independent delivery

Apply this contract during Spec, Tickets and Implement within the accepted
scope identity. Keep the existing spec, ticket map or small-change intent as
the record; this adds neither a planning artifact nor execution authority.

## Plan outcomes and boundaries

Spec must name independently deliverable outcomes, their acceptance checks,
and produced and consumed interfaces. An outcome is independently deliverable
when its accepted result can be verified and delivered without waiting for an
unrelated outcome. Shared files, interfaces, release targets and other scarce
resources can still constrain execution.

Tickets must map each outcome to an accountable scope driver marked accepted
or proposed, write and resource boundaries, dependency milestones, and evidence
with invalidation conditions. Record what a consumer actually needs: for
example an accepted immutable interface, a versioned artifact, an exact
reviewed code revision, or a merged change. Choose the sufficient milestone
from acceptance and integration needs rather than requiring every producer to
be reviewed or merged. Mapping can leave actual SHAs unresolved until execution.

Default to separate accountable scope drivers for independent outcomes when
explicitly authorized and supported by the runtime. Tasks within an accepted
scope remain native delegates of its accountable driver. Reuse accepted owners
and current attempts before proposing new drivers. Follow
[Coordinating multiple drivers](t3-runtime.md#coordinating-multiple-drivers)
for project binding, acceptance handbacks, record ownership and launch rules.

Planning never grants launch permission or execution authority. Missing
new-driver launch permission holds only that launch, subject to dependency and
scoped-hold rules. The existing driver can progress only work already inside
its accepted authority. A proposed scope driver is a plan entry, not an
accepted owner. Preserve existing owners until an explicit accepted transfer
under [Lifecycle](lifecycle.md#native-handoff-and-resume).

## Admit and reconcile during execution

During Implement, admit newly discovered independent outcomes through the same
scope, interface and dependency map. Reuse the accepted scope where it covers
the work; materially changed scope follows the existing approval boundary.
Before dispatch, reconcile semantic and write conflicts, milestone and
revision evidence, ownership and current attempts, writer exclusivity and
capacity with native and forge state. Separate worktrees never prove semantic
independence. Queue conflicting work or resolve its boundaries before dispatch;
keep one writer per candidate and record. Driver separation alone grants no
additional capacity or routing authority.

Use main or the recorded integration target as the branch base unless a genuine
unfinished code predecessor requires its exact reviewed revision. An artifact-only
dependency can be satisfied by an accepted immutable interface or artifact
milestone without Git ancestry. Follow [PR chains](pr-chain.md) for actual code
ancestry, reviewed-parent branching, child invalidation and base updates.

Bind each consumed milestone to actual current evidence at execution, including
the producer revision or immutable artifact identity, receipt and acceptance
state. Unknown or stale dependency evidence holds affected consumers until
reconciled. When a producer revision changes, invalidate affected consumer
evidence and revalidate those consumers while unrelated scopes progress.
Keep artifact identities and code revisions distinct when determining which
consumers are affected. A planned dependency or completion message alone is
insufficient execution evidence.

Follow [Lifecycle receipts](lifecycle.md#receipts-bind-each-decision-to-evidence)
for current-attempt completion and advancement, [Autopilot](autopilot.md#advance-and-hold)
for scoped and run-wide holds, and [Implement](../../axstack-implement/SKILL.md)
for dispatch, review and delivery gates. This contract changes none of their
ownership, serial preflight, capacity, hold, merge or completion requirements.
