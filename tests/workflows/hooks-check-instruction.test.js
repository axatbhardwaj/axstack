import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const skill = readFileSync(`${import.meta.dir}/../../skills/axstack-implement/SKILL.md`, 'utf8');
const section = skill.split(/^## 4\. /m)[1].split(/^## 5\. /m)[0].replace(/--no-verify/g, 'noverifyflag');
const prohibition = /\b(?:never|do not) (?:pass|use|override)\b/i;
const rules = [
  ['check before each commit',
    (text) => requires(text, /before (?:each|every) commit/i, /author|writer/i, /runs?|executes?/i,
      /hooks-check/i, /--repo/i),
    'The writer executes hooks-check with --repo before every commit.',
    [[/before/i, 'after'], [/runs?|executes?/i, 'skips']]],
  ['hook repair and recheck on hold',
    (text) => requires(text, /exit 2/i, /declared/i, /install (?:command|hooks)/i, /once/i, /rerun|run .* again/i,
      /hooks-check/i),
    'For exit 2, execute the declared install command once and run hooks-check again.',
    [[/once/i, 'repeatedly'], [/rerun|run .* again/i, 'skip']]],
  ['commit flags cannot bypass hooks',
    (text) => prohibits(text, prohibition, /commit/i, /noverifyflag/, /-n\b/),
    'For commits, do not pass -n or noverifyflag.',
    [[prohibition, 'may use']], [/noverifyflag/, /-n\b/]],
  ['hooks path cannot be overridden on commit',
    (text) => prohibits(text, prohibition, /commit/i, /core\.hooksPath/, /override/i),
    'Do not override core.hooksPath when committing.',
    [[/\b(?:never|do not) /i, 'always ']]],
];

for (const [name, accepts, rewording, inversions, concepts] of rules) {
  test(`implement hooks check: ${name}`, () => {
    checkRule(section, accepts, rewording, inversions, concepts);
  });
}

test('implement holds until a successful check and records the result', () => {
  expect(requires(section, /hooks-check/i, /exits? 0/i, /hold/i, /receipt/i)).toBe(true);
});
