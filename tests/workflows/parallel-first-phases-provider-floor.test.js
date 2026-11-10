import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (phase) => readFileSync(
  `${import.meta.dir}/../../skills/axstack-${phase}/SKILL.md`, 'utf8',
).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');

// The residual floor also covers unnamed same-brief mixed work.
test('M3 every other mixed fanout keeps both providers with only scoped exceptions', () => {
  checkRule(read('research'), (text) => requires(text,
    /(?:every|all) other mixed fan.?outs?/i, /except|apart from|excluding/i,
    /same.binding (?:engineering )?writers/i, /distinct.brief nonwriter packages/i,
    /retain|require|must include/i, /at least one Codex/i, /one Claude/i, /hold/i),
  'All other mixed fanouts, excluding same-binding engineering writers and distinct-brief nonwriter packages, must include at least one Codex and one Claude seat, otherwise hold.',
  [[/retain(?:s)?|require(?:s)?|must include/ig, 'must not retain'],
    [/same.binding/ig, 'any-binding'], [/distinct.brief/ig, 'same-brief'],
    [/every|all/ig, 'only corroborating'], [/otherwise hold/i, 'otherwise proceed']],
  [/Codex/i, /Claude/i, /hold/i]);
});

test('M3 named corroborating teams retain their configured seats and floors', () => {
  checkRule(read('research'), (text) => requires(text,
    /research pairs/i, /arena judges/i, /peer first passes/i, /audit pairs/i,
    /retain|preserve/i, /configured seats/i, /provider floors/i),
  'Preserve configured seats and provider floors for research pairs, arena judges, peer first passes and audit pairs.',
  [[/retain|preserve/ig, 'discard']]);
});
