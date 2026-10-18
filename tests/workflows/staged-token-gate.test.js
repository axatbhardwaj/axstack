import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const skill = readFileSync(`${import.meta.dir}/../../skills/axstack-implement/SKILL.md`, 'utf8');
const gate = /staged[- ]file token (?:gate|check)/i;
const rules = [
  ['author runs before every commit',
    (text) => requires(text, gate, /author|writer/i, /runs?|executes?/i,
      /before (?:every|each) commit/i, /bun/i),
    'Before each commit, the writer executes the staged-file token check with Bun.',
    [[/before/i, 'after'], [/runs?|executes?/i, 'skips']]],
  ['failure requires splitting',
    (text) => requires(text, /gate|check/i, /fails?|failure/i, /split/i,
      /instructions|guidance/i, /before retrying|before another attempt/i),
    'If the check fails, split files using its guidance before another attempt.',
    [[/split/i, 'keep'], [/before/i, 'after']]],
  ['bypass forbidden',
    (text) => prohibits(text, /never bypass|do not bypass/i, gate),
    'Do not bypass the staged-file token check.',
    [[/never bypass|do not bypass/i, 'Allow bypass of']]],
  ['result recorded in receipt',
    (text) => requires(text, gate, /record|include/i, /result/i, /implementation receipt/i),
    'Include the staged-file token check result in the implementation receipt.',
    [[/record|include/i, 'Omit']]],
];

// Semantic instruction contracts: deletion/inversion red, paraphrase green.
for (const [name, accepts, rewording, inversions] of rules) {
  test(`writer token gate: ${name}`, () => {
    checkRule(sentences(skill).join('. '), accepts, rewording, inversions);
  });
}

test('writer gate links the packaged executable by relative path', () => {
  const target = skill.match(/\]\(([^)]+check-staged-file-tokens\.js)\)/)?.[1];
  expect(target?.startsWith('../')).toBe(true);
  expect(existsSync(`${import.meta.dir}/../../skills/axstack-implement/${target}`)).toBe(true);
});
