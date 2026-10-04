import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const audit = () => readFileSync(`${root}/skills/axstack-audit/SKILL.md`, 'utf8');
const routing = () => readFileSync(`${root}/skills/axstack/references/routing.md`, 'utf8');

// Declared prompt contracts, not proof of live compliance. Existing no-op
// coverage does not distinguish recurrence or protect the suggestion boundary.
const rules = [
  ['covered recurrence is not a no-op', audit, /(?:never classify|do not treat) it as an already-covered no-op/i,
    [/covered rule/i, /recurs|repeats/i, /already-covered no-op/i],
    0, 'classify it as an already-covered no-op', 'If a covered rule repeats, do not treat it as an already-covered no-op.'],
  ['record recurrence', audit, null, [/record|report/i, /recurrence/i, /as recurred/i],
    0, 'Ignore', 'Report that recurrence as recurred.'],
  ['suggest correct', audit, null, [/suggest|recommend/i, /axstack-correct/i, /recurrence/i],
    0, 'Omit', 'Recommend `axstack-correct` for the recurrence.'],
  ['audit does not run correct', audit, /never run|do not invoke/i,
    [/axstack-correct/i, /from audit|during audit/i],
    0, 'Run', 'Do not invoke `axstack-correct` during audit.'],
  ['direct correct route', routing, null,
    [/repeated mistakes|recurring mistakes/i, /evidence/i, /stronger checks/i,
      /axstack-correct/i, /user-invoked|invoked by the user/i, /report only|report-only/i],
    4, 'automatically invoked',
    '- Recurring mistakes needing evidence and stronger checks -> `axstack-correct`: invoked by the user, report-only.'],
];

const acceptsRule = ([, , negative, concepts]) => (text) => negative
  ? prohibits(text, negative, ...concepts) : requires(text, ...concepts);

function checkRule(text, rule) {
  const [, , negative, concepts, flipIndex, inverse] = rule;
  const accepts = acceptsRule(rule);
  expect(accepts(text), rule[0]).toBe(true);
  const clauses = sentences(text);
  const matching = clauses.filter(accepts);
  expect(matching).toHaveLength(1);
  const rewrite = (replacement) => clauses.map((clause) =>
    matching.includes(clause) ? replacement(clause) : clause).join('. ');
  expect(accepts(rewrite(() => '')), 'removal must be red').toBe(false);
  // Flip the entire accepted concept, not a narrower spelling.
  const flip = new RegExp((negative ?? concepts[flipIndex]).source, 'gi');
  expect(accepts(rewrite((clause) => clause.replace(flip, inverse))), 'inversion must be red').toBe(false);
  if (!negative) {
    expect(accepts(rewrite((clause) => `Do not ${clause}`)), 'negation must be red').toBe(false);
  }
}

for (const rule of rules) {
  const [name, source, , , , , rewording] = rule;
  test(`correct integration: ${name}`, () => checkRule(source(), rule));
  test(`correct integration real-source rewording: ${name}`, () => {
    const text = source();
    const originals = text.split('\n').filter(acceptsRule(rule));
    expect(originals).toHaveLength(1);
    // Replace the actual instruction in the full source string, without writes.
    const reworded = text.replace(originals[0], rewording);
    for (const sibling of rules.filter((row) => row[1] === source)) checkRule(reworded, sibling);
  });
}
