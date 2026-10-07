import { test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../../skills/`;
const sources = [
  ['implement §5', () => readFileSync(`${root}axstack-implement/SKILL.md`, 'utf8').split('## 5. Verify and return the candidate\n')[1].split('\n## 6.')[0]],
  ['UI verification', () => readFileSync(`${root}axstack/references/ui-verification.md`, 'utf8')],
];
// AC18 guards both consumers. The generated-skill tests do not protect receipt
// suggestions, feature-file upkeep, or an existing acceptance obligation here.
const rules = [
  ['use present skill', [/use/i, /present/i, /verify-<app>/i, /skill/i, /affected behavior/i], 'Use a present verify-<app> skill for affected behavior.', [/use/gi, 'skip']],
  ['map upkeep', [/PR/i, /changes/i, /mapped feature/i, /author/i, /update/i, /feature file/i, /same PR/i], 'If a PR changes a mapped feature, its author updates the feature file in the same PR.', [/same PR/gi, 'later PR']],
  ['missing suggestion', [/missing/i, /skill/i, /add/i, /suggest/i, /axstack-verify create/i, /receipt/i, /Unverified:/i], 'For a missing skill, add suggest axstack-verify create to the receipt Unverified: line.', [/suggest/gi, 'automatically run']],
  ['no automatic generation', [/generate/i, /verification skill/i, /automatically/i], 'Never generate a verification skill automatically.', [/never/gi, 'Always'], /never/i],
  ['broken recipe gap', [/broken or stale/i, /recipe/i, /report/i, /gap/i], 'For a broken or stale recipe, report the gap.', [/report/gi, 'hide']],
  ['acceptance retained', [/broken or stale/i, /recipe/i, /waive/i, /existing acceptance obligations/i], 'Never let a broken or stale recipe waive existing acceptance obligations.', [/never/gi, 'Always'], /never/i],
  ['tool neutral', [/keep/i, /browser recipes/i, /tool-neutral/i, /verifier/i], 'Keep browser recipes tool-neutral for the verifier.', [/tool-neutral/gi, 'Playwright-only']],
];

for (const [owner, read] of sources) {
  for (const [name, concepts, rewording, inversion, prohibition] of rules) {
    test(`verify integration (${owner}): ${name}`, () => {
      const accepts = (text) => sentences(text).some((sentence) =>
        !/\b(?:unless|except)\b/i.test(sentence)
        && (prohibition ? prohibits(sentence, prohibition, ...concepts) : requires(sentence, ...concepts)));
      checkRule(sentences(read()).join('. '), accepts, rewording.replace(/\.$/, ''),
        [inversion, [/^/, 'Do not '], [/$/, ' unless convenient']], concepts);
    });
  }
}
