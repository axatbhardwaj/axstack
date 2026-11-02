import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, requires, sentences } from './prose-contract.js';
const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const publication = () => read('skills/axstack/references/candidate-publication.md');
const pins = [
  'Delegated reviewers inspect their own native detached checkout; tracked candidate files remain read-only and outputs go to their private evidence folder.',
  'After each delegated completion, compare the driver HEAD and `git status --porcelain` with their pre-dispatch values; any change holds advancement.',
  'Before removing a reviewer checkout, read back its report and supporting evidence, then use exact `git worktree remove <recorded-native-worktree-path>` without force.',
];
for (const pin of pins) test(`review checkout safety: ${pin}`, () => {
  expect(normalize(publication())).toContain(pin);
  expect(normalize(publication()).split(pin).length).toBe(2);
});
test('review isolation AC2 scenario binds each required safety rule', () => {
  const scenario = JSON.parse(read('tests/workflows/t3-recovery-scenarios.json')).cases.find(({ id }) => id === 'delegated-reviewer-isolation');
  expect(scenario.contracts.slice(-3)).toEqual(pins);
  for (const pin of pins) {
    expect(normalize(publication())).toContain(pin);
    expect(normalize(publication()).split(pin).length).toBe(2);
  }
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

for (const path of [
  'skills/axstack/references/t3-runtime.md',
  'skills/axstack/references/automations.md',
  'skills/axstack/references/candidate-publication.md',
  'skills/axstack-review/references/review-candidate.md',
]) test(`reviewers use native isolation and verify the candidate and base in ${path}`, () => {
  const text = sentences(read(path).replace(/`/g, '').replace(/\|\n/g, '|.\n')).join('. ');
  checkRule(text, (source) => requires(source, /reviewers/i, /native/i, /isolation:"worktree"/i),
    'Reviewers must use native isolation:"worktree".',
    [[/native/i, 'driver-made'], [/isolation:"worktree"/i, 'isolation:"shared"']], [/native/i]);
  checkRule(text, (source) => requires(source, /reviewers/i, /check out/i, /verif/i, /exact candidate SHA/i, /pinned base/i, /inside/i),
    'Reviewers must check out and verify the exact candidate SHA and pinned base inside their native worktree.',
    [[/verif\w*/i, 'assume'], [/inside/i, 'outside']], [/exact candidate SHA/i, /pinned base/i]);
  const obsolete = (source) => requires(source, /driver/i, /(?:creat|mak)\w*/i, /(?:review checkout|reviewers?)/i, /checkout/i)
    || /reviewers?[^.]*driver-made[^.]*checkout/i.test(source);
  expect(obsolete(text)).toBe(false);
  for (const old of [
    'The driver must create the review checkout with git worktree add --detach.',
    'Each reviewer uses a separate driver-made disposable detached checkout.',
    'Reviewers must use async delegate_task and the driver makes a disposable detached checkout of candidate SHA and pinned base.',
  ]) expect(obsolete(`${text} ${old}`)).toBe(true);
});
