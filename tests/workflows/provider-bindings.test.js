import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readSkillFile } from './skill-source.js';
import { checkRule, prohibits, requires } from './prose-contract.js';

const runtime = () => readSkillFile(`${import.meta.dir}/../../skills/axstack/references/t3-runtime.md`, 'utf8')
  .replace(/`/g, '').replace(/\s+/g, ' ');

test('every dispatch and launch takes its binding from dispatch-plan output', () => {
  const verb = /\b(?:takes?|uses?|comes?|cop(?:y|ies))\b/i;
  const concepts = [/\b(?:every|each|all)\b/i, /dispatch(?:es)?\b(?!-plan)/i, /launch(?:es)?/i,
    /bindings?/i, verb, /from dispatch-plan(?:\.js)? output/i];
  for (const rewording of [
    'All launches and dispatches use bindings from dispatch-plan output.',
    'Bindings for every dispatch and launch come from dispatch-plan output.',
    'Every dispatch or launch copies its binding from dispatch-plan output.',
  ]) {
    checkRule(runtime(), (text) => requires(text, ...concepts), rewording,
      [[/\b(?:every|each|all)\b/i, 'selected'],
        [/\bdispatch(?:es)?(?!-plan)(?: or)?/i, ''],
        [verb, 'must not use'],
        [/from dispatch-plan(?:\.js)? output/i, 'from hand-built payloads']], concepts);
  }
});

test('runtime provider-binding pointer resolves to its code owner without duplicated prose', () => {
  const text = runtime();
  const pointers = [...text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
    .filter(([, , target]) => target === '../scripts/resolve-models.js');
  expect(pointers).toHaveLength(1);
  const [, label, target] = pointers[0];
  expect(label).toMatch(/provider.*binding|binding.*provider/i);
  const owner = readFileSync(`${import.meta.dir}/../../skills/axstack/references/${target}`, 'utf8');
  expect(owner).toMatch(/\bbindings\b/);
  expect(text).not.toMatch(
    /\b(?:codex|claude|grok)\s*(?:→|(?:must bind to|shall bind to|maps? to|to)\s+)\s*(?:codex|claudeAgent|grok)\b/i,
  );
});

test('a usage-limited instance holds work without failover', () => {
  const concepts = [/usage-limited instance/i, /must hold the work/i];
  checkRule(runtime(), (text) => prohibits(text, /without failover/i, ...concepts),
    'Without failover, a usage-limited instance must hold the work.',
    [[/must hold the work/i, 'can continue the work'], [/without failover/i, 'with failover'],
      [/usage-limited instance/i, 'eligible instance']], concepts);
});
