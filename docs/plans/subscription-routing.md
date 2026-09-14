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
| C1 Explicit subscription routing | T01, T02, T05 | Spec routing, setup, review and acceptance 1–4, 6–7 | In Review — PR #20 | None |
| C2 Claude native subagent default | T03, T05 | Spec Claude Code native subagent default | In Review — PR #22 | C1 setup interface |
| C3 Active execution tracking | T04, T05 | Spec active tracking and acceptance 5–7 | In Review — PR #21 | C1 role contract |

Implementation is complete and independently reviewed in PRs [#20](https://github.com/axatbhardwaj/axstack/pull/20),
[#21](https://github.com/axatbhardwaj/axstack/pull/21), and
[#22](https://github.com/axatbhardwaj/axstack/pull/22). Delivery is pending CI,
merge, release, and host verification. Done requires the relevant merges and
capability acceptance; source checks do not establish live harness behavior.

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

## Execution authority and evidence

After preparation, the user explicitly authorized resuming the required Axstack
implementers, independent reviewers and auditor, followed by merge, release,
mixed-preset installation on both devices and Paseo restarts. The current chat
remains the driver and owns those delivery actions. Authors own source changes;
review and audit stay independent. The approved spec bytes remain unchanged.

T01/T02 are implemented in PR #20, T04 in PR #21 and T03 in PR #22, using
`gh stack`. Independent authored reviews approved all three candidates. The
complete Linux suite has 285 passing tests and one skip; macOS CI exposed
canonical-path assumptions in the new Claude fixtures, addressed by a test repair
with CI and review refresh required before merge. Routing and tracking static evaluations cover
18 and 13 scenarios respectively. These are not live dispatch or timer-delivery
proof. Host configuration and daemon readback are separate delivery evidence.

One workflow reference-edit ordering deviation is recorded: three reference
files were edited before the baseline evaluation returned. Later commits do not
retroactively establish test-first ordering. Installer red/green ordering relies
partly on author session receipts rather than independently captured raw output.
The Luna max audit assesses execution outcome, adherence and coverage separately.

The initial Fable advice remains scoped to the independence question; no later
Fable approval is claimed. Subsequent authority comes from the user's explicit
conversation instructions. Private run evidence records actual session IDs,
reviewed revisions, timer receipts and deployment checks without publishing
host-sensitive configuration.
