import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const compact = (path) => read(path).replace(/\s+/g, ' ');
const referencePath = 'skills/axstack/references/simplify-diff.md';

test('simplify-diff: shared reference is bounded to code and agent instructions', () => {
  expect(existsSync(`${root}/${referencePath}`)).toBe(true);
  const text = read(referencePath);

  expect(text.split('\n').length).toBeLessThanOrEqual(70);
  expect(text).toMatch(/code diffs?[^.]*agent instructions?|agent instructions?[^.]*code diffs?/i);
  expect(text).toMatch(/not[^.]*human-facing[^.]*marketing/i);
  for (const target of [
    /speculative abstractions?/i,
    /redundant narration/i,
    /unjustified defensive (branches|logic)/i,
    /unjustified[^.]*casts/i,
    /needless wrappers?/i,
    /deep nesting/i,
    /convention mismatch/i,
  ]) expect(text).toMatch(target);

  for (const safeguard of [
    /trust-boundary validation/i,
    /accessibility text/i,
    /meaningful[^.]*why-comments/i,
    /uncertainty/i,
    /authority instructions?/i,
  ]) expect(text).toMatch(safeguard);

  expect(text).toMatch(/behavior-preserving/i);
  expect(text).toMatch(/not-applicable/i);
  expect(text).toMatch(/no[^.]*deletion quota/i);
  expect(text).toMatch(/no[^.]*score/i);
});

test('simplify-diff: implement, review, and audit carry distinct receipts', () => {
  const implement = compact('skills/axstack-implement/SKILL.md');
  const review = compact('skills/axstack-review/SKILL.md');
  const audit = compact('skills/axstack-audit/SKILL.md');

  expect(implement).toContain('../axstack/references/simplify-diff.md');
  expect(implement).toMatch(/post-green|green[^.]*refactor/i);
  expect(implement).toMatch(/code diff[^.]*agent[- ]instruction[^.]*load/i);
  expect(implement).toContain(
    'Simplification: <applied | not-applicable> — evidence: <diff locations and checks>; retained complexity: <necessary complexity and why>',
  );

  expect(review).toContain('../axstack/references/simplify-diff.md');
  expect(review).toMatch(/angle 6[^.]*independently[^.]*diff/i);
  expect(review).toMatch(/independently[^.]*receipt[^.]*relevant diff/i);
  expect(review).toMatch(/location[^.]*consequence[^.]*simpler behavior-preserving alternative/i);

  expect(audit).toMatch(/simplif[^.]*applicability[^.]*\/[^.]*(candidate|diff|receipt)/i);
  expect(audit).toMatch(/complete[^.]*\/[^.]*(candidate|applicable|expected)/i);
  expect(audit).toMatch(/simplif[^.]*UNKNOWN|UNKNOWN[^.]*simplif/i);
  expect(audit).toMatch(/not a quality score/i);
});

test('simplify-diff: writing guidance points to the sole maintained policy', () => {
  const docs = read('docs/skill-writing.md');
  expect(docs).toContain('../skills/axstack/references/simplify-diff.md');
  expect(docs.match(/simplify-diff\.md/g)?.length).toBe(1);
  expect(docs).toMatch(/code diff[^.]*agent instruction/i);
});
