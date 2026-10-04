import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { prohibits, requires, sentences } from './prose-contract.js';

const root = `${import.meta.dir}/../..`;
const audit = () => readFileSync(`${root}/skills/axstack-audit/SKILL.md`, 'utf8');
const routing = () => readFileSync(`${root}/skills/axstack/references/routing.md`, 'utf8');

// Declared prompt contracts, not proof of live compliance. Existing no-op
// coverage does not distinguish recurrence or protect the suggestion boundary.
const rules = [
  ['covered recurrence is not a no-op', audit,
    /(?:never classify|do not treat) (?:it|(?:the|any|a|each|every|that) rule) as an already-covered no-op/i,
    [/covered rule/i, /\b(?:recurs|recurred|repeats|repeated)\b/i, /already-covered no-op/i],
    0, 'classify it as an already-covered no-op', 'If a covered rule repeats, do not treat it as an already-covered no-op.'],
  ['record recurrence', audit, null, [/record|report/i, /recurrence/i, /as recurred/i],
    0, 'Ignore', 'Report that recurrence as recurred.'],
  ['suggest correct', audit, null, [/suggest|recommend/i, /axstack-correct/i, /recurrence/i],
    0, 'Omit', 'Recommend `axstack-correct` for the recurrence.'],
  ['audit does not run correct', audit, /\b(?:never runs?|do not invoke)\b/i,
    [/axstack-correct/i, /\baudit\b/i],
    0, 'Run', 'Do not invoke `axstack-correct` during audit.'],
  ['direct correct route', routing, null,
    [/(?:repeated|recurring|repeating) mistakes/i, /evidence/i, /stronger checks/i,
      /axstack-correct/i, /user-invoked|invoked by (?:the|a) user/i, /report only|report-only/i],
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

function checkRewording(text, rule, rewording = rule[6]) {
  const originals = (text.match(/[^\n]+(?:\n[ \t]+[^\n]+)*/g) ?? []).filter(acceptsRule(rule));
  expect(originals).toHaveLength(1);
  // Replace the actual instruction in the full source string, without writes.
  const reworded = text.replace(originals[0], rewording);
  for (const sibling of rules.filter((row) => row[1] === rule[1])) checkRule(reworded, sibling);
  return reworded;
}

for (const rule of rules) {
  const [name, source] = rule;
  test(`correct integration: ${name}`, () => checkRule(source(), rule));
  test(`correct integration real-source rewording: ${name}`, () => {
    const reworded = checkRewording(source(), rule);
    // Already-reworded source still satisfies the same contract.
    checkRewording(reworded, rule);
  });
}

const naturalRewordings = [
  ['covered recurrence is not a no-op', [
    'If any covered rule recurred, never classify the rule as an already-covered no-op.',
    'If a covered rule repeated, do not treat it as an already-covered no-op.',
  ]],
  ['record recurrence', ['Record each recurrence as recurred.']],
  ['suggest correct', ['Suggest `axstack-correct` for every recurrence.']],
  ['audit does not run correct', [
    'Never run the `axstack-correct` skill during audit.',
    'Audit never runs `axstack-correct`.',
  ]],
  ['direct correct route', [
    '- Repeating mistakes needing evidence and stronger checks -> `axstack-correct`: invoked by a user, report only.',
  ]],
];

for (const [name, rewordings] of naturalRewordings) {
  test(`correct integration natural real-source rewording: ${name}`, () => {
    const rule = rules.find(([ruleName]) => ruleName === name);
    for (const rewording of rewordings) {
      const reworded = checkRewording(rule[1](), rule, rewording);
      checkRewording(reworded, rule, rewording);
      checkRewording(reworded, rule);
    }
  });
}

const record = () => readFileSync(`${root}/skills/axstack-audit/references/record.md`, 'utf8');
const dispositionFields = [
  ['skill', audit, /6\. its disposition:[\s\S]*?(?=\n\n)/],
  ['record', record, /^Learning candidates:.*$/m],
];
const recurrenceOption = /\b(?:recurred|recurring)\s*\(([^)]+)\)/i;
const suggestion = /suggest|recommend/i;
const auditProhibition = /does not run|does not invoke|never runs|never invokes/i;

function acceptsDisposition(field) {
  const option = field.match(recurrenceOption)?.[1];
  return !!option && requires(option, suggestion, /axstack-correct/i)
    && prohibits(option, auditProhibition, /audit/i, /\bit\b/i);
}

function checkDisposition(text, fieldPattern) {
  const field = text.match(fieldPattern)?.[0] ?? '';
  expect(acceptsDisposition(field), 'disposition must represent recurrence safely').toBe(true);
  const option = field.match(recurrenceOption)[0];
  expect(acceptsDisposition(field.replace(option, '')), 'removal must be red').toBe(false);
  expect(acceptsDisposition(field.replace(/recurred|recurring/gi, 'already-covered no-op')), 'classification inversion').toBe(false);
  expect(acceptsDisposition(field.replace(new RegExp(suggestion.source, 'gi'), 'omit')), 'suggestion inversion').toBe(false);
  expect(acceptsDisposition(field.replace(new RegExp(auditProhibition.source, 'gi'), 'runs')), 'invocation inversion').toBe(false);
  return field;
}

function checkDispositionRewording(text, fieldPattern) {
  const field = checkDisposition(text, fieldPattern);
  const rewording = field.replace(recurrenceOption,
    'recurring (recommend axstack-correct; audit never invokes it)');
  const reworded = text.replace(field, rewording);
  checkDisposition(reworded, fieldPattern);
  return reworded;
}

for (const [name, source, fieldPattern] of dispositionFields) {
  test(`correct integration: ${name} recurrence disposition`, () => checkDisposition(source(), fieldPattern));
  test(`correct integration real-source rewording: ${name} recurrence disposition`, () => {
    const reworded = checkDispositionRewording(source(), fieldPattern);
    // Re-run substitution and probes when the source already uses this wording.
    checkDispositionRewording(reworded, fieldPattern);
    for (const sibling of rules.filter((rule) => rule[1] === source)) checkRule(reworded, sibling);
  });
}
