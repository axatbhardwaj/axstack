# Local non-repository artifacts

Follow [Parallel-first delivery](parallel-first.md) for ready packages, exclusive
ownership, verified terminal outputs and stale hashes. This matrix and exact-byte
review apply independently of engineering bindings or Git ancestry.

Report-only modes may use an explicitly bound non-repository artifact scope.
Null repository identity alone never authorizes a route. Engineering authors
and code reviewers still require a repository and native Git worktree isolation.
Remote artifacts and remote author/coordinator work remain outside scope.

## Scope and ownership

Use `request.scope` with `repositoryId:null` and `role:reader`. Writers may write
only phase-authorized owned artifacts or reports. Product code is outside scope.
`task` selects load preference. Bind scope in helper evidence and briefs, never
in native T3 arguments.

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

Research, Explain and Publish permit configured research requirements/code/code-sol/
web/web-sol/X, explore-execution/explore-execution-sol and diligence. Explain and
Publish add explainer, explainer-review and configured UI verifiers. Full
`axstack-` role IDs must match scope.roleId in dispatch-plan. Preserve preset
availability and provider/model/effort/options/runtime authority. Exclude
engineering authors, code reviewers, owners and unlisted roles.

Brainstorm permits only candidates Astra (`axstack-advisor-codex`), Fable 5.2
(`axstack-advisor-claude`) and Grok (`axstack-arena-candidate-grok`), and judges
Opus (`axstack-arena-judge-opus`), Fable (`axstack-escalation-fable`) and Astra
(`axstack-arena-judge-astra`). Outputs are report-only and never grant
implementation or spec approval. These direct arena seats exclude arbitrary
advisers and cannot cross into research/article scopes or admit their roles.

Candidates must remain independent with the same bounded brief and no
cross-reading. Judges never author candidates or cross-read judges. Rung 1 has
no judge. Rung 2 uses round 1, with round 2 only on existing disagreement or
caller user-rejection under [the arena procedure](../../axstack-brainstorm/references/arena.md).
Before dispatch the driver verifies rung, round, independence and seat
availability. Helpers validate role scope only.

Use the preset's exact provider/model/effort/full-access bindings. Apply the
arena's fenced absence rule to optional Grok and reconcile uncertain dispatch.
Fable is the required round-1 judge when that round applies. Missing required or intentionally
null models hold the round without substitution, even for allowlisted roles.

## Workflow and inherited-role matrix

Substantive runs in each supported workflow retain `axstack-auditor` and
`axstack-auditor-sol` through the lifecycle hook. Passes must remain independent
on the same bounded evidence under optional-seat and mixed-provider rules.
Audit never audits itself. Auditors launch no children. The unlaunchable-base
UNKNOWN archive exception gives a degraded receipt with audit uncompleted.

| Workflow | Direct roles | Inherited audit | Boundary |
| --- | --- | --- | --- |
| research | Source roles listed above | Both auditors | Cited, bounded research; no engineering |
| explain, publish | Source and article roles listed above | Both auditors | Exact-byte review; publication still needs authority |
| brainstorm | Six candidate/judge seats listed above | Both auditors | Independent report-only arena and applicable rounds |
| align | `axstack-advisor-codex`, `axstack-advisor-claude` | Both auditors | Pre-repository scope advice; stop before execution |
| improve | `axstack-research-code`, `axstack-research-code-sol`, `axstack-ui-verifier`, `axstack-ui-verifier-sonnet` | Both auditors | Named nonversioned code/UI discovery only; second UI seat only under its dual-run trigger |
| audit | `axstack-auditor`, `axstack-auditor-sol` | None; terminal audit | Standalone audit of explicit nonrepo evidence; only assigned `audit.md` is writable |
| advice | `axstack-advisor-codex`, `axstack-advisor-claude`, `axstack-escalation-fable` | None; audit retains the supported parent's workflow | Only eligible existing shared advice; Fable retains its trigger |

The advice workflow permits only existing advised-hold, high-stakes or bounded
escalation consultations under [Standing contracts](contracts.md). It never
waives parent repository, store or tracker prerequisites. Brief the actual
phase, trigger, evidence and question. Use Codex/Claude for advised holds and
Astra/Fable for high stakes. Other escalation seats require the existing trigger
and a fresh session. Exclude relabelled arbitrary work. Hold missing required
seats/models without substitution. The helper checks roles and the driver
verifies conditional duties, as for arena rounds.

