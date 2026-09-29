# Role roster

- Chat drives (no role ID); `axstack-owner` owns one PR and
  `axstack-author` its sole writer.
- `axstack-reviewer-primary` and `axstack-reviewer-secondary` are the ordered
  peer pair. Peer review uses both; authored review uses this table:

  | Preset | Author | Reviewer (model/effort) |
  | --- | --- | --- |
  | `mixed` | Codex / Sol (`codex/gpt-6-sol`) | `axstack-reviewer-secondary` (`claude/claude-opus-5-5` medium) |
  | `mixed` | Claude / Opus (`claude/claude-opus-5-5`) | `axstack-reviewer-primary` (`codex/gpt-6-sol` high) |
  | `codex-only` | Codex / Sol (`codex/gpt-6-sol`) | `axstack-reviewer-secondary` (`codex/gpt-6-luna` xhigh) |
  | `claude-only` | Claude / Opus (`claude/claude-opus-5-5`) | `axstack-reviewer-secondary` (`claude/claude-sonnet-5-5` high) |
- `axstack-advisor-astra`/`axstack-advisor-opus` advise and author candidates;
  `axstack-arena-candidate-grok`/
  `axstack-arena-candidate-antigravity` add families.
  `axstack-arena-judge-opus` judges round 1; `axstack-escalation-fable`/`axstack-arena-judge-astra` judge round 2.
  High-stakes/trigger: fresh [contract](contracts.md) session.
  `axstack-auditor` audits; `axstack-checker` reports discrepancies.
- `axstack-explainer`/`axstack-explainer-review`: explain/review.
- `axstack-ui-verifier`: [UI checks](ui-verification.md).
- `axstack-auditor`/`axstack-research-requirements`/
  `axstack-research-code`/`axstack-research-web`/
  `axstack-explore-execution`/`axstack-monitor`:
  `claude-sonnet-5-5` high in mixed/claude-only.
  `axstack-monitor`: standalone watch never sends; chat-run watch: bounded
  internal reports to its Run and original driver.
- Sol pairs `axstack-auditor-sol`/`axstack-research-code-sol`/
  `axstack-explore-execution-sol`: `codex/gpt-6-sol` high in
  mixed/codex-only; intentionally absent in claude-only. Dispatch each
  independently from its Sonnet seat on the same bounded brief without
  cross-reading. The driver reconciles findings per claim, never averages.
  Record intentional absence and continue with Sonnet alone; a configured
  but unavailable seat holds only its affected work.
- `axstack-debug-investigator-1..4` probe L1 briefs.
