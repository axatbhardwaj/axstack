import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const skill = readFileSync(`${import.meta.dir}/../../skills/axstack-implement/SKILL.md`, 'utf8');
const gate = /staged[- ]file (?:token|size) (?:gate|check)/i;
const rules = [
  ['author runs before every commit',
    (text) => requires(text, gate, /author|writer/i, /runs?|executes?/i,
      /before (?:every|each) commit/i, /bun/i),
    'Before each commit, the writer executes the staged-file token check with Bun.',
    [[/before/i, 'after'], [/runs?|executes?/i, 'skips']]],
  ['successful measurements are advisory',
    (text) => requires(text, /measurements?/i, /successful/i, /advisory/i, /exit 0/i, /20,?000 bytes/i),
    'Successful measurements above 20000 bytes are advisory and exit 0.',
    [[/advisory/i, 'blocking'], [/exit 0/i, 'exit 1']]],
  ['size alone never requires splitting',
    (text) => prohibits(text, /never require|do not require/i, /splitting|split files/i, /solely for size|size alone/i),
    'Do not require splitting solely for size.',
    [[/never require|do not require/i, 'Always require']]],
  ['size alone never requires user approval',
    (text) => prohibits(text, /never request|do not request/i, /user approval/i, /solely for file size|size alone/i),
    'Do not request user approval for size alone.',
    [[/never request|do not request/i, 'Always request']]],
  ['measurement errors remain failures',
    (text) => requires(text, /git/i, /read/i, /malformed.size/i, /unmerged.index/i, /errors/i, /fail/i, /nonzero exit/i),
    'Git, read, malformed-size and unmerged-index errors fail with a nonzero exit.',
    [[/fail/i, 'succeed'], [/nonzero exit/i, 'zero exit']]],
  ['structural review remains required',
    (text) => requires(text, /review/i, /file structure/i, /responsibilities/i, /advisory/i),
    'Review file structure and responsibilities when size is advisory.',
    [[/review/i, 'Skip reviewing']]],
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
