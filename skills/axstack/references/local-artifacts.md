# Local non-repository artifacts

Research, Explain and Publish may use an explicitly bound non-repository
artifact scope. Null repository identity alone never authorizes a route.
Engineering authors and code reviewers still require a repository and native
Git worktree isolation. Remote artifacts and remote author/coordinator work
remain outside this scope.

## Scope and ownership

Use `request.scope` below with `repositoryId:null` and `role:reader`.
Here reader means no product-code authority; an explainer may write only its
owned article artifacts. `task` remains a load preference, not role authority.
The scope is evidence for the helpers and brief, never a native T3 argument.

```json
{
  "kind": "local-artifact",
  "workflow": "explain",
  "roleId": "axstack-explainer",
  "environmentId": "<current environment>",
  "projectId": "<actual parent project>",
  "workspaceRoot": "/scratch",
  "artifactRoot": "/scratch/run/artifacts/author-a1",
  "evidenceRoot": "/scratch/run/evidence/author-a1",
  "reservedRoots": ["/scratch/run/artifacts/other-attempt"]
}
```

`workflow` is research, explain or publish. All three permit the configured
research requirements/code/code-sol/web/web-sol/X and explore-execution/
explore-execution-sol source roles plus diligence. Explain and Publish also
permit explainer, explainer-review and the configured UI verifier roles.
Use their full `axstack-` role IDs; this list does not make an absent seat
available or change provider/model/effort/options/runtime authority.
The selected role ID must equal scope.roleId in dispatch-plan.
No engineering author, code reviewer, owner or arbitrary role can use this scope.

The driver binds the native parent project and its real workspaceRoot. Require
explicit null repositoryIdentity in both project-read and complete project-list
reads; omitted, conflicting or incomplete observations hold. Native environment,
project, catalog, provider restrictions, options, runtime and access checks still
apply. Use only a local route in that environment/project/workspace. Do not
fabricate a repository ID, initialize Git or attach an unrelated repository.

Give every attempt separate owned artifact and evidence directories, strict
children of the observed workspaceRoot. They must be canonical absolute paths,
with no traversal, shared-root writes or ancestor/equal overlap. `reservedRoots`
is the driver's current list of other attempts' owned artifact/evidence roots;
include pending and retained attempts, never guess an empty inventory.
The helper checks lexical paths and overlaps; the driver must independently
verify real paths, no symlink escapes, ownership and exclusive writers on disk.
Unknown ownership holds. This is supplied evidence, not an authenticated lock.

## Native dispatch and review

Use async native `delegate_task` with `isolation:"shared"`, exact local target,
role-labelled title and stable clientRequestId. Native local projectId must equal
the parent's project; moving to another local project is unsupported. Preserve
requested arguments and native effective settings separately. Dispatch-plan
requires nativeDestination and `--kind task`; it returns artifactScope as evidence
and shared isolation. Copy only supported native arguments into delegate_task.
No top-level launch, shell checkout, live policy edit or per-run bypass is needed.

Research branches keep independent first passes and cited-source reopening.
Diligence reopens answer-changing claims; it never becomes the article author.
The explainer remains sole source writer. Reviewers/verifiers get their own
byte-identical snapshot in their owned artifact directory; their reports/probes
stay in their separate evidence directory and never edit the author's original.
Independent explainer review checks the exact SHA-256 bytes. Before public
publication require Playwright layout/interaction evidence and independent
source/fact and design review of those same bytes under Explain/Publish rules.
Changed bytes invalidate affected reviews and renders; unknown proof holds.
Shared filesystem access does not permit cross-reading independent first passes.
Publication remains the explicitly authorized driver's action.

## Receipts

Retain the normal native task/thread/run, pending-question and settings checks.
For artifact receipts, `attempt.candidate` and marker `head` are the exact
64-hex artifact SHA-256; `attempt.base` is null. They are not Git revisions.
Bind `artifactScope` to the requested scope and report to evidenceRoot.
Supply `artifact:{path,sha256,readback:{path,sha256,evidence}}` for the independently
hashed owned snapshot. Requested isolation must be shared. Native child worktreePath may be null;
on T3 0.1.5 it may also inherit the parent's non-Git scratch path. For the latter,
include `parent` as a saved `t3_thread_read` observation (tool, environmentId,
args.threadId, observedAt, evidence, value.thread). Bind it to the attempt's
origin thread, selected project, child parentThreadId/subagent relationship and
identical canonical path inside workspaceRoot. Verify the actual filesystem;
this is shared access, not a Git checkout or OS isolation. Checkout metadata
remains forbidden. Unknown or different parent/path evidence holds.

T3 0.1.5 deduplicates local task results: latestTerminalSummary can be null when
summary contains the same result. For local artifact receipts only, use that
summary when childRunId and latestTerminalRunId both equal the current completed
run and its bytes equal the destination final message. An explicit conflicting
terminal summary, stale run, other version or remote result does not use this
fallback. Preserve the raw native fields; do not rewrite them. Never synthesize an effective field from requested settings.
The driver checks actual bytes and readbacks; helpers validate saved data only.
Keep artifact receipts separate from Git candidate publication/PR/merge receipts.
