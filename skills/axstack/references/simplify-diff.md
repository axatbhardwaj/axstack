# Simplify the diff

Load this reference only after the relevant checks are green and the candidate
contains code diffs or agent instructions. It does not apply to
general human-facing or marketing prose.

## Preserve behavior first

Simplify only when the same checked behavior and accepted scope remain intact.
Read the changed lines with their callers and local conventions; do not optimize
an isolated snippet while making the surrounding system harder to understand.
Re-run the check that established green after an applied simplification.

Look for complexity introduced or retained by the diff:

- speculative abstractions without a current second use;
- redundant narration that repeats what names or structure already say;
- unjustified defensive branches, fallback logic, or casts;
- needless wrappers or indirection;
- deep nesting that a guard clause or smaller direct operation can flatten; and
- convention mismatch where the repository already has a simpler pattern.

Prefer the smallest behavior-preserving change. Do not expand into nearby
cleanup, redesign stable interfaces, or trade explicit behavior for brevity.

## Keep necessary safeguards

Never remove complexity merely because it looks verbose. Preserve:

- trust-boundary validation and failure handling;
- accessibility text and interaction semantics;
- meaningful why-comments that capture a non-obvious constraint;
- explicit uncertainty instead of turning an unknown into a claim; and
- authority instructions, approval boundaries, and mutation limits.

When evidence cannot show that a change preserves behavior, retain it and name
the uncertainty. A justified `not-applicable` result is valid; there is no
deletion quota and no quality score.

## Receipt

Record one line for the exact candidate:

```text
Simplification: <applied | not-applicable> — evidence: <diff locations and checks>; retained complexity: <necessary complexity and why>
```

For `applied`, name the simplified locations and the green check rerun. For
`not-applicable`, name what was inspected and why no behavior-preserving
simplification was justified. The receipt is review evidence, not proof of live
model effectiveness and not an automatic gate.
