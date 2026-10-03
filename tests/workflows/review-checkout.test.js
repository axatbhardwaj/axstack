import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { requires, sentences } from './prose-contract.js';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const publication = () => read('skills/axstack/references/candidate-publication.md');
const pins = [
  'The driver creates the immutable review checkout with `git worktree add --detach <run>/checkouts/<key> <sha>` at the confirmed candidate SHA and pinned base.',
  'Delegated reviewers must `cd` into their separate detached checkout; tracked candidate files remain read-only and outputs go to their private evidence folder.',
  'After each delegated completion, compare the driver HEAD and `git status --porcelain` with their pre-dispatch values; any change holds advancement.',
  'Before removing a reviewer checkout, read back its report and supporting evidence, then use exact `git worktree remove <run>/checkouts/<key>` without force.',
];
for (const pin of pins) test(`review checkout safety: ${pin}`, () => {
  expect(normalize(publication())).toContain(pin);
  expect(normalize(publication()).replace(pin, '')).not.toContain(pin);
  expect(normalize(publication()).replace(pin, pin.replace(/^\S+/, '$& not'))).not.toContain(pin);
});
test('review isolation AC2 scenario binds each required safety rule', () => {
  const scenario = JSON.parse(read('tests/workflows/t3-recovery-scenarios.json')).cases.find(({ id }) => id === 'delegated-reviewer-isolation');
  expect(scenario.contracts).toEqual(pins);
  for (const pin of scenario.contracts) expect(normalize(publication())).toContain(pin);
  expect(scenario.expected.action).toContain('Hold');
});
test('later reviews use a fresh checkout', () => {
  const concepts = [/later review/i, /fresh/i, /checkout/i];
  expect(requires(publication(), ...concepts)).toBe(true);
  const holdout = 'A fresh checkout is required for each later review.';
  expect(requires(holdout, ...concepts)).toBe(true);
  expect(requires(`Do not ${holdout}`, ...concepts)).toBe(false);
  const clauses = sentences(publication());
  const matching = clauses.filter((clause) => requires(clause, ...concepts));
  expect(requires(clauses.filter((clause) => !matching.includes(clause)).join('. '), ...concepts)).toBe(false);
  expect(requires(clauses.map((clause) => matching.includes(clause) ? `Do not ${clause}` : clause).join('. '), ...concepts)).toBe(false);
});
