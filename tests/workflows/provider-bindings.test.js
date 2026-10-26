import { test } from 'bun:test';
import { readSkillFile } from './skill-source.js';
import { checkRule, prohibits, requires } from './prose-contract.js';

const runtime = () => readSkillFile(`${import.meta.dir}/../../skills/axstack/references/t3-runtime.md`, 'utf8')
  .replace(/`/g, '').replace(/\s+/g, ' ');

test('every Claude and Codex dispatch binds directly to its single T3 instance', () => {
  const concepts = [/every dispatch or launch/i, /claude (?:must|shall) bind to claudeAgent\b/i,
    /codex (?:must|shall) bind to codex\b/i];
  checkRule(runtime(), (text) => requires(text, ...concepts),
    'At every dispatch or launch, codex shall bind to codex and claude shall bind to claudeAgent.',
    [[/claude (?:must|shall) bind to claudeAgent\b/i, 'claude must bind to claudeAlt'],
      [/codex (?:must|shall) bind to codex\b/i, 'codex must bind to codexAlt'],
      [/every dispatch or launch/i, 'selected dispatches']], concepts);
});

test('a usage-limited instance holds work without failover', () => {
  const concepts = [/usage-limited instance/i, /must hold the work/i];
  checkRule(runtime(), (text) => prohibits(text, /without failover/i, ...concepts),
    'Without failover, a usage-limited instance must hold the work.',
    [[/must hold the work/i, 'can continue the work'], [/without failover/i, 'with failover'],
      [/usage-limited instance/i, 'eligible instance']], concepts);
});
