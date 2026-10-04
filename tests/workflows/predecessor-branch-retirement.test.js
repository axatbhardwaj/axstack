import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = () => readFileSync(`${import.meta.dir}/../../skills/axstack/references/automations.md`, 'utf8');
const conditions = [
  /predecessor pass is settled/i,
  /(?:proven|verified) run\/lane-owned by recorded identity/i,
  /(?:its|all) descendants and evidence are settled/i,
  /no worktree (?:has the branch checked out|checks out the branch)/i,
  /no remote counterpart exists/i,
  /(?:its|the) tip (?:equals|matches) the recorded tip/i,
  /(?:its|the) tip is (?:an ancestor of|ancestral to) the verified remote default branch/i,
];

function guarded(text) {
  const paragraph = text.replace(/\s+/g, ' ').match(/[^.]*git branch -D[^.]*\.[^.]*\./)?.[0] ?? '';
  return /review-manager pass may/i.test(paragraph) && /only (?:when|if) all/i.test(paragraph)
    && /(?:otherwise|else)[, ]+(?:hold|retirement holds)/i.test(paragraph)
    && conditions.every((condition) => condition.test(paragraph));
}

test('review-manager forced branch retirement requires every predecessor safeguard', () => {
  expect(guarded(source())).toBe(true);
});

test('retirement contract detects removal and directional inversions', () => {
  const text = source();
  expect(guarded(text)).toBe(true);
  expect(guarded(text.replace(/[^\n]*git branch -D[^\n]*\n/, ''))).toBe(false);
  for (const condition of conditions) expect(guarded(text.replace(condition, 'condition omitted'))).toBe(false);
  for (const [before, after] of [
    ['no worktree has the branch checked out', 'a worktree may have the branch checked out'],
    ['its tip is an ancestor of', 'its tip is not an ancestor of'],
    ['only when ALL', 'even when not all'],
    ['Otherwise hold', 'Otherwise proceed'],
  ]) {
    expect(text).toContain(before);
    expect(guarded(text.replace(before, after))).toBe(false);
  }
});

test('retirement contract survives equivalent rewording', () => {
  expect(guarded(`A review-manager pass may retire a predecessor local t3code/* branch
    using git branch -D only if all these checks hold: the predecessor pass is settled,
    verified run/lane-owned by recorded identity, all descendants and evidence are settled,
    no worktree checks out the branch, no remote counterpart exists, the tip matches the
    recorded tip, and the tip is ancestral to the verified remote default branch.
    Else retirement holds.`)).toBe(true);
});
