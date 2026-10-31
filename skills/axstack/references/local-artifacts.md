# Local non-repository artifacts

The report-only modes in the matrix below may use an explicitly bound
non-repository artifact scope. Null repository identity alone never authorizes
a route.
Engineering authors and code reviewers still require a repository and native
Git worktree isolation. Remote artifacts and remote author/coordinator work
remain outside this scope.

## Scope and ownership

Use `request.scope` below with `repositoryId:null` and `role:reader`.
Here reader means no product-code authority. Writers may write only their owned
artifacts or reports under the selected phase contract.
`task` remains a load preference, not role authority.
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

The research, explain and publish workflows permit the configured research
requirements/code/code-sol/web/web-sol/X and explore-execution/
explore-execution-sol source roles plus diligence. Explain and Publish also
permit explainer, explainer-review and the configured UI verifier roles.
Use their full `axstack-` role IDs; this list does not make an absent seat
available or change provider/model/effort/options/runtime authority.
The selected role ID must equal scope.roleId in dispatch-plan.
No engineering author, code reviewer, owner or arbitrary role can use this scope.

Brainstorm permits only candidate seats Astra (`axstack-advisor-astra`),
Opus (`axstack-advisor-opus`), Grok (`axstack-arena-candidate-grok`) and judge
seats Opus (`axstack-arena-judge-opus`), Fable (`axstack-escalation-fable`), Astra
(`axstack-arena-judge-astra`). All outputs are report-only; never grant
implementation or spec approval. These seats are excluded from Research,
Explain and Publish artifact scopes; source/article roles are excluded from
Brainstorm. These are direct roles; inherited audit is listed below.
This is arena authority, never arbitrary adviser authority.

Candidates must remain independent with the same bounded brief and no
cross-reading; judges never author candidates or cross-read other judges.
Rung 1 has no judge round; Rung 2 uses round 1, with round 2 only on the
existing disagreement or caller's user-rejection trigger in
[the arena procedure](../../axstack-brainstorm/references/arena.md).
The driver verifies rung, round, independence and configured seat availability
before dispatch; helpers validate role scope, not those procedural facts.

Use the selected preset's exact provider/model/effort/full-access bindings.
Configured optional Grok follows the arena's fenced absence rule; an uncertain
dispatch requires reconciliation. Fable is a required round-2 judge when that
round applies, not an optional candidate. A missing required model or an
intentional null-model absence holds the applicable round without substitution.
An allowlisted role never makes an unavailable seat executable.

## Workflow and inherited-role matrix

Substantive runs in each supported workflow retain `axstack-auditor` and
`axstack-auditor-sol` under the lifecycle hook. Their passes must remain
independent on the same bounded evidence, with configured optional-seat and
mixed-provider rules unchanged. Audit never audits itself; its auditor workers
launch no children. The unlaunchable-base UNKNOWN archive exception remains
a degraded receipt, not evidence of a completed audit.

| Workflow | Direct roles | Inherited audit | Boundary |
| --- | --- | --- | --- |
| research | Source roles listed above | Both auditors | Cited, bounded research; no engineering |
| explain, publish | Source and article roles listed above | Both auditors | Exact-byte review; publication still needs authority |
| brainstorm | Six candidate/judge seats listed above | Both auditors | Independent report-only arena and applicable rounds |
| align | `axstack-advisor-astra`, `axstack-advisor-opus` | Both auditors | Pre-repository scope advice; stop before execution |
| improve | `axstack-research-code`, `axstack-research-code-sol`, `axstack-ui-verifier`, `axstack-ui-verifier-sonnet` | Both auditors | Named nonversioned code/UI discovery only; second UI seat only under its dual-run trigger |
| audit | `axstack-auditor`, `axstack-auditor-sol` | None; terminal audit | Standalone audit of explicit nonrepo evidence; only assigned `audit.md` is writable |
| advice | `axstack-advisor-astra`, `axstack-advisor-opus`, `axstack-escalation-fable` | Both auditors for a substantive parent run | Only eligible existing shared advice; Fable retains its trigger |

The advice workflow permits only existing advised-hold, high-stakes or bounded
escalation consultations under [Standing contracts](contracts.md). It never
waives the parent phase's repository, store or tracker prerequisites. Record
the actual parent phase, qualifying trigger, evidence and question in the brief.
Ordinary advised holds use Astra/Opus; high-stakes use Astra/Fable; other Fable
uses require the existing bounded escalation trigger and a fresh session.
Never relabel arbitrary work as advice. Required seats and missing models hold
without substitution. The helper checks the role matrix; the driver must verify
these conditional duties, as with arena rounds.

Nested phase calls use their own explicit scope: Align research uses research,
unresolved design uses brainstorm, and Improve visuals use explain. This is not
a workflow alias for the caller or a waiver of its prerequisites.

Improve already accepts nonversioned files, screenshots and exported snippets.
Its previous artifact routing was ambiguous, not a proven runtime failure.
The improve mapping now covers that existing report-only discovery: copy owned
source snapshots, bind stable source identity and SHA-256, and name missing
history. UI discovery retains exact build/URL, source identity, real Playwright
capture and applicable dual-run requirements. A supplied screenshot alone is
not proof of a live render. Repository readiness, whole-repo Scout, executable
probes and implementation do not acquire artifact authority.

| Skill or mode | Nonrepo boundary |
| --- | --- |
| Anatomy | Uses Explain's workflow and exact-byte review; no new workflow |
| Perf | Router only; Improve discovery may use improve, Debug/Implement still require repository isolation |
| Spec | Unsupported as a standalone artifact workflow; chosen authoritative store, repository counterpart and approval remain required |
| Tickets | Unsupported; approved engineering scope, repository/store and tracker access remain required |
| Scout | Unsupported; whole-repository pinned-tree evidence is required |
| Debug, Implement | Unsupported; native repository/worktree probes and writers remain required |
| Review | Article/source review uses explain/publish; PR/code/codebase review retains repository and checkout requirements |
| Verify | Unsupported; repository verification-skill authoring routes through Implement |
| Watch | Unsupported; PR/repository ownership and forge rules remain required |
| Correct, Cleanup, VOA | Inline only; no worker workflow added; existing identity, ownership and read-only/status limits remain |

This matrix plus the supported rows covers the twenty skills inspected for this
repair. It describes contract/validator support, not completed native execution.
No live provider, browser, tracker, publication or installed-host support follows
from static checks or fixture receipts. Missing prerequisites remain unresolved;
record the exact gap rather than fabricate a repository, alias or approval.

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
For audits, the driver supplies an owned read-only input snapshot or evidence
manifest under artifactRoot. Bind its SHA-256 as the candidate; the auditor
writes only evidenceRoot/audit.md and marker report points there. Missing Git
history is a named limitation, never a fabricated revision. Paired auditors get
independent owned snapshots and never cross-read reports.

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
