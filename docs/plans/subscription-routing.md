# Subscription routing — execution task map

Authoritative store: repository Markdown.
Approved spec: [subscription-routing.md](../specs/subscription-routing.md),
revision 2, approved by the user's subsequent “okay proceed”.
Approved content SHA-256:
`83bf3cbd4044eb3ffe001af8bdc4d966af2d2ab74abe248d92c8c633b90fa920`.
The frozen spec retains its pre-approval Draft label; this receipt records
approval without changing the reviewed bytes. A private byte-identical snapshot
is preserved in this run's Git-metadata record.
Source baseline: `fd74a79a922471285da56e6523350fce2c3868a0`.

## Capabilities and status

| Capability | Tasks | Acceptance source | Status | Dependencies |
| --- | --- | --- | --- | --- |
| C1 Explicit subscription routing | T01, T02, T05 | Spec routing, setup, review and acceptance 1–4, 6–7 | Planned | None |
| C2 Claude native subagent default | T03, T05 | Spec Claude Code native subagent default | Planned | C1 setup interface |
| C3 Active execution tracking | T04, T05 | Spec active tracking and acceptance 5–7 | Planned | C1 role contract |

Nothing is implemented, reviewed, merged, or live. Reviewed candidates become
In Review; Done requires all relevant PR merges and capability acceptance.

## Owned tasks

Every row describes planned ownership, not a launched session. At execution,
record actual owner/author IDs and worktree receipts before dispatch. Existing
source ownership boundaries remain: installer author owns src/bin/installer
checks, workflow author owns skills/profiles/workflow checks; driver integrates.

| Task | Theme and owned files | Planned PR owner / worktree | Size estimate | Depends |
| --- | --- | --- | --- | --- |
| T01 | Shared role routing, exact preset data, review contract; skills/**, profiles/**, tests/workflows/**, workflow docs | Routing PR owner / dedicated routing worktree | Target ≤2000 changed lines; measure actual total | None |
| T02 | Required preset selection and safe profile migration; src/**, bin/**, tests/installer/**, installation docs | Same routing PR owner / same candidate, serialized installer author | Target ≤2000 combined with T01; reassess combined diff | T01 preset interface |
| T03 | Claude env-key setup, preservation and uninstall; installer modules and fixture tests, installation docs | Claude setup PR owner / child worktree | Target ≤2000 | T02 |
| T04 | Driver heartbeat reconciliation and advancement; lifecycle/implementation prompts, workflow scenarios, workflow docs | Tracking PR owner / child worktree | Target ≤2000 | T01 |
| T05 | Cross-capability acceptance, package smoke, independent final review and evidence documentation | Driver coordination; repairs return to source authors | Verification task; no standalone omnibus PR | T01–T04 |

T01/T02 are authoring tasks within one coherent routing PR: shipping selectable
presets without matching review policy, or mandatory role-based prompts without
installable mappings, would create an inconsistent public state. T03 and T04
are separate themes and may branch from the reviewed routing candidate. Use
`gh stack` when submitting dependent PRs. Do not create these worktrees or
sessions during preparation. Keep coherent commits around 200 lines where
practical; measure full PR size under shared PR-shape policy.

## Task acceptance and test-first sequence

### T01 — Role policy and preset assets

Define behavioral cases before editing prompts: each peer/authored route,
unknown or unsupported authors, owner authorship, provider outages, explicit
same-model Sonnet explanation review, and high-stakes unmapped-route holds.
Capture observed baseline evaluation separately from structural checks.
Add failing data checks for the complete role matrix, provider boundaries,
neutral reviewer slots and resolvable packaged references. Deliver shared
role-based instructions, three mappings and explicit evidence limitations.
No keyword check is claimed as agent-behavior proof.

### T02 — Installer selection and migration

Write and execute meaningful failing fixture tests before implementation:
omitted/invalid preset causes no mutation; valid selections install exact
assets; repeat setup is idempotent; switching preserves custom entries;
unchanged owned legacy IDs migrate; collisions and unsupported overrides are
visible; uninstall preserves later edits. Include rollback and existing path
safety coverage. Update docs and package assets with the same PR. All tests
use temporary homes. No source test writes live configuration.

### T03 — Claude setup preference

Test CLI presence/absence via injection, missing settings, existing equal or
different values, unrelated env/config entries, malformed data, unsafe paths,
atomic rollback, repeat setup and key-level uninstall ownership. Implement only
`env.CLAUDE_CODE_SUBAGENT_MODEL = "opus"`, without FORCE or changes to main
models or Paseo roles. Respect actual Claude config location. Report preserved
overrides and missing-CLI skips. Never assert universal override or measured
savings from static configuration.

### T04 — Active tracking

Define before/after behavior cases for a missed completion notification and a
reviewed task left unadvanced. Add duplicate-event/uncertain-create, restart,
stall, pause, complete and deadline holdouts. Require one reconciled native
heartbeat per active run, immediate event reconciliation, evidence-backed
advancement, recorded timer receipts and stopped/expired timers. Preserve PR
monitor responsibilities and authority. No new scheduler or runtime engine.
Agent evaluations and live timer proof remain separate evidence classes.

### T05 — Integrated delivery evidence

Run relevant Bun tests and package/neutral-directory smoke checks for all
presets. Check shared docs for stale unconditional model requirements. Record
red/green receipts, full candidate/base identity, review author provenance,
actual model and effort, all-angle coverage and evidence gaps. Refresh affected
children after parent changes. Live compatibility requires authorized actual
harness runs; fixture tests alone do not establish it.

## Execution boundary and resume

Subagents were explicitly stopped by the user and remain stopped. No new
advisor, auditor, implementer or reviewer has been launched for this map.
The later role table, expanded scope, spec and map are driver-authored;
Fable only reviewed the initial independence question. Do not invent current
advisor/audit receipts or interpret preparation as authority to resume agents.

Before implementation, reconcile this approval hash, current Git state, source
ownership, and the user's continued subagent-stop instruction. Required
independent behavioral evaluation/review must be arranged within the authority
then available; do not silently replace it with driver self-review.

Excluded authority remains unchanged: no live home install, production timer,
merge, release or publication. This task map ends preparation; the user invokes
Axstack to begin execution.
