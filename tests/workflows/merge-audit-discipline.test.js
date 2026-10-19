import { readSkillFile as readFileSync } from './skill-source.js';
import { test } from 'bun:test';

import { checkRule, prohibits, requires } from './prose-contract.js';

// Separate contracts for the missing #251 clauses; existing merge-boundary,
// publication and strict-TDD tests remain the unchanged holdouts.
for (const [path, name, concepts, wording, inversion, negative] of [
  ['skills/axstack-watch/SKILL.md', 'head or base change refreshes all evidence',
    [/every head or base change/i, /refresh/i, /authored review/i, /diligence/i, /CI/i, /current head and base/i],
    'Every head or base change requires refreshed authored review, diligence and CI evidence at the current head and base.', [/every head or base change/i, 'only a code change']],
  ['skills/axstack-watch/SKILL.md', 'immutable executing scripts',
    [/edit/i, /running script/i, /freeze/i, /exact script bytes/i, /until exit/i],
    'Never edit a running script, freeze its exact script bytes until exit.', [/never edit/i, 'always edit'], /never edit/i],
  ['skills/axstack-watch/SKILL.md', 'each refusal has argv and evidence',
    [/each merge refusal/i, /record/i, /exact argv/i, /result/i, /head and base/i, /evidence pointer/i],
    'For each merge refusal record exact argv, result, head and base and an evidence pointer.', [/record/i, 'discard']],
  ['skills/axstack-watch/SKILL.md', 'pending CI is not failure',
    [/pending CI/i, /distinct from failed CI/i, /wait/i, /terminal check results/i, /before repair/i],
    'Keep pending CI distinct from failed CI and wait for terminal check results before repair.', [/distinct from failed CI/i, 'equivalent to failed CI']],
  ['skills/axstack-review/SKILL.md', 'missing test claims use whole files and actual CI',
    [/before/i, /claiming.*test.*missing.*CI/i, /inspect/i, /complete file/i, /actual CI step result/i],
    'Before claiming a test is missing from CI inspect the complete file and actual CI step result.', [/before/i, 'after']],
]) {
  test(`merge audit discipline: ${name}`, () => {
    const source = readFileSync(`${import.meta.dir}/../../${path}`, 'utf8').replace(/\s+/g, ' ');
    const accepts = (text) => negative ? prohibits(text, negative, ...concepts) : requires(text, ...concepts);
    checkRule(source, accepts, wording, [inversion], concepts);
  });
}