Nested calls bind their own scope and prerequisites: Align research uses
research, unresolved design uses brainstorm, and Improve visuals use explain.

Improve accepts nonversioned files, screenshots and snippets for report-only
discovery. Copy owned snapshots, bind stable source identity and SHA-256, and
report missing history. UI proof requires the exact build/URL, source identity,
real Playwright capture and applicable dual runs. A supplied screenshot leaves
live render unverified. Repository readiness, whole-repo Scout, executable
probes and implementation remain outside artifact authority.

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

Repository-mode Correct/Cleanup may assign bounded read-only evidence analysis
within their phase, with no cleanup mutation authority. Work chat also stays
inline, using its scoped reader. Static checks and fixtures leave native provider,
browser, tracker, publication and installed-host execution unverified. Record
missing prerequisites without fabricating repository identity, alias or approval.

Bind the parent project and real workspaceRoot with explicit null
repositoryIdentity in project-read and complete project-list. Hold omitted,
conflicting or incomplete results. Require native environment, project, catalog,
provider, options, runtime and access checks. Route only within that environment,
project and workspace. Never invent a repository ID, initialize Git or attach
another repository.

Give each attempt owned artifact and evidence directories, canonical absolute
strict children of workspaceRoot. Forbid traversal, shared-root writes and
ancestor/equal overlaps. Record every other attempt's roots in `reservedRoots`,
including pending and retained attempts. Never guess an empty inventory.
The helper checks lexical paths and overlaps.
This evidence supplies no lock. The driver must independently
verify real paths, no symlink escapes, ownership and exclusive writers on disk.
Unknown ownership holds.

## Native dispatch and review

Use async `delegate_task` with `isolation:"shared"`, exact local parent project
target, role-labelled title and stable clientRequestId. Record requested arguments
and native settings separately. Dispatch-plan requires nativeDestination and
`--kind task`, returning artifactScope evidence and shared isolation. Pass only
supported native arguments. Skip top-level launches, shell checkouts, live policy
edits and per-run bypasses.

Research branches keep independent first passes and cited-source reopening.
Diligence reopens answer-changing claims. The explainer alone writes source.
Reviewers/verifiers get owned byte-identical snapshots and separate evidence
directories. They never edit the original. Review binds exact SHA-256. Before
public publication require Playwright layout/interaction evidence and independent
source/fact and design review of those same bytes under Explain/Publish.
Changed bytes invalidate affected reviews and renders. Unknown proof holds.
Shared access grants no first-pass cross-reading. Only the explicitly
authorized driver publishes.

## Receipts

Retain native task/thread/run, pending-question and settings checks. Audit binds
the SHA-256 of a driver-supplied owned read-only snapshot or manifest under
artifactRoot. The auditor writes only evidenceRoot/audit.md and points the
marker there. Report missing Git history. Never fabricate a revision. Paired
auditors get independent owned snapshots and never cross-read reports.

Set `attempt.candidate` and marker `head` to the 64-hex artifact SHA-256,
`attempt.base` to null and `artifactScope` to the requested scope. Report to
evidenceRoot with `artifact:{path,sha256,readback:{path,sha256,evidence}}` for
the independently hashed owned snapshot.
Verify requested isolation is shared. Hold otherwise. Child worktreePath may
be null. On T3 0.1.5 it may inherit the parent's non-Git scratch path if
`parent` saves the `t3_thread_read` observation (tool, environmentId,
args.threadId, observedAt, evidence, value.thread). Bind origin thread, project,
child parentThreadId/subagent relation and identical canonical path within
workspaceRoot. Verify the filesystem. Shared access supplies no Git checkout or
OS isolation. Forbid checkout metadata. Unknown or different parent/path holds.

For T3 0.1.5 local artifact receipts only, null latestTerminalSummary may use
summary if childRunId and latestTerminalRunId match the current completed run
and its bytes equal the destination final message. Exclude conflicting terminal
summaries, stale runs, other versions and remote results. Preserve raw native
fields. Never synthesize an effective field from requested settings.
The driver checks actual bytes and readbacks. Helpers validate saved data.
Only observed T3 0.1.5 local artifact receipts accept a trimmed title over 72
UTF-16 code units as its first 69 plus three ASCII periods (`...`). Compare
that projection exactly, keep the full requested title in the attempt, and
preserve native and expected evidence. Task, child, run, parent, marker and
artifact binding remain required. Other versions, remote and engineering
receipts require exact title equality. Replay proves compatibility only.

Keep artifact receipts separate from Git candidate publication/PR/merge receipts.
