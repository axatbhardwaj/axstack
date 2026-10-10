import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkRule, prohibits, requires } from './prose-contract.js';

const read = () => readFileSync(`${import.meta.dir}/../../skills/axstack-relay/SKILL.md`, 'utf8');

// Shipped authoring instructions only: no live wording or model-quality claim.
// Existing relay tests own wire identity, authority and Hermes forwarding.
const rules = [
  ['phone spacing', [/decision cards.*explain answers/i, /phone/i, /short paragraphs/i, /blank lines.*thoughts/i],
    'Decision cards and explain answers shall use short paragraphs with blank lines between thoughts for reading on a phone.'],
  ['plain vocabulary', [/decision cards.*explain answers/i, /ordinary|everyday/i, /words/i, /briefly define/i, /necessary technical terms/i],
    'Decision cards and explain answers shall use everyday words and briefly define necessary technical terms.'],
  ['decision context', [/each decision card/i, /what is happening/i, /why.*choice matters/i],
    'Each decision card shall describe what is happening and why the choice matters.'],
  ['option consequences', [/each numbered option/i, /concrete action/i, /scope/i, /outcome/i, /material trade.off/i],
    'Each numbered option shall give its concrete action, scope, expected outcome and material trade-off.'],
  ['withheld consequences', [/Defer.*Cancel/i, /withheld action/i, /what remains unresolved/i],
    'Defer and Cancel shall describe the withheld action and what remains unresolved.'],
  ['recommendation reason', [/recommendation/i, /brief/i, /evidence.supported reason/i],
    'Any recommendation shall include a brief evidence-supported reason.'],
  ['user choice', [/recommendation/i, /leave.*choice.*user/i],
    'A recommendation shall leave the choice with the user.'],
  ['answer confusion', [/explain answers/i, /directly address/i, /reader.*confusion/i],
    'Explain answers shall directly address the reader\'s confusion.'],
  ['explanation depth', [/explain answers/i, /expand/i, /meaningful context/i, /each option.*consequences/i],
    'Explain answers shall expand meaningful context and each option\'s consequences.'],
  ['supported advice', [/explain answers/i, /justified recommendation/i, /when evidence supports/i],
    'Explain answers shall offer a justified recommendation when evidence supports it.'],
  ['plain uncertainty', [/explain answers/i, /material risks/i, /unknown facts/i, /plainly/i],
    'Explain answers shall state material risks and unknown facts plainly.'],
];

for (const [name, concepts, rewording] of rules) {
  test(`relay readability: ${name} survives rewording and rejects removal or inversion`, () => {
    const required = [...concepts, /must|shall/i];
    checkRule(read().replace(/\s+/g, ' '), (text) => requires(text, ...required),
      rewording, [[/must|shall/i, 'must not']], required);
  });
}

test('relay readability: explain cannot merely restate revision identifiers', () => {
  const concepts = [/merely restate|only repeat/i, /IDs.*SHAs/i, /explain answer/i];
  const negative = /never/i;
  checkRule(read().replace(/\s+/g, ' '), (text) => prohibits(text, negative, ...concepts),
    'Never only repeat IDs or SHAs in an explain answer.', [[negative, 'Always']], concepts);
});

for (const label of ['3 Defer', '1 Confirm', '2 Cancel']) {
  test(`relay readability: ${label} example carries action and consequences`, () => {
    const rows = [...read().matchAll(/```text\n([\s\S]*?)\n```/g)]
      .flatMap((match) => match[1].split('\n'));
    const row = rows.find((line) => line.startsWith(`${label} - `)) ?? '';
    const concepts = [new RegExp(`^${label}`), /action/i, /scope/i,
      /outcome|expected result/i, /trade.off|material compromise/i];
    // Treat a template row as one thought; optional inclusion of Defer does
    // not make its detail fields optional when that choice is offered.
    checkRule(row.replace(/;/g, ','),
      (text) => requires(text.replace(/\(optional\)/g, ''), ...concepts),
      `${label} - <bound action and scope, expected result, material compromise>`,
      [[/action/i, 'skip action'], [/scope/i, 'skip scope'],
        [/outcome|expected result/i, 'skip outcome'],
        [/trade.off|material compromise/i, 'skip trade-off']], concepts);
  });
}

test('relay readability: card groups technical rows after context and numbered choices', () => {
  const layout = read().match(/```text\n([\s\S]*?)\n```/)[1].split('\n');
  const context = layout.findIndex((line) => line.startsWith('Context:'));
  const decision = layout.findIndex((line) => line.startsWith('Decision:'));
  const options = layout.flatMap((line, index) => /^[123] /.test(line) ? [index] : []);
  expect(context).toBeGreaterThan(1);
  expect(decision).toBeGreaterThan(context);
  expect(options).toHaveLength(3);
  expect(options[0]).toBeGreaterThan(decision);
  const rows = ['Driver environment: <value | not supplied>',
    'Execution machine: <value | not supplied>', 'Affected targets: <values | not supplied>',
    'Revision: <repo#PR @ full SHA | spec rev N sha256 | none>'];
  const start = layout.indexOf(rows[0]);
  expect(start).toBeGreaterThan(options.at(-1));
  expect(layout.slice(start, start + rows.length)).toEqual(rows);
  expect(layout[options[0] - 1]).toBe('');
  expect(layout[start - 1]).toBe('');
});
