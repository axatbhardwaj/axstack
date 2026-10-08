# Role roster

- Chat drives (no role ID); `axstack-owner` owns one PR and
  `axstack-author` its sole writer.
  For own PRs, automatic merge is the default under the
  [watch predicate](../../axstack-watch/SKILL.md#5-state-readiness-precisely).
  Only the recorded owning watch thread merges, including `axstack-owner`
  for authorized standalone maintenance. Other roles never acquire merge authority.
- `axstack-reviewer-primary` and `axstack-reviewer-peer` are the ordered
  peer pair. Peer review uses both; authored review uses this table:

  | Preset | Author class | Reviewer (class/effort) |
  | --- | --- | --- |
  | `mixed` | `codex/sol` | `axstack-reviewer-secondary` (`claude/opus` medium) |
  | `mixed` | `claude/opus` | `axstack-reviewer-primary` (`codex/sol` high) |
  | `codex-only` | `codex/sol` | `axstack-reviewer-secondary` (`codex/luna` xhigh) |
  | `claude-only` | `claude/opus` | `axstack-reviewer-secondary` (`claude/sonnet` high) |
- `axstack-advisor-astra`/`axstack-advisor-opus` advise and author candidates;
  `axstack-arena-candidate-grok`/
  `axstack-arena-candidate-antigravity` add families.
  `axstack-arena-judge-opus` judges round 1; `axstack-escalation-fable`/`axstack-arena-judge-astra` judge round 2.
  High-stakes/trigger: fresh [contract](contracts.md) session.
  `axstack-auditor` audits; `axstack-checker` reports discrepancies.
- `axstack-explainer` authors archify only on an explicit viewer request.
- `axstack-explainer-review` reviews consequential or complex claims, archify
  output, or on request.
- `axstack-diligence`: read-only [diligence checks](diligence.md) for every PR
  review round and bounded research, spec, ticket, receipt, and release claims.
- `axstack-ui-verifier`: owns the inline page interaction pass under [UI checks](ui-verification.md)
  for every interactive page, bound to the exact bytes and SHA-256.
- `axstack-auditor`/`axstack-research-requirements`/
  `axstack-research-code`/`axstack-research-web`/
  `axstack-explore-execution`:
  `claude/sonnet` high in mixed/claude-only.
- `axstack-explore-codebase`/`axstack-monitor`: `claude/haiku` high in
  mixed/claude-only, pinned to `claude-haiku-5-5`. Missing that exact model
  or high effort holds these roles without substitution.
  `axstack-monitor`: standalone watch never sends; chat-run watch: bounded
  internal reports to its Run and original driver.
- Sol pairs `axstack-auditor-sol`/`axstack-research-code-sol`/
  `axstack-explore-execution-sol`: `codex/sol` high in
  mixed/codex-only; intentionally absent in claude-only. Dispatch each
  independently from its Sonnet seat on the same bounded brief without
  cross-reading. The driver reconciles findings per claim, never averages.
  Record intentional absence and continue with Sonnet alone.
- Optional seats: `axstack-arena-candidate-grok`,
  `axstack-arena-candidate-antigravity`, `axstack-research-web-google`,
  `axstack-research-x`, `axstack-checker`, `axstack-research-code-sol`,
  `axstack-explore-execution-sol`, `axstack-auditor-sol`.
  Always dispatch optional seats when configured and available. Only a
  launch failure, trust/login prompt, or prompt block makes one absent:
  fence the attempt, record `absent (<reason>)`, name it once in the next
  read-back, and skip it without a relay or substitution. An uncertain
  dispatch is reconciled, not called absent. A mixed fan-out still includes
  at least one Codex and one Claude seat; otherwise hold that fan-out.
  Intentional absences in codex-only and claude-only remain unchanged.
- `axstack-debug-investigator-1..4` probe L1 briefs.
