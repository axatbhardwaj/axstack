import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const read = (phase) => readFileSync(
  `${import.meta.dir}/../../skills/axstack-${phase}/SKILL.md`, 'utf8',
).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// Enumerate the exception set: mere presence permits an extra exempt team.
const writers = 'same[- ]binding (?:engineering )?(?:writers|authors)';
const nonwriters = 'distinct[- ]brief non[- ]?writer packages';
const exemptions = new RegExp(`(?:except|apart from|excluding) (?:precisely |only )?(?:${writers} and ${nonwriters}|${nonwriters} and ${writers}),`, 'i');

for (const phase of ['research', 'improve']) {
  test(`M3 ${phase}: all residual mixed fanout retains both providers or holds`, () => {
    const source = read(phase);
    const accepts = (text) => requires(text,
      /(?:every|all) (?:other|remaining) mixed fan[- ]?outs?/i, exemptions,
      /retain|require|must include/i,
      /at least one (?:Codex and one Claude|Claude and one Codex)/i,
      /otherwise|else/i, /hold|block/i);
    checkRule(source, accepts,
      'All remaining mixed fanouts, excluding distinct-brief nonwriter packages and same-binding engineering authors, must include at least one Claude and one Codex seat, otherwise hold that fanout.',
      [[/retain(?:s)?|require(?:s)?|must include/ig, 'must not retain'],
        [/same.binding/ig, 'any-binding'], [/distinct.brief/ig, 'same-brief'],
        [/every|all/ig, 'only corroborating'], [/otherwise hold/i, 'otherwise proceed']],
      [/Codex/i, /Claude/i, /hold/i]);
    const floor = sentences(source).find(accepts);
    for (const extra of ['same-brief corroboration', 'reviewers', 'unnamed ad hoc teams']) {
      expect(accepts(source.replace(floor, floor.replace(exemptions,
        (set) => `${set.slice(0, -1)} and ${extra},`))), extra).toBe(false);
    }
  });
}

test('Improve decomposition preserves required research-pair corroboration', () => {
  checkRule(sentences(read('improve')).join('. '), (text) => prohibits(text, /never remove(?:s)?/i,
    /required research.pair corroboration/i),
  'These exceptions never remove required research-pair corroboration.',
  [[/never remove(?:s)?/i, 'always remove']], [/required/i, /research.pair/i]);
});

test('M3 named corroborating teams retain their configured seats and floors', () => {
  checkRule(read('research'), (text) => requires(text,
    /research pairs/i, /arena judges/i, /peer first passes/i, /audit pairs/i,
    /retain|preserve/i, /configured seats/i, /provider floors/i),
  'Preserve configured seats and provider floors for research pairs, arena judges, peer first passes and audit pairs.',
  [[/retain|preserve/ig, 'discard']]);
});
