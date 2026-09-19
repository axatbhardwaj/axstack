import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const root = `${import.meta.dir}/../..`;
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const loaded = [
  'skills/axstack-implement/SKILL.md',
  'skills/axstack/references/contracts.md',
  'skills/axstack/references/lifecycle.md',
  'skills/axstack/references/routing.md',
  'skills/axstack/references/pr-shape.md',
  'skills/axstack/references/candidate-publication.md',
  'skills/axstack/references/orca-runtime.md',
  'skills/axstack/references/run-record.md',
].map(read).join('\n').replace(/\s+/g, ' ');

test('implement loop: loaded text carries the merge-ready run contract', () => {
  expect(loaded).toMatch(/one run-level completion wait[^.]*every unsettled Dispatch/i);
  expect(loaded).toMatch(/forge[^.]*blocking check wait[^.]*bounded[^.]*once per revision/i);
  expect(loaded).toMatch(
    /authoring\s*\|\s*published\s*\|\s*in-review\s*\|\s*repairing\(n\)\s*\|\s*merge-ready\s*\|\s*merged\s*\|\s*held/i,
  );
  expect(loaded).toMatch(/REQUEST_CHANGES[^.]*same author[^.]*new revision[^.]*repairs/i);
  expect(loaded).toMatch(/third `?REQUEST_CHANGES`?[^.]*held/i);
  expect(loaded).toMatch(/`codex-only`[^.]*`claude-only`[^.]*hold[^.]*step \(3\)[^.]*no substitution/i);
  expect(loaded).toMatch(/serious risk[^.]*immediately/i);
  expect(loaded).toMatch(/merge-ready[^.]*human boundary[^.]*user merges/i);
  expect(loaded).toMatch(/resumes[^.]*next message[^.]*`?\/axstack-watch`?/i);
  expect(loaded).toMatch(/done[^.]*every required PR[^.]*forge-merged[^.]*Close-out/i);
});

test('implement loop: close-out requires an Archived record with every step receipt', () => {
  expect(loaded).toMatch(/compact record[^.]*counts and denominators/i);
  expect(loaded).toMatch(
    /unavailable auditor leaves close-out pending, never skipped silently/i,
  );
  expect(loaded).toMatch(
    /settlement receipt[^.]*compact record path[^.]*auditor decision[^.]*settlement receipt[^.]*counts zero[^.]*release[^.]*ticket receipts[^.]*archive timestamp/i,
  );
  expect(loaded).toMatch(
    /`active`\/receipt-incomplete record[^.]*close-out pending[^.]*never done/i,
  );
  expect(loaded).not.toMatch(/`close-out pending`/i);
});
