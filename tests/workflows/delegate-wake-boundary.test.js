import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const paths = ['axstack/references/t3-runtime.md', 'axstack/references/lifecycle.md',
  'axstack-implement/SKILL.md', 'axstack-watch/references/watch-runtime.md'];
const read = (path) => readFileSync(`${import.meta.dir}/../../skills/${path}`, 'utf8')
  .replace(/`/g, '').replace(/\s+/g, ' ');

for (const path of paths) {
  test(`R7c native delegate completion excludes scheduled polling: ${path}`, () => {
    const concepts = [/schedule|scheduled/i, /poll|status-check/i, /running delegate_task children/i];
    const ban = /never/i;
    checkRule(read(path), (text) => prohibits(text, ban, ...concepts),
      'Never status-check running delegate_task children on scheduled wakes.',
      [[/never/i, 'always']], concepts);
    expect(read(path)).not.toMatch(/(?:each wake|schedule|run watch)[^.]*reconcil\w* (?:all|every) unsettled (?:runs|dispatch attempt)/i);
  });
}

test('R7c launched fallback schedules remain five-minute responsibilities', () => {
  const source = read('axstack-watch/references/watch-runtime.md');
  const concepts = [/launched-fallback Writer/i, /without native completion/i,
    /5-minute lifecycle schedule/i, /everyMs:300000/i, /Driver-owned/i];
  checkRule(source, (text) => requires(text, ...concepts),
    'The Driver-owned 5-minute lifecycle schedule (everyMs:300000) covers a launched-fallback Writer without native completion.',
    [[/Driver-owned/i, 'recovery-owned']], concepts);
});

test('R7c native completion creates no schedule merely for delegate existence', () => {
  const concepts = [/create/i, /schedule/i, /merely because/i, /delegate_task children exist/i];
  checkRule(read('axstack/references/t3-runtime.md'), (text) => prohibits(text, /never/i, ...concepts),
    'Never create a schedule merely because delegate_task children exist.',
    [[/never/i, 'always']], concepts);
});

test('R7c only external checks may consolidate, never delegate polling', () => {
  const source = read('axstack-watch/references/watch-runtime.md');
  const concepts = [/only/i, /named external-dependency checks/i, /recovery/i,
    /after/i, /owners retire exact old IDs/i, /verify absence/i];
  checkRule(source, (text) => requires(text, ...concepts),
    'Only named external-dependency checks move to recovery after owners retire exact old IDs and verify absence.',
    [[/only/i, 'all including delegates']], concepts);
});
