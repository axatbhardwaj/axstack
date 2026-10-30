# Role roster

Fleet nonwriter placement follows [Fleet dispatch and receipts](fleet-dispatch.md).
Roles retain exact configured provider/model/options/full-access on the selected
native destination. Remote reviewers require T3 worktree isolation; no shell child
checkout. Host names confer no role or permission. Remote authors/coordinator stay
disabled; local isolated authors remain supported even overloaded.

- Chat drives (no role ID); `axstack-owner` owns one PR and
  `axstack-author` its sole writer.
  For own PRs, automatic merge is the default under the
  [watch predicate](../../axstack-watch/SKILL.md#5-state-readiness-precisely).
  Only the recorded owning watch thread merges, including `axstack-owner`
  for authorized standalone maintenance. Other roles never acquire merge authority.
- `axstack-reviewer-primary` and `axstack-reviewer-peer` are the ordered
  peer pair. In `mixed`, the cross-provider pair is Sol high followed by Opus medium.
  First peer review uses both. Peer follow-up uses one reviewer under
  [Peer mode](../../axstack-review/SKILL.md#peer-mode-colleague-pr); authored review uses this table:

  | Preset | Author class | Reviewer (class/effort) |
  | --- | --- | --- |
  | `mixed` | `codex/sol` | `axstack-reviewer-secondary` (`claude/opus` high) |
  | `mixed` | `claude/opus` | `axstack-reviewer-primary` (`codex/sol` high) |
  | `codex-only` | `codex/sol` | `axstack-reviewer-secondary` (`codex/terra` high) |
  | `claude-only` | `claude/opus` | `axstack-reviewer-secondary` (`claude/sonnet` high) |
- `axstack-advisor-astra`/`axstack-advisor-opus` advise and author candidates;
  `axstack-arena-candidate-grok` adds a family.
  `axstack-arena-judge-opus` judges round 1; `axstack-escalation-fable`/`axstack-arena-judge-astra` judge round 2.
  High-stakes/trigger: fresh [contract](contracts.md) session.
  `axstack-auditor` audits; `axstack-checker` reports discrepancies.
- `axstack-explainer` authors every visual Explain delivers, including pages,
  chat Mermaid and anatomy figures; mixed pins Sonnet 5.5 high exactly.
- `axstack-explainer-review` always reviews every visual; `codex/terra` high in mixed.
  Consequential or complex driver-written prose keeps its review rule; every
  whiteboard defense is consequential, in chat too.
- `axstack-diligence`: read-only [diligence checks](diligence.md) for every authored PR
  review round and bounded research, spec, ticket, receipt, and release claims.
- `axstack-ui-verifier`: owns the inline page interaction pass under [UI checks](ui-verification.md)
  for every interactive page, bound to the exact bytes and SHA-256.
- `axstack-ui-verifier-sonnet`: `claude/sonnet` high in mixed, read-only;
  independently drives Android and web/PWA run 2 under [UI checks](ui-verification.md#android-device-and-webpwa-dual-run).
  `axstack-ui-verifier` (Terra high in mixed) drives run 1; the driver reconciles.
  `axstack-ui-verifier-sonnet` is intentionally absent in both single-provider presets,
  leaving dual-run verification unverified; record the absence without substitution.
- `axstack-research-requirements`/
  `axstack-research-code`/`axstack-research-web`/
  `axstack-explore-execution`:
  `claude/sonnet` high in mixed/claude-only.
- `axstack-auditor`: `claude/haiku` xhigh in mixed, pinned to
  `claude-haiku-5-5`. Missing that exact model or xhigh effort holds without
  substitution. `claude/sonnet` high in claude-only; `codex/luna` xhigh in codex-only.
- `axstack-explore-codebase`: `claude/haiku` high in
  mixed/claude-only, pinned to `claude-haiku-5-5`. Missing that exact model
  or high effort holds this role without substitution.
- Scout requires `axstack-explore-codebase` and
  `axstack-explore-codebase-luna` per facet in mixed (Haiku high + Luna
  xhigh) and codex-only (Sol high + Luna xhigh). Claude-only requires
  the Haiku high base seat per facet.
- Sol pairs (stable `-sol` IDs) `axstack-auditor-sol`/`axstack-research-code-sol`/
  `axstack-explore-execution-sol`: `codex/sol` high in
  mixed/codex-only; intentionally absent in claude-only. In mixed,
  research-code and explore-execution use `codex/terra` high instead. Dispatch each
  independently from its base seat on the same bounded brief without
  cross-reading. The driver reconciles findings per claim, never averages.
  Record intentional absence and continue with Sonnet alone.
- Web pair `axstack-research-web`/`axstack-research-web-sol`: Sonnet high +
  Terra high in mixed, independently on the same bounded brief without
  cross-reading, with driver reconciliation per claim. The `-sol` web seat is
  intentionally absent in both single-provider presets; use the base seat alone.
- Optional seats: `axstack-arena-candidate-grok`,
  `axstack-research-x`, `axstack-checker`, `axstack-research-code-sol`,
  `axstack-research-web-sol`,
  `axstack-explore-execution-sol`, `axstack-auditor-sol`.
  Always dispatch optional seats when configured and available, except research
  branches, which follow [Research step 2](../../axstack-research/SKILL.md#procedure) sizing.
  A research branch unneeded by an open claim is recorded `not needed (<reason>)`,
  never as absent or a malfunction. Only a
  launch failure, trust/login prompt, or prompt block makes one absent:
  fence the attempt, record `absent (<reason>)`, name it once in the next
  read-back, and skip it without a relay or substitution. An uncertain
  dispatch is reconciled, not called absent. A sized mixed research fan-out
  requires dispatched branches spanning at least two different providers;
  otherwise hold that fan-out. Every other mixed fan-out, including arena and
  first peer review, retains at least one Codex and one Claude seat; otherwise hold that fan-out.
  Intentional absences in codex-only and claude-only remain unchanged.
- `axstack-debug-investigator-1..4` probe L1 briefs.
