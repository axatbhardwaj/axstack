import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const prose = (path) => readFileSync(`${root}/${path}`, 'utf8').replace(/\s+/g, ' ');

test('review names each defect class and searches the full affected surface', () => {
  const review = prose('skills/axstack-review/SKILL.md');
  expect(review).toMatch(/each finding[^.]*defect class[^.]*every instance[^.]*pinned diff[^.]*dependent surfaces/i);
  expect(review).toMatch(/callers[^.]*sibling docs[^.]*README[^.]*tests/i);
  expect(review).toMatch(/later instance[^.]*already-named class[^.]*coverage miss/i);
});

test('implement accepts non-blocking review notes without driver-elected polish', () => {
  const implement = prose('skills/axstack-implement/SKILL.md');
  expect(implement).toMatch(/APPROVE[^.]*non-blocking findings[^.]*diligence `PASS`[^.]*merge-ready/i);
  expect(implement).toMatch(/driver records[^.]*non-blocking notes[^.]*does not elect a repair/i);
  expect(implement).toMatch(/only the user[^.]*ask for polish/i);
  expect(implement).toMatch(/third review round[^.]*REQUEST_CHANGES[^.]*FINDINGS[^.]*held/i);
});

test('optional adviser notes are dispositioned without changing the draft', () => {
  for (const path of ['skills/axstack-spec/SKILL.md', 'skills/axstack-align/SKILL.md']) {
    const skill = prose(path);
    expect(skill).toMatch(/optional adviser note[^.]*deferred or rejected[^.]*`Decisions` row[^.]*draft unchanged/i);
    expect(skill).toMatch(/optional adviser note[^.]*no new adviser pair/i);
    // Changed-text review and meaning-preserving deltas: autonomy-planning.test.js.
  }
});

test('blocking and exact-revision holdouts still apply', () => {
  const review = prose('skills/axstack-review/SKILL.md');
  const implement = prose('skills/axstack-implement/SKILL.md');
  const spec = prose('skills/axstack-spec/SKILL.md');
  expect(review).toMatch(/Any authoring change makes prior receipts stale/i);
  expect(review).toMatch(/Refresh each mode-required receipt for the new exact SHA and current base/i);
  expect(review).toMatch(/validated blocking defects[^.]*REQUEST_CHANGES/i);
  expect(implement).toMatch(/`REQUEST_CHANGES`[^.]*failed required check[^.]*same author[^.]*new revision/i);
  expect(spec).toMatch(/driver owns the draft[^.]*user approves it/i);
});
