import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (path) => readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replace(/`/g, '');
const record = 'skills/axstack/references/run-record.md';
const audit = 'skills/axstack-audit/SKILL.md';
const fields = [/dispatches/i, /review rounds/i, /spec revisions/i, /active time/i,
  /wait time/i, /driver tokens/i, /worker tokens/i];

// Agent-facing instruction contracts, not proof of live measurement accuracy.
for (const path of [record, audit]) {
  test(`${path}: every PR has all seven cost fields`, () => {
    checkRule(sentences(read(path)).join('. '),
      (text) => requires(text, /(?:one|each|every).*\bPR\b/i, /cost line/i, ...fields),
      'For each PR report a cost line with dispatches, review rounds, spec revisions, active time, wait time, driver tokens and worker tokens.',
      [[/cost line/i, 'optional cost summary']], fields);
  });

  test(`${path}: absent measurements remain unknown, never zero`, () => {
    const source = sentences(read(path)).join('. ');
    checkRule(source, (text) => requires(text, /missing cost values/i, /\bunknown\b/i),
      'Use unknown for missing cost values.', [[/\bunknown\b/i, 'zero']], [/missing cost values/i]);
    const ban = /never (?:replace|report) missing cost values (?:with|as) zero/i;
    checkRule(source, (text) => prohibits(text, ban),
      'Never report missing cost values as zero.', [[ban, 'Report missing cost values as zero']]);
  });

  test(`${path}: cost example exposes separate unknown defaults`, () => {
    const line = read(path).split('\n').find((row) => /^PR cost:/i.test(row)) ?? '';
    for (const field of fields) {
      expect(line).toMatch(new RegExp(`${field.source}: unknown`, 'i'));
      expect(line.replace(new RegExp(`${field.source}: unknown`, 'i'), '')).not.toMatch(field);
    }
  });
}

for (const [name, concepts, wording, inversion] of [
  ['dispatch boundary', [/dispatch/i, /counts one/i, /native task or launch/i],
    'A dispatch counts one native task or launch.', [/counts one/i, 'counts every message in each']],
  ['review boundary', [/review round/i, /counts one/i, /authored.review pass/i, /at one head/i],
    'Each review round counts one authored-review pass at one head.', [/authored.review pass/i, 'diligence receipt']],
]) {
  test(`cost: ${name}`, () => checkRule(sentences(read(record)).join('. '),
    (text) => requires(text, ...concepts), wording, [inversion], concepts));
}

test('audit: cost reporting cannot gate delivery', () => {
  const ban = /never gates? work/i;
  checkRule(sentences(read(audit)).join('. '), (text) => prohibits(text, ban, /cost/i),
    'Cost reporting never gates work.', [[ban, 'gates work']], [/cost/i]);
});

test('record: baseline pointer resolves to the backfilled document', () => {
  const source = read(record);
  const pointer = source.match(/^Cost baseline: (docs\/[^\s]+\.md)$/m);
  expect(pointer).toBeTruthy();
  const baseline = read(pointer[1]);
  expect(baseline).toMatch(/review.manager PRs.*excluded|exclude.*review.manager PRs/i);
});
