# Writing Axstack skills

Write for the next decision the agent must make. This is authoring guidance,
not an additional runtime skill or phase.

- Keep the discovery description on one line: `When ..., use axstack-...`.
  Name distinct triggers without listing the procedure.
- Open with the result the skill produces. Order actions only where their
  dependencies require it; use reference sections for rules consulted together.
- Make completion observable: resolved scope, accepted revision, checked
  evidence, verified receipt, or a named blocker. Avoid repeating a completion
  formula after every sentence.
- Put a constraint next to the action it governs. Preserve required authority
  and lifecycle checks; load conditional details before the relevant operation.
- Keep one maintained definition for shared policy. A pointer must name both
  its target and when to read it. Check the whole reachable instruction path
  before removing a repeated rule.
- Add examples for judgments that wording alone leaves ambiguous, such as an
  inadequate acceptance test or a revision-bound review finding. Examples
  illustrate the rule; they do not create new global requirements.
- Use original prose. Changes to writing do not authorize changes to models,
  review topology, approval checkpoints, stores, timers or mutation authority.
- For post-green code diffs and agent instructions, use the shared
  [simplify-diff contract](../skills/axstack/references/simplify-diff.md) rather
  than duplicating its rules here.

Validation has distinct layers: package/link/frontmatter checks, structural
policy assertions, isolated model simulations, and actual runtime evidence.
Wording checks may move with a rule, but preserve their semantic requirement
and scenario expectations. A passing prose regex is not behavioral proof.
An editorial rewrite does not manufacture a TDD red; observable behavior
changes need failing-first evidence appropriate to their boundary.

This approach is informed by Matt Pocock's
[writing-for-agents guidance](https://github.com/mattpocock/skills/blob/3cca18b368ae95cdbdebbff572ccafa662551015/skills/productivity/writing-for-agents/SKILL.md)
at the pinned revision, together with Axstack's own operating contracts.
That source is design reference, not an installed dependency or a claim of
measured performance improvement.
