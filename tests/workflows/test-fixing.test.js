import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = (path) => readFileSync(new URL('../../skills/' + path, import.meta.url), 'utf8')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ');
const skill = read('axstack-test-fixing/SKILL.md');
const routing = read('axstack/references/routing.md');

const rules = [
  ['repair route', routing, [/repair/i, /existing/i, /tests/i, /axstack-test-fixing/i],
    'Route repair of existing weak tests to axstack-test-fixing.', [/axstack-test-fixing/i, 'axstack-review']],
  ['audit scope', skill, [/audit-only/i, /report-only/i],
    'Keep audit-only investigations report-only.', [/report-only/i, 'editable']],
  ['product diagnosis', skill, [/debug/i, /suspected product regressions/i],
    'Send suspected product regressions to Debug.', [/debug/i, 'Implement']],
  ['matched flake trials', skill, [/same/i, /trial count/i, /environment/i, /seed/i, /command/i, /compare/i, /failure counts/i],
    'Compare failure counts with the same command, environment, trial count and seed schedule.',
    [/same/i, 'unrelated']],
  ['CI equivalence', skill, [/moves|replaced/i, /remaining check/i, /runs/i, /failure/i, /fails/i, /gate/i],
    'If a test moves, verify the remaining check runs and its failure fails the gate.', [/fails/i, 'bypasses']],
  ['unverified replacement', skill, [/keep|retain/i, /original protection/i, /unverified/i],
    'Retain the original protection while the replacement is unverified.', [/keep|retain/i, 'discard']],
];

for (const [name, source, concepts, rewording, inversion] of rules) {
  test('test fixing: ' + name, () => {
    checkRule(source, (text) => requires(text, ...concepts), rewording, [inversion], concepts);
  });
}

test('test fixing: prohibit masking the failure', () => {
  const ban = /never|do not/i;
  const concepts = [/skips/i, /retries/i, /looser assertions/i, /pass/i];
  checkRule(skill, (text) => prohibits(text, ban, ...concepts),
    'Never add retries, skips, or looser assertions to make a test pass.', [[ban, 'Always']], concepts);
});
